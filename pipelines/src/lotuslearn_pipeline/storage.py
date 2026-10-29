"""SQLite relational storage engine with strict transactionality, cascade delete safety,
and conflict detection."""

import json
import sqlite3
from datetime import datetime, timezone
from importlib import resources
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from lotuslearn_pipeline.ingestion import AnalyticalEventValidator
from lotuslearn_pipeline.models import IngestionOutcome, IngestionResult


def load_sql_resource(filename: str) -> str:
    """Loads SQL resource text via importlib.resources or repo fallback."""
    try:
        res = resources.files("lotuslearn_pipeline.sql").joinpath(filename)
        return res.read_text(encoding="utf-8")
    except Exception:
        fallback = Path(__file__).resolve().parent / "sql" / filename
        return fallback.read_text(encoding="utf-8")


_load_sql_resource = load_sql_resource


def canonical_json_string(obj: Any) -> str:
    """Returns deterministic canonical JSON string for payload comparison."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"))


class AnalyticalDatabase:
    """Encapsulates SQLite connection, relational schema, and query execution."""

    def __init__(self, db_path: str = ":memory:"):
        self.db_path = db_path
        self._conn: Optional[sqlite3.Connection] = None

    def get_connection(self) -> sqlite3.Connection:
        """Get or create connection with verified foreign keys."""
        if self._conn is None:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            # Mandatory constraint check on every connection
            conn.execute("PRAGMA foreign_keys = ON;")
            cursor = conn.execute("PRAGMA foreign_keys;")
            fk_enabled = cursor.fetchone()[0]
            if not fk_enabled:
                raise RuntimeError("Failed to enable foreign keys in SQLite connection.")
            self._conn = conn
        return self._conn

    def initialize_schema(self) -> None:
        """Executes schema.sql and transformations.sql from package resources."""
        conn = self.get_connection()
        schema_sql = _load_sql_resource("schema.sql")
        transformations_sql = _load_sql_resource("transformations.sql")
        with conn:
            conn.executescript(schema_sql)
            conn.executescript(transformations_sql)

    def get_committed_event_ids(self) -> Set[str]:
        """Fetch all committed analytical event IDs (authoritative replay boundary)."""
        conn = self.get_connection()
        cursor = conn.execute("SELECT event_id FROM analytical_events")
        return {row["event_id"] for row in cursor.fetchall()}

    def record_audit_log(self, results: List[IngestionResult]) -> None:
        """Appends ingestion attempts to append-only ingestion_audit_log."""
        conn = self.get_connection()
        now_iso = datetime.now(timezone.utc).isoformat()
        with conn:
            for r in results:
                conn.execute(
                    """
                    INSERT INTO ingestion_audit_log (
                        event_id, event_type, outcome, rejection_reason, processed_at
                    ) VALUES (?, ?, ?, ?, ?)
                    """,
                    (r.event_id, r.event_type, r.outcome.value, r.rejection_reason, now_iso),
                )

    def ingest_single_event(
        self,
        event: Dict[str, Any],
        validator: Optional[AnalyticalEventValidator] = None,
    ) -> IngestionResult:
        """
        Transactional ingestion for a single analytical event:
        1. Validate schema & zero-PII
        2. Begin transaction
        3. Authoritative replay & conflict check in analytical_events:
           - Same ID + same payload -> DUPLICATE (no state mutation)
           - Same ID + different payload -> CONFLICT (IDENTITY_CONFLICT_PAYLOAD_MISMATCH)
        4. If new: write relational data (using ON CONFLICT DO UPDATE for cascade safety)
        5. Write immutable event envelope
        6. Append ingestion audit record
        7. Commit (or rollback on error)
        """
        val = validator or AnalyticalEventValidator()
        event_id = str(event.get("event_id", "missing_id"))
        event_type = event.get("event_type")
        now_iso = datetime.now(timezone.utc).isoformat()

        # Step 1: Pre-transaction validation
        val_result = val.validate_event(event)
        if val_result.outcome != IngestionOutcome.ACCEPTED:
            # Audit rejection
            self.record_audit_log([val_result])
            return val_result

        conn = self.get_connection()

        # Step 2 & 3: Authoritative identity check in analytical_events
        cur = conn.execute(
            "SELECT payload_json FROM analytical_events WHERE event_id = ?",
            (event_id,),
        )
        existing_row = cur.fetchone()

        if existing_row is not None:
            existing_payload_str = existing_row["payload_json"]
            try:
                existing_payload = json.loads(existing_payload_str)
                is_match = canonical_json_string(existing_payload) == canonical_json_string(event)
            except Exception:
                is_match = False

            if is_match:
                # Harmless idempotent replay
                res = IngestionResult(
                    event_id=event_id,
                    outcome=IngestionOutcome.DUPLICATE,
                    rejection_reason="DUPLICATE_EVENT_ID: exact event already ingested",
                    event_type=event_type,
                )
                self.record_audit_log([res])
                return res
            else:
                # Identity conflict: same event ID, different payload
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

        # Step 4, 5, 6: Transactional write of new event
        try:
            with conn:
                run_id = event["analysis_run_id"]

                # Relational projection writes (cascade delete safe: DO NOT USE INSERT OR REPLACE!)
                if event_type == "ANALYSIS_INGESTED":
                    cur_run = conn.execute(
                        """
                        SELECT dataset_fingerprint, submission_count, subject,
                               grade_level, total_duration_ms, execution_mode, occurred_at
                        FROM analysis_runs WHERE run_id = ?
                        """,
                        (run_id,),
                    )
                    existing_run = cur_run.fetchone()
                    if existing_run is not None:
                        is_same_metadata = (
                            existing_run["dataset_fingerprint"] == event["dataset_fingerprint"]
                            and existing_run["submission_count"] == event["submission_count"]
                            and existing_run["subject"] == event["subject"]
                            and existing_run["grade_level"] == event["grade_level"]
                            and existing_run["occurred_at"] == event["occurred_at"]
                        )
                        if not is_same_metadata:
                            conflict_reason = (
                                f"ANALYSIS_RUN_CONFLICT: analysis_run_id '{run_id}' "
                                "already exists with differing immutable metadata"
                            )
                            res = IngestionResult(
                                event_id=event_id,
                                outcome=IngestionOutcome.CONFLICT,
                                rejection_reason=conflict_reason,
                                event_type=event_type,
                            )
                            self.record_audit_log([res])
                            return res
                    else:
                        conn.execute(
                            """
                            INSERT INTO analysis_runs (
                                run_id, dataset_fingerprint, submission_count, subject,
                                grade_level, total_duration_ms, execution_mode, occurred_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(analysis_run_id, cluster_id) DO UPDATE SET
                            concept = excluded.concept,
                            teaching_priority = excluded.teaching_priority,
                            affected_student_count = excluded.affected_student_count,
                            percentage_affected = excluded.percentage_affected,
                            explanation = excluded.explanation
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
                            ) VALUES (?, ?, ?)
                            ON CONFLICT(analysis_run_id, cluster_id, student_id) DO NOTHING
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
                        ) VALUES (?, ?, ?, ?, ?, ?)
                        ON CONFLICT(analysis_run_id, group_id) DO UPDATE SET
                            group_name = excluded.group_name,
                            student_count = excluded.student_count,
                            suggested_activity = excluded.suggested_activity,
                            estimated_duration = excluded.estimated_duration
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
                            ) VALUES (?, ?, ?)
                            ON CONFLICT(analysis_run_id, group_id, student_id) DO NOTHING
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
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(analysis_run_id) DO UPDATE SET
                            overall_status = excluded.overall_status,
                            coverage_passed = excluded.coverage_passed,
                            cluster_math_passed = excluded.cluster_math_passed,
                            group_partition_passed = excluded.group_partition_passed,
                            quotes_grounded_count = excluded.quotes_grounded_count,
                            quotes_flagged_count = excluded.quotes_flagged_count
                        """,
                        (
                            run_id,
                            event["overall_status"],
                            1 if event["coverage_passed"] else 0,
                            1 if event["cluster_math_passed"] else 0,
                            1 if event["group_partition_passed"] else 0,
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
                        ) VALUES (?, ?, ?, ?, ?, ?)
                        ON CONFLICT(analysis_run_id, target_type, target_id, recorded_at)
                        DO UPDATE SET
                            teacher_decision = excluded.teacher_decision,
                            notes = excluded.notes
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
                    conn.execute(
                        """
                        INSERT INTO current_teacher_decisions (
                            analysis_run_id, target_type, target_id, teacher_decision,
                            notes, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?)
                        ON CONFLICT(analysis_run_id, target_type, target_id) DO UPDATE SET
                            teacher_decision = excluded.teacher_decision,
                            notes = excluded.notes,
                            updated_at = excluded.updated_at
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

                # Write immutable event envelope
                conn.execute(
                    """
                    INSERT INTO analytical_events (
                        event_id, schema_version, event_type, occurred_at,
                        analysis_run_id, provenance, payload_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        event["event_id"],
                        event["schema_version"],
                        event["event_type"],
                        event["occurred_at"],
                        event["analysis_run_id"],
                        event["provenance"],
                        canonical_json_string(event),
                    ),
                )

                # Append audit log
                conn.execute(
                    """
                    INSERT INTO ingestion_audit_log (
                        event_id, event_type, outcome, rejection_reason, processed_at
                    ) VALUES (?, ?, ?, ?, ?)
                    """,
                    (event_id, event_type, IngestionOutcome.ACCEPTED.value, None, now_iso),
                )

            return IngestionResult(
                event_id=event_id,
                outcome=IngestionOutcome.ACCEPTED,
                event_type=event_type,
            )
        except Exception as exc:
            # Entire transaction rolled back by with conn context manager
            # Audit rejection or error
            err_reason = f"INGESTION_TRANSACTION_FAILED: {type(exc).__name__}: {str(exc)}"
            conn.rollback()
            res = IngestionResult(
                event_id=event_id,
                outcome=IngestionOutcome.REJECTED,
                rejection_reason=err_reason,
                event_type=event_type,
            )
            self.record_audit_log([res])
            return res

    def load_events(self, events: List[Dict[str, Any]]) -> List[IngestionResult]:
        """
        Loads a batch of events with foreign-key safe dependency ordering:
        ANALYSIS_INGESTED first, then child events.
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
        if self._conn:
            self._conn.close()
            self._conn = None
