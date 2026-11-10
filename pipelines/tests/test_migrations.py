"""Migration integrity tests for LotusLearn PostgreSQL persistence.

Tests fresh migration application, realistic 0001 to 0002 upgrades, legacy
checksum adoption, migration drift detection, missing migration alerts, and
expected access-path indexes.
"""

import json
import os
from datetime import datetime, timezone

import psycopg
import pytest
from psycopg.rows import dict_row

from lotuslearn_pipeline.postgres import (
    MigrationDriftError,
    MigrationFileMissingError,
    apply_postgres_migrations,
    get_migration_status,
    get_postgres_migration_files,
)

TEST_PG_URL = (
    os.environ.get("LOTUSLEARN_TEST_DATABASE_URL")
    or ""
)


@pytest.fixture
def empty_pg_conn():
    """Provide a clean PostgreSQL connection using explicit transactions."""
    if not TEST_PG_URL:
        pytest.skip("No PostgreSQL URL configured")

    with psycopg.connect(TEST_PG_URL, autocommit=True) as reset_conn:
        database_name = reset_conn.execute("SELECT current_database();").fetchone()[0]
        if database_name != "lotuslearn_test":
            raise RuntimeError(
                "Refusing destructive PostgreSQL test setup outside lotuslearn_test"
            )
        reset_conn.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")

    conn = psycopg.connect(
        TEST_PG_URL,
        row_factory=dict_row,
        autocommit=True,
    )

    try:
        yield conn
    finally:
        conn.close()


def test_migrations_fresh_apply(empty_pg_conn):
    """Fresh database applies packaged migrations with valid checksums."""
    applied = apply_postgres_migrations(empty_pg_conn)

    assert applied == [
        "0001_initial.sql",
        "0002_reliability_hardening.sql",
        "0003_metadata_history.sql",
        "0004_metadata_governance_history.sql",
        "0005_pipeline_executions.sql",
        "0006_pipeline_execution_invariants.sql",
        "0007_pipeline_execution_temporal_integrity.sql",
    ]

    status = get_migration_status(empty_pg_conn)
    assert len(status) == 7

    for migration in status:
        assert migration["applied"] is True
        assert migration["match"] is True
        assert len(migration["checksum"]) == 64


def test_legacy_checksum_adoption(empty_pg_conn):
    """A legacy 0001 row without checksum metadata is adopted safely."""
    packaged = {
        migration[1]: migration
        for migration in get_postgres_migration_files()
    }
    initial_sql = packaged["0001_initial.sql"][2]

    with empty_pg_conn.cursor() as cur:
        cur.execute(initial_sql)
        cur.execute(
            """
            INSERT INTO schema_migrations (
                version,
                applied_at
            )
            VALUES ('0001_initial.sql', %s);
            """,
            (datetime.now(timezone.utc),),
        )

    applied = apply_postgres_migrations(empty_pg_conn)

    assert applied == [
        "0002_reliability_hardening.sql",
        "0003_metadata_history.sql",
        "0004_metadata_governance_history.sql",
        "0005_pipeline_executions.sql",
        "0006_pipeline_execution_invariants.sql",
        "0007_pipeline_execution_temporal_integrity.sql",
    ]

    with empty_pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                version,
                name,
                checksum
            FROM schema_migrations
            WHERE version = '0001_initial.sql';
            """
        )
        row = cur.fetchone()

    assert row is not None
    assert row["checksum"] == packaged["0001_initial.sql"][3]
    assert row["name"] == "0001_initial.sql"


def test_realistic_0001_to_0002_upgrade(empty_pg_conn):
    """Upgrade a populated DE-02A 0001 database without losing history."""
    packaged = {
        migration[1]: migration
        for migration in get_postgres_migration_files()
    }
    initial_sql = packaged["0001_initial.sql"][2]

    run_id = "run-upgrade-001"
    event_run = "1" * 64
    event_decision_1 = "d" * 4 + "1" * 60
    event_decision_2 = "d" * 4 + "2" * 60

    decision_1_recorded_at = "2026-10-26T10:10:00Z"
    decision_2_recorded_at = "2026-10-26T10:30:00Z"

    payload_decision_1 = {
        "event_id": event_decision_1,
        "event_type": "DECISION_RECORDED",
        "analysis_run_id": run_id,
        "target_type": "misconception_cluster",
        "target_id": "c1",
        "teacher_decision": "accepted",
        "decision_recorded_at": decision_1_recorded_at,
        "occurred_at": decision_1_recorded_at,
    }

    payload_decision_2 = {
        "event_id": event_decision_2,
        "event_type": "DECISION_RECORDED",
        "analysis_run_id": run_id,
        "target_type": "misconception_cluster",
        "target_id": "c1",
        "teacher_decision": "edited",
        "decision_recorded_at": decision_2_recorded_at,
        "occurred_at": decision_2_recorded_at,
    }

    with empty_pg_conn.cursor() as cur:
        cur.execute(initial_sql)

        cur.execute(
            """
            INSERT INTO schema_migrations (
                version,
                applied_at
            )
            VALUES ('0001_initial.sql', %s);
            """,
            (datetime.now(timezone.utc),),
        )

        cur.execute(
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
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
            """,
            (
                run_id,
                "legacy-fingerprint-before-contract-hardening",
                20,
                "Math",
                "9",
                1000,
                "STANDARD",
                "2026-10-26T10:00:00Z",
            ),
        )

        cur.execute(
            """
            INSERT INTO misconception_clusters (
                analysis_run_id,
                cluster_id,
                concept,
                teaching_priority,
                affected_student_count
            )
            VALUES (%s, %s, %s, %s, %s);
            """,
            (
                run_id,
                "c1",
                "Fractions",
                "HIGH",
                5,
            ),
        )

        cur.execute(
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
            VALUES
                (
                    %s,
                    '1.0.0',
                    'ANALYSIS_INGESTED',
                    '2026-10-26T10:00:00Z',
                    %s,
                    'test',
                    '{}'::jsonb
                ),
                (
                    %s,
                    '1.0.0',
                    'DECISION_RECORDED',
                    %s,
                    %s,
                    'human',
                    %s
                ),
                (
                    %s,
                    '1.0.0',
                    'DECISION_RECORDED',
                    %s,
                    %s,
                    'human',
                    %s
                );
            """,
            (
                event_run,
                run_id,
                event_decision_1,
                decision_1_recorded_at,
                run_id,
                json.dumps(payload_decision_1),
                event_decision_2,
                decision_2_recorded_at,
                run_id,
                json.dumps(payload_decision_2),
            ),
        )

        cur.execute(
            """
            INSERT INTO teacher_decisions (
                analysis_run_id,
                target_type,
                target_id,
                teacher_decision,
                notes,
                recorded_at
            )
            VALUES
                (
                    %s,
                    'misconception_cluster',
                    'c1',
                    'accepted',
                    'approved',
                    %s
                ),
                (
                    %s,
                    'misconception_cluster',
                    'c1',
                    'edited',
                    'revised',
                    %s
                );
            """,
            (
                run_id,
                decision_1_recorded_at,
                run_id,
                decision_2_recorded_at,
            ),
        )

        cur.execute(
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
                'misconception_cluster',
                'c1',
                'edited',
                'revised',
                %s,
                %s
            );
            """,
            (
                run_id,
                decision_2_recorded_at,
                event_decision_2,
            ),
        )

    applied = apply_postgres_migrations(empty_pg_conn)

    assert applied == [
        "0002_reliability_hardening.sql",
        "0003_metadata_history.sql",
        "0004_metadata_governance_history.sql",
        "0005_pipeline_executions.sql",
        "0006_pipeline_execution_invariants.sql",
        "0007_pipeline_execution_temporal_integrity.sql",
    ]

    with empty_pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                event_id,
                teacher_decision,
                notes,
                recorded_at
            FROM teacher_decisions
            ORDER BY recorded_at;
            """
        )
        decision_rows = cur.fetchall()

        assert len(decision_rows) == 2
        assert decision_rows[0]["event_id"] == event_decision_1
        assert decision_rows[0]["teacher_decision"] == "accepted"
        assert decision_rows[0]["notes"] == "approved"
        assert decision_rows[1]["event_id"] == event_decision_2
        assert decision_rows[1]["teacher_decision"] == "edited"
        assert decision_rows[1]["notes"] == "revised"

        cur.execute(
            """
            SELECT
                teacher_decision,
                notes,
                updated_at,
                last_event_id
            FROM current_teacher_decisions
            WHERE
                analysis_run_id = %s
                AND target_type = 'misconception_cluster'
                AND target_id = 'c1';
            """,
            (run_id,),
        )
        current_decision = cur.fetchone()

        assert current_decision is not None
        assert current_decision["teacher_decision"] == "edited"
        assert current_decision["notes"] == "revised"
        assert current_decision["last_event_id"] == event_decision_2

        cur.execute(
            """
            SELECT COUNT(*) AS c
            FROM teacher_decisions
            WHERE event_id IS NULL;
            """
        )
        assert cur.fetchone()["c"] == 0

        cur.execute(
            """
            DELETE FROM analytical_events
            WHERE event_id = %s;
            """,
            (event_decision_1,),
        )

        cur.execute(
            """
            SELECT COUNT(*) AS c
            FROM teacher_decisions
            WHERE event_id = %s;
            """,
            (event_decision_1,),
        )
        assert cur.fetchone()["c"] == 0

        cur.execute(
            """
            SELECT COUNT(*) AS c
            FROM teacher_decisions
            WHERE event_id = %s;
            """,
            (event_decision_2,),
        )
        assert cur.fetchone()["c"] == 1


def test_migration_drift_detection(empty_pg_conn):
    """A changed applied checksum raises MigrationDriftError immediately."""
    apply_postgres_migrations(empty_pg_conn)

    with empty_pg_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE schema_migrations
            SET checksum = %s
            WHERE version = '0001_initial.sql';
            """,
            ("0" * 64,),
        )

    with pytest.raises(MigrationDriftError) as exc_info:
        apply_postgres_migrations(empty_pg_conn)

    assert "MIGRATION_DRIFT" in str(exc_info.value)


def test_missing_migration_file_detection(empty_pg_conn):
    """An applied migration absent from the package is rejected."""
    apply_postgres_migrations(empty_pg_conn)

    with empty_pg_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO schema_migrations (
                version,
                name,
                checksum,
                applied_at
            )
            VALUES (
                '9999_phantom.sql',
                '9999_phantom.sql',
                %s,
                CURRENT_TIMESTAMP
            );
            """,
            ("f" * 64,),
        )

    with pytest.raises(MigrationFileMissingError) as exc_info:
        apply_postgres_migrations(empty_pg_conn)

    assert "MIGRATION_FILE_MISSING" in str(exc_info.value)


def test_access_path_indexes_exist(empty_pg_conn):
    """Reliability-hardening migration creates the expected indexes."""
    apply_postgres_migrations(empty_pg_conn)

    expected_indexes = {
        "idx_analytical_events_run_type",
        "idx_teacher_decisions_run_target",
        "idx_current_teacher_decisions_target",
        "idx_audit_event_processed",
    }

    with empty_pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname = 'public';
            """
        )
        found_indexes = {row["indexname"] for row in cur.fetchall()}

    assert expected_indexes.issubset(found_indexes)


def _stage_ops01_schema_through_0005(conn, monkeypatch):
    """Exercise the real migration runner against a five-file release."""
    from lotuslearn_pipeline import postgres as migration_module

    packaged = migration_module.get_postgres_migration_files()
    names = [entry[1] for entry in packaged]

    assert names == [
        "0001_initial.sql",
        "0002_reliability_hardening.sql",
        "0003_metadata_history.sql",
        "0004_metadata_governance_history.sql",
        "0005_pipeline_executions.sql",
        "0006_pipeline_execution_invariants.sql",
        "0007_pipeline_execution_temporal_integrity.sql",
    ]

    first_five = packaged[:5]

    with monkeypatch.context() as patch:
        patch.setattr(
            migration_module,
            "get_postgres_migration_files",
            lambda: first_five,
        )
        applied = migration_module.apply_postgres_migrations(conn)

    assert applied == names[:5]


def test_upgrade_0005_to_0006_preserves_existing_executions(
    empty_pg_conn,
    monkeypatch,
):
    """Upgrade populated execution history without modifying any row."""
    from uuid import uuid4

    from lotuslearn_pipeline.postgres import (
        apply_postgres_migrations,
        get_migration_status,
    )

    _stage_ops01_schema_through_0005(empty_pg_conn, monkeypatch)

    running_id, success_id = uuid4(), uuid4()

    empty_pg_conn.execute(
        """
        INSERT INTO pipeline_executions (
            execution_id, batch_id, attempt_number, status
        )
        VALUES (%s, %s, 1, 'RUNNING')
        """,
        (running_id, uuid4()),
    )

    empty_pg_conn.execute(
        """
        INSERT INTO pipeline_executions (
            execution_id, batch_id, attempt_number, status,
            finished_at, total_attempted, accepted_count,
            duplicate_count, conflict_count, rejected_count,
            failed_count, internal_retry_count
        )
        VALUES (
            %s, %s, 1, 'SUCCEEDED',
            CURRENT_TIMESTAMP, 1, 1,
            0, 0, 0, 0, 0
        )
        """,
        (success_id, uuid4()),
    )

    before = empty_pg_conn.execute(
        "SELECT * FROM pipeline_executions ORDER BY execution_id"
    ).fetchall()

    assert len(before) == 2

    applied = apply_postgres_migrations(empty_pg_conn)
    assert applied == [
        "0006_pipeline_execution_invariants.sql",
        "0007_pipeline_execution_temporal_integrity.sql",
    ]

    after = empty_pg_conn.execute(
        "SELECT * FROM pipeline_executions ORDER BY execution_id"
    ).fetchall()

    assert after == before

    status = get_migration_status(empty_pg_conn)
    assert len(status) == 7
    assert all(row["applied"] and row["match"] for row in status)

    assert apply_postgres_migrations(empty_pg_conn) == []

    with pytest.raises(psycopg.errors.CheckViolation):
        empty_pg_conn.execute(
            """
            UPDATE pipeline_executions
            SET status = 'RUNNING', finished_at = NULL
            WHERE execution_id = %s
            """,
            (success_id,),
        )

    persisted = empty_pg_conn.execute(
        "SELECT * FROM pipeline_executions ORDER BY execution_id"
    ).fetchall()

    assert persisted == before


def test_upgrade_0005_to_0006_fails_atomically_on_dirty_history(
    empty_pg_conn,
    monkeypatch,
):
    """A failed migration must retain 0005 state and allow recovery."""
    from uuid import uuid4

    from lotuslearn_pipeline.postgres import apply_postgres_migrations

    _stage_ops01_schema_through_0005(empty_pg_conn, monkeypatch)

    execution_id = uuid4()

    empty_pg_conn.execute(
        """
        INSERT INTO pipeline_executions (
            execution_id, batch_id, attempt_number, status,
            finished_at, total_attempted, accepted_count,
            duplicate_count, conflict_count, rejected_count,
            failed_count, internal_retry_count
        )
        VALUES (
            %s, %s, 1, 'SUCCEEDED',
            CURRENT_TIMESTAMP, 1, 0,
            0, 0, 0, 1, 0
        )
        """,
        (execution_id, uuid4()),
    )

    with pytest.raises(psycopg.errors.CheckViolation):
        apply_postgres_migrations(empty_pg_conn)

    migration_count = empty_pg_conn.execute(
        """
        SELECT COUNT(*) AS total
        FROM schema_migrations
        WHERE version = '0006_pipeline_execution_invariants.sql'
        """
    ).fetchone()["total"]

    assert migration_count == 0

    constraint_count = empty_pg_conn.execute(
        """
        SELECT COUNT(*) AS total
        FROM pg_constraint
        WHERE conrelid = 'pipeline_executions'::regclass
          AND conname = 'pipeline_execution_success_failed_zero'
        """
    ).fetchone()["total"]

    assert constraint_count == 0

    original = empty_pg_conn.execute(
        """
        SELECT status, failed_count
        FROM pipeline_executions
        WHERE execution_id = %s
        """,
        (execution_id,),
    ).fetchone()

    assert original["status"] == "SUCCEEDED"
    assert original["failed_count"] == 1

    # Repair only the synthetic invalid test record.
    empty_pg_conn.execute(
        """
        UPDATE pipeline_executions
        SET failed_count = 0, accepted_count = 1
        WHERE execution_id = %s
        """,
        (execution_id,),
    )

    assert apply_postgres_migrations(empty_pg_conn) == [
        "0006_pipeline_execution_invariants.sql",
        "0007_pipeline_execution_temporal_integrity.sql",
    ]

    assert apply_postgres_migrations(empty_pg_conn) == []
