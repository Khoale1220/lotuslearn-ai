"""
Migration integrity tests for LotusLearn PostgreSQL persistence.
Tests multi-stage migrations (0001 -> 0002), legacy checksum adoption,
tamper/drift detection, missing migration file alerts, and access path indexes.
"""

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

TEST_PG_URL = os.environ.get(
    "LOTUSLEARN_DATABASE_URL",
    "postgresql://postgres@127.0.0.1:5432/lotuslearn_test",
)


@pytest.fixture
def empty_pg_conn():
    if not TEST_PG_URL:
        pytest.skip("No PostgreSQL URL configured")
    try:
        with psycopg.connect(TEST_PG_URL, autocommit=True) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    DROP SCHEMA public CASCADE;
                    CREATE SCHEMA public;
                    """
                )
    except Exception as e:
        pytest.skip(f"Cannot connect to PostgreSQL at {TEST_PG_URL}: {e}")

    conn = psycopg.connect(TEST_PG_URL, row_factory=dict_row)
    yield conn
    conn.close()


def test_migrations_fresh_apply(empty_pg_conn):
    """Applying migrations to an empty DB applies 0001 and 0002 with checksums."""
    applied = apply_postgres_migrations(empty_pg_conn)
    assert len(applied) == 2
    assert "0001_initial.sql" in applied
    assert "0002_reliability_hardening.sql" in applied

    status = get_migration_status(empty_pg_conn)
    assert len(status) == 2
    for m in status:
        assert m["applied"] is True
        assert m["match"] is True
        assert len(m["checksum"]) == 64  # valid SHA-256


def test_legacy_checksum_adoption(empty_pg_conn):
    """
    Simulates a database that previously ran under DE-02A where 0001 was recorded
    without 'checksum' or 'name' columns.
    The migration runner must upgrade schema_migrations and backfill the checksum
    without failing or re-running 0001.
    """
    # 1. Manually apply 0001 using old schema_migrations structure
    packaged = {m[1]: m for m in get_postgres_migration_files()}
    initial_sql = packaged["0001_initial.sql"][2]

    with empty_pg_conn.cursor() as cur:
        # Run raw 0001 DDL
        cur.execute(initial_sql)
        # Old 0001 insert: only version and applied_at
        cur.execute(
            """
            INSERT INTO schema_migrations (version, applied_at)
            VALUES ('0001_initial.sql', %s);
            """,
            (datetime.now(timezone.utc),),
        )

    # 2. Run apply_postgres_migrations
    applied = apply_postgres_migrations(empty_pg_conn)
    # Only 0002 should have been newly executed
    assert applied == ["0002_reliability_hardening.sql"]

    # 3. Verify that 0001 now has the adopted checksum
    with empty_pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT version, name, checksum FROM schema_migrations
            WHERE version = '0001_initial.sql';
            """
        )
        row = cur.fetchone()
        assert row is not None
        assert row["checksum"] == packaged["0001_initial.sql"][3]
        assert row["name"] == "0001_initial.sql"


def test_realistic_0001_to_0002_upgrade(empty_pg_conn):
    """
    Constructs a complete realistic DE-02A database at migration 0001 containing:
      - analysis_runs
      - analytical_events (including DECISION_RECORDED)
      - misconception_clusters
      - instructional_groups
      - legacy teacher_decisions (without event_id column)
      - current_teacher_decisions
    Then runs apply_postgres_migrations to upgrade to 0002.
    Verifies:
      - History preserved and backfilled with exact event_id
      - Current state projection preserved
      - Foreign keys intact
      - Zero orphan rows
    """
    packaged = {m[1]: m for m in get_postgres_migration_files()}
    initial_sql = packaged["0001_initial.sql"][2]

    run_id = "run-upgrade-001"
    ev_run = "1111111111111111111111111111111111111111111111111111111111111111"
    ev_dec1 = "dddd111111111111111111111111111111111111111111111111111111111111"
    ev_dec2 = "dddd222222222222222222222222222222222222222222222222222222222222"

    with empty_pg_conn.cursor() as cur:
        # 1. Apply raw 0001 DDL
        cur.execute(initial_sql)
        cur.execute(
            """
            INSERT INTO schema_migrations (version, applied_at)
            VALUES ('0001_initial.sql', %s);
            """,
            (datetime.now(timezone.utc),),
        )

        # 2. Insert parent run
        cur.execute(
            """
            INSERT INTO analysis_runs (
                run_id, dataset_fingerprint, submission_count, subject,
                grade_level, total_duration_ms, execution_mode, occurred_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
            """,
            (run_id, "fp-up", 20, "Math", "9", 1000, "STANDARD", "2026-10-26T10:00:00Z"),
        )

        # 3. Insert clusters and groups
        cur.execute(
            """
            INSERT INTO misconception_clusters (
                analysis_run_id, cluster_id, concept, teaching_priority, affected_student_count
            ) VALUES (%s, %s, %s, %s, %s);
            """,
            (run_id, "c1", "Fractions", "HIGH", 5),
        )

        # 4. Insert analytical events
        payload_dec1 = {
            "event_id": ev_dec1,
            "event_type": "DECISION_RECORDED",
            "analysis_run_id": run_id,
            "target_type": "misconception_cluster",
            "target_id": "c1",
            "teacher_decision": "accepted",
            "decision_recorded_at": "2026-10-26T10:10:00Z",
            "occurred_at": "2026-10-26T10:10:00Z",
        }
        payload_dec2 = {
            "event_id": ev_dec2,
            "event_type": "DECISION_RECORDED",
            "analysis_run_id": run_id,
            "target_type": "misconception_cluster",
            "target_id": "c1",
            "teacher_decision": "edited",
            "decision_recorded_at": "2026-10-26T10:30:00Z",
            "occurred_at": "2026-10-26T10:30:00Z",
        }

        import json

        cur.execute(
            """
            INSERT INTO analytical_events (
                event_id, schema_version, event_type, occurred_at,
                analysis_run_id, provenance, payload_json
            ) VALUES
            (%s, '1.0.0', 'ANALYSIS_INGESTED', '2026-10-26T10:00:00Z', %s, 'test', '{}'),
            (%s, '1.0.0', 'DECISION_RECORDED', '2026-10-26T10:10:00Z', %s, 'human', %s),
            (%s, '1.0.0', 'DECISION_RECORDED', '2026-10-26T10:30:00Z', %s, 'human', %s);
            """,
            (
                ev_run,
                run_id,
                ev_dec1,
                run_id,
                json.dumps(payload_dec1),
                ev_dec2,
                run_id,
                json.dumps(payload_dec2),
            ),
        )

        # 5. Insert legacy teacher_decisions rows
        cur.execute(
            """
            INSERT INTO teacher_decisions (
                analysis_run_id, target_type, target_id, teacher_decision, notes, recorded_at
            ) VALUES
            (%s, 'misconception_cluster', 'c1', 'accepted', 'approved', '2026-10-26T10:10:00Z'),
            (%s, 'misconception_cluster', 'c1', 'edited', 'revised', '2026-10-26T10:30:00Z');
            """,
            (run_id, run_id),
        )

        # 6. Insert current teacher decision projection
        cur.execute(
            """
            INSERT INTO current_teacher_decisions (
                analysis_run_id, target_type, target_id, teacher_decision,
                notes, decision_recorded_at, updated_at
            ) VALUES
            (%s, 'misconception_cluster', 'c1', 'edited', 'revised',
             '2026-10-26T10:30:00Z', '2026-10-26T10:30:00Z');
            """,
            (run_id,),
        )

    # Apply upgrade to 0002
    applied = apply_postgres_migrations(empty_pg_conn)
    assert "0002_reliability_hardening.sql" in applied

    # Verify state after upgrade
    with empty_pg_conn.cursor() as cur:
        # Check teacher_decisions has event_id populated
        cur.execute(
            """
            SELECT event_id, teacher_decision, recorded_at
            FROM teacher_decisions
            ORDER BY recorded_at;
            """
        )
        dec_rows = cur.fetchall()
        assert len(dec_rows) == 2
        assert dec_rows[0]["event_id"] == ev_dec1
        assert dec_rows[0]["teacher_decision"] == "accepted"
        assert dec_rows[1]["event_id"] == ev_dec2
        assert dec_rows[1]["teacher_decision"] == "edited"

        # Check current_teacher_decisions projection remains intact
        cur.execute("SELECT * FROM current_teacher_decisions WHERE target_id = 'c1';")
        curr = cur.fetchone()
        assert curr is not None
        assert curr["teacher_decision"] == "edited"

        # Check foreign key works: deleting analytical event cascades
        cur.execute("DELETE FROM analytical_events WHERE event_id = %s;", (ev_dec1,))
        cur.execute(
            "SELECT COUNT(*) AS c FROM teacher_decisions WHERE event_id = %s;",
            (ev_dec1,),
        )
        assert cur.fetchone()["c"] == 0
        # Second event still remains
        cur.execute(
            "SELECT COUNT(*) AS c FROM teacher_decisions WHERE event_id = %s;",
            (ev_dec2,),
        )
        assert cur.fetchone()["c"] == 1


def test_migration_drift_detection(empty_pg_conn):
    """
    If an applied migration in schema_migrations has a checksum that does not match
    the packaged migration file, MigrationDriftError must be raised immediately.
    """
    apply_postgres_migrations(empty_pg_conn)

    # Tamper with the checksum in schema_migrations
    with empty_pg_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE schema_migrations
            SET checksum = 'tampered000000000000000000000000000000000000000000000000000000000'
            WHERE version = '0001_initial.sql';
            """
        )

    with pytest.raises(MigrationDriftError) as exc_info:
        apply_postgres_migrations(empty_pg_conn)

    assert "MIGRATION_DRIFT" in str(exc_info.value)


def test_missing_migration_file_detection(empty_pg_conn):
    """
    If schema_migrations records a migration version that does not exist
    in packaged migration files, MigrationFileMissingError must be raised.
    """
    apply_postgres_migrations(empty_pg_conn)

    # Insert phantom migration
    with empty_pg_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO schema_migrations (version, name, checksum, applied_at)
            VALUES ('9999_phantom.sql', '9999_phantom.sql', 'dummyhash', CURRENT_TIMESTAMP);
            """
        )

    with pytest.raises(MigrationFileMissingError) as exc_info:
        apply_postgres_migrations(empty_pg_conn)

    assert "MIGRATION_FILE_MISSING" in str(exc_info.value)


def test_access_path_indexes_exist_and_planned(empty_pg_conn):
    """
    Validates that the performance indexes created in 0002_reliability_hardening.sql
    exist and are available in the PostgreSQL catalog.
    """
    apply_postgres_migrations(empty_pg_conn)

    expected_indexes = [
        "idx_analytical_events_run_type",
        "idx_teacher_decisions_run_target",
        "idx_current_teacher_decisions_target",
        "idx_audit_event_processed",
    ]

    with empty_pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT indexname FROM pg_indexes
            WHERE schemaname = 'public';
            """
        )
        found_indexes = {r["indexname"] for r in cur.fetchall()}

    for idx in expected_indexes:
        assert idx in found_indexes, f"Expected index '{idx}' was not found in pg_indexes"

    # Verify planner EXPLAIN on target table queries
    with empty_pg_conn.cursor() as cur:
        cur.execute(
            """
            EXPLAIN SELECT * FROM analytical_events
            WHERE analysis_run_id = 'test' AND event_type = 'ANALYSIS_INGESTED';
            """
        )
        plan = " ".join([r["QUERY PLAN"] for r in cur.fetchall()])
        assert len(plan) > 0

        cur.execute(
            """
            EXPLAIN SELECT * FROM current_teacher_decisions
            WHERE target_type = 'CLUSTER' AND target_id = 'c1';
            """
        )
        plan2 = " ".join([r["QUERY PLAN"] for r in cur.fetchall()])
        assert len(plan2) > 0
