"""PostgreSQL durable storage backend for LotusLearn analytical pipeline.

Implements PostgreSQL 18 relational storage using Psycopg 3 with strict transactionality,
cascade delete safety, immutable run conflict detection, and authoritative event replay.
"""

import json
from datetime import datetime, timezone
from importlib import resources
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import psycopg
from psycopg.rows import dict_row

from lotuslearn_pipeline.ingestion import AnalyticalEventValidator
from lotuslearn_pipeline.models import IngestionOutcome, IngestionResult
from lotuslearn_pipeline.storage import canonical_json_string


def get_postgres_migration_files() -> List[Tuple[str, str]]:
    """Discovers and returns sorted (version_filename, sql_content) pairs."""
    migrations: List[Tuple[str, str]] = []
    try:
        mig_dir = resources.files("lotuslearn_pipeline.migrations.postgres")
        for entry in mig_dir.iterdir():
            if entry.name.endswith(".sql"):
                migrations.append((entry.name, entry.read_text(encoding="utf-8")))
    except Exception:
        fallback_dir = Path(__file__).resolve().parent / "migrations" / "postgres"
        if fallback_dir.exists():
            for entry in fallback_dir.iterdir():
                if entry.name.endswith(".sql"):
                    migrations.append((entry.name, entry.read_text(encoding="utf-8")))

    migrations.sort(key=lambda m: m[0])
    return migrations


def apply_postgres_migrations(conn: psycopg.Connection) -> List[str]:
    """
    Applies any unapplied PostgreSQL migrations in deterministic filename order.
    Creates schema_migrations tracking table if absent.
    Returns list of newly applied migration versions.
    """
    with conn.transaction():
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )

    with conn.cursor() as cur:
        cur.execute("SELECT version FROM schema_migrations;")
        applied = {row["version"] for row in cur.fetchall()}

    applied_now: List[str] = []
    migrations = get_postgres_migration_files()
    for version, sql_text in migrations:
        if version not in applied:
            with conn.transaction():
                conn.execute(sql_text)
                conn.execute(
                    "INSERT INTO schema_migrations (version, applied_at) VALUES (%s, %s);",
                    (version, datetime.now(timezone.utc)),
                )
            applied_now.append(version)

    return applied_now


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
    """Encapsulates PostgreSQL connection, versioned migrations, and transactional ingestion."""

    def __init__(self, connection_string: str):
        self.connection_string = connection_string
        self._conn: Optional[psycopg.Connection] = None

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
        """Applies versioned migrations to the PostgreSQL database."""
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
                    ) VALUES (%s, %s, %s, %s, %s)
                    """,
                    (r.event_id, r.event_type, r.outcome.value, r.rejection_reason, now_dt),
                )

    def ingest_single_event(
        self,
        event: Dict[str, Any],
        validator: Optional[AnalyticalEventValidator] = None,
    ) -> IngestionResult:
        """
        Transactional ingestion for a single analytical event on PostgreSQL:
        1. Validate schema and zero-PII constraints
        2. Check authoritative analytical_events identity:
           - Same ID + identical payload -> DUPLICATE (idempotent replay)
           - Same ID + differing payload -> CONFLICT (IDENTITY_CONFLICT_PAYLOAD_MISMATCH)
        3. Transaction block:
           - Ingest relational projections (ON CONFLICT DO UPDATE for cascade safety)
           - Enforce immutable analysis run metadata checks
           - Insert analytical_events immutable envelope
           - Insert ingestion_audit_log entry
        4. Commit or rollback on failure
        """
        val = validator or AnalyticalEventValidator()
        event_id = str(event.get("event_id", "missing_id"))
        event_type = event.get("event_type")
        now_dt = datetime.now(timezone.utc)

        # Step 1: Pre-transaction validation
        val_result = val.validate_event(event)
        if val_result.outcome != IngestionOutcome.ACCEPTED:
            self.record_audit_log([val_result])
            return val_result

        conn = self.get_connection()

        # Step 2: Authoritative identity check in analytical_events
        with conn.cursor() as cur:
            cur.execute(
                "SELECT payload_json FROM analytical_events WHERE event_id = %s;",
                (event_id,),
            )
            existing_row = cur.fetchone()

        if existing_row is not None:
            existing_payload = existing_row["payload_json"]
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

        # Step 3: Transactional write
        try:
            with conn.transaction():
                run_id = event["analysis_run_id"]

                if event_type == "ANALYSIS_INGESTED":
                    with conn.cursor() as cur_run:
                        cur_run.execute(
                            """
                            SELECT dataset_fingerprint, submission_count, subject,
                                   grade_level, total_duration_ms, execution_mode, occurred_at
                            FROM analysis_runs WHERE run_id = %s;
                            """,
                            (run_id,),
                        )
                        existing_run = cur_run.fetchone()

                    if existing_run is not None:
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
                            # Rollback transaction cleanly
                            raise ValueError(conflict_reason)
                    else:
                        conn.execute(
                            """
                            INSERT INTO analysis_runs (
                                run_id, dataset_fingerprint, submission_count, subject,
                                grade_level, total_duration_ms, execution_mode, occurred_at
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
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

                elif event_type == "FINDING_IDENTIFIED":
                    cluster_id = event["finding_id"]
                    conn.execute(
                        """
                        INSERT INTO misconception_clusters (
                            analysis_run_id, cluster_id, concept, teaching_priority,
                            affected_student_count, percentage_affected, explanation
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT(analysis_run_id, cluster_id) DO UPDATE SET
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
                            ON CONFLICT(analysis_run_id, cluster_id, student_id) DO NOTHING;
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
                        ON CONFLICT(analysis_run_id, group_id) DO UPDATE SET
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
                            ON CONFLICT(analysis_run_id, group_id, student_id) DO NOTHING;
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
                        ON CONFLICT(analysis_run_id) DO UPDATE SET
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
                    # 1. Historical action append
                    conn.execute(
                        """
                        INSERT INTO teacher_decisions (
                            analysis_run_id, target_type, target_id, teacher_decision,
                            notes, recorded_at
                        ) VALUES (%s, %s, %s, %s, %s, %s)
                        ON CONFLICT(analysis_run_id, target_type, target_id, recorded_at)
                        DO UPDATE SET
                            teacher_decision = EXCLUDED.teacher_decision,
                            notes = EXCLUDED.notes;
                        """,
                        (
                            run_id,
                            event["target_type"],
                            event["target_id"],
                            event["teacher_decision"],
                            event.get("notes"),
                            rec_at,
                        ),
                    )
                    # 2. Latest state projection update
                    # (out-of-order protected with deterministic tie rule)
                    conn.execute(
                        """
                        INSERT INTO current_teacher_decisions (
                            analysis_run_id, target_type, target_id, teacher_decision,
                            notes, updated_at, last_event_id
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT(analysis_run_id, target_type, target_id) DO UPDATE SET
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

                # Write immutable event envelope
                conn.execute(
                    """
                    INSERT INTO analytical_events (
                        event_id, schema_version, event_type, occurred_at,
                        analysis_run_id, provenance, payload_json
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s);
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

                # Append audit log
                conn.execute(
                    """
                    INSERT INTO ingestion_audit_log (
                        event_id, event_type, outcome, rejection_reason, processed_at
                    ) VALUES (%s, %s, %s, %s, %s);
                    """,
                    (event_id, event_type, IngestionOutcome.ACCEPTED.value, None, now_dt),
                )

            return IngestionResult(
                event_id=event_id,
                outcome=IngestionOutcome.ACCEPTED,
                event_type=event_type,
            )
        except Exception as exc:
            err_msg = str(exc)
            if "ANALYSIS_RUN_CONFLICT" in err_msg:
                outcome = IngestionOutcome.CONFLICT
                reason = err_msg
            else:
                outcome = IngestionOutcome.REJECTED
                reason = f"INGESTION_TRANSACTION_FAILED: {type(exc).__name__}: {err_msg}"

            res = IngestionResult(
                event_id=event_id,
                outcome=outcome,
                rejection_reason=reason,
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
