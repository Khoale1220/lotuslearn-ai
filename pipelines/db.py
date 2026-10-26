"""SQLite relational storage engine and metrics computation for LotusLearn analytical pipeline."""

import json
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from pipelines.models import IngestionResult, LearningAnalyticsMetrics

SQL_DIR = Path(__file__).resolve().parent / "sql"
SCHEMA_SQL = SQL_DIR / "schema.sql"
TRANSFORMATIONS_SQL = SQL_DIR / "transformations.sql"


class AnalyticalDatabase:
    """Encapsulates SQLite connection, relational schema, and analytical queries."""

    def __init__(self, db_path: str = ":memory:"):
        self.db_path = db_path
        self._conn: Optional[sqlite3.Connection] = None

    def get_connection(self) -> sqlite3.Connection:
        """Get or create connection with enforced foreign keys."""
        if self._conn is None:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            # Mandatory constraint check on every connection
            conn.execute("PRAGMA foreign_keys = ON;")
            # Verify foreign keys are enabled
            cursor = conn.execute("PRAGMA foreign_keys;")
            fk_enabled = cursor.fetchone()[0]
            if not fk_enabled:
                raise RuntimeError("Failed to enable foreign keys in SQLite connection.")
            self._conn = conn
        return self._conn

    def initialize_schema(self) -> None:
        """Executes schema.sql and transformations.sql."""
        conn = self.get_connection()
        with open(SCHEMA_SQL, "r", encoding="utf-8") as f:
            conn.executescript(f.read())
        with open(TRANSFORMATIONS_SQL, "r", encoding="utf-8") as f:
            conn.executescript(f.read())
        conn.commit()

    def get_existing_event_ids(self) -> Set[str]:
        """Fetch all previously recorded event IDs for deduplication."""
        conn = self.get_connection()
        cursor = conn.execute("SELECT event_id FROM ingestion_audit_log")
        return {row["event_id"] for row in cursor.fetchall()}

    def record_audit_log(self, results: List[IngestionResult]) -> None:
        """Log ingestion attempts into ingestion_audit_log."""
        conn = self.get_connection()
        from datetime import datetime, timezone

        now_iso = datetime.now(timezone.utc).isoformat()
        with conn:
            for r in results:
                conn.execute(
                    """
                    INSERT OR REPLACE INTO ingestion_audit_log (
                        event_id, event_type, outcome, rejection_reason, processed_at
                    ) VALUES (?, ?, ?, ?, ?)
                    """,
                    (r.event_id, r.event_type, r.outcome.value, r.rejection_reason, now_iso),
                )

    def load_events(self, events: List[Dict[str, Any]]) -> None:
        """
        Loads validated, accepted analytical events into relational tables.
        Events are loaded in foreign-key safe order:
        1. ANALYSIS_INGESTED (creates parent analysis_runs row)
        2. Others referencing analysis_runs
        """
        conn = self.get_connection()

        # Separate ANALYSIS_INGESTED from child events
        run_events = [e for e in events if e.get("event_type") == "ANALYSIS_INGESTED"]
        child_events = [e for e in events if e.get("event_type") != "ANALYSIS_INGESTED"]

        with conn:
            # 1. Ingest parent runs
            for ev in run_events:
                run_id = ev["analysis_run_id"]
                conn.execute(
                    """
                    INSERT OR REPLACE INTO analysis_runs (
                        run_id, dataset_fingerprint, submission_count, subject,
                        grade_level, total_duration_ms, execution_mode, occurred_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        run_id,
                        ev["dataset_fingerprint"],
                        ev["submission_count"],
                        ev["subject"],
                        ev["grade_level"],
                        ev.get("total_duration_ms"),
                        ev.get("execution_mode"),
                        ev["occurred_at"],
                    ),
                )
                self._insert_event_envelope(conn, ev)

            # 2. Ingest child events
            for ev in child_events:
                self._insert_event_envelope(conn, ev)
                event_type = ev.get("event_type")
                run_id = ev["analysis_run_id"]

                if event_type == "FINDING_IDENTIFIED":
                    cluster_id = ev["finding_id"]
                    conn.execute(
                        """
                        INSERT OR REPLACE INTO misconception_clusters (
                            analysis_run_id, cluster_id, concept, teaching_priority,
                            affected_student_count, percentage_affected, explanation
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            run_id,
                            cluster_id,
                            ev["concept"],
                            ev["teaching_priority"],
                            ev["affected_student_count"],
                            ev.get("percentage_affected"),
                            ev.get("explanation"),
                        ),
                    )
                    # Insert student_findings
                    for sid in ev.get("affected_student_ids", []):
                        conn.execute(
                            """
                            INSERT OR IGNORE INTO student_findings (
                                analysis_run_id, cluster_id, student_id
                            ) VALUES (?, ?, ?)
                            """,
                            (run_id, cluster_id, sid),
                        )

                elif event_type == "GROUP_FORMED":
                    group_id = ev["group_id"]
                    conn.execute(
                        """
                        INSERT OR REPLACE INTO instructional_groups (
                            analysis_run_id, group_id, group_name, student_count,
                            suggested_activity, estimated_duration
                        ) VALUES (?, ?, ?, ?, ?, ?)
                        """,
                        (
                            run_id,
                            group_id,
                            ev["group_name"],
                            ev["student_count"],
                            ev["suggested_activity"],
                            ev.get("estimated_duration"),
                        ),
                    )
                    for sid in ev.get("student_ids", []):
                        conn.execute(
                            """
                            INSERT OR IGNORE INTO group_memberships (
                                analysis_run_id, group_id, student_id
                            ) VALUES (?, ?, ?)
                            """,
                            (run_id, group_id, sid),
                        )

                elif event_type == "VERIFICATION_AUDITED":
                    conn.execute(
                        """
                        INSERT OR REPLACE INTO verifications (
                            analysis_run_id, overall_status, coverage_passed,
                            cluster_math_passed, group_partition_passed,
                            quotes_grounded_count, quotes_flagged_count
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            run_id,
                            ev["overall_status"],
                            1 if ev["coverage_passed"] else 0,
                            1 if ev["cluster_math_passed"] else 0,
                            1 if ev["group_partition_passed"] else 0,
                            ev["quotes_grounded_count"],
                            ev["quotes_flagged_count"],
                        ),
                    )

                elif event_type == "DECISION_RECORDED":
                    conn.execute(
                        """
                        INSERT OR REPLACE INTO teacher_decisions (
                            analysis_run_id, target_type, target_id, teacher_decision,
                            notes, recorded_at
                        ) VALUES (?, ?, ?, ?, ?, ?)
                        """,
                        (
                            run_id,
                            ev["target_type"],
                            ev["target_id"],
                            ev["teacher_decision"],
                            ev.get("notes"),
                            ev["occurred_at"],
                        ),
                    )

    def _insert_event_envelope(self, conn: sqlite3.Connection, ev: Dict[str, Any]) -> None:
        conn.execute(
            """
            INSERT OR REPLACE INTO analytical_events (
                event_id, schema_version, event_type, occurred_at,
                analysis_run_id, provenance, payload_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                ev["event_id"],
                ev["schema_version"],
                ev["event_type"],
                ev["occurred_at"],
                ev["analysis_run_id"],
                ev["provenance"],
                json.dumps(ev),
            ),
        )

    def compute_metrics(self) -> LearningAnalyticsMetrics:
        """Execute analytical queries and return structured metrics."""
        conn = self.get_connection()

        # 1. Total accepted events
        cur = conn.execute("SELECT COUNT(*) FROM analytical_events")
        total_accepted = cur.fetchone()[0]

        # 2. Distinct students
        cur = conn.execute("SELECT COUNT(*) FROM v_distinct_students")
        distinct_students = cur.fetchone()[0]

        # 3. Total runs
        cur = conn.execute("SELECT COUNT(*) FROM analysis_runs")
        total_runs = cur.fetchone()[0]

        # 4. Findings by concept
        cur = conn.execute(
            """
            SELECT concept, teaching_priority, COUNT(*) AS cluster_count,
                   SUM(affected_student_count) AS total_affected_instances
            FROM misconception_clusters
            GROUP BY concept, teaching_priority
            ORDER BY total_affected_instances DESC
            """
        )
        findings = [dict(row) for row in cur.fetchall()]

        # 5. Prevalence by cluster
        cur = conn.execute(
            """
            SELECT analysis_run_id, cluster_id, concept, teaching_priority,
                   affected_students, total_students, prevalence_rate
            FROM v_cohort_prevalence
            ORDER BY prevalence_rate DESC
            """
        )
        prevalence = [dict(row) for row in cur.fetchall()]

        # 6. Global Educator Modification Rate
        cur = conn.execute(
            """
            SELECT
                SUM(total_reviewed) AS total_reviewed,
                SUM(count_edited + count_dismissed) AS total_modified
            FROM v_educator_decisions
            """
        )
        dec_row = cur.fetchone()
        tot_rev = dec_row["total_reviewed"] or 0
        tot_mod = dec_row["total_modified"] or 0
        mod_rate = round(tot_mod / tot_rev, 4) if tot_rev > 0 else None

        return LearningAnalyticsMetrics(
            total_accepted_events=total_accepted,
            distinct_students_count=distinct_students,
            total_analysis_runs=total_runs,
            findings_by_concept=findings,
            prevalence_by_cluster=prevalence,
            educator_modification_rate=mod_rate,
        )

    def close(self) -> None:
        if self._conn:
            self._conn.close()
            self._conn = None
