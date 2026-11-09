"""Append-only PostgreSQL persistence for metadata observations and diffs."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Optional

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from lotuslearn_pipeline.metadata import (
    MetadataIntegrityError,
    MetadataSnapshot,
    validate_metadata_snapshot,
)
from lotuslearn_pipeline.metadata_drift import (
    MetadataChangeSeverity,
    MetadataDiff,
    compare_metadata_snapshots,
)
from lotuslearn_pipeline.retry import execute_with_retry

_SHA256 = re.compile(r"^[0-9a-f]{64}$")
_SEVERITY_COLUMNS = {
    MetadataChangeSeverity.BREAKING: "breaking_count",
    MetadataChangeSeverity.REVIEW_REQUIRED: "review_required_count",
    MetadataChangeSeverity.NON_BREAKING: "non_breaking_count",
    MetadataChangeSeverity.METADATA_ONLY: "metadata_only_count",
}


class MetadataHistoryError(RuntimeError):
    """Base error for immutable metadata history operations."""


class MetadataHistoryConflictError(MetadataHistoryError):
    """Raised when an existing observation identity has different content."""


class MetadataHistoryIntegrityError(MetadataHistoryError):
    """Raised when persisted history fails integrity verification."""


class MetadataHistoryWriteOutcome(str, Enum):
    INSERTED = "INSERTED"
    EXISTING = "EXISTING"


@dataclass(frozen=True)
class MetadataSnapshotWriteResult:
    snapshot_id: str
    outcome: MetadataHistoryWriteOutcome


@dataclass(frozen=True)
class MetadataComparisonWriteResult:
    comparison_id: str
    baseline_outcome: MetadataHistoryWriteOutcome
    current_outcome: MetadataHistoryWriteOutcome
    outcome: MetadataHistoryWriteOutcome
    diff: MetadataDiff


def _canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def _decode_payload(value: Any) -> dict[str, Any]:
    if isinstance(value, str):
        value = json.loads(value)
    if not isinstance(value, dict):
        raise MetadataHistoryIntegrityError("Persisted metadata payload is not a JSON object")
    return value


def _aware_datetime(value: datetime) -> bool:
    return value.tzinfo is not None and value.utcoffset() is not None


def _validate_snapshot(snapshot: MetadataSnapshot) -> None:
    if not isinstance(snapshot, MetadataSnapshot):
        raise MetadataIntegrityError("Metadata snapshot failed integrity validation")
    if not isinstance(snapshot.snapshot_id, str) or not snapshot.snapshot_id.strip():
        raise MetadataIntegrityError("Metadata snapshot observation ID must be non-empty")
    result = validate_metadata_snapshot(snapshot)
    if not result.is_valid or not _SHA256.fullmatch(snapshot.content_checksum):
        raise MetadataIntegrityError("Metadata snapshot failed integrity validation")
    if not _aware_datetime(snapshot.generated_at):
        raise MetadataIntegrityError("Metadata snapshot timestamp must be timezone-aware")


def _snapshot_summary(snapshot: MetadataSnapshot) -> dict[str, Any]:
    return {
        "snapshot_id": snapshot.snapshot_id,
        "content_checksum": snapshot.content_checksum,
        "generated_at": snapshot.generated_at,
        "schema_version": snapshot.schema_version,
        "extractor_version": snapshot.extractor_version,
        "repository_commit": snapshot.repository_commit,
        "asset_count": snapshot.asset_count,
        "field_count": snapshot.field_count,
        "constraint_count": snapshot.constraint_count,
        "lineage_edge_count": snapshot.lineage_edge_count,
        "warning_count": snapshot.warning_count,
        "error_count": snapshot.error_count,
    }


def _diff_summary(diff: MetadataDiff) -> dict[str, Any]:
    counts = {column: 0 for column in _SEVERITY_COLUMNS.values()}
    for change in diff.changes:
        counts[_SEVERITY_COLUMNS[change.severity]] += 1
    return {
        "comparison_id": diff.comparison_id,
        "baseline_checksum": diff.baseline_checksum,
        "current_checksum": diff.current_checksum,
        "change_count": len(diff.changes),
        **counts,
        "directly_changed_asset_count": len(diff.directly_changed_assets),
        "downstream_impacted_asset_count": len(diff.downstream_impacted_assets),
    }


class PostgresMetadataHistoryStore:
    """Persist immutable observations using database uniqueness for arbitration."""

    def __init__(self, database_url: str):
        if not isinstance(database_url, str) or not database_url.strip():
            raise ValueError("A PostgreSQL database URL is required")
        self._database_url = database_url

    def _connect(self) -> psycopg.Connection:
        return psycopg.connect(self._database_url, row_factory=dict_row)

    def _stored_snapshot(
        self, row: dict[str, Any]
    ) -> tuple[MetadataSnapshot, dict[str, Any]]:
        try:
            payload = _decode_payload(row["payload_json"])
            snapshot = MetadataSnapshot.from_dict(payload)
            _validate_snapshot(snapshot)
        except MetadataHistoryIntegrityError:
            raise
        except Exception:
            raise MetadataHistoryIntegrityError(
                "Persisted metadata snapshot failed integrity verification"
            ) from None

        expected = _snapshot_summary(snapshot)
        if any(row[key] != value for key, value in expected.items()):
            raise MetadataHistoryIntegrityError(
                "Persisted metadata snapshot summary does not match its payload"
            )
        if _canonical_json(snapshot.to_dict()) != _canonical_json(payload):
            raise MetadataHistoryIntegrityError(
                "Persisted metadata snapshot payload is not canonical"
            )
        return snapshot, payload

    def _insert_snapshot(
        self, conn: psycopg.Connection, snapshot: MetadataSnapshot
    ) -> MetadataHistoryWriteOutcome:
        payload = snapshot.to_dict()
        summary = _snapshot_summary(snapshot)
        inserted = conn.execute(
            """
            INSERT INTO metadata_snapshot_history (
                snapshot_id, content_checksum, generated_at, schema_version,
                extractor_version, repository_commit, asset_count, field_count,
                constraint_count, lineage_edge_count, warning_count, error_count,
                payload_json
            ) VALUES (
                %(snapshot_id)s, %(content_checksum)s, %(generated_at)s,
                %(schema_version)s, %(extractor_version)s, %(repository_commit)s,
                %(asset_count)s, %(field_count)s, %(constraint_count)s,
                %(lineage_edge_count)s, %(warning_count)s, %(error_count)s,
                %(payload_json)s
            )
            ON CONFLICT (snapshot_id) DO NOTHING
            RETURNING snapshot_id;
            """,
            {**summary, "payload_json": Jsonb(payload)},
        ).fetchone()
        if inserted is not None:
            return MetadataHistoryWriteOutcome.INSERTED

        existing = conn.execute(
            "SELECT * FROM metadata_snapshot_history WHERE snapshot_id = %s;",
            (snapshot.snapshot_id,),
        ).fetchone()
        if existing is None:
            raise MetadataHistoryIntegrityError(
                "Existing metadata snapshot observation could not be read"
            )
        existing_snapshot, existing_payload = self._stored_snapshot(existing)
        if (
            _canonical_json(existing_payload) != _canonical_json(payload)
            or _snapshot_summary(existing_snapshot) != summary
        ):
            raise MetadataHistoryConflictError(
                "Metadata snapshot observation identity has different immutable content"
            )
        return MetadataHistoryWriteOutcome.EXISTING

    def record_snapshot(self, snapshot: MetadataSnapshot) -> MetadataSnapshotWriteResult:
        """Insert a snapshot or return EXISTING for an exact immutable replay."""
        _validate_snapshot(snapshot)

        def operation() -> MetadataSnapshotWriteResult:
            with self._connect() as conn:
                with conn.transaction():
                    outcome = self._insert_snapshot(conn, snapshot)
            return MetadataSnapshotWriteResult(snapshot.snapshot_id, outcome)

        return execute_with_retry(operation).result

    def record_comparison(
        self, baseline_snapshot: MetadataSnapshot, current_snapshot: MetadataSnapshot
    ) -> MetadataComparisonWriteResult:
        """Atomically record both observations and their deterministic comparison."""
        _validate_snapshot(baseline_snapshot)
        _validate_snapshot(current_snapshot)
        diff = compare_metadata_snapshots(baseline_snapshot, current_snapshot)
        if (
            diff.baseline_checksum != baseline_snapshot.content_checksum
            or diff.current_checksum != current_snapshot.content_checksum
        ):
            raise MetadataHistoryIntegrityError(
                "Computed metadata comparison does not match its input snapshots"
            )

        def operation() -> MetadataComparisonWriteResult:
            with self._connect() as conn:
                with conn.transaction():
                    baseline_outcome = self._insert_snapshot(conn, baseline_snapshot)
                    current_outcome = self._insert_snapshot(conn, current_snapshot)
                    comparison_outcome = self._insert_comparison(
                        conn,
                        diff,
                        baseline_snapshot.snapshot_id,
                        current_snapshot.snapshot_id,
                    )
            return MetadataComparisonWriteResult(
                diff.comparison_id,
                baseline_outcome,
                current_outcome,
                comparison_outcome,
                diff,
            )

        return execute_with_retry(operation).result

    def _insert_comparison(
        self,
        conn: psycopg.Connection,
        diff: MetadataDiff,
        baseline_snapshot_id: str,
        current_snapshot_id: str,
    ) -> MetadataHistoryWriteOutcome:
        summary = _diff_summary(diff)
        payload = diff.to_dict()
        inserted = conn.execute(
            """
            INSERT INTO metadata_diff_history (
                baseline_snapshot_id, current_snapshot_id, comparison_id,
                baseline_checksum, current_checksum, change_count, breaking_count,
                review_required_count, non_breaking_count, metadata_only_count,
                directly_changed_asset_count, downstream_impacted_asset_count,
                payload_json
            ) VALUES (
                %(baseline_snapshot_id)s, %(current_snapshot_id)s, %(comparison_id)s,
                %(baseline_checksum)s, %(current_checksum)s, %(change_count)s,
                %(breaking_count)s, %(review_required_count)s, %(non_breaking_count)s,
                %(metadata_only_count)s, %(directly_changed_asset_count)s,
                %(downstream_impacted_asset_count)s, %(payload_json)s
            )
            ON CONFLICT (baseline_snapshot_id, current_snapshot_id) DO NOTHING
            RETURNING comparison_id;
            """,
            {
                **summary,
                "baseline_snapshot_id": baseline_snapshot_id,
                "current_snapshot_id": current_snapshot_id,
                "payload_json": Jsonb(payload),
            },
        ).fetchone()
        if inserted is not None:
            return MetadataHistoryWriteOutcome.INSERTED

        existing = conn.execute(
            """
            SELECT * FROM metadata_diff_history
            WHERE baseline_snapshot_id = %s AND current_snapshot_id = %s;
            """,
            (baseline_snapshot_id, current_snapshot_id),
        ).fetchone()
        if existing is None:
            raise MetadataHistoryIntegrityError(
                "Existing metadata comparison observation could not be read"
            )
        existing_payload = _decode_payload(existing["payload_json"])
        expected_summary = {
            **summary,
            "baseline_snapshot_id": baseline_snapshot_id,
            "current_snapshot_id": current_snapshot_id,
        }
        if (
            any(existing[key] != value for key, value in expected_summary.items())
            or _canonical_json(existing_payload) != _canonical_json(payload)
        ):
            raise MetadataHistoryConflictError(
                "Metadata comparison observation identity has different immutable content"
            )
        return MetadataHistoryWriteOutcome.EXISTING

    def get_snapshot(self, snapshot_id: str) -> Optional[MetadataSnapshot]:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM metadata_snapshot_history WHERE snapshot_id = %s;",
                (snapshot_id,),
            ).fetchone()
            if row is None:
                return None
            snapshot, _ = self._stored_snapshot(row)
            return snapshot

    def get_latest_snapshot(self) -> Optional[MetadataSnapshot]:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT * FROM metadata_snapshot_history
                ORDER BY generated_at DESC, snapshot_id DESC
                LIMIT 1;
                """
            ).fetchone()
            if row is None:
                return None
            snapshot, _ = self._stored_snapshot(row)
            return snapshot

    def list_snapshots(
        self,
        *,
        limit: int = 100,
        before: Optional[tuple[datetime, str]] = None,
    ) -> list[MetadataSnapshot]:
        if not isinstance(limit, int) or isinstance(limit, bool) or limit < 1:
            raise ValueError("Snapshot list limit must be a positive integer")
        if before is not None and not _aware_datetime(before[0]):
            raise ValueError("Snapshot pagination timestamp must be timezone-aware")
        with self._connect() as conn:
            if before is None:
                rows = conn.execute(
                    """
                    SELECT * FROM metadata_snapshot_history
                    ORDER BY generated_at DESC, snapshot_id DESC
                    LIMIT %s;
                    """,
                    (limit,),
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT * FROM metadata_snapshot_history
                    WHERE (generated_at, snapshot_id) < (%s, %s)
                    ORDER BY generated_at DESC, snapshot_id DESC
                    LIMIT %s;
                    """,
                    (before[0], before[1], limit),
                ).fetchall()
            return [self._stored_snapshot(row)[0] for row in rows]

    def get_comparison(
        self, baseline_snapshot_id: str, current_snapshot_id: str
    ) -> Optional[MetadataDiff]:
        with self._connect() as conn:
            with conn.transaction():
                row = conn.execute(
                    """
                    SELECT * FROM metadata_diff_history
                    WHERE baseline_snapshot_id = %s AND current_snapshot_id = %s;
                    """,
                    (baseline_snapshot_id, current_snapshot_id),
                ).fetchone()
                if row is None:
                    return None
                baseline_row = conn.execute(
                    "SELECT * FROM metadata_snapshot_history WHERE snapshot_id = %s;",
                    (baseline_snapshot_id,),
                ).fetchone()
                current_row = conn.execute(
                    "SELECT * FROM metadata_snapshot_history WHERE snapshot_id = %s;",
                    (current_snapshot_id,),
                ).fetchone()
                if baseline_row is None or current_row is None:
                    raise MetadataHistoryIntegrityError(
                        "Metadata comparison references a missing snapshot"
                    )
                baseline, _ = self._stored_snapshot(baseline_row)
                current, _ = self._stored_snapshot(current_row)
                try:
                    diff = compare_metadata_snapshots(baseline, current)
                except MetadataIntegrityError:
                    raise MetadataHistoryIntegrityError(
                        "Metadata comparison snapshots failed integrity verification"
                    ) from None
                stored_payload = _decode_payload(row["payload_json"])
                if (
                    any(row[key] != value for key, value in _diff_summary(diff).items())
                    or _canonical_json(stored_payload) != _canonical_json(diff.to_dict())
                ):
                    raise MetadataHistoryIntegrityError(
                        "Persisted metadata comparison failed integrity verification"
                    )
                return diff


__all__ = [
    "MetadataComparisonWriteResult",
    "MetadataHistoryConflictError",
    "MetadataHistoryError",
    "MetadataHistoryIntegrityError",
    "MetadataHistoryWriteOutcome",
    "MetadataSnapshotWriteResult",
    "PostgresMetadataHistoryStore",
]
