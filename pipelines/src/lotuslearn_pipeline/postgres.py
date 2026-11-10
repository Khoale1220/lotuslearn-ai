"""PostgreSQL durable storage backend for LotusLearn analytical pipeline.

Implements PostgreSQL 18 relational storage using Psycopg 3 with strict
transactionality, advisory-locked checksummed migrations, atomic event
arbitration, bounded retry for 40001/40P01, and cascade delete safety.
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

from lotuslearn_pipeline.ingestion import (
    EMAIL_REGEX,
    PHONE_REGEX,
    AnalyticalEventValidator,
    sanitize_event_id,
    sanitize_event_type,
)
from lotuslearn_pipeline.models import IngestionOutcome, IngestionResult
from lotuslearn_pipeline.retry import execute_with_retry
from lotuslearn_pipeline.storage import canonical_json_string

logger = logging.getLogger("lotuslearn_pipeline.postgres")

LOTUSLEARN_MIGRATION_LOCK_ID = 0x4C4F5455534D4947


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

    Returns sorted list of:
    (version_key, filename, sql_content, sha256_checksum).
    """
    migrations: List[Tuple[str, str, str, str]] = []
    found_files: List[Tuple[str, str]] = []

    try:
        mig_dir = resources.files("lotuslearn_pipeline.migrations.postgres")
        for entry in mig_dir.iterdir():
            if entry.name.endswith(".sql"):
                found_files.append(
                    (
                        entry.name,
                        entry.read_text(encoding="utf-8"),
                    )
                )
    except Exception:
        fallback_dir = (
            Path(__file__).resolve().parent
            / "migrations"
            / "postgres"
        )
        if fallback_dir.exists():
            for entry in fallback_dir.iterdir():
                if entry.name.endswith(".sql"):
                    found_files.append(
                        (
                            entry.name,
                            entry.read_text(encoding="utf-8"),
                        )
                    )

    found_files.sort(key=lambda migration: migration[0])

    for filename, sql_text in found_files:
        version_key = (
            filename.split("_")[0]
            if "_" in filename
            else filename
        )
        checksum = compute_migration_checksum(sql_text)
        migrations.append(
            (
                version_key,
                filename,
                sql_text,
                checksum,
            )
        )

    return migrations


def apply_postgres_migrations(
    conn: psycopg.Connection,
) -> List[str]:
    """
    Applies unapplied PostgreSQL migrations in deterministic filename order.

    Migration execution is protected by a PostgreSQL transaction-level
    advisory lock. Applied migration checksums are verified against packaged
    migration artifacts.
    """
    applied_now: List[str] = []

    migrations = get_postgres_migration_files()

    packaged_by_version = {
        migration[0]: migration
        for migration in migrations
    }

    packaged_by_filename = {
        migration[1]: migration
        for migration in migrations
    }

    with conn.transaction():
        conn.execute(
            "SELECT pg_advisory_xact_lock(%s);",
            (LOTUSLEARN_MIGRATION_LOCK_ID,),
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version TEXT PRIMARY KEY,
                name TEXT,
                checksum TEXT,
                applied_at TIMESTAMPTZ NOT NULL
                    DEFAULT CURRENT_TIMESTAMP
            );
            """
        )

        conn.execute(
            """
            ALTER TABLE schema_migrations
            ADD COLUMN IF NOT EXISTS name TEXT;
            """
        )

        conn.execute(
            """
            ALTER TABLE schema_migrations
            ADD COLUMN IF NOT EXISTS checksum TEXT;
            """
        )

        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    version,
                    name,
                    checksum
                FROM schema_migrations
                ORDER BY applied_at;
                """
            )
            applied_rows = cur.fetchall()

        applied_versions: Set[str] = set()

        for row in applied_rows:
            version_key = row["version"]
            stored_name = row["name"]
            stored_checksum = row["checksum"]

            matched = (
                packaged_by_filename.get(version_key)
                or packaged_by_version.get(version_key)
                or (
                    packaged_by_filename.get(stored_name)
                    if stored_name
                    else None
                )
            )

            if not matched:
                raise MigrationFileMissingError(
                    "MIGRATION_FILE_MISSING: "
                    f"Applied migration '{version_key}' "
                    "not found in packaged migration files."
                )

            (
                packaged_version,
                packaged_name,
                _,
                expected_checksum,
            ) = matched

            applied_versions.add(packaged_version)
            applied_versions.add(packaged_name)
            applied_versions.add(version_key)

            if stored_checksum is None:
                conn.execute(
                    """
                    UPDATE schema_migrations
                    SET
                        checksum = %s,
                        name = %s
                    WHERE
                        version = %s
                        AND checksum IS NULL;
                    """,
                    (
                        expected_checksum,
                        packaged_name,
                        version_key,
                    ),
                )
            elif stored_checksum != expected_checksum:
                raise MigrationDriftError(
                    "MIGRATION_DRIFT: "
                    f"Checksum mismatch for migration "
                    f"'{version_key}'. "
                    f"Stored={stored_checksum}, "
                    f"Expected={expected_checksum}."
                )

        for (
            version_key,
            filename,
            sql_text,
            checksum,
        ) in migrations:
            if (
                version_key not in applied_versions
                and filename not in applied_versions
            ):
                conn.execute(sql_text)

                conn.execute(
                    """
                    INSERT INTO schema_migrations (
                        version,
                        name,
                        checksum,
                        applied_at
                    )
                    VALUES (%s, %s, %s, %s);
                    """,
                    (
                        filename,
                        filename,
                        checksum,
                        datetime.now(timezone.utc),
                    ),
                )

                applied_now.append(filename)

    return applied_now


def get_migration_status(
    conn: psycopg.Connection,
) -> List[Dict[str, Any]]:
    """Returns current migration state against packaged migrations."""
    migrations = get_postgres_migration_files()

    applied_rows: Dict[str, Any] = {}

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE
                    table_schema = 'public'
                    AND table_name = 'schema_migrations'
            ) AS tbl_exists;
            """
        )

        result = cur.fetchone()
        table_exists = (
            result["tbl_exists"]
            if result
            else False
        )

        if table_exists:
            cur.execute(
                """
                SELECT
                    version,
                    name,
                    checksum,
                    applied_at
                FROM schema_migrations
                ORDER BY applied_at;
                """
            )

            applied_rows = {
                row["version"]: row
                for row in cur.fetchall()
            }

    status_list: List[Dict[str, Any]] = []

    for (
        version_key,
        filename,
        _,
        expected_checksum,
    ) in migrations:
        row = (
            applied_rows.get(version_key)
            or applied_rows.get(filename)
        )

        if row:
            stored_checksum = row["checksum"]
            checksum_valid = (
                stored_checksum == expected_checksum
            )

            status_list.append(
                {
                    "version": version_key,
                    "name": filename,
                    "applied": True,
                    "applied_at": row["applied_at"],
                    "checksum": stored_checksum,
                    "checksum_valid": checksum_valid,
                    "match": checksum_valid,
                }
            )
        else:
            status_list.append(
                {
                    "version": version_key,
                    "name": filename,
                    "applied": False,
                    "applied_at": None,
                    "checksum": expected_checksum,
                    "checksum_valid": True,
                    "match": None,
                }
            )

    return status_list


def _normalize_iso_datetime(
    dt_val: Any,
) -> Optional[datetime]:
    """Converts ISO timestamp or datetime to UTC-aware datetime."""
    if dt_val is None:
        return None

    if isinstance(dt_val, datetime):
        if dt_val.tzinfo is None:
            return dt_val.replace(
                tzinfo=timezone.utc
            )

        return dt_val.astimezone(
            timezone.utc
        )

    if isinstance(dt_val, str):
        cleaned = dt_val.replace(
            "Z",
            "+00:00",
        )

        parsed = datetime.fromisoformat(
            cleaned
        )

        if parsed.tzinfo is None:
            return parsed.replace(
                tzinfo=timezone.utc
            )

        return parsed.astimezone(
            timezone.utc
        )

    return None


class PostgresAnalyticalDatabase:
    """
    Encapsulates PostgreSQL 18 storage, migrations, and transactional ingestion.
    """

    def __init__(
        self,
        connection_string: Optional[str] = None,
        connection_url: Optional[str] = None,
    ):
        self.connection_string = (
            connection_string
            or connection_url
            or os.environ.get(
                "LOTUSLEARN_DATABASE_URL",
                "",
            )
        )

        self._conn: Optional[
            psycopg.Connection
        ] = None

        self.fault_hook: Optional[
            Callable[[str], None]
        ] = None

    def get_connection(
        self,
    ) -> psycopg.Connection:
        """
        Returns or establishes a Psycopg 3 connection.

        The connection uses autocommit mode so standalone reads do not create
        implicit long-lived transactions. Operations requiring atomicity use
        explicit conn.transaction() blocks.
        """
        if (
            self._conn is None
            or self._conn.closed
        ):
            self._conn = psycopg.connect(
                self.connection_string,
                row_factory=dict_row,
                autocommit=True,
            )

        return self._conn

    def initialize_schema(
        self,
    ) -> List[str]:
        """Applies versioned migrations under advisory lock."""
        conn = self.get_connection()
        return apply_postgres_migrations(
            conn
        )

    def get_committed_event_ids(
        self,
    ) -> Set[str]:
        """Returns all committed analytical event IDs."""
        conn = self.get_connection()

        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT event_id
                FROM analytical_events;
                """
            )

            return {
                row["event_id"]
                for row in cur.fetchall()
            }

    def get_current_teacher_decisions(
        self,
    ) -> List[Dict[str, Any]]:
        """Returns current teacher decision projection rows."""
        conn = self.get_connection()

        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    analysis_run_id,
                    target_type,
                    target_id,
                    teacher_decision,
                    notes,
                    updated_at,
                    last_event_id
                FROM current_teacher_decisions
                ORDER BY
                    analysis_run_id,
                    target_type,
                    target_id;
                """
            )

            return [
                dict(row)
                for row in cur.fetchall()
            ]

    def record_audit_log(
        self,
        results: List[IngestionResult],
    ) -> None:
        """Appends durable logical ingestion outcomes to audit history."""
        conn = self.get_connection()
        processed_at = datetime.now(
            timezone.utc
        )

        with conn.transaction():
            for result in results:
                safe_id = sanitize_event_id(result.event_id)
                safe_type = sanitize_event_type(result.event_type)
                conn.execute(
                    """
                    INSERT INTO ingestion_audit_log (
                        event_id,
                        event_type,
                        outcome,
                        rejection_reason,
                        processed_at
                    )
                    VALUES (%s, %s, %s, %s, %s);
                    """,
                    (
                        safe_id,
                        safe_type,
                        result.outcome.value,
                        result.rejection_reason,
                        processed_at,
                    ),
                )

    def ingest_single_event(
        self,
        event: Dict[str, Any],
        validator: Optional[
            AnalyticalEventValidator
        ] = None,
        sleep_fn: Callable[
            [float],
            None,
        ] = time.sleep,
    ) -> IngestionResult:
        """
        Ingests one analytical event transactionally.

        Event identity is arbitrated by PostgreSQL uniqueness constraints.
        Retry is limited to PostgreSQL serialization failures and deadlocks.
        """
        start_time = time.monotonic()

        active_validator = (
            validator
            or AnalyticalEventValidator()
        )

        event_id = str(
            event.get(
                "event_id",
                "missing_id",
            )
        )

        event_type = event.get(
            "event_type"
        )

        processed_at = datetime.now(
            timezone.utc
        )

        validation_result = (
            active_validator.validate_event(
                event
            )
        )

        if (
            validation_result.outcome
            != IngestionOutcome.ACCEPTED
        ):
            self.record_audit_log(
                [validation_result]
            )

            return validation_result

        conn = self.get_connection()

        def _do_ingest() -> IngestionResult:
            if self.fault_hook:
                self.fault_hook(
                    "transaction_start"
                )

            with conn.cursor() as cur_check:
                cur_check.execute(
                    """
                    SELECT payload_json
                    FROM analytical_events
                    WHERE event_id = %s;
                    """,
                    (event_id,),
                )

                existing_envelope = (
                    cur_check.fetchone()
                )

            if existing_envelope:
                existing_payload = (
                    existing_envelope[
                        "payload_json"
                    ]
                )

                if isinstance(
                    existing_payload,
                    str,
                ):
                    try:
                        existing_payload = (
                            json.loads(
                                existing_payload
                            )
                        )
                    except Exception:
                        existing_payload = None

                payload_matches = (
                    canonical_json_string(
                        existing_payload
                    )
                    == canonical_json_string(
                        event
                    )
                    if existing_payload
                    is not None
                    else False
                )

                if payload_matches:
                    result = IngestionResult(
                        event_id=event_id,
                        outcome=(
                            IngestionOutcome.DUPLICATE
                        ),
                        rejection_reason=(
                            "DUPLICATE_EVENT_ID: "
                            "exact event already ingested"
                        ),
                        event_type=event_type,
                    )

                    self.record_audit_log(
                        [result]
                    )

                    return result

                conflict_reason = (
                    "IDENTITY_CONFLICT_PAYLOAD_MISMATCH: "
                    "event_id already exists "
                    "with different payload"
                )

                result = IngestionResult(
                    event_id=event_id,
                    outcome=(
                        IngestionOutcome.CONFLICT
                    ),
                    rejection_reason=(
                        conflict_reason
                    ),
                    event_type=event_type,
                )

                self.record_audit_log(
                    [result]
                )

                return result

            with conn.transaction():
                run_id = event[
                    "analysis_run_id"
                ]

                if (
                    event_type
                    == "ANALYSIS_INGESTED"
                ):
                    with conn.cursor() as cur_run:
                        cur_run.execute(
                            """
                            INSERT INTO analysis_runs (
                                run_id,
                                dataset_fingerprint,
                                submission_count,
                                subject,
                                grade_level,
                                total_duration_ms,
                                execution_mode,
                                occurred_at
                            )
                            VALUES (
                                %s,
                                %s,
                                %s,
                                %s,
                                %s,
                                %s,
                                %s,
                                %s
                            )
                            ON CONFLICT (run_id)
                            DO UPDATE SET
                                run_id = EXCLUDED.run_id
                            RETURNING
                                dataset_fingerprint,
                                submission_count,
                                subject,
                                grade_level,
                                total_duration_ms,
                                execution_mode,
                                occurred_at;
                            """,
                            (
                                run_id,
                                event[
                                    "dataset_fingerprint"
                                ],
                                event[
                                    "submission_count"
                                ],
                                event[
                                    "subject"
                                ],
                                event[
                                    "grade_level"
                                ],
                                event.get(
                                    "total_duration_ms"
                                ),
                                event.get(
                                    "execution_mode"
                                ),
                                event[
                                    "occurred_at"
                                ],
                            ),
                        )

                        existing_run = (
                            cur_run.fetchone()
                        )

                    if existing_run:
                        database_occurred_at = (
                            _normalize_iso_datetime(
                                existing_run[
                                    "occurred_at"
                                ]
                            )
                        )

                        event_occurred_at = (
                            _normalize_iso_datetime(
                                event[
                                    "occurred_at"
                                ]
                            )
                        )

                        same_metadata = (
                            existing_run[
                                "dataset_fingerprint"
                            ]
                            == event[
                                "dataset_fingerprint"
                            ]
                            and existing_run[
                                "submission_count"
                            ]
                            == event[
                                "submission_count"
                            ]
                            and existing_run[
                                "subject"
                            ]
                            == event[
                                "subject"
                            ]
                            and existing_run[
                                "grade_level"
                            ]
                            == event[
                                "grade_level"
                            ]
                            and existing_run[
                                "total_duration_ms"
                            ]
                            == event.get(
                                "total_duration_ms"
                            )
                            and existing_run[
                                "execution_mode"
                            ]
                            == event.get(
                                "execution_mode"
                            )
                            and database_occurred_at
                            == event_occurred_at
                        )

                        if not same_metadata:
                            conflict_reason = (
                                "ANALYSIS_RUN_CONFLICT: "
                                "analysis run already exists "
                                "with differing immutable metadata"
                            )

                            raise (
                                AnalysisRunConflictError(
                                    conflict_reason
                                )
                            )

                    if self.fault_hook:
                        self.fault_hook(
                            "after_run_insert"
                        )

                with conn.cursor() as cur_event:
                    cur_event.execute(
                        """
                        INSERT INTO analytical_events (
                            event_id,
                            schema_version,
                            event_type,
                            occurred_at,
                            analysis_run_id,
                            provenance,
                            payload_json
                        )
                        VALUES (
                            %s,
                            %s,
                            %s,
                            %s,
                            %s,
                            %s,
                            %s
                        )
                        ON CONFLICT (event_id)
                        DO NOTHING
                        RETURNING event_id;
                        """,
                        (
                            event[
                                "event_id"
                            ],
                            event[
                                "schema_version"
                            ],
                            event[
                                "event_type"
                            ],
                            event[
                                "occurred_at"
                            ],
                            event[
                                "analysis_run_id"
                            ],
                            event[
                                "provenance"
                            ],
                            json.dumps(
                                event
                            ),
                        ),
                    )

                    inserted_row = (
                        cur_event.fetchone()
                    )

                if inserted_row is None:
                    with conn.cursor() as cur_existing:
                        cur_existing.execute(
                            """
                            SELECT payload_json
                            FROM analytical_events
                            WHERE event_id = %s;
                            """,
                            (event_id,),
                        )

                        existing_row = (
                            cur_existing.fetchone()
                        )

                    existing_payload = (
                        existing_row[
                            "payload_json"
                        ]
                        if existing_row
                        else None
                    )

                    if isinstance(
                        existing_payload,
                        str,
                    ):
                        try:
                            existing_payload = (
                                json.loads(
                                    existing_payload
                                )
                            )
                        except Exception:
                            existing_payload = None

                    payload_matches = (
                        canonical_json_string(
                            existing_payload
                        )
                        == canonical_json_string(
                            event
                        )
                        if existing_payload
                        is not None
                        else False
                    )

                    if payload_matches:
                        result = IngestionResult(
                            event_id=event_id,
                            outcome=(
                                IngestionOutcome.DUPLICATE
                            ),
                            rejection_reason=(
                                "DUPLICATE_EVENT_ID: "
                                "exact event already ingested"
                            ),
                            event_type=event_type,
                        )

                        conn.execute(
                            """
                            INSERT INTO ingestion_audit_log (
                                event_id,
                                event_type,
                                outcome,
                                rejection_reason,
                                processed_at
                            )
                            VALUES (
                                %s,
                                %s,
                                %s,
                                %s,
                                %s
                            );
                            """,
                            (
                                event_id,
                                event_type,
                                IngestionOutcome
                                .DUPLICATE
                                .value,
                                result
                                .rejection_reason,
                                processed_at,
                            ),
                        )

                        return result

                    conflict_reason = (
                        "IDENTITY_CONFLICT_PAYLOAD_MISMATCH: "
                        "event_id already exists "
                        "with different payload"
                    )

                    result = IngestionResult(
                        event_id=event_id,
                        outcome=(
                            IngestionOutcome.CONFLICT
                        ),
                        rejection_reason=(
                            conflict_reason
                        ),
                        event_type=event_type,
                    )

                    conn.execute(
                        """
                        INSERT INTO ingestion_audit_log (
                            event_id,
                            event_type,
                            outcome,
                            rejection_reason,
                            processed_at
                        )
                        VALUES (
                            %s,
                            %s,
                            %s,
                            %s,
                            %s
                        );
                        """,
                        (
                            event_id,
                            event_type,
                            IngestionOutcome
                            .CONFLICT
                            .value,
                            conflict_reason,
                            processed_at,
                        ),
                    )

                    return result

                if (
                    event_type
                    == "FINDING_IDENTIFIED"
                ):
                    cluster_id = event[
                        "finding_id"
                    ]

                    conn.execute(
                        """
                        INSERT INTO misconception_clusters (
                            analysis_run_id,
                            cluster_id,
                            concept,
                            teaching_priority,
                            affected_student_count,
                            percentage_affected,
                            explanation
                        )
                        VALUES (
                            %s,
                            %s,
                            %s,
                            %s,
                            %s,
                            %s,
                            %s
                        )
                        ON CONFLICT (
                            analysis_run_id,
                            cluster_id
                        )
                        DO UPDATE SET
                            concept = EXCLUDED.concept,
                            teaching_priority =
                                EXCLUDED.teaching_priority,
                            affected_student_count =
                                EXCLUDED.affected_student_count,
                            percentage_affected =
                                EXCLUDED.percentage_affected,
                            explanation =
                                EXCLUDED.explanation;
                        """,
                        (
                            run_id,
                            cluster_id,
                            event[
                                "concept"
                            ],
                            event[
                                "teaching_priority"
                            ],
                            event[
                                "affected_student_count"
                            ],
                            event.get(
                                "percentage_affected"
                            ),
                            event.get(
                                "explanation"
                            ),
                        ),
                    )

                    for student_id in event.get(
                        "affected_student_ids",
                        [],
                    ):
                        conn.execute(
                            """
                            INSERT INTO student_findings (
                                analysis_run_id,
                                cluster_id,
                                student_id
                            )
                            VALUES (%s, %s, %s)
                            ON CONFLICT (
                                analysis_run_id,
                                cluster_id,
                                student_id
                            )
                            DO NOTHING;
                            """,
                            (
                                run_id,
                                cluster_id,
                                student_id,
                            ),
                        )

                elif (
                    event_type
                    == "GROUP_FORMED"
                ):
                    group_id = event[
                        "group_id"
                    ]

                    conn.execute(
                        """
                        INSERT INTO instructional_groups (
                            analysis_run_id,
                            group_id,
                            group_name,
                            student_count,
                            suggested_activity,
                            estimated_duration
                        )
                        VALUES (
                            %s,
                            %s,
                            %s,
                            %s,
                            %s,
                            %s
                        )
                        ON CONFLICT (
                            analysis_run_id,
                            group_id
                        )
                        DO UPDATE SET
                            group_name =
                                EXCLUDED.group_name,
                            student_count =
                                EXCLUDED.student_count,
                            suggested_activity =
                                EXCLUDED.suggested_activity,
                            estimated_duration =
                                EXCLUDED.estimated_duration;
                        """,
                        (
                            run_id,
                            group_id,
                            event[
                                "group_name"
                            ],
                            event[
                                "student_count"
                            ],
                            event[
                                "suggested_activity"
                            ],
                            event.get(
                                "estimated_duration"
                            ),
                        ),
                    )

                    for student_id in event.get(
                        "student_ids",
                        [],
                    ):
                        conn.execute(
                            """
                            INSERT INTO group_memberships (
                                analysis_run_id,
                                group_id,
                                student_id
                            )
                            VALUES (%s, %s, %s)
                            ON CONFLICT (
                                analysis_run_id,
                                group_id,
                                student_id
                            )
                            DO NOTHING;
                            """,
                            (
                                run_id,
                                group_id,
                                student_id,
                            ),
                        )

                elif (
                    event_type
                    == "VERIFICATION_AUDITED"
                ):
                    conn.execute(
                        """
                        INSERT INTO verifications (
                            analysis_run_id,
                            overall_status,
                            coverage_passed,
                            cluster_math_passed,
                            group_partition_passed,
                            quotes_grounded_count,
                            quotes_flagged_count
                        )
                        VALUES (
                            %s,
                            %s,
                            %s,
                            %s,
                            %s,
                            %s,
                            %s
                        )
                        ON CONFLICT (
                            analysis_run_id
                        )
                        DO UPDATE SET
                            overall_status =
                                EXCLUDED.overall_status,
                            coverage_passed =
                                EXCLUDED.coverage_passed,
                            cluster_math_passed =
                                EXCLUDED.cluster_math_passed,
                            group_partition_passed =
                                EXCLUDED.group_partition_passed,
                            quotes_grounded_count =
                                EXCLUDED.quotes_grounded_count,
                            quotes_flagged_count =
                                EXCLUDED.quotes_flagged_count;
                        """,
                        (
                            run_id,
                            event[
                                "overall_status"
                            ],
                            bool(
                                event[
                                    "coverage_passed"
                                ]
                            ),
                            bool(
                                event[
                                    "cluster_math_passed"
                                ]
                            ),
                            bool(
                                event[
                                    "group_partition_passed"
                                ]
                            ),
                            event[
                                "quotes_grounded_count"
                            ],
                            event[
                                "quotes_flagged_count"
                            ],
                        ),
                    )

                elif (
                    event_type
                    == "DECISION_RECORDED"
                ):
                    recorded_at = event.get(
                        "decision_recorded_at",
                        event[
                            "occurred_at"
                        ],
                    )

                    conn.execute(
                        """
                        INSERT INTO teacher_decisions (
                            event_id,
                            analysis_run_id,
                            target_type,
                            target_id,
                            teacher_decision,
                            notes,
                            recorded_at
                        )
                        VALUES (
                            %s,
                            %s,
                            %s,
                            %s,
                            %s,
                            %s,
                            %s
                        )
                        ON CONFLICT (
                            event_id
                        )
                        DO UPDATE SET
                            teacher_decision =
                                EXCLUDED.teacher_decision,
                            notes =
                                EXCLUDED.notes;
                        """,
                        (
                            event[
                                "event_id"
                            ],
                            run_id,
                            event[
                                "target_type"
                            ],
                            event[
                                "target_id"
                            ],
                            event[
                                "teacher_decision"
                            ],
                            event.get(
                                "notes"
                            ),
                            recorded_at,
                        ),
                    )

                    conn.execute(
                        """
                        INSERT INTO current_teacher_decisions (
                            analysis_run_id,
                            target_type,
                            target_id,
                            teacher_decision,
                            notes,
                            updated_at,
                            last_event_id
                        )
                        VALUES (
                            %s,
                            %s,
                            %s,
                            %s,
                            %s,
                            %s,
                            %s
                        )
                        ON CONFLICT (
                            analysis_run_id,
                            target_type,
                            target_id
                        )
                        DO UPDATE SET
                            teacher_decision =
                                EXCLUDED.teacher_decision,
                            notes =
                                EXCLUDED.notes,
                            updated_at =
                                EXCLUDED.updated_at,
                            last_event_id =
                                EXCLUDED.last_event_id
                        WHERE
                            EXCLUDED.updated_at >
                                current_teacher_decisions.updated_at
                            OR (
                                EXCLUDED.updated_at =
                                    current_teacher_decisions.updated_at
                                AND EXCLUDED.last_event_id >
                                    current_teacher_decisions.last_event_id
                            );
                        """,
                        (
                            run_id,
                            event[
                                "target_type"
                            ],
                            event[
                                "target_id"
                            ],
                            event[
                                "teacher_decision"
                            ],
                            event.get(
                                "notes"
                            ),
                            recorded_at,
                            event[
                                "event_id"
                            ],
                        ),
                    )

                if self.fault_hook:
                    self.fault_hook(
                        "after_projection_insert"
                    )

                conn.execute(
                    """
                    INSERT INTO ingestion_audit_log (
                        event_id,
                        event_type,
                        outcome,
                        rejection_reason,
                        processed_at
                    )
                    VALUES (
                        %s,
                        %s,
                        %s,
                        %s,
                        %s
                    );
                    """,
                    (
                        event_id,
                        event_type,
                        IngestionOutcome
                        .ACCEPTED
                        .value,
                        None,
                        processed_at,
                    ),
                )

                if self.fault_hook:
                    self.fault_hook(
                        "before_commit"
                    )

            return IngestionResult(
                event_id=event_id,
                outcome=(
                    IngestionOutcome.ACCEPTED
                ),
                event_type=event_type,
            )

        try:
            retry_execution = execute_with_retry(
                _do_ingest,
                sleep_fn=sleep_fn,
            )

            duration_ms = (
                time.monotonic()
                - start_time
            ) * 1000

            result = (
                retry_execution.result
            )

            if (
                retry_execution.attempts
                > 1
            ):
                result = IngestionResult(
                    event_id=(
                        result.event_id
                    ),
                    outcome=(
                        result.outcome
                    ),
                    rejection_reason=(
                        result.rejection_reason
                    ),
                    event_type=(
                        result.event_type
                    ),
                    retry_attempts=(
                        retry_execution.attempts
                    ),
                )

            logger.info(
                json.dumps(
                    {
                        "backend": "postgres",
                        "event_id": (
                            event_id[:16]
                        ),
                        "event_type": (
                            event_type
                        ),
                        "outcome": (
                            result
                            .outcome
                            .value
                        ),
                        "attempts": (
                            retry_execution
                            .attempts
                        ),
                        "duration_ms": round(
                            duration_ms,
                            2,
                        ),
                    }
                )
            )

            return result

        except AnalysisRunConflictError as exc:
            result = IngestionResult(
                event_id=event_id,
                outcome=(
                    IngestionOutcome.CONFLICT
                ),
                rejection_reason=str(
                    exc
                ),
                event_type=event_type,
            )

            self.record_audit_log(
                [result]
            )

            return result

        except Exception as exc:
            if isinstance(exc, (psycopg.Error,)):
                err_reason = (
                    "INGESTION_TRANSACTION_FAILED: "
                    f"{type(exc).__name__}"
                )
            else:
                exc_msg = str(exc)
                safe_msg = (
                    exc_msg
                    if not (EMAIL_REGEX.search(exc_msg) or PHONE_REGEX.search(exc_msg))
                    else "REDACTED"
                )
                err_reason = (
                    "INGESTION_TRANSACTION_FAILED: "
                    f"{type(exc).__name__}: "
                    f"{safe_msg}"
                )

            result = IngestionResult(
                event_id=event_id,
                outcome=(
                    IngestionOutcome.REJECTED
                ),
                rejection_reason=err_reason,
                event_type=event_type,
            )

            self.record_audit_log(
                [result]
            )

            return result

    def load_events(
        self,
        events: List[Dict[str, Any]],
    ) -> List[IngestionResult]:
        """
        Loads events in foreign-key-safe dependency order.

        ANALYSIS_INGESTED events are processed before dependent event types.
        """
        run_events = [
            event
            for event in events
            if event.get(
                "event_type"
            )
            == "ANALYSIS_INGESTED"
        ]

        child_events = [
            event
            for event in events
            if event.get(
                "event_type"
            )
            != "ANALYSIS_INGESTED"
        ]

        results: List[
            IngestionResult
        ] = []

        validator = (
            AnalyticalEventValidator()
        )

        for event in run_events:
            results.append(
                self.ingest_single_event(
                    event,
                    validator=validator,
                )
            )

        for event in child_events:
            results.append(
                self.ingest_single_event(
                    event,
                    validator=validator,
                )
            )

        return results

    def compute_metrics(
        self,
    ) -> Any:
        """Computes metrics through authoritative SQL queries."""
        from lotuslearn_pipeline.metrics import (
            compute_pipeline_metrics,
        )

        return compute_pipeline_metrics(
            self
        )

    def close(
        self,
    ) -> None:
        """Closes the PostgreSQL connection if open."""
        if (
            self._conn
            and not self._conn.closed
        ):
            self._conn.close()
            self._conn = None
