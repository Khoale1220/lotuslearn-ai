"""Deterministic governance decisions for LotusLearn metadata drift.

This module consumes an already validated MetadataDiff and converts semantic
metadata changes into an explicit governance decision.

The policy is intentionally separate from metadata extraction, drift detection,
history persistence, CI execution, and database access. It is a pure,
deterministic decision layer suitable for local validation and CI enforcement.

Policy v1 follows a conservative rule set:

- BREAKING changes block promotion.
- REVIEW_REQUIRED changes require human review.
- NON_BREAKING and METADATA_ONLY changes pass automatically.
- Downstream lineage impact is retained as decision evidence but does not,
  by itself, escalate a non-breaking change into a review or block.

The policy does not claim universal producer/consumer compatibility.
"""

from __future__ import annotations

import hashlib
import json
import re
from collections import Counter
from dataclasses import dataclass
from enum import Enum
from typing import Any, Optional

from lotuslearn_pipeline.metadata_drift import (
    MetadataChange,
    MetadataChangeKind,
    MetadataChangeSeverity,
    MetadataDiff,
    MetadataEntityType,
)

POLICY_ID = "lotuslearn.metadata.compatibility"
POLICY_VERSION = "1.0.0"

_HEX_SHA256 = re.compile(r"^[0-9a-f]{64}$")


class MetadataGovernanceError(ValueError):
    """Raised when governance input violates the policy-engine contract."""


class MetadataGovernanceStatus(str, Enum):
    PASS = "PASS"
    REVIEW = "REVIEW"
    BLOCK = "BLOCK"


class MetadataPolicyRule(str, Enum):
    BREAKING_CHANGE = "LL-META-001"
    REVIEW_REQUIRED_CHANGE = "LL-META-002"


_STATUS_RANK = {
    MetadataGovernanceStatus.BLOCK: 0,
    MetadataGovernanceStatus.REVIEW: 1,
    MetadataGovernanceStatus.PASS: 2,
}

_SEVERITY_RANK = {
    MetadataChangeSeverity.BREAKING: 0,
    MetadataChangeSeverity.REVIEW_REQUIRED: 1,
    MetadataChangeSeverity.NON_BREAKING: 2,
    MetadataChangeSeverity.METADATA_ONLY: 3,
}

_ENTITY_RANK = {
    MetadataEntityType.ASSET: 0,
    MetadataEntityType.FIELD: 1,
    MetadataEntityType.CONSTRAINT: 2,
    MetadataEntityType.LINEAGE_EDGE: 3,
}


@dataclass(frozen=True)
class MetadataPolicyViolation:
    """One deterministic, privacy-safe governance finding."""

    violation_id: str
    rule: MetadataPolicyRule
    status: MetadataGovernanceStatus
    change_id: str
    entity_id: str
    entity_type: MetadataEntityType
    kind: MetadataChangeKind
    severity: MetadataChangeSeverity
    asset_id: Optional[str] = None
    field_name: Optional[str] = None
    downstream_impact_count: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "violation_id": self.violation_id,
            "rule_id": self.rule.value,
            "status": self.status.value,
            "change_id": self.change_id,
            "entity_id": self.entity_id,
            "entity_type": self.entity_type.value,
            "kind": self.kind.value,
            "severity": self.severity.value,
            "asset_id": self.asset_id,
            "field_name": self.field_name,
            "downstream_impact_count": self.downstream_impact_count,
        }


@dataclass(frozen=True)
class MetadataGovernanceDecision:
    """Deterministic governance result for one metadata comparison."""

    decision_id: str
    policy_id: str
    policy_version: str
    status: MetadataGovernanceStatus
    comparison_id: str
    baseline_checksum: str
    current_checksum: str
    change_count: int
    breaking_change_count: int
    review_required_change_count: int
    non_breaking_change_count: int
    metadata_only_change_count: int
    directly_changed_assets: tuple[str, ...]
    downstream_impacted_assets: tuple[str, ...]
    violations: tuple[MetadataPolicyViolation, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "decision_id": self.decision_id,
            "policy_id": self.policy_id,
            "policy_version": self.policy_version,
            "status": self.status.value,
            "comparison_id": self.comparison_id,
            "baseline_checksum": self.baseline_checksum,
            "current_checksum": self.current_checksum,
            "change_count": self.change_count,
            "breaking_change_count": self.breaking_change_count,
            "review_required_change_count": self.review_required_change_count,
            "non_breaking_change_count": self.non_breaking_change_count,
            "metadata_only_change_count": self.metadata_only_change_count,
            "directly_changed_assets": list(self.directly_changed_assets),
            "downstream_impacted_assets": list(
                self.downstream_impacted_assets
            ),
            "violations": [
                violation.to_dict()
                for violation in self.violations
            ],
        }


def _canonical_json(value: Any) -> str:
    return json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
    )


def _digest(value: Any) -> str:
    return hashlib.sha256(
        _canonical_json(value).encode("utf-8")
    ).hexdigest()


def _is_sha256(value: Any) -> bool:
    return (
        isinstance(value, str)
        and _HEX_SHA256.fullmatch(value) is not None
    )


def _validate_safe_asset_id(value: Any) -> bool:
    return value is None or _is_sha256(value)


def _expected_comparison_id(metadata_diff: MetadataDiff) -> str:
    return _digest(
        {
            "baseline_checksum": metadata_diff.baseline_checksum,
            "current_checksum": metadata_diff.current_checksum,
        }
    )


def _validate_change(change: MetadataChange) -> None:
    if not isinstance(change, MetadataChange):
        raise MetadataGovernanceError(
            "Metadata governance input contains an invalid change record"
        )

    if not _is_sha256(change.change_id):
        raise MetadataGovernanceError(
            "Metadata governance input contains an invalid change identifier"
        )

    if not _is_sha256(change.entity_id):
        raise MetadataGovernanceError(
            "Metadata governance input contains an invalid entity identifier"
        )

    if not isinstance(change.entity_type, MetadataEntityType):
        raise MetadataGovernanceError(
            "Metadata governance input contains an invalid entity type"
        )

    if not isinstance(change.kind, MetadataChangeKind):
        raise MetadataGovernanceError(
            "Metadata governance input contains an invalid change kind"
        )

    if not isinstance(change.severity, MetadataChangeSeverity):
        raise MetadataGovernanceError(
            "Metadata governance input contains an invalid change severity"
        )

    if not _validate_safe_asset_id(change.asset_id):
        raise MetadataGovernanceError(
            "Metadata governance input contains an invalid asset identifier"
        )

    if any(
        not _is_sha256(asset_id)
        for asset_id in change.related_asset_ids
    ):
        raise MetadataGovernanceError(
            "Metadata governance input contains an invalid related "
            "asset identifier"
        )

    if len(change.related_asset_ids) != len(
        set(change.related_asset_ids)
    ):
        raise MetadataGovernanceError(
            "Metadata governance input contains duplicate related "
            "asset identifiers"
        )

    if len(change.changed_properties) != len(
        set(change.changed_properties)
    ):
        raise MetadataGovernanceError(
            "Metadata governance input contains duplicate changed properties"
        )


def _validate_metadata_diff(metadata_diff: MetadataDiff) -> None:
    if not isinstance(metadata_diff, MetadataDiff):
        raise MetadataGovernanceError(
            "Metadata governance requires a MetadataDiff input"
        )

    if not _is_sha256(metadata_diff.baseline_checksum):
        raise MetadataGovernanceError(
            "Metadata governance input has an invalid baseline checksum"
        )

    if not _is_sha256(metadata_diff.current_checksum):
        raise MetadataGovernanceError(
            "Metadata governance input has an invalid current checksum"
        )

    if not _is_sha256(metadata_diff.comparison_id):
        raise MetadataGovernanceError(
            "Metadata governance input has an invalid comparison identifier"
        )

    expected_comparison_id = _expected_comparison_id(metadata_diff)

    if metadata_diff.comparison_id != expected_comparison_id:
        raise MetadataGovernanceError(
            "Metadata governance comparison identifier failed verification"
        )

    change_ids: set[str] = set()

    for change in metadata_diff.changes:
        _validate_change(change)

        if change.change_id in change_ids:
            raise MetadataGovernanceError(
                "Metadata governance input contains duplicate "
                "change identifiers"
            )

        change_ids.add(change.change_id)

    direct_assets = metadata_diff.directly_changed_assets
    downstream_assets = metadata_diff.downstream_impacted_assets

    if (
        not isinstance(direct_assets, tuple)
        or not isinstance(downstream_assets, tuple)
    ):
        raise MetadataGovernanceError(
            "Metadata governance input contains a non-canonical "
            "asset collection"
        )

    if len(direct_assets) != len(set(direct_assets)):
        raise MetadataGovernanceError(
            "Metadata governance input contains duplicate directly "
            "changed assets"
        )

    if len(downstream_assets) != len(set(downstream_assets)):
        raise MetadataGovernanceError(
            "Metadata governance input contains duplicate downstream "
            "impacted assets"
        )

    if any(
        not _is_sha256(asset_id)
        for asset_id in direct_assets
    ):
        raise MetadataGovernanceError(
            "Metadata governance input contains an invalid directly "
            "changed asset"
        )

    if any(
        not _is_sha256(asset_id)
        for asset_id in downstream_assets
    ):
        raise MetadataGovernanceError(
            "Metadata governance input contains an invalid downstream "
            "impacted asset"
        )

    if direct_assets != tuple(sorted(direct_assets)):
        raise MetadataGovernanceError(
            "Metadata governance input contains non-canonical directly "
            "changed assets"
        )

    if downstream_assets != tuple(sorted(downstream_assets)):
        raise MetadataGovernanceError(
            "Metadata governance input contains non-canonical downstream "
            "impacted assets"
        )

    if set(direct_assets) & set(downstream_assets):
        raise MetadataGovernanceError(
            "Metadata governance input has overlapping direct and "
            "downstream assets"
        )

    expected_direct_assets = {
        change.asset_id
        for change in metadata_diff.changes
        if change.asset_id is not None
    }

    actual_direct_assets = set(direct_assets)

    if not expected_direct_assets.issubset(actual_direct_assets):
        raise MetadataGovernanceError(
            "Metadata governance input is missing directly changed "
            "asset evidence"
        )

    if not actual_direct_assets.issubset(expected_direct_assets):
        raise MetadataGovernanceError(
            "Metadata governance input contains unexpected directly "
            "changed asset evidence"
        )


def _violation_for_change(
    *,
    metadata_diff: MetadataDiff,
    change: MetadataChange,
) -> Optional[MetadataPolicyViolation]:
    if change.severity == MetadataChangeSeverity.BREAKING:
        rule = MetadataPolicyRule.BREAKING_CHANGE
        status = MetadataGovernanceStatus.BLOCK
    elif change.severity == MetadataChangeSeverity.REVIEW_REQUIRED:
        rule = MetadataPolicyRule.REVIEW_REQUIRED_CHANGE
        status = MetadataGovernanceStatus.REVIEW
    else:
        return None

    violation_id = _digest(
        {
            "policy_id": POLICY_ID,
            "policy_version": POLICY_VERSION,
            "comparison_id": metadata_diff.comparison_id,
            "rule_id": rule.value,
            "change_id": change.change_id,
        }
    )

    return MetadataPolicyViolation(
        violation_id=violation_id,
        rule=rule,
        status=status,
        change_id=change.change_id,
        entity_id=change.entity_id,
        entity_type=change.entity_type,
        kind=change.kind,
        severity=change.severity,
        asset_id=change.asset_id,
        field_name=change.field_name,
        downstream_impact_count=len(
            metadata_diff.downstream_impacted_assets
        ),
    )


def _decision_status(
    violations: tuple[MetadataPolicyViolation, ...],
) -> MetadataGovernanceStatus:
    if any(
        violation.status == MetadataGovernanceStatus.BLOCK
        for violation in violations
    ):
        return MetadataGovernanceStatus.BLOCK

    if any(
        violation.status == MetadataGovernanceStatus.REVIEW
        for violation in violations
    ):
        return MetadataGovernanceStatus.REVIEW

    return MetadataGovernanceStatus.PASS


def evaluate_metadata_governance(
    metadata_diff: MetadataDiff,
) -> MetadataGovernanceDecision:
    """Evaluate one deterministic LotusLearn metadata-governance decision."""

    _validate_metadata_diff(metadata_diff)

    severity_counts = Counter(
        change.severity
        for change in metadata_diff.changes
    )

    violations = tuple(
        sorted(
            (
                violation
                for change in metadata_diff.changes
                if (
                    violation := _violation_for_change(
                        metadata_diff=metadata_diff,
                        change=change,
                    )
                )
                is not None
            ),
            key=lambda violation: (
                _STATUS_RANK[violation.status],
                _SEVERITY_RANK[violation.severity],
                _ENTITY_RANK[violation.entity_type],
                violation.asset_id or "",
                violation.field_name or "",
                violation.kind.value,
                violation.violation_id,
            ),
        )
    )

    status = _decision_status(violations)

    decision_id = _digest(
        {
            "policy_id": POLICY_ID,
            "policy_version": POLICY_VERSION,
            "comparison_id": metadata_diff.comparison_id,
            "status": status.value,
            "violation_ids": [
                violation.violation_id
                for violation in violations
            ],
        }
    )

    return MetadataGovernanceDecision(
        decision_id=decision_id,
        policy_id=POLICY_ID,
        policy_version=POLICY_VERSION,
        status=status,
        comparison_id=metadata_diff.comparison_id,
        baseline_checksum=metadata_diff.baseline_checksum,
        current_checksum=metadata_diff.current_checksum,
        change_count=len(metadata_diff.changes),
        breaking_change_count=severity_counts[
            MetadataChangeSeverity.BREAKING
        ],
        review_required_change_count=severity_counts[
            MetadataChangeSeverity.REVIEW_REQUIRED
        ],
        non_breaking_change_count=severity_counts[
            MetadataChangeSeverity.NON_BREAKING
        ],
        metadata_only_change_count=severity_counts[
            MetadataChangeSeverity.METADATA_ONLY
        ],
        directly_changed_assets=(
            metadata_diff.directly_changed_assets
        ),
        downstream_impacted_assets=(
            metadata_diff.downstream_impacted_assets
        ),
        violations=violations,
    )


__all__ = [
    "MetadataGovernanceDecision",
    "MetadataGovernanceError",
    "MetadataGovernanceStatus",
    "MetadataPolicyRule",
    "MetadataPolicyViolation",
    "POLICY_ID",
    "POLICY_VERSION",
    "evaluate_metadata_governance",
]
