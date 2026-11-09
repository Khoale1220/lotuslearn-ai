"""Tests for PostgreSQL 18 durable persistence backend with Psycopg 3."""

import os

import psycopg
import pytest
from psycopg.rows import dict_row

from lotuslearn_pipeline.models import IngestionOutcome
from lotuslearn_pipeline.postgres import PostgresAnalyticalDatabase, apply_postgres_migrations


def get_test_pg_url() -> str:
    """Return only the dedicated destructive-test database URL."""
    return os.environ.get("LOTUSLEARN_TEST_DATABASE_URL", "").strip()


TEST_PG_URL = get_test_pg_url()


def clean_postgres_db(url: str) -> None:
    """Drops all tables and views in public schema for a clean test slate."""
    with psycopg.connect(url, autocommit=True) as conn:
        database_name = conn.execute("SELECT current_database();").fetchone()[0]
        if database_name != "lotuslearn_test":
            raise RuntimeError(
                "Refusing destructive PostgreSQL test setup outside lotuslearn_test"
            )
        conn.execute("DROP SCHEMA public CASCADE;")
        conn.execute("CREATE SCHEMA public;")
        conn.execute("GRANT ALL ON SCHEMA public TO PUBLIC;")


def test_get_test_pg_url_never_falls_back_to_database_url(monkeypatch):
    monkeypatch.delenv("LOTUSLEARN_TEST_DATABASE_URL", raising=False)
    monkeypatch.setenv(
        "LOTUSLEARN_DATABASE_URL",
        "postgresql://user:pass@localhost:5432/lotuslearn_dev",
    )
    assert get_test_pg_url() == ""


@pytest.fixture
def pg_db():
    if not TEST_PG_URL:
        pytest.skip("No running PostgreSQL instance available for testing")
    clean_postgres_db(TEST_PG_URL)
    db = PostgresAnalyticalDatabase(TEST_PG_URL)
    db.initialize_schema()
    yield db
    db.close()


@pytest.fixture
def sample_run_event():
    return {
        "schema_version": "1.0.0",
        "event_id": "1111111111111111111111111111111111111111111111111111111111111111",
        "event_type": "ANALYSIS_INGESTED",
        "occurred_at": "2026-10-26T10:00:00Z",
        "analysis_run_id": "run-test-pg-001",
        "provenance": "source",
        "dataset_fingerprint": "2222222222222222222222222222222222222222222222222222222222222222",
        "submission_count": 25,
        "subject": "Mathematics",
        "grade_level": "Grade 8",
        "total_duration_ms": 1400,
        "execution_mode": "demo_resilience",
    }


@pytest.fixture
def sample_finding_event():
    return {
        "schema_version": "1.0.0",
        "event_id": "3333333333333333333333333333333333333333333333333333333333333333",
        "event_type": "FINDING_IDENTIFIED",
        "occurred_at": "2026-10-26T10:00:00Z",
        "analysis_run_id": "run-test-pg-001",
        "provenance": "gemini",
        "finding_id": "cluster-fractions-01",
        "concept": "Adding Fractions with Unlike Denominators",
        "teaching_priority": "urgent",
        "affected_student_count": 6,
        "affected_student_ids": [
            "Student A",
            "Student B",
            "Student C",
            "Student D",
            "Student E",
            "Student F",
        ],
        "percentage_affected": 24.0,
        "explanation": "Adding numerators and denominators directly.",
    }


def test_migrations_from_scratch():
    """Validates applying migrations from an empty database."""
    if not TEST_PG_URL:
        pytest.skip("No PostgreSQL available")
    clean_postgres_db(TEST_PG_URL)

    with psycopg.connect(TEST_PG_URL, row_factory=dict_row) as conn:
        applied = apply_postgres_migrations(conn)
        assert "0001_initial.sql" in applied

        with conn.cursor() as cur:
            cur.execute("SELECT version FROM schema_migrations;")
            rows = [r["version"] for r in cur.fetchall()]
            assert "0001_initial.sql" in rows


def test_migrations_rerun_idempotent(pg_db):
    """Validates that rerunning initialize_schema applies 0 new migrations safely."""
    newly_applied = pg_db.initialize_schema()
    assert newly_applied == []


def test_postgres_ingestion_and_event_boundary(pg_db, sample_run_event, sample_finding_event):
    """Validates standard transactional ingestion and committed ID retrieval."""
    res1 = pg_db.ingest_single_event(sample_run_event)
    assert res1.outcome == IngestionOutcome.ACCEPTED

    res2 = pg_db.ingest_single_event(sample_finding_event)
    assert res2.outcome == IngestionOutcome.ACCEPTED

    committed = pg_db.get_committed_event_ids()
    assert sample_run_event["event_id"] in committed
    assert sample_finding_event["event_id"] in committed


def test_postgres_exact_duplicate_replay(pg_db, sample_run_event):
    """Exact identical replay must return DUPLICATE without mutation."""
    res1 = pg_db.ingest_single_event(sample_run_event)
    assert res1.outcome == IngestionOutcome.ACCEPTED

    res2 = pg_db.ingest_single_event(sample_run_event)
    assert res2.outcome == IngestionOutcome.DUPLICATE

    conn = pg_db.get_connection()
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS c FROM analysis_runs;")
        assert cur.fetchone()["c"] == 1


def test_postgres_identity_conflict_payload_mismatch(pg_db, sample_run_event):
    """Same event_id with different payload must yield CONFLICT."""
    res1 = pg_db.ingest_single_event(sample_run_event)
    assert res1.outcome == IngestionOutcome.ACCEPTED

    tampered = dict(sample_run_event)
    tampered["subject"] = "Biology"

    res2 = pg_db.ingest_single_event(tampered)
    assert res2.outcome == IngestionOutcome.CONFLICT
    assert "IDENTITY_CONFLICT_PAYLOAD_MISMATCH" in str(res2.rejection_reason)


def test_postgres_run_conflict_duration_and_execution_mode(pg_db, sample_run_event):
    """Different run metadata on same analysis_run_id must yield CONFLICT."""
    res1 = pg_db.ingest_single_event(sample_run_event)
    assert res1.outcome == IngestionOutcome.ACCEPTED

    # Conflicting duration
    conflicting_dur = dict(sample_run_event)
    conflicting_dur["event_id"] = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    conflicting_dur["total_duration_ms"] = 9999
    res_dur = pg_db.ingest_single_event(conflicting_dur)
    assert res_dur.outcome == IngestionOutcome.CONFLICT
    assert "ANALYSIS_RUN_CONFLICT" in str(res_dur.rejection_reason)

    # Conflicting execution mode
    conflicting_mode = dict(sample_run_event)
    conflicting_mode["event_id"] = "b" * 64
    conflicting_mode["execution_mode"] = "live_gemini"
    res_mode = pg_db.ingest_single_event(conflicting_mode)
    assert res_mode.outcome == IngestionOutcome.CONFLICT
    assert "ANALYSIS_RUN_CONFLICT" in str(res_mode.rejection_reason)


def test_postgres_foreign_key_rollback(pg_db, sample_finding_event):
    """Child event without parent analysis run must fail FK and rollback transaction."""
    res = pg_db.ingest_single_event(sample_finding_event)
    assert res.outcome == IngestionOutcome.REJECTED
    assert "INGESTION_TRANSACTION_FAILED" in str(res.rejection_reason)

    committed = pg_db.get_committed_event_ids()
    assert sample_finding_event["event_id"] not in committed


def test_postgres_out_of_order_teacher_decisions(pg_db, sample_run_event):
    """Validates that out-of-order decision events do not regress current state."""
    pg_db.ingest_single_event(sample_run_event)
    run_id = sample_run_event["analysis_run_id"]

    # 1. 11:00 edited decision arrives first
    event_1100 = {
        "schema_version": "1.0.0",
        "event_id": "e111111111111111111111111111111111111111111111111111111111111111",
        "event_type": "DECISION_RECORDED",
        "occurred_at": "2026-10-26T11:00:00Z",
        "decision_recorded_at": "2026-10-26T11:00:00Z",
        "analysis_run_id": run_id,
        "provenance": "human",
        "target_type": "differentiated_intervention",
        "target_id": "group-review-1",
        "teacher_decision": "edited",
        "notes": "Added review duration",
    }
    pg_db.ingest_single_event(event_1100)

    conn = pg_db.get_connection()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT teacher_decision, updated_at
            FROM current_teacher_decisions
            WHERE analysis_run_id = %s;
            """,
            (run_id,),
        )
        row = cur.fetchone()
        assert row["teacher_decision"] == "edited"

    # 2. Older 10:30 accepted decision arrives later (e.g. delayed network delivery)
    event_1030 = {
        "schema_version": "1.0.0",
        "event_id": "e000000000000000000000000000000000000000000000000000000000000000",
        "event_type": "DECISION_RECORDED",
        "occurred_at": "2026-10-26T10:30:00Z",
        "decision_recorded_at": "2026-10-26T10:30:00Z",
        "analysis_run_id": run_id,
        "provenance": "human",
        "target_type": "differentiated_intervention",
        "target_id": "group-review-1",
        "teacher_decision": "accepted",
        "notes": "Initial auto-accept",
    }
    pg_db.ingest_single_event(event_1030)

    # Current projection MUST remain 'edited' (from 11:00)
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT teacher_decision, updated_at
            FROM current_teacher_decisions
            WHERE analysis_run_id = %s;
            """,
            (run_id,),
        )
        row = cur.fetchone()
        assert row["teacher_decision"] == "edited"

        # Historical log must have both events recorded
        cur.execute(
            """
            SELECT COUNT(*) AS c
            FROM teacher_decisions
            WHERE analysis_run_id = %s;
            """,
            (run_id,),
        )
        assert cur.fetchone()["c"] == 2


def test_postgres_cascade_delete(pg_db, sample_run_event, sample_finding_event):
    """Deleting parent analysis run cascades across relational tables and events."""
    pg_db.ingest_single_event(sample_run_event)
    pg_db.ingest_single_event(sample_finding_event)
    run_id = sample_run_event["analysis_run_id"]

    conn = pg_db.get_connection()
    with conn.transaction():
        conn.execute("DELETE FROM analysis_runs WHERE run_id = %s;", (run_id,))

    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS c FROM analysis_runs;")
        assert cur.fetchone()["c"] == 0
        cur.execute("SELECT COUNT(*) AS c FROM misconception_clusters;")
        assert cur.fetchone()["c"] == 0
        cur.execute("SELECT COUNT(*) AS c FROM student_findings;")
        assert cur.fetchone()["c"] == 0
        cur.execute("SELECT COUNT(*) AS c FROM analytical_events;")
        assert cur.fetchone()["c"] == 0


def test_postgres_equal_timestamp_tie_breaker(pg_db, sample_run_event):
    """Equal timestamps resolve deterministically via last_event_id comparison."""
    pg_db.ingest_single_event(sample_run_event)
    run_id = sample_run_event["analysis_run_id"]

    ev_low = {
        "schema_version": "1.0.0",
        "event_id": "1111111111111111111111111111111111111111111111111111111111111111",
        "event_type": "DECISION_RECORDED",
        "occurred_at": "2026-10-26T12:00:00Z",
        "decision_recorded_at": "2026-10-26T12:00:00Z",
        "analysis_run_id": run_id,
        "provenance": "human",
        "target_type": "misconception_cluster",
        "target_id": "cluster-1",
        "teacher_decision": "accepted",
        "notes": "Low ID accept",
    }
    ev_high = {
        "schema_version": "1.0.0",
        "event_id": "9999999999999999999999999999999999999999999999999999999999999999",
        "event_type": "DECISION_RECORDED",
        "occurred_at": "2026-10-26T12:00:00Z",
        "decision_recorded_at": "2026-10-26T12:00:00Z",
        "analysis_run_id": run_id,
        "provenance": "human",
        "target_type": "misconception_cluster",
        "target_id": "cluster-1",
        "teacher_decision": "dismissed",
        "notes": "High ID dismiss",
    }

    # Ingest low first, then high
    pg_db.ingest_single_event(ev_low)
    pg_db.ingest_single_event(ev_high)

    conn = pg_db.get_connection()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT teacher_decision, last_event_id
            FROM current_teacher_decisions
            WHERE analysis_run_id = %s;
            """,
            (run_id,),
        )
        row = cur.fetchone()
        assert row["teacher_decision"] == "dismissed"
        assert row["last_event_id"] == ev_high["event_id"]
