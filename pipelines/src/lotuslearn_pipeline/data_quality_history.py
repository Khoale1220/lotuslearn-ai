"""Durable PostgreSQL evidence for dataset reconciliation."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from enum import Enum
from typing import Any
from uuid import UUID

from psycopg import Connection
from psycopg.types.json import Jsonb

from lotuslearn_pipeline.data_quality_reconciliation import (
    DatasetReconciliationReport,
)


class DataQualityPersistenceStatus(str, Enum):
    """Database arbitration result."""

    INSERTED = "INSERTED"
    EXISTING = "EXISTING"


class DataQualityPersistenceConflict(RuntimeError):
    """Raised when an existing immutable ID has different evidence."""


@dataclass(frozen=True, slots=True)
class PersistedDataQualityEvidence:
    """Result of one durable evidence write."""

    reconciliation_id: UUID
    evidence_checksum: str
    status: DataQualityPersistenceStatus


def _normalize_key_fields(
    key_fields: Sequence[str],
) -> tuple[str, ...]:
    if isinstance(key_fields, (str, bytes)):
        raise TypeError("key_fields must be a sequence of field names")

    normalized = tuple(key_fields)

    if not normalized:
        raise ValueError("key_fields must contain at least one field")

    if any(not isinstance(field, str) or not field for field in normalized):
        raise ValueError("key_fields must contain non-empty strings")

    if len(set(normalized)) != len(normalized):
        raise ValueError("key_fields must not contain duplicate field names")

    return normalized


def _evidence_payload(
    *,
    report: DatasetReconciliationReport,
    key_fields: tuple[str, ...],
    execution_id: UUID | None,
    batch_id: UUID | None,
) -> dict[str, Any]:
    return {
        "execution_id": str(execution_id) if execution_id is not None else None,
        "batch_id": str(batch_id) if batch_id is not None else None,
        "key_fields": list(key_fields),
        "status": report.status.value,
        "source": {
            "row_count": report.source.row_count,
            "distinct_key_count": report.source.distinct_key_count,
            "duplicate_key_count": report.source.duplicate_key_count,
            "digest": report.source.digest,
            "field_nulls": [
                {
                    "field_name": item.field_name,
                    "null_count": item.null_count,
                    "null_rate": item.null_rate,
                }
                for item in report.source.field_nulls
            ],
        },
        "target": {
            "row_count": report.target.row_count,
            "distinct_key_count": report.target.distinct_key_count,
            "duplicate_key_count": report.target.duplicate_key_count,
            "digest": report.target.digest,
            "field_nulls": [
                {
                    "field_name": item.field_name,
                    "null_count": item.null_count,
                    "null_rate": item.null_rate,
                }
                for item in report.target.field_nulls
            ],
        },
        "metrics": [
            {
                "name": metric.name,
                "source_value": metric.source_value,
                "target_value": metric.target_value,
                "delta": metric.delta,
                "status": metric.status.value,
            }
            for metric in report.metrics
        ],
        "missing_from_target": [
            {
                "key": item.key,
                "count": item.count,
            }
            for item in report.missing_from_target
        ],
        "extra_in_target": [
            {
                "key": item.key,
                "count": item.count,
            }
            for item in report.extra_in_target
        ],
    }


def reconciliation_evidence_checksum(
    report: DatasetReconciliationReport,
    *,
    key_fields: Sequence[str],
    execution_id: UUID | None = None,
    batch_id: UUID | None = None,
) -> str:
    """Return a stable checksum for immutable persisted evidence."""

    normalized_keys = _normalize_key_fields(key_fields)

    payload = _evidence_payload(
        report=report,
        key_fields=normalized_keys,
        execution_id=execution_id,
        batch_id=batch_id,
    )

    encoded = json.dumps(
        payload,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")

    return hashlib.sha256(encoded).hexdigest()


def _scalar(
    row: Any,
    *,
    key: str,
) -> Any:
    if isinstance(row, Mapping):
        return row[key]

    return row[0]


def persist_data_quality_reconciliation(
    conn: Connection[Any],
    *,
    reconciliation_id: UUID,
    report: DatasetReconciliationReport,
    key_fields: Sequence[str],
    execution_id: UUID | None = None,
    batch_id: UUID | None = None,
) -> PersistedDataQualityEvidence:
    """Persist reconciliation evidence atomically and idempotently.

    ``reconciliation_id`` is the immutable idempotency key.

    Replaying the same ID with exactly the same evidence returns EXISTING.
    Reusing the ID with different evidence raises
    ``DataQualityPersistenceConflict``.
    """

    if not isinstance(reconciliation_id, UUID):
        raise TypeError("reconciliation_id must be a UUID")

    if execution_id is not None and not isinstance(execution_id, UUID):
        raise TypeError("execution_id must be a UUID or None")

    if batch_id is not None and not isinstance(batch_id, UUID):
        raise TypeError("batch_id must be a UUID or None")

    normalized_keys = _normalize_key_fields(key_fields)

    checksum = reconciliation_evidence_checksum(
        report,
        key_fields=normalized_keys,
        execution_id=execution_id,
        batch_id=batch_id,
    )

    missing_key_count = sum(item.count for item in report.missing_from_target)
    extra_key_count = sum(item.count for item in report.extra_in_target)

    with conn.transaction():
        inserted = conn.execute(
            """
            INSERT INTO data_quality_reconciliation_runs (
                reconciliation_id,
                execution_id,
                batch_id,
                key_fields,
                status,
                source_row_count,
                target_row_count,
                source_distinct_key_count,
                target_distinct_key_count,
                source_duplicate_key_count,
                target_duplicate_key_count,
                source_digest,
                target_digest,
                missing_key_count,
                extra_key_count,
                evidence_checksum
            )
            VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s
            )
            ON CONFLICT (reconciliation_id) DO NOTHING
            RETURNING reconciliation_id
            """,
            (
                reconciliation_id,
                execution_id,
                batch_id,
                Jsonb(list(normalized_keys)),
                report.status.value,
                report.source.row_count,
                report.target.row_count,
                report.source.distinct_key_count,
                report.target.distinct_key_count,
                report.source.duplicate_key_count,
                report.target.duplicate_key_count,
                report.source.digest,
                report.target.digest,
                missing_key_count,
                extra_key_count,
                checksum,
            ),
        ).fetchone()

        if inserted is None:
            existing = conn.execute(
                """
                SELECT evidence_checksum
                FROM data_quality_reconciliation_runs
                WHERE reconciliation_id = %s
                """,
                (reconciliation_id,),
            ).fetchone()

            if existing is None:
                raise RuntimeError("Data quality evidence disappeared during persistence")

            existing_checksum = _scalar(
                existing,
                key="evidence_checksum",
            )

            if existing_checksum != checksum:
                raise DataQualityPersistenceConflict(
                    "Reconciliation ID already exists with different evidence"
                )

            return PersistedDataQualityEvidence(
                reconciliation_id=reconciliation_id,
                evidence_checksum=checksum,
                status=DataQualityPersistenceStatus.EXISTING,
            )

        with conn.cursor() as cursor:
            cursor.executemany(
                """
                INSERT INTO data_quality_reconciliation_metrics (
                    reconciliation_id,
                    metric_name,
                    source_value,
                    target_value,
                    delta,
                    status
                )
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                [
                    (
                        reconciliation_id,
                        metric.name,
                        Jsonb(metric.source_value),
                        Jsonb(metric.target_value),
                        metric.delta,
                        metric.status.value,
                    )
                    for metric in report.metrics
                ],
            )

            key_difference_rows = [
                (
                    reconciliation_id,
                    "MISSING_FROM_TARGET",
                    item.key,
                    item.count,
                )
                for item in report.missing_from_target
            ]

            key_difference_rows.extend(
                (
                    reconciliation_id,
                    "EXTRA_IN_TARGET",
                    item.key,
                    item.count,
                )
                for item in report.extra_in_target
            )

            if key_difference_rows:
                cursor.executemany(
                    """
                    INSERT INTO data_quality_reconciliation_key_differences (
                        reconciliation_id,
                        direction,
                        key_token,
                        occurrence_count
                    )
                    VALUES (%s, %s, %s, %s)
                    """,
                    key_difference_rows,
                )

    return PersistedDataQualityEvidence(
        reconciliation_id=reconciliation_id,
        evidence_checksum=checksum,
        status=DataQualityPersistenceStatus.INSERTED,
    )


__all__ = [
    "DataQualityPersistenceConflict",
    "DataQualityPersistenceStatus",
    "PersistedDataQualityEvidence",
    "persist_data_quality_reconciliation",
    "reconciliation_evidence_checksum",
]
