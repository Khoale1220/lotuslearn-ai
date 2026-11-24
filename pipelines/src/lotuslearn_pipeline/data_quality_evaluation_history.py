"""Durable immutable evidence for data-quality evaluation decisions."""

from __future__ import annotations

import dataclasses
import hashlib
import json
import math
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from psycopg import Connection
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from lotuslearn_pipeline.data_quality_evaluation import (
    QualityEvaluationDecision,
    QualityEvaluationStatus,
)
from lotuslearn_pipeline.data_quality_reconciliation import DataQualityStatus


class QualityEvaluationConflictError(RuntimeError):
    """Raised when an existing evaluation key has different evidence."""


class QualityEvaluationPersistenceDisposition(str, Enum):
    """Outcome of an idempotent persistence attempt."""

    INSERTED = "INSERTED"
    EXISTING = "EXISTING"


@dataclass(frozen=True)
class PersistedQualityEvaluation:
    """Immutable row reconstructed from PostgreSQL evidence."""

    evaluation_key: str
    decision_fingerprint: str
    reconciliation_fingerprint: str
    status: QualityEvaluationStatus
    reconciliation_status: DataQualityStatus
    history_size: int
    analytics_ready: bool
    reasons: tuple[str, ...]
    feature_columns: tuple[str, ...]
    detector_evidence: Mapping[str, object] | None
    payload: Mapping[str, object]
    created_at: datetime
    execution_id: UUID | None = None


@dataclass(frozen=True)
class PersistQualityEvaluationResult:
    """Result of inserting or exactly replaying one evaluation."""

    disposition: QualityEvaluationPersistenceDisposition
    record: PersistedQualityEvaluation


def _canonical_value(value: object) -> object:
    if isinstance(value, Enum):
        return _canonical_value(value.value)

    if dataclasses.is_dataclass(value) and not isinstance(value, type):
        return {
            field.name: _canonical_value(getattr(value, field.name))
            for field in dataclasses.fields(value)
        }

    if isinstance(value, Mapping):
        return {
            str(key): _canonical_value(item)
            for key, item in sorted(
                value.items(),
                key=lambda pair: str(pair[0]),
            )
        }

    if isinstance(value, (tuple, list)):
        return [_canonical_value(item) for item in value]

    if value is None or isinstance(
        value,
        (str, bool, int),
    ):
        return value

    if isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError(
                "quality evaluation evidence cannot contain non-finite floating-point values"
            )
        return value

    raise TypeError(f"unsupported quality evaluation evidence type: {type(value).__name__}")


def _canonical_mapping(value: object) -> dict[str, object]:
    normalized = _canonical_value(value)

    if not isinstance(normalized, dict):
        raise TypeError("quality evaluation evidence must normalize to an object")

    return normalized


def _fingerprint(value: object) -> str:
    canonical = _canonical_value(value)

    encoded = json.dumps(
        canonical,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
        allow_nan=False,
    ).encode("utf-8")

    return hashlib.sha256(encoded).hexdigest()


def quality_evaluation_payload(
    decision: QualityEvaluationDecision,
) -> dict[str, object]:
    """Return canonical versioned durable evidence for a decision."""

    return {
        "schema_version": "1.0",
        "decision": _canonical_mapping(decision),
    }


def quality_evaluation_fingerprint(
    decision: QualityEvaluationDecision,
) -> str:
    """Return deterministic SHA-256 identity for decision evidence."""

    return _fingerprint(quality_evaluation_payload(decision))


def reconciliation_fingerprint(
    decision: QualityEvaluationDecision,
) -> str:
    """Return deterministic SHA-256 identity for reconciliation evidence."""

    return _fingerprint(decision.reconciliation)


def _record_from_row(
    row: Mapping[str, Any],
) -> PersistedQualityEvaluation:
    detector = row["detector_evidence"]

    return PersistedQualityEvaluation(
        evaluation_key=row["evaluation_key"],
        decision_fingerprint=row["decision_fingerprint"],
        reconciliation_fingerprint=row["reconciliation_fingerprint"],
        status=QualityEvaluationStatus(row["evaluation_status"]),
        reconciliation_status=DataQualityStatus(row["reconciliation_status"]),
        history_size=row["history_size"],
        analytics_ready=row["analytics_ready"],
        reasons=tuple(row["reasons"]),
        feature_columns=tuple(row["feature_columns"]),
        detector_evidence=detector,
        payload=row["payload"],
        created_at=row["created_at"],
        execution_id=row["execution_id"],
    )


def get_quality_evaluation(
    conn: Connection[Any],
    *,
    evaluation_key: str,
) -> PersistedQualityEvaluation | None:
    """Return one immutable quality-evaluation record by idempotency key."""
    if not isinstance(evaluation_key, str):
        raise TypeError("evaluation_key must be a string")

    key = evaluation_key.strip()

    if not key:
        raise ValueError("evaluation_key must not be empty")

    with conn.cursor(row_factory=dict_row) as cursor:
        cursor.execute(
            """
            SELECT
                evaluation_key, execution_id,
                decision_fingerprint,
                reconciliation_fingerprint,
                evaluation_status,
                reconciliation_status,
                history_size,
                analytics_ready,
                reasons,
                feature_columns,
                detector_evidence,
                payload,
                created_at
            FROM data_quality_evaluation_history
            WHERE evaluation_key = %s
            """,
            (key,),
        )
        row = cursor.fetchone()

    if row is None:
        return None

    return _record_from_row(row)


def list_quality_evaluations_for_execution(
    conn: Connection[Any],
    *,
    execution_id: UUID,
    limit: int = 100,
) -> tuple[PersistedQualityEvaluation, ...]:
    """Return bounded immutable quality evidence linked to one execution."""
    if not isinstance(execution_id, UUID):
        raise TypeError("execution_id must be a UUID")

    if isinstance(limit, bool) or not isinstance(limit, int):
        raise TypeError("limit must be an integer")

    if limit < 1 or limit > 1000:
        raise ValueError("limit must be between 1 and 1000")

    with conn.cursor(row_factory=dict_row) as cursor:
        cursor.execute(
            """
            SELECT
                evaluation_key, execution_id,
                decision_fingerprint,
                reconciliation_fingerprint,
                evaluation_status,
                reconciliation_status,
                history_size,
                analytics_ready,
                reasons,
                feature_columns,
                detector_evidence,
                payload,
                created_at
            FROM data_quality_evaluation_history
            WHERE execution_id = %s
            ORDER BY created_at ASC, evaluation_key ASC
            LIMIT %s
            """,
            (execution_id, limit),
        )
        rows = cursor.fetchall()

    return tuple(_record_from_row(row) for row in rows)


def persist_quality_evaluation(
    conn: Connection[Any],
    *,
    evaluation_key: str,
    decision: QualityEvaluationDecision,
    execution_id: UUID | None = None,
) -> PersistQualityEvaluationResult:
    """Persist immutable evidence or return EXISTING for exact replay.

    The supplied evaluation key is the caller-owned idempotency identity.

    Reusing the same key with byte-equivalent canonical evidence is safe and
    returns EXISTING. Reusing it with different evidence fails closed.
    """

    if not isinstance(evaluation_key, str):
        raise TypeError("evaluation_key must be a string")

    key = evaluation_key.strip()

    if not key:
        raise ValueError("evaluation_key must not be empty")

    payload = quality_evaluation_payload(decision)

    decision_digest = quality_evaluation_fingerprint(decision)

    reconciliation_digest = reconciliation_fingerprint(decision)

    detector_evidence: object = None

    if decision.detector_comparison is not None:
        detector_evidence = _canonical_mapping(decision.detector_comparison)

    with conn.transaction():
        with conn.cursor(row_factory=dict_row) as cursor:
            cursor.execute(
                """
                INSERT INTO data_quality_evaluation_history (
                    evaluation_key, execution_id,
                    decision_fingerprint,
                    reconciliation_fingerprint,
                    evaluation_status,
                    reconciliation_status,
                    history_size,
                    analytics_ready,
                    reasons,
                    feature_columns,
                    detector_evidence,
                    payload
                )
                VALUES (
                    %s, %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s
                )
                ON CONFLICT (evaluation_key)
                DO NOTHING
                RETURNING
                    evaluation_key, execution_id,
                    decision_fingerprint,
                    reconciliation_fingerprint,
                    evaluation_status,
                    reconciliation_status,
                    history_size,
                    analytics_ready,
                    reasons,
                    feature_columns,
                    detector_evidence,
                    payload,
                    created_at
                """,
                (
                    key,
                    execution_id,
                    decision_digest,
                    reconciliation_digest,
                    decision.status.value,
                    decision.reconciliation.status.value,
                    decision.history_size,
                    decision.analytics_ready,
                    Jsonb(list(decision.reasons)),
                    Jsonb(list(decision.feature_columns)),
                    Jsonb(detector_evidence) if detector_evidence is not None else None,
                    Jsonb(payload),
                ),
            )

            inserted = cursor.fetchone()

            if inserted is not None:
                return PersistQualityEvaluationResult(
                    disposition=(QualityEvaluationPersistenceDisposition.INSERTED),
                    record=_record_from_row(inserted),
                )

            cursor.execute(
                """
                SELECT
                    evaluation_key, execution_id,
                    decision_fingerprint,
                    reconciliation_fingerprint,
                    evaluation_status,
                    reconciliation_status,
                    history_size,
                    analytics_ready,
                    reasons,
                    feature_columns,
                    detector_evidence,
                    payload,
                    created_at
                FROM data_quality_evaluation_history
                WHERE evaluation_key = %s
                FOR SHARE
                """,
                (key,),
            )

            existing = cursor.fetchone()

            if existing is None:
                raise RuntimeError(
                    "evaluation conflict occurred but the existing record could not be read"
                )

            if existing["execution_id"] != execution_id or (
                existing["decision_fingerprint"] != decision_digest
                or existing["payload"] != payload
            ):
                raise QualityEvaluationConflictError(
                    "evaluation_key already exists with different quality evaluation evidence"
                )

            return PersistQualityEvaluationResult(
                disposition=(QualityEvaluationPersistenceDisposition.EXISTING),
                record=_record_from_row(existing),
            )


__all__ = [
    "PersistQualityEvaluationResult",
    "PersistedQualityEvaluation",
    "QualityEvaluationConflictError",
    "QualityEvaluationPersistenceDisposition",
    "get_quality_evaluation",
    "list_quality_evaluations_for_execution",
    "persist_quality_evaluation",
    "quality_evaluation_fingerprint",
    "quality_evaluation_payload",
    "reconciliation_fingerprint",
]
