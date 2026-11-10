"""Append-only PostgreSQL persistence for metadata governance decisions."""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from enum import Enum
from typing import Any, Optional

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from lotuslearn_pipeline.metadata_drift import (
    MetadataChangeKind,
    MetadataChangeSeverity,
    MetadataEntityType,
)
from lotuslearn_pipeline.metadata_policy import (
    MetadataGovernanceDecision,
    MetadataGovernanceStatus,
    MetadataPolicyRule,
    MetadataPolicyViolation,
)
from lotuslearn_pipeline.retry import execute_with_retry

_SHA256 = re.compile(r"^[0-9a-f]{64}$")


class MetadataGovernanceHistoryError(RuntimeError):
    """Base error for immutable metadata governance history operations."""


class MetadataGovernanceHistoryConflictError(
    MetadataGovernanceHistoryError
):
    """Raised when an existing governance identity has different content."""


class MetadataGovernanceHistoryIntegrityError(
    MetadataGovernanceHistoryError
):
    """Raised when persisted governance history fails integrity verification."""


class MetadataGovernanceHistoryWriteOutcome(str, Enum):
    INSERTED = "INSERTED"
    EXISTING = "EXISTING"


@dataclass(frozen=True)
class MetadataGovernanceDecisionWriteResult:
    decision_id: str
    outcome: MetadataGovernanceHistoryWriteOutcome
    decision: MetadataGovernanceDecision


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
        and _SHA256.fullmatch(value) is not None
    )


def _is_non_negative_int(value: Any) -> bool:
    return (
        isinstance(value, int)
        and not isinstance(value, bool)
        and value >= 0
    )


def _decode_payload(value: Any) -> dict[str, Any]:
    if isinstance(value, str):
        value = json.loads(value)

    if not isinstance(value, dict):
        raise MetadataGovernanceHistoryIntegrityError(
            "Persisted metadata governance payload is not a JSON object"
        )

    return value


def _expected_violation_id(
    decision: MetadataGovernanceDecision,
    violation: MetadataPolicyViolation,
) -> str:
    return _digest(
        {
            "policy_id": decision.policy_id,
            "policy_version": decision.policy_version,
            "comparison_id": decision.comparison_id,
            "rule_id": violation.rule.value,
            "change_id": violation.change_id,
        }
    )


def _expected_decision_id(
    decision: MetadataGovernanceDecision,
) -> str:
    return _digest(
        {
            "policy_id": decision.policy_id,
            "policy_version": decision.policy_version,
            "comparison_id": decision.comparison_id,
            "status": decision.status.value,
            "violation_ids": [
                violation.violation_id
                for violation in decision.violations
            ],
        }
    )


def _expected_status(
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


def _validate_asset_collection(
    value: Any,
    *,
    label: str,
) -> tuple[str, ...]:
    if not isinstance(value, tuple):
        raise MetadataGovernanceHistoryIntegrityError(
            f"Metadata governance {label} must be a tuple"
        )

    if len(value) != len(set(value)):
        raise MetadataGovernanceHistoryIntegrityError(
            f"Metadata governance {label} contains duplicate identifiers"
        )

    if any(not _is_sha256(asset_id) for asset_id in value):
        raise MetadataGovernanceHistoryIntegrityError(
            f"Metadata governance {label} contains an invalid identifier"
        )

    if value != tuple(sorted(value)):
        raise MetadataGovernanceHistoryIntegrityError(
            f"Metadata governance {label} is not canonical"
        )

    return value


def _validate_violation(
    decision: MetadataGovernanceDecision,
    violation: MetadataPolicyViolation,
) -> None:
    if not isinstance(violation, MetadataPolicyViolation):
        raise MetadataGovernanceHistoryIntegrityError(
            "Metadata governance decision contains an invalid violation"
        )

    if not _is_sha256(violation.violation_id):
        raise MetadataGovernanceHistoryIntegrityError(
            "Metadata governance violation has an invalid identifier"
        )

    if not _is_sha256(violation.change_id):
        raise MetadataGovernanceHistoryIntegrityError(
            "Metadata governance violation has an invalid change identifier"
        )

    if not _is_sha256(violation.entity_id):
        raise MetadataGovernanceHistoryIntegrityError(
            "Metadata governance violation has an invalid entity identifier"
        )

    if not isinstance(violation.rule, MetadataPolicyRule):
        raise MetadataGovernanceHistoryIntegrityError(
            "Metadata governance violation has an invalid policy rule"
        )

    if not isinstance(
        violation.status,
        MetadataGovernanceStatus,
    ):
        raise MetadataGovernanceHistoryIntegrityError(
            "Metadata governance violation has an invalid status"
        )

    if not isinstance(
        violation.entity_type,
        MetadataEntityType,
    ):
        raise MetadataGovernanceHistoryIntegrityError(
            "Metadata governance violation has an invalid entity type"
        )

    if not isinstance(
        violation.kind,
        MetadataChangeKind,
    ):
        raise MetadataGovernanceHistoryIntegrityError(
            "Metadata governance violation has an invalid change kind"
        )

    if not isinstance(
        violation.severity,
        MetadataChangeSeverity,
    ):
        raise MetadataGovernanceHistoryIntegrityError(
            "Metadata governance violation has an invalid severity"
        )

    if (
        violation.asset_id is not None
        and not _is_sha256(violation.asset_id)
    ):
        raise MetadataGovernanceHistoryIntegrityError(
            "Metadata governance violation has an invalid asset identifier"
        )

    if (
        violation.field_name is not None
        and not isinstance(violation.field_name, str)
    ):
        raise MetadataGovernanceHistoryIntegrityError(
            "Metadata governance violation has an invalid field name"
        )

    if not _is_non_negative_int(
        violation.downstream_impact_count
    ):
        raise MetadataGovernanceHistoryIntegrityError(
            "Metadata governance violation has an invalid downstream impact count"
        )

    if (
        violation.downstream_impact_count
        != len(decision.downstream_impacted_assets)
    ):
        raise MetadataGovernanceHistoryIntegrityError(
            "Metadata governance violation downstream impact evidence "
            "does not match its decision"
        )

    if (
        violation.asset_id is not None
        and violation.asset_id
        not in decision.directly_changed_assets
    ):
        raise MetadataGovernanceHistoryIntegrityError(
            "Metadata governance violation asset is missing from "
            "directly changed asset evidence"
        )

    if violation.rule == MetadataPolicyRule.BREAKING_CHANGE:
        if (
            violation.status
            != MetadataGovernanceStatus.BLOCK
            or violation.severity
            != MetadataChangeSeverity.BREAKING
        ):
            raise MetadataGovernanceHistoryIntegrityError(
                "Metadata governance breaking violation is inconsistent"
            )

    elif (
        violation.rule
        == MetadataPolicyRule.REVIEW_REQUIRED_CHANGE
    ):
        if (
            violation.status
            != MetadataGovernanceStatus.REVIEW
            or violation.severity
            != MetadataChangeSeverity.REVIEW_REQUIRED
        ):
            raise MetadataGovernanceHistoryIntegrityError(
                "Metadata governance review violation is inconsistent"
            )

    else:
        raise MetadataGovernanceHistoryIntegrityError(
            "Metadata governance violation references an unsupported rule"
        )

    if (
        violation.violation_id
        != _expected_violation_id(decision, violation)
    ):
        raise MetadataGovernanceHistoryIntegrityError(
            "Metadata governance violation identifier failed verification"
        )


def _validate_decision(
    decision: MetadataGovernanceDecision,
) -> None:
    if not isinstance(decision, MetadataGovernanceDecision):
        raise MetadataGovernanceHistoryIntegrityError(
            "Metadata governance history requires a "
            "MetadataGovernanceDecision"
        )

    if not _is_sha256(decision.decision_id):
        raise MetadataGovernanceHistoryIntegrityError(
            "Metadata governance decision has an invalid identifier"
        )

    if not _is_sha256(decision.comparison_id):
        raise MetadataGovernanceHistoryIntegrityError(
            "Metadata governance decision has an invalid comparison identifier"
        )

    if not _is_sha256(decision.baseline_checksum):
        raise MetadataGovernanceHistoryIntegrityError(
            "Metadata governance decision has an invalid baseline checksum"
        )

    if not _is_sha256(decision.current_checksum):
        raise MetadataGovernanceHistoryIntegrityError(
            "Metadata governance decision has an invalid current checksum"
        )

    if (
        not isinstance(decision.policy_id, str)
        or not decision.policy_id.strip()
    ):
        raise MetadataGovernanceHistoryIntegrityError(
            "Metadata governance decision has an invalid policy identifier"
        )

    if (
        not isinstance(decision.policy_version, str)
        or not decision.policy_version.strip()
    ):
        raise MetadataGovernanceHistoryIntegrityError(
            "Metadata governance decision has an invalid policy version"
        )

    if not isinstance(
        decision.status,
        MetadataGovernanceStatus,
    ):
        raise MetadataGovernanceHistoryIntegrityError(
            "Metadata governance decision has an invalid status"
        )

    count_fields = (
        decision.change_count,
        decision.breaking_change_count,
        decision.review_required_change_count,
        decision.non_breaking_change_count,
        decision.metadata_only_change_count,
    )

    if any(
        not _is_non_negative_int(value)
        for value in count_fields
    ):
        raise MetadataGovernanceHistoryIntegrityError(
            "Metadata governance decision contains an invalid change count"
        )

    if decision.change_count != (
        decision.breaking_change_count
        + decision.review_required_change_count
        + decision.non_breaking_change_count
        + decision.metadata_only_change_count
    ):
        raise MetadataGovernanceHistoryIntegrityError(
            "Metadata governance decision change counts are inconsistent"
        )

    direct_assets = _validate_asset_collection(
        decision.directly_changed_assets,
        label="directly changed assets",
    )

    downstream_assets = _validate_asset_collection(
        decision.downstream_impacted_assets,
        label="downstream impacted assets",
    )

    if set(direct_assets) & set(downstream_assets):
        raise MetadataGovernanceHistoryIntegrityError(
            "Metadata governance decision has overlapping direct "
            "and downstream assets"
        )

    if not isinstance(decision.violations, tuple):
        raise MetadataGovernanceHistoryIntegrityError(
            "Metadata governance decision violations must be a tuple"
        )

    violation_ids: set[str] = set()
    violation_change_ids: set[str] = set()

    for violation in decision.violations:
        _validate_violation(decision, violation)

        if violation.violation_id in violation_ids:
            raise MetadataGovernanceHistoryIntegrityError(
                "Metadata governance decision contains duplicate "
                "violation identifiers"
            )

        if violation.change_id in violation_change_ids:
            raise MetadataGovernanceHistoryIntegrityError(
                "Metadata governance decision contains duplicate "
                "violation change identifiers"
            )

        violation_ids.add(violation.violation_id)
        violation_change_ids.add(violation.change_id)

    expected_violation_count = (
        decision.breaking_change_count
        + decision.review_required_change_count
    )

    if len(decision.violations) != expected_violation_count:
        raise MetadataGovernanceHistoryIntegrityError(
            "Metadata governance decision violation count is inconsistent"
        )

    block_count = sum(
        violation.status == MetadataGovernanceStatus.BLOCK
        for violation in decision.violations
    )

    review_count = sum(
        violation.status == MetadataGovernanceStatus.REVIEW
        for violation in decision.violations
    )

    if block_count != decision.breaking_change_count:
        raise MetadataGovernanceHistoryIntegrityError(
            "Metadata governance breaking count does not match violations"
        )

    if review_count != decision.review_required_change_count:
        raise MetadataGovernanceHistoryIntegrityError(
            "Metadata governance review count does not match violations"
        )

    if decision.status != _expected_status(decision.violations):
        raise MetadataGovernanceHistoryIntegrityError(
            "Metadata governance decision status failed verification"
        )

    if decision.decision_id != _expected_decision_id(decision):
        raise MetadataGovernanceHistoryIntegrityError(
            "Metadata governance decision identifier failed verification"
        )


def _decision_summary(
    decision: MetadataGovernanceDecision,
) -> dict[str, Any]:
    return {
        "comparison_id": decision.comparison_id,
        "policy_id": decision.policy_id,
        "policy_version": decision.policy_version,
        "decision_id": decision.decision_id,
        "status": decision.status.value,
        "baseline_checksum": decision.baseline_checksum,
        "current_checksum": decision.current_checksum,
        "change_count": decision.change_count,
        "breaking_change_count": (
            decision.breaking_change_count
        ),
        "review_required_change_count": (
            decision.review_required_change_count
        ),
        "non_breaking_change_count": (
            decision.non_breaking_change_count
        ),
        "metadata_only_change_count": (
            decision.metadata_only_change_count
        ),
        "directly_changed_asset_count": len(
            decision.directly_changed_assets
        ),
        "downstream_impacted_asset_count": len(
            decision.downstream_impacted_assets
        ),
        "violation_count": len(decision.violations),
    }


def _violation_from_dict(
    value: Any,
) -> MetadataPolicyViolation:
    if not isinstance(value, dict):
        raise MetadataGovernanceHistoryIntegrityError(
            "Persisted metadata governance violation is not a JSON object"
        )

    try:
        return MetadataPolicyViolation(
            violation_id=value["violation_id"],
            rule=MetadataPolicyRule(value["rule_id"]),
            status=MetadataGovernanceStatus(
                value["status"]
            ),
            change_id=value["change_id"],
            entity_id=value["entity_id"],
            entity_type=MetadataEntityType(
                value["entity_type"]
            ),
            kind=MetadataChangeKind(value["kind"]),
            severity=MetadataChangeSeverity(
                value["severity"]
            ),
            asset_id=value.get("asset_id"),
            field_name=value.get("field_name"),
            downstream_impact_count=value[
                "downstream_impact_count"
            ],
        )
    except (
        KeyError,
        TypeError,
        ValueError,
    ):
        raise MetadataGovernanceHistoryIntegrityError(
            "Persisted metadata governance violation failed decoding"
        ) from None


def _decision_from_dict(
    value: Any,
) -> MetadataGovernanceDecision:
    if not isinstance(value, dict):
        raise MetadataGovernanceHistoryIntegrityError(
            "Persisted metadata governance decision is not a JSON object"
        )

    try:
        violations_value = value["violations"]

        if not isinstance(violations_value, list):
            raise MetadataGovernanceHistoryIntegrityError(
                "Persisted metadata governance violations are not a JSON array"
            )

        direct_assets_value = value[
            "directly_changed_assets"
        ]
        downstream_assets_value = value[
            "downstream_impacted_assets"
        ]

        if not isinstance(direct_assets_value, list):
            raise MetadataGovernanceHistoryIntegrityError(
                "Persisted directly changed assets are not a JSON array"
            )

        if not isinstance(
            downstream_assets_value,
            list,
        ):
            raise MetadataGovernanceHistoryIntegrityError(
                "Persisted downstream impacted assets are not a JSON array"
            )

        decision = MetadataGovernanceDecision(
            decision_id=value["decision_id"],
            policy_id=value["policy_id"],
            policy_version=value["policy_version"],
            status=MetadataGovernanceStatus(
                value["status"]
            ),
            comparison_id=value["comparison_id"],
            baseline_checksum=value[
                "baseline_checksum"
            ],
            current_checksum=value["current_checksum"],
            change_count=value["change_count"],
            breaking_change_count=value[
                "breaking_change_count"
            ],
            review_required_change_count=value[
                "review_required_change_count"
            ],
            non_breaking_change_count=value[
                "non_breaking_change_count"
            ],
            metadata_only_change_count=value[
                "metadata_only_change_count"
            ],
            directly_changed_assets=tuple(
                direct_assets_value
            ),
            downstream_impacted_assets=tuple(
                downstream_assets_value
            ),
            violations=tuple(
                _violation_from_dict(violation)
                for violation in violations_value
            ),
        )
    except MetadataGovernanceHistoryIntegrityError:
        raise

    except (
        KeyError,
        TypeError,
        ValueError,
    ):
        raise MetadataGovernanceHistoryIntegrityError(
            "Persisted metadata governance decision failed decoding"
        ) from None

    _validate_decision(decision)

    return decision


class PostgresMetadataGovernanceHistoryStore:
    """Persist immutable governance decisions with database arbitration."""

    def __init__(self, database_url: str):
        if (
            not isinstance(database_url, str)
            or not database_url.strip()
        ):
            raise ValueError(
                "A PostgreSQL database URL is required"
            )

        self._database_url = database_url

    def _connect(self) -> psycopg.Connection:
        return psycopg.connect(
            self._database_url,
            row_factory=dict_row,
        )

    def _stored_decision(
        self,
        row: dict[str, Any],
    ) -> tuple[
        MetadataGovernanceDecision,
        dict[str, Any],
    ]:
        try:
            payload = _decode_payload(
                row["payload_json"]
            )

            decision = _decision_from_dict(payload)

        except MetadataGovernanceHistoryIntegrityError:
            raise

        except Exception:
            raise MetadataGovernanceHistoryIntegrityError(
                "Persisted metadata governance decision failed "
                "integrity verification"
            ) from None

        expected = _decision_summary(decision)

        if any(
            row[key] != value
            for key, value in expected.items()
        ):
            raise MetadataGovernanceHistoryIntegrityError(
                "Persisted metadata governance summary does not "
                "match its payload"
            )

        if (
            _canonical_json(decision.to_dict())
            != _canonical_json(payload)
        ):
            raise MetadataGovernanceHistoryIntegrityError(
                "Persisted metadata governance payload is not canonical"
            )

        return decision, payload

    def _insert_decision(
        self,
        conn: psycopg.Connection,
        decision: MetadataGovernanceDecision,
    ) -> MetadataGovernanceHistoryWriteOutcome:
        payload = decision.to_dict()
        summary = _decision_summary(decision)

        inserted = conn.execute(
            """
            INSERT INTO metadata_governance_decision_history (
                comparison_id,
                policy_id,
                policy_version,
                decision_id,
                status,
                baseline_checksum,
                current_checksum,
                change_count,
                breaking_change_count,
                review_required_change_count,
                non_breaking_change_count,
                metadata_only_change_count,
                directly_changed_asset_count,
                downstream_impacted_asset_count,
                violation_count,
                payload_json
            ) VALUES (
                %(comparison_id)s,
                %(policy_id)s,
                %(policy_version)s,
                %(decision_id)s,
                %(status)s,
                %(baseline_checksum)s,
                %(current_checksum)s,
                %(change_count)s,
                %(breaking_change_count)s,
                %(review_required_change_count)s,
                %(non_breaking_change_count)s,
                %(metadata_only_change_count)s,
                %(directly_changed_asset_count)s,
                %(downstream_impacted_asset_count)s,
                %(violation_count)s,
                %(payload_json)s
            )
            ON CONFLICT DO NOTHING
            RETURNING decision_id;
            """,
            {
                **summary,
                "payload_json": Jsonb(payload),
            },
        ).fetchone()

        if inserted is not None:
            return (
                MetadataGovernanceHistoryWriteOutcome.INSERTED
            )

        existing = conn.execute(
            """
            SELECT *
            FROM metadata_governance_decision_history
            WHERE comparison_id = %s
              AND policy_id = %s
              AND policy_version = %s;
            """,
            (
                decision.comparison_id,
                decision.policy_id,
                decision.policy_version,
            ),
        ).fetchone()

        if existing is None:
            raise MetadataGovernanceHistoryIntegrityError(
                "Existing metadata governance decision could not be read"
            )

        stored_decision, stored_payload = (
            self._stored_decision(existing)
        )

        if (
            _decision_summary(stored_decision)
            != summary
            or _canonical_json(stored_payload)
            != _canonical_json(payload)
        ):
            raise MetadataGovernanceHistoryConflictError(
                "Metadata governance decision identity has "
                "different immutable content"
            )

        return MetadataGovernanceHistoryWriteOutcome.EXISTING

    def record_decision(
        self,
        decision: MetadataGovernanceDecision,
    ) -> MetadataGovernanceDecisionWriteResult:
        """Insert a governance decision or return EXISTING for exact replay."""

        _validate_decision(decision)

        def operation() -> MetadataGovernanceDecisionWriteResult:
            with self._connect() as conn:
                with conn.transaction():
                    outcome = self._insert_decision(
                        conn,
                        decision,
                    )

                    return MetadataGovernanceDecisionWriteResult(
                        decision_id=decision.decision_id,
                        outcome=outcome,
                        decision=decision,
                    )

        return execute_with_retry(operation).result

    def get_decision(
        self,
        decision_id: str,
    ) -> Optional[MetadataGovernanceDecision]:
        """Read and verify one persisted decision by deterministic ID."""

        if not _is_sha256(decision_id):
            raise ValueError(
                "A valid metadata governance decision ID is required"
            )

        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT *
                FROM metadata_governance_decision_history
                WHERE decision_id = %s;
                """,
                (decision_id,),
            ).fetchone()

        if row is None:
            return None

        decision, _ = self._stored_decision(row)

        return decision

    def get_policy_decision(
        self,
        *,
        comparison_id: str,
        policy_id: str,
        policy_version: str,
    ) -> Optional[MetadataGovernanceDecision]:
        """Read one verified decision by its governance business identity."""

        if not _is_sha256(comparison_id):
            raise ValueError(
                "A valid metadata comparison ID is required"
            )

        if (
            not isinstance(policy_id, str)
            or not policy_id.strip()
        ):
            raise ValueError(
                "A metadata governance policy ID is required"
            )

        if (
            not isinstance(policy_version, str)
            or not policy_version.strip()
        ):
            raise ValueError(
                "A metadata governance policy version is required"
            )

        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT *
                FROM metadata_governance_decision_history
                WHERE comparison_id = %s
                  AND policy_id = %s
                  AND policy_version = %s;
                """,
                (
                    comparison_id,
                    policy_id,
                    policy_version,
                ),
            ).fetchone()

        if row is None:
            return None

        decision, _ = self._stored_decision(row)

        return decision


__all__ = [
    "MetadataGovernanceDecisionWriteResult",
    "MetadataGovernanceHistoryConflictError",
    "MetadataGovernanceHistoryError",
    "MetadataGovernanceHistoryIntegrityError",
    "MetadataGovernanceHistoryWriteOutcome",
    "PostgresMetadataGovernanceHistoryStore",
]
