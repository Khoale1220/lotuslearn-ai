"""Tests for deterministic LotusLearn metadata governance policy."""

from __future__ import annotations

import hashlib
import json

import pytest

from lotuslearn_pipeline.metadata_drift import (
    MetadataChange,
    MetadataChangeKind,
    MetadataChangeSeverity,
    MetadataDiff,
    MetadataEntityType,
)
from lotuslearn_pipeline.metadata_policy import (
    POLICY_ID,
    POLICY_VERSION,
    MetadataGovernanceError,
    MetadataGovernanceStatus,
    MetadataPolicyRule,
    evaluate_metadata_governance,
)


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _comparison_id(
    baseline_checksum: str,
    current_checksum: str,
) -> str:
    payload = {
        "baseline_checksum": baseline_checksum,
        "current_checksum": current_checksum,
    }

    canonical = json.dumps(
        payload,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
    )

    return hashlib.sha256(
        canonical.encode("utf-8")
    ).hexdigest()


def _change(
    *,
    label: str,
    severity: MetadataChangeSeverity,
    kind: MetadataChangeKind,
    entity_type: MetadataEntityType = MetadataEntityType.ASSET,
    asset_id: str | None = None,
    field_name: str | None = None,
    related_asset_ids: tuple[str, ...] = (),
    changed_properties: tuple[str, ...] = ("test_property",),
) -> MetadataChange:
    return MetadataChange(
        change_id=_sha256(f"change:{label}"),
        entity_id=_sha256(f"entity:{label}"),
        entity_type=entity_type,
        kind=kind,
        severity=severity,
        asset_id=asset_id,
        field_name=field_name,
        related_asset_ids=related_asset_ids,
        changed_properties=changed_properties,
    )


def _metadata_diff(
    *,
    changes: tuple[MetadataChange, ...] = (),
    directly_changed_assets: tuple[str, ...] | None = None,
    downstream_impacted_assets: tuple[str, ...] = (),
    baseline_checksum: str | None = None,
    current_checksum: str | None = None,
    comparison_id: str | None = None,
) -> MetadataDiff:
    baseline = baseline_checksum or _sha256("baseline")
    current = current_checksum or _sha256("current")

    if directly_changed_assets is None:
        directly_changed_assets = tuple(
            sorted(
                {
                    change.asset_id
                    for change in changes
                    if change.asset_id is not None
                }
            )
        )

    expected_comparison_id = _comparison_id(
        baseline,
        current,
    )

    return MetadataDiff(
        comparison_id=comparison_id or expected_comparison_id,
        baseline_checksum=baseline,
        current_checksum=current,
        changes=changes,
        directly_changed_assets=directly_changed_assets,
        downstream_impacted_assets=downstream_impacted_assets,
    )


def test_empty_diff_passes() -> None:
    metadata_diff = _metadata_diff()

    decision = evaluate_metadata_governance(metadata_diff)

    assert decision.status == MetadataGovernanceStatus.PASS
    assert decision.change_count == 0
    assert decision.breaking_change_count == 0
    assert decision.review_required_change_count == 0
    assert decision.non_breaking_change_count == 0
    assert decision.metadata_only_change_count == 0
    assert decision.violations == ()
    assert decision.policy_id == POLICY_ID
    assert decision.policy_version == POLICY_VERSION


def test_non_breaking_change_passes() -> None:
    asset_id = _sha256("asset:orders")

    change = _change(
        label="asset-added",
        severity=MetadataChangeSeverity.NON_BREAKING,
        kind=MetadataChangeKind.ASSET_ADDED,
        asset_id=asset_id,
    )

    decision = evaluate_metadata_governance(
        _metadata_diff(changes=(change,))
    )

    assert decision.status == MetadataGovernanceStatus.PASS
    assert decision.change_count == 1
    assert decision.non_breaking_change_count == 1
    assert decision.violations == ()


def test_metadata_only_change_passes() -> None:
    asset_id = _sha256("asset:customers")

    change = _change(
        label="description-change",
        severity=MetadataChangeSeverity.METADATA_ONLY,
        kind=MetadataChangeKind.ASSET_DESCRIPTION_CHANGED,
        asset_id=asset_id,
    )

    decision = evaluate_metadata_governance(
        _metadata_diff(changes=(change,))
    )

    assert decision.status == MetadataGovernanceStatus.PASS
    assert decision.metadata_only_change_count == 1
    assert decision.violations == ()


def test_review_required_change_requires_review() -> None:
    asset_id = _sha256("asset:payments")

    change = _change(
        label="constraint-added",
        severity=MetadataChangeSeverity.REVIEW_REQUIRED,
        kind=MetadataChangeKind.CONSTRAINT_ADDED,
        entity_type=MetadataEntityType.CONSTRAINT,
        asset_id=asset_id,
    )

    decision = evaluate_metadata_governance(
        _metadata_diff(changes=(change,))
    )

    assert decision.status == MetadataGovernanceStatus.REVIEW
    assert decision.review_required_change_count == 1
    assert len(decision.violations) == 1

    violation = decision.violations[0]

    assert (
        violation.rule
        == MetadataPolicyRule.REVIEW_REQUIRED_CHANGE
    )
    assert violation.status == MetadataGovernanceStatus.REVIEW
    assert violation.change_id == change.change_id
    assert violation.entity_id == change.entity_id
    assert violation.asset_id == asset_id


def test_breaking_change_blocks() -> None:
    asset_id = _sha256("asset:users")

    change = _change(
        label="field-removed",
        severity=MetadataChangeSeverity.BREAKING,
        kind=MetadataChangeKind.FIELD_REMOVED,
        entity_type=MetadataEntityType.FIELD,
        asset_id=asset_id,
        field_name="email",
    )

    decision = evaluate_metadata_governance(
        _metadata_diff(changes=(change,))
    )

    assert decision.status == MetadataGovernanceStatus.BLOCK
    assert decision.breaking_change_count == 1
    assert len(decision.violations) == 1

    violation = decision.violations[0]

    assert violation.rule == MetadataPolicyRule.BREAKING_CHANGE
    assert violation.status == MetadataGovernanceStatus.BLOCK
    assert violation.field_name == "email"


def test_block_takes_precedence_over_review() -> None:
    breaking_asset = _sha256("asset:breaking")
    review_asset = _sha256("asset:review")

    breaking_change = _change(
        label="breaking",
        severity=MetadataChangeSeverity.BREAKING,
        kind=MetadataChangeKind.FIELD_REMOVED,
        entity_type=MetadataEntityType.FIELD,
        asset_id=breaking_asset,
        field_name="legacy_id",
    )

    review_change = _change(
        label="review",
        severity=MetadataChangeSeverity.REVIEW_REQUIRED,
        kind=MetadataChangeKind.CONSTRAINT_ADDED,
        entity_type=MetadataEntityType.CONSTRAINT,
        asset_id=review_asset,
    )

    decision = evaluate_metadata_governance(
        _metadata_diff(
            changes=(
                review_change,
                breaking_change,
            )
        )
    )

    assert decision.status == MetadataGovernanceStatus.BLOCK
    assert decision.breaking_change_count == 1
    assert decision.review_required_change_count == 1
    assert len(decision.violations) == 2

    assert (
        decision.violations[0].status
        == MetadataGovernanceStatus.BLOCK
    )
    assert (
        decision.violations[1].status
        == MetadataGovernanceStatus.REVIEW
    )


def test_all_severity_counts_are_reported() -> None:
    breaking_asset = _sha256("asset:count-breaking")
    review_asset = _sha256("asset:count-review")
    safe_asset = _sha256("asset:count-safe")
    metadata_asset = _sha256("asset:count-metadata")

    changes = (
        _change(
            label="count-breaking",
            severity=MetadataChangeSeverity.BREAKING,
            kind=MetadataChangeKind.FIELD_REMOVED,
            entity_type=MetadataEntityType.FIELD,
            asset_id=breaking_asset,
            field_name="old_column",
        ),
        _change(
            label="count-review",
            severity=MetadataChangeSeverity.REVIEW_REQUIRED,
            kind=MetadataChangeKind.CONSTRAINT_ADDED,
            entity_type=MetadataEntityType.CONSTRAINT,
            asset_id=review_asset,
        ),
        _change(
            label="count-safe",
            severity=MetadataChangeSeverity.NON_BREAKING,
            kind=MetadataChangeKind.ASSET_ADDED,
            asset_id=safe_asset,
        ),
        _change(
            label="count-metadata",
            severity=MetadataChangeSeverity.METADATA_ONLY,
            kind=MetadataChangeKind.ASSET_DESCRIPTION_CHANGED,
            asset_id=metadata_asset,
        ),
    )

    decision = evaluate_metadata_governance(
        _metadata_diff(changes=changes)
    )

    assert decision.change_count == 4
    assert decision.breaking_change_count == 1
    assert decision.review_required_change_count == 1
    assert decision.non_breaking_change_count == 1
    assert decision.metadata_only_change_count == 1
    assert decision.status == MetadataGovernanceStatus.BLOCK


def test_downstream_impact_does_not_escalate_non_breaking_change() -> None:
    direct_asset = _sha256("asset:direct")
    downstream_asset_1 = _sha256("asset:downstream-1")
    downstream_asset_2 = _sha256("asset:downstream-2")

    downstream_assets = tuple(
        sorted(
            (
                downstream_asset_1,
                downstream_asset_2,
            )
        )
    )

    change = _change(
        label="non-breaking-with-downstream",
        severity=MetadataChangeSeverity.NON_BREAKING,
        kind=MetadataChangeKind.ASSET_ADDED,
        asset_id=direct_asset,
    )

    decision = evaluate_metadata_governance(
        _metadata_diff(
            changes=(change,),
            downstream_impacted_assets=downstream_assets,
        )
    )

    assert decision.status == MetadataGovernanceStatus.PASS
    assert decision.violations == ()
    assert (
        decision.downstream_impacted_assets
        == downstream_assets
    )


def test_review_violation_retains_downstream_impact_count() -> None:
    direct_asset = _sha256("asset:review-direct")
    downstream_asset_1 = _sha256(
        "asset:review-downstream-1"
    )
    downstream_asset_2 = _sha256(
        "asset:review-downstream-2"
    )
    downstream_asset_3 = _sha256(
        "asset:review-downstream-3"
    )

    downstream_assets = tuple(
        sorted(
            (
                downstream_asset_1,
                downstream_asset_2,
                downstream_asset_3,
            )
        )
    )

    change = _change(
        label="review-impact",
        severity=MetadataChangeSeverity.REVIEW_REQUIRED,
        kind=MetadataChangeKind.LINEAGE_EDGE_REMOVED,
        entity_type=MetadataEntityType.LINEAGE_EDGE,
        asset_id=direct_asset,
    )

    decision = evaluate_metadata_governance(
        _metadata_diff(
            changes=(change,),
            downstream_impacted_assets=downstream_assets,
        )
    )

    assert decision.status == MetadataGovernanceStatus.REVIEW
    assert len(decision.violations) == 1
    assert (
        decision.violations[0].downstream_impact_count
        == 3
    )
    assert (
        decision.downstream_impacted_assets
        == downstream_assets
    )


def test_decision_is_deterministic_for_same_input() -> None:
    asset_id = _sha256("asset:deterministic")

    change = _change(
        label="deterministic",
        severity=MetadataChangeSeverity.BREAKING,
        kind=MetadataChangeKind.ASSET_REMOVED,
        asset_id=asset_id,
    )

    metadata_diff = _metadata_diff(
        changes=(change,)
    )

    first = evaluate_metadata_governance(metadata_diff)
    second = evaluate_metadata_governance(metadata_diff)

    assert first == second
    assert first.decision_id == second.decision_id
    assert first.to_dict() == second.to_dict()


def test_violation_id_is_deterministic() -> None:
    asset_id = _sha256(
        "asset:violation-determinism"
    )

    change = _change(
        label="violation-determinism",
        severity=MetadataChangeSeverity.BREAKING,
        kind=MetadataChangeKind.FIELD_TYPE_CHANGED,
        entity_type=MetadataEntityType.FIELD,
        asset_id=asset_id,
        field_name="amount",
    )

    metadata_diff = _metadata_diff(
        changes=(change,)
    )

    first = evaluate_metadata_governance(metadata_diff)
    second = evaluate_metadata_governance(metadata_diff)

    assert (
        first.violations[0].violation_id
        == second.violations[0].violation_id
    )


def test_invalid_comparison_id_is_rejected() -> None:
    metadata_diff = _metadata_diff(
        comparison_id=_sha256(
            "incorrect-comparison-id"
        ),
    )

    with pytest.raises(
        MetadataGovernanceError,
        match="comparison identifier failed verification",
    ):
        evaluate_metadata_governance(metadata_diff)


def test_duplicate_change_ids_are_rejected() -> None:
    first_asset = _sha256(
        "asset:duplicate-change-first"
    )
    second_asset = _sha256(
        "asset:duplicate-change-second"
    )
    duplicate_change_id = _sha256(
        "duplicate-change-id"
    )

    first = MetadataChange(
        change_id=duplicate_change_id,
        entity_id=_sha256(
            "entity:duplicate-first"
        ),
        entity_type=MetadataEntityType.ASSET,
        kind=MetadataChangeKind.ASSET_ADDED,
        severity=MetadataChangeSeverity.NON_BREAKING,
        asset_id=first_asset,
        changed_properties=("asset",),
    )

    second = MetadataChange(
        change_id=duplicate_change_id,
        entity_id=_sha256(
            "entity:duplicate-second"
        ),
        entity_type=MetadataEntityType.ASSET,
        kind=MetadataChangeKind.ASSET_ADDED,
        severity=MetadataChangeSeverity.NON_BREAKING,
        asset_id=second_asset,
        changed_properties=("asset",),
    )

    metadata_diff = _metadata_diff(
        changes=(first, second),
    )

    with pytest.raises(
        MetadataGovernanceError,
        match="duplicate change identifiers",
    ):
        evaluate_metadata_governance(metadata_diff)


def test_missing_direct_asset_evidence_is_rejected() -> None:
    asset_id = _sha256(
        "asset:missing-direct"
    )

    change = _change(
        label="missing-direct",
        severity=MetadataChangeSeverity.NON_BREAKING,
        kind=MetadataChangeKind.ASSET_ADDED,
        asset_id=asset_id,
    )

    metadata_diff = _metadata_diff(
        changes=(change,),
        directly_changed_assets=(),
    )

    with pytest.raises(
        MetadataGovernanceError,
        match="missing directly changed asset evidence",
    ):
        evaluate_metadata_governance(metadata_diff)


def test_direct_and_downstream_asset_overlap_is_rejected() -> None:
    asset_id = _sha256(
        "asset:overlap"
    )

    change = _change(
        label="overlap",
        severity=MetadataChangeSeverity.NON_BREAKING,
        kind=MetadataChangeKind.ASSET_ADDED,
        asset_id=asset_id,
    )

    metadata_diff = _metadata_diff(
        changes=(change,),
        directly_changed_assets=(asset_id,),
        downstream_impacted_assets=(asset_id,),
    )

    with pytest.raises(
        MetadataGovernanceError,
        match="overlapping direct and downstream assets",
    ):
        evaluate_metadata_governance(metadata_diff)


def test_invalid_asset_identifier_is_rejected() -> None:
    invalid_asset_id = "raw.database.customer_table"

    change = _change(
        label="invalid-asset-id",
        severity=MetadataChangeSeverity.BREAKING,
        kind=MetadataChangeKind.ASSET_REMOVED,
        asset_id=invalid_asset_id,
    )

    metadata_diff = _metadata_diff(
        changes=(change,),
        directly_changed_assets=(invalid_asset_id,),
    )

    with pytest.raises(
        MetadataGovernanceError,
        match="invalid asset identifier",
    ):
        evaluate_metadata_governance(metadata_diff)


def test_duplicate_related_asset_ids_are_rejected() -> None:
    asset_id = _sha256(
        "asset:lineage-target"
    )
    related_asset = _sha256(
        "asset:lineage-source"
    )

    change = _change(
        label="duplicate-related-assets",
        severity=MetadataChangeSeverity.REVIEW_REQUIRED,
        kind=MetadataChangeKind.LINEAGE_EDGE_REMOVED,
        entity_type=MetadataEntityType.LINEAGE_EDGE,
        asset_id=asset_id,
        related_asset_ids=(
            related_asset,
            related_asset,
        ),
    )

    metadata_diff = _metadata_diff(
        changes=(change,)
    )

    with pytest.raises(
        MetadataGovernanceError,
        match="duplicate related asset identifiers",
    ):
        evaluate_metadata_governance(metadata_diff)


def test_duplicate_changed_properties_are_rejected() -> None:
    asset_id = _sha256(
        "asset:duplicate-properties"
    )

    change = _change(
        label="duplicate-properties",
        severity=MetadataChangeSeverity.REVIEW_REQUIRED,
        kind=MetadataChangeKind.CONSTRAINT_MODIFIED,
        entity_type=MetadataEntityType.CONSTRAINT,
        asset_id=asset_id,
        changed_properties=(
            "referenced_fields",
            "referenced_fields",
        ),
    )

    metadata_diff = _metadata_diff(
        changes=(change,)
    )

    with pytest.raises(
        MetadataGovernanceError,
        match="duplicate changed properties",
    ):
        evaluate_metadata_governance(metadata_diff)


def test_serialized_decision_contains_stable_policy_identity() -> None:
    asset_id = _sha256(
        "asset:serialized-policy"
    )

    change = _change(
        label="serialized-policy",
        severity=MetadataChangeSeverity.REVIEW_REQUIRED,
        kind=MetadataChangeKind.OWNER_CHANGED,
        asset_id=asset_id,
    )

    decision = evaluate_metadata_governance(
        _metadata_diff(changes=(change,))
    )

    payload = decision.to_dict()

    assert (
        payload["policy_id"]
        == "lotuslearn.metadata.compatibility"
    )
    assert payload["policy_version"] == "1.0.0"
    assert payload["status"] == "REVIEW"
    assert payload["change_count"] == 1
    assert len(payload["violations"]) == 1
    assert (
        payload["violations"][0]["rule_id"]
        == "LL-META-002"
    )
