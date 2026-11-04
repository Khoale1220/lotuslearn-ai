"""PostgreSQL durable storage backend for LotusLearn analytical pipeline.

Implements PostgreSQL 18 relational storage using Psycopg 3 with strict transactionality,
advisory-locked checksummed migrations, atomic event arbitration, bounded retry for 40001/40P01,
and cascade delete safety.
"""

import hashlib
import json
import logging
import os
import time
from datetime import datetime, timezone
from importlib import resources
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

import psycopg
from psycopg.rows import dict_row

from lotuslearn_pipeline.ingestion import AnalyticalEventValidator
from lotuslearn_pipeline.models import IngestionOutcome, IngestionResult
from lotuslearn_pipeline.retry import execute_with_retry
from lotuslearn_pipeline.storage import canonical_json_string

logger = logging.getLogger("lotuslearn_pipeline.postgres")

LOTUSLEARN_MIGRATION_LOCK_ID = 0x4C4F5455534D4947  # Stable 64-bit advisory lock key


class MigrationDriftError(RuntimeError):
    """Raised when an applied migration checksum differs from packaged migration artifact."""


class MigrationFileMissingError(RuntimeError):
    """Raised when an applied migration record has no corresponding packaged artifact."""


class AnalysisRunConflictError(ValueError):
    """Raised when an analysis_run_id exists with differing immutable metadata."""


def compute_migration_checksum(sql_text: str) -> str:
    """Computes deterministic SHA-256 hex checksum of migration SQL."""
    return hashlib.sha256(sql_text.strip().encode("utf-8")).hexdigest()


def get_postgres_migration_files() -> List[Tuple[str, str, str, str]]:
    """
    Discovers packaged PostgreSQL migration files.
    Returns sorted list of (version_key, filename, sql_content, sha256_checksum).
    """
    migrations: List[Tuple[str, str, str, str]] = []
    found_files: List[Tuple[str, str]] = []

    try:
        mig_dir = resources.files("lotuslearn_pipeline.migrations.postgres")
        for entry in mig_dir.iterdir():
            if entry.name.endswith(".sql"):
                found_files.append((entry.name, entry.read_text(encoding="utf-8")))
    except Exception:
        fallback_dir = Path(__file__).resolve().parent / "migrations" / "postgres"
        if fallback_dir.exists():
            for entry in fallback_dir.iterdir():
                if entry.name.endswith(".sql"):
                    found_files.append((entry.name, entry.read_text(encoding="utf-8")))

    found_files.sort(key=lambda m: m[0])
    for filename, sql_text in found_files:
        version_key = filename.split("_")[0] if "_" in filename else filename
        checksum = compute_migration_checksum(sql_text)
        migrations.append((version_key, filename, sql_text, checksum))

    return migrations


def apply_postgres_migrations(conn: psycopg.Connection) -> List[str]:
    """
    Applies any unapplied PostgreSQL migrations in deterministic filename order.
    Protected by PostgreSQL transaction-level advisory lock (pg_advisory_xact_lock).
    Validates SHA-256 checksums, enforces immutable migration history, and adops legacy rows.
    """
    applied_now: List[str] = []
    migrations = get_postgres_migration_files()
    packaged_by_version = {m[0]: m for m in migrations}
    packaged_by_filename = {m[1]: m for m in migrations}

    with conn.transaction():
        # 1. Acquire transaction-level advisory lock
        conn.execute("SELECT pg_advisory_xact_lock(%s);", (LOTUSLEARN_MIGRATION_LOCK_ID,))

        # 2. Ensure schema_migrations table and columns exist
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version TEXT PRIMARY KEY,
                name TEXT,
                checksum TEXT,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        conn.execute("ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS name TEXT;")
        conn.execute("ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum TEXT;")

        # 3. Read applied migrations
        with conn.cursor() as cur:
            cur.execute(
                "SELECT version, name, checksum FROM schema_migrations ORDER BY applied_at;"
            )
            applied_rows = cur.fetchall()

        applied_versions: Set[str] = set()

        for row in applied_rows:
            v_key = row["version"]
            stored_name = row["name"]
            stored_checksum = row["checksum"]

            # Locate matching packaged migration by version prefix or full filename
            matched = (
                packaged_by_filename.get(v_key)
                or packaged_by_version.get(v_key)
                or (packaged_by_filename.get(stored_name) if stored_name else None)
            )

            if not matched:
                raise MigrationFileMissingError(
                    f"MIGRATION_FILE_MISSING: Applied migration '{v_key}' "
                    "not found in packaged migration files."
                )

            pkg_v, pkg_name, _, expected_checksum = matched
            applied_versions.add(pkg_v)
            applied_versions.add(pkg_name)
            applied_versions.add(v_key)

            # 4. Legacy Checksum Adoption
            if stored_checksum is None:
                conn.execute(
                    """
                    UPDATE schema_migrations
                    SET checksum = %s, name = %s
                    WHERE version = %s AND checksum IS NULL;
                    """,
                    (expected_checksum, pkg_name, v_key),
                )
            else:
                # 5. Migration Drift Verification
                if stored_checksum != expected_checksum:
                    raise MigrationDriftError(
                        f"MIGRATION_DRIFT: Checksum mismatch for migration '{v_key}'. "
                        f"Stored={stored_checksum}, Expected={expected_checksum}."
                    )

        # 6. Apply pending migrations
        for v_key, filename, sql_text, checksum in migrations:
            if v_key not in applied_versions and filename not in applied_versions:
                conn.execute(sql_text)
                conn.execute(
                    """
                    INSERT INTO schema_migrations (version, name, checksum, applied_at)
                    VALUES (%s, %s, %s, %s);
                    """,
                    (filename, filename, checksum, datetime.now(timezone.utc)),
                )
                applied_now.append(filename)

    return applied_now


def get_migration_status(conn: psycopg.Connection) -> List[Dict[str, Any]]:
    """Returns current status of all packaged migrations against database."""
    migrations = get_postgres_migration_files()

    applied_rows: Dict[str, Any] = {}
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'schema_migrations'
            ) AS tbl_exists;
            """
        )
        res = cur.fetchone()
        tbl_exists = res["tbl_exists"] if res else False

        if tbl_exists:
            cur.execute(
                "SELECT version, name, checksum, applied_at "
                "FROM schema_migrations ORDER BY applied_at;"
            )
            applied_rows = {r["version"]: r for r in cur.fetchall()}

    status_list: List[Dict[str, Any]] = []
    for v_key, filename, _, expected_checksum in migrations:
        row = applied_rows.get(v_key) or applied_rows.get(filename)
        if row:
            stored_checksum = row["checksum"]
            is_valid = stored_checksum == expected_checksum
            status_list.append(
                {
                    "version": v_key,
                    "name": filename,
                    "applied": True,
                    "applied_at": row["applied_at"],
                    "checksum": stored_checksum,
                    "checksum_valid": is_valid,
                    "match": is_valid,
                }
            )
        else:
            status_list.append(
                {
                    "version": v_key,
                    "name": filename,
                    "applied": False,
                    "applied_at": None,
                    "checksum": expected_checksum,
                    "checksum_valid": True,
                    "match": None,
                }
            )
    return status_list


def _normalize_iso_datetime(dt_val: Any) -> Optional[datetime]:
    """Converts a string ISO timestamp or datetime to a UTC-aware datetime."""
    if dt_val is None:
        return None
    if isinstance(dt_val, datetime):
        if dt_val.tzinfo is None:
            return dt_val.replace(tzinfo=timezone.utc)
        return dt_val.astimezone(timezone.utc)
    if isinstance(dt_val, str):
        cleaned = dt_val.replace("Z", "+00:00")
        dt = datetime.fromisoformat(cleaned)
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    return None


class PostgresAnalyticalDatabase:
    """Encapsulates PostgreSQL 18 connection, versioned migrations, and transactional ingestion."""

    def __init__(
        self,
        connection_string: Optional[str] = None,
        connection_url: Optional[str] = None,
    ):
        self.connection_string = (
            connection_string
            or connection_url
            or os.environ.get("LOTUSLEARN_DATABASE_URL", "")
        )
        self._conn: Optional[psycopg.Connection] = None
        self.fault_hook: Optional[Callable[[str], None]] = None

    def get_connection(self) -> psycopg.Connection:
        """Returns or establishes a psycopg 3 connection with dict_row factory."""
        if self._conn is None or self._conn.closed:
            self._conn = psycopg.connect(
                self.connection_string,
                row_factory=dict_row,
                autocommit=False,
            )
        return self._conn

    def initialize_schema(self) -> List[str]:
        """Applies versioned migrations under advisory lock."""
        conn = self.get_connection()
        return apply_postgres_migrations(conn)

    def get_committed_event_ids(self) -> Set[str]:
        """Returns set of all committed analytical event IDs."""
        conn = self.get_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT event_id FROM analytical_events;")
            return {row["event_id"] for row in cur.fetchall()}

    def record_audit_log(self, results: List[IngestionResult]) -> None:
        """Appends ingestion results to ingestion_audit_log table."""
        conn = self.get_connection()
        now_dt = datetime.now(timezone.utc)
        with conn.transaction():
            for r in results:
                conn.execute(
                    """
                    INSERT INTO ingestion_audit_log (
                        event_id, event_type, outcome, rejection_reason, processed_at
                    ) VALUES (%s, %s, %s, %s, %s);
                    """,
                    (r.event_id, r.event_type, r.outcome.value, r.rejection_reason, now_dt),
                )

    def ingest_single_event(
        self,
        event: Dict[str, Any],
        validator: Optional[AnalyticalEventValidator] = None,
        sleep_fn: Callable[[float], None] = time.sleep,
    ) -> IngestionResult:
        """
        Transactional ingestion for a single analytical event on PostgreSQL.
        Atomic uniqueness: PostgreSQL unique constraint arbitrates concurrent event identity.
        Bounded retry: Retries only transaction serialization failures (40001) and deadlocks.
        """
        start_time = time.monotonic()
        val = validator or AnalyticalEventValidator()
        event_id = str(event.get("event_id", "missing_id"))
        event_type = event.get("event_type")
        now_dt = datetime.now(timezone.utc)

        # Pre-transaction schema & zero-PII validation
        val_result = val.validate_event(event)
        if val_result.outcome != IngestionOutcome.ACCEPTED:
            self.record_audit_log([val_result])
            return val_result

        conn = self.get_connection()

        def _do_ingest() -> IngestionResult:
            if self.fault_hook:
                self.fault_hook("transaction_start")

            # Check if event_id already committed
            with conn.cursor() as cur_check:
                cur_check.execute(
                    "SELECT payload_json FROM analytical_events WHERE event_id = %s;",
                    (event_id,),
                )
                existing_env = cur_check.fetchone()

            if existing_env:
                existing_payload = existing_env["payload_json"]
                if isinstance(existing_payload, str):
                    try:
                        existing_payload = json.loads(existing_payload)
                    except Exception:
                        existing_payload = None

                is_match = (
                    canonical_json_string(existing_payload) == canonical_json_string(event)
                    if existing_payload is not None
                    else False
                )
                if is_match:
                    res = IngestionResult(
                        event_id=event_id,
                        outcome=IngestionOutcome.DUPLICATE,
                        rejection_reason="DUPLICATE_EVENT_ID: exact event already ingested",
                        event_type=event_type,
                    )
                    self.record_audit_log([res])
                    return res
                else:
                    conflict_reason = (
                        "IDENTITY_CONFLICT_PAYLOAD_MISMATCH: "
                        "event_id already exists with different payload"
                    )
                    res = IngestionResult(
                        event_id=event_id,
                        outcome=IngestionOutcome.CONFLICT,
                        rejection_reason=conflict_reason,
                        event_type=event_type,
                    )
                    self.record_audit_log([res])
                    return res

            with conn.transaction():
                run_id = event["analysis_run_id"]

                # 1. Atomic Analysis Run Conflict Check / Upsert
                if event_type == "ANALYSIS_INGESTED":
                    with conn.cursor() as cur_run:
                        cur_run.execute(
                            """
                            INSERT INTO analysis_runs (
                                run_id, dataset_fingerprint, submission_count, subject,
                                grade_level, total_duration_ms, execution_mode, occurred_at
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                            ON CONFLICT (run_id) DO UPDATE SET run_id = EXCLUDED.run_id
                            RETURNING dataset_fingerprint, submission_count, subject,
                                      grade_level, total_duration_ms, execution_mode, occurred_at;
                            """,
                            (
                                run_id,
                                event["dataset_fingerprint"],
                                event["submission_count"],
                                event["subject"],
                                event["grade_level"],
                                event.get("total_duration_ms"),
                                event.get("execution_mode"),
                                event["occurred_at"],
                            ),
                        )
                        existing_run = cur_run.fetchone()

                    if existing_run:
                        db_occurred = _normalize_iso_datetime(existing_run["occurred_at"])
                        ev_occurred = _normalize_iso_datetime(event["occurred_at"])
                        is_same_metadata = (
                            existing_run["dataset_fingerprint"] == event["dataset_fingerprint"]
                            and existing_run["submission_count"] == event["submission_count"]
                            and existing_run["subject"] == event["subject"]
                            and existing_run["grade_level"] == event["grade_level"]
                            and existing_run["total_duration_ms"] == event.get("total_duration_ms")
                            and existing_run["execution_mode"] == event.get("execution_mode")
                            and db_occurred == ev_occurred
                        )
                        if not is_same_metadata:
                            conflict_reason = (
                                f"ANALYSIS_RUN_CONFLICT: analysis_run_id '{run_id}' "
                                "already exists with differing immutable metadata"
                            )
                            raise AnalysisRunConflictError(conflict_reason)

                    if self.fault_hook:
                        self.fault_hook("after_run_insert")

                # 2. Atomic Envelope Insert in analytical_events
                with conn.cursor() as cur_env:
                    cur_env.execute(
                        """
                        INSERT INTO analytical_events (
                            event_id, schema_version, event_type, occurred_at,
                            analysis_run_id, provenance, payload_json
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (event_id) DO NOTHING
                        RETURNING event_id;
                        """,
                        (
                            event["event_id"],
                            event["schema_version"],
                            event["event_type"],
                            event["occurred_at"],
                            event["analysis_run_id"],
                            event["provenance"],
                            json.dumps(event),
                        ),
                    )
                    inserted_row = cur_env.fetchone()

                # If event_id was NOT inserted, it already exists
                # (concurrent or sequential duplicate/conflict)
                if inserted_row is None:
                    # Compare canonical payloads
                    with conn.cursor() as cur_existing:
                        cur_existing.execute(
                            "SELECT payload_json FROM analytical_events WHERE event_id = %s;",
                            (event_id,),
                        )
                        existing_row = cur_existing.fetchone()

                    existing_payload = existing_row["payload_json"] if existing_row else None
                    if isinstance(existing_payload, str):
                        try:
                            existing_payload = json.loads(existing_payload)
                        except Exception:
                            existing_payload = None

                    is_match = (
                        canonical_json_string(existing_payload) == canonical_json_string(event)
                        if existing_payload is not None
                        else False
                    )

                    if is_match:
                        # Harmless idempotent replay
                        res = IngestionResult(
                            event_id=event_id,
                            outcome=IngestionOutcome.DUPLICATE,
                            rejection_reason="DUPLICATE_EVENT_ID: exact event already ingested",
                            event_type=event_type,
                        )
                        # Record audit within separate transaction to avoid rollbacks
                        conn.execute(
                            """
                            INSERT INTO ingestion_audit_log (
                                event_id, event_type, outcome, rejection_reason, processed_at
                            ) VALUES (%s, %s, %s, %s, %s);
                            """,
                            (
                                event_id,
                                event_type,
                                IngestionOutcome.DUPLICATE.value,
                                res.rejection_reason,
                                now_dt,
                            ),
                        )
                        return res
                    else:
                        conflict_reason = (
                            "IDENTITY_CONFLICT_PAYLOAD_MISMATCH: "
                            "event_id already exists with different payload"
                        )
                        res = IngestionResult(
                            event_id=event_id,
                            outcome=IngestionOutcome.CONFLICT,
                            rejection_reason=conflict_reason,
                            event_type=event_type,
                        )
                        conn.execute(
                            """
                            INSERT INTO ingestion_audit_log (
                                event_id, event_type, outcome, rejection_reason, processed_at
                            ) VALUES (%s, %s, %s, %s, %s);
                            """,
                            (
                                event_id,
                                event_type,
                                IngestionOutcome.CONFLICT.value,
                                conflict_reason,
                                now_dt,
                            ),
                        )
                        return res

                # 3. New Event Winner: Write Relational Projections
                if event_type == "FINDING_IDENTIFIED":
                    cluster_id = event["finding_id"]
                    conn.execute(
                        """
                        INSERT INTO misconception_clusters (
                            analysis_run_id, cluster_id, concept, teaching_priority,
                            affected_student_count, percentage_affected, explanation
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (analysis_run_id, cluster_id) DO UPDATE SET
                            concept = EXCLUDED.concept,
                            teaching_priority = EXCLUDED.teaching_priority,
                            affected_student_count = EXCLUDED.affected_student_count,
                            percentage_affected = EXCLUDED.percentage_affected,
                            explanation = EXCLUDED.explanation;
                        """,
                        (
                            run_id,
                            cluster_id,
                            event["concept"],
                            event["teaching_priority"],
                            event["affected_student_count"],
                            event.get("percentage_affected"),
                            event.get("explanation"),
                        ),
                    )
                    for sid in event.get("affected_student_ids", []):
                        conn.execute(
                            """
                            INSERT INTO student_findings (
                                analysis_run_id, cluster_id, student_id
                            ) VALUES (%s, %s, %s)
                            ON CONFLICT (analysis_run_id, cluster_id, student_id) DO NOTHING;
                            """,
                            (run_id, cluster_id, sid),
                        )

                elif event_type == "GROUP_FORMED":
                    group_id = event["group_id"]
                    conn.execute(
                        """
                        INSERT INTO instructional_groups (
                            analysis_run_id, group_id, group_name, student_count,
                            suggested_activity, estimated_duration
                        ) VALUES (%s, %s, %s, %s, %s, %s)
                        ON CONFLICT (analysis_run_id, group_id) DO UPDATE SET
                            group_name = EXCLUDED.group_name,
                            student_count = EXCLUDED.student_count,
                            suggested_activity = EXCLUDED.suggested_activity,
                            estimated_duration = EXCLUDED.estimated_duration;
                        """,
                        (
                            run_id,
                            group_id,
                            event["group_name"],
                            event["student_count"],
                            event["suggested_activity"],
                            event.get("estimated_duration"),
                        ),
                    )
                    for sid in event.get("student_ids", []):
                        conn.execute(
                            """
                            INSERT INTO group_memberships (
                                analysis_run_id, group_id, student_id
                            ) VALUES (%s, %s, %s)
                            ON CONFLICT (analysis_run_id, group_id, student_id) DO NOTHING;
                            """,
                            (run_id, group_id, sid),
                        )

                elif event_type == "VERIFICATION_AUDITED":
                    conn.execute(
                        """
                        INSERT INTO verifications (
                            analysis_run_id, overall_status, coverage_passed,
                            cluster_math_passed, group_partition_passed,
                            quotes_grounded_count, quotes_flagged_count
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (analysis_run_id) DO UPDATE SET
                            overall_status = EXCLUDED.overall_status,
                            coverage_passed = EXCLUDED.coverage_passed,
                            cluster_math_passed = EXCLUDED.cluster_math_passed,
                            group_partition_passed = EXCLUDED.group_partition_passed,
                            quotes_grounded_count = EXCLUDED.quotes_grounded_count,
                            quotes_flagged_count = EXCLUDED.quotes_flagged_count;
                        """,
                        (
                            run_id,
                            event["overall_status"],
                            bool(event["coverage_passed"]),
                            bool(event["cluster_math_passed"]),
                            bool(event["group_partition_passed"]),
                            event["quotes_grounded_count"],
                            event["quotes_flagged_count"],
                        ),
                    )

                elif event_type == "DECISION_RECORDED":
                    rec_at = event.get("decision_recorded_at", event["occurred_at"])
                    # Historical action append (keyed by unique event_id)
                    conn.execute(
                        """
                        INSERT INTO teacher_decisions (
                            event_id, analysis_run_id, target_type, target_id,
                            teacher_decision, notes, recorded_at
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (event_id) DO UPDATE SET
                            teacher_decision = EXCLUDED.teacher_decision,
                            notes = EXCLUDED.notes;
                        """,
                        (
                            event["event_id"],
                            run_id,
                            event["target_type"],
                            event["target_id"],
                            event["teacher_decision"],
                            event.get("notes"),
                            rec_at,
                        ),
                    )
                    # Latest state projection update
                    conn.execute(
                        """
                        INSERT INTO current_teacher_decisions (
                            analysis_run_id, target_type, target_id, teacher_decision,
                            notes, updated_at, last_event_id
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (analysis_run_id, target_type, target_id) DO UPDATE SET
                            teacher_decision = EXCLUDED.teacher_decision,
                            notes = EXCLUDED.notes,
                            updated_at = EXCLUDED.updated_at,
                            last_event_id = EXCLUDED.last_event_id
                        WHERE EXCLUDED.updated_at > current_teacher_decisions.updated_at
                           OR (
                               EXCLUDED.updated_at = current_teacher_decisions.updated_at
                               AND EXCLUDED.last_event_id >
                                   current_teacher_decisions.last_event_id
                           );
                        """,
                        (
                            run_id,
                            event["target_type"],
                            event["target_id"],
                            event["teacher_decision"],
                            event.get("notes"),
                            rec_at,
                            event["event_id"],
                        ),
                    )

                if self.fault_hook:
                    self.fault_hook("after_projection")

                # Append audit log
                conn.execute(
                    """
                    INSERT INTO ingestion_audit_log (
                        event_id, event_type, outcome, rejection_reason, processed_at
                    ) VALUES (%s, %s, %s, %s, %s);
                    """,
                    (event_id, event_type, IngestionOutcome.ACCEPTED.value, None, now_dt),
                )

                if self.fault_hook:
                    self.fault_hook("before_commit")

            return IngestionResult(
                event_id=event_id,
                outcome=IngestionOutcome.ACCEPTED,
                event_type=event_type,
            )

        # Execute logical transaction inside bounded retry subsystem
        try:
            retry_exec = execute_with_retry(_do_ingest, sleep_fn=sleep_fn)
            duration_ms = (time.monotonic() - start_time) * 1000
            res = retry_exec.result
            if retry_exec.attempts > 1:
                res = IngestionResult(
                    event_id=res.event_id,
                    outcome=res.outcome,
                    rejection_reason=res.rejection_reason,
                    event_type=res.event_type,
                    retry_attempts=retry_exec.attempts,
                )

            # Operational logging
            logger.info(
                json.dumps(
                    {
                        "backend": "postgres",
                        "event_id": event_id[:16],
                        "event_type": event_type,
                        "outcome": res.outcome.value,
                        "attempts": retry_exec.attempts,
                        "duration_ms": round(duration_ms, 2),
                    }
                )
            )
            return res

        except AnalysisRunConflictError as arc_err:
            res = IngestionResult(
                event_id=event_id,
                outcome=IngestionOutcome.CONFLICT,
                rejection_reason=str(arc_err),
                event_type=event_type,
            )
            self.record_audit_log([res])
            return res

        except Exception as exc:
            err_msg = str(exc)
            res = IngestionResult(
                event_id=event_id,
                outcome=IngestionOutcome.REJECTED,
                rejection_reason=f"INGESTION_TRANSACTION_FAILED: {type(exc).__name__}: {err_msg}",
                event_type=event_type,
            )
            self.record_audit_log([res])
            return res

    def load_events(self, events: List[Dict[str, Any]]) -> List[IngestionResult]:
        """
        Loads batch of events with foreign-key safe dependency ordering:
        ANALYSIS_INGESTED first, then dependent child events.
        """
        run_events = [e for e in events if e.get("event_type") == "ANALYSIS_INGESTED"]
        child_events = [e for e in events if e.get("event_type") != "ANALYSIS_INGESTED"]

        results: List[IngestionResult] = []
        val = AnalyticalEventValidator()

        for ev in run_events:
            results.append(self.ingest_single_event(ev, validator=val))
        for ev in child_events:
            results.append(self.ingest_single_event(ev, validator=val))

        return results

    def compute_metrics(self) -> Any:
        """Computes metrics via the authoritative SQL queries."""
        from lotuslearn_pipeline.metrics import compute_pipeline_metrics

        return compute_pipeline_metrics(self)

    def close(self) -> None:
        """Closes the underlying database connection if open."""
        if self._conn and not self._conn.closed:
            self._conn.close()
            self._conn = None
