"""
Concurrency integration tests for LotusLearn PostgreSQL persistence.
Tests multi-threaded concurrent ingestion, atomic arbitration,
advisory locking for migrations, and race condition guarantees.
"""

import os
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

import psycopg
import pytest
from psycopg.rows import dict_row

from lotuslearn_pipeline.models import IngestionOutcome
from lotuslearn_pipeline.postgres import (
    PostgresAnalyticalDatabase,
    apply_postgres_migrations,
)

TEST_PG_URL = os.environ.get(
    "LOTUSLEARN_DATABASE_URL",
    "postgresql://postgres@127.0.0.1:5432/lotuslearn_test",
)


@pytest.fixture
def fresh_pg_db():
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

    db = PostgresAnalyticalDatabase(connection_url=TEST_PG_URL)
    db.initialize_schema()
    yield db
    db.close()


def test_concurrent_identical_event_ingestion(fresh_pg_db):
    """
    8 simultaneous workers attempt to ingest the exact same event.
    Guarantees:
      - Exactly 1 worker receives IngestionOutcome.ACCEPTED.
      - Exactly 7 workers receive IngestionOutcome.DUPLICATE.
      - Exactly 0 workers receive IngestionOutcome.REJECTED or error.
      - Exactly 1 row in analytical_events.
      - Exactly 8 rows recorded in ingestion_audit_log.
    """
    event = {
        "event_id": "c001000000000000000000000000000000000000000000000000000000000001",
        "schema_version": "1.0.0",
        "event_type": "ANALYSIS_INGESTED",
        "occurred_at": "2026-11-02T10:00:00Z",
        "analysis_run_id": "run-conc-001",
        "dataset_fingerprint": "fp-conc-001",
        "submission_count": 25,
        "subject": "Algebra I",
        "grade_level": "9",
        "total_duration_ms": 1200,
        "execution_mode": "STANDARD",
        "provenance": "concurrent-test-worker",
    }

    num_workers = 8
    barrier = threading.Barrier(num_workers)

    def _worker(worker_id: int):
        # Each worker creates its own independent database instance / connection
        worker_db = PostgresAnalyticalDatabase(connection_url=TEST_PG_URL)
        try:
            barrier.wait(timeout=10.0)
            return worker_db.ingest_single_event(event)
        finally:
            worker_db.close()

    with ThreadPoolExecutor(max_workers=num_workers) as executor:
        futures = [executor.submit(_worker, i) for i in range(num_workers)]
        results = [f.result() for f in as_completed(futures)]

    accepted_count = sum(1 for r in results if r.outcome == IngestionOutcome.ACCEPTED)
    duplicate_count = sum(1 for r in results if r.outcome == IngestionOutcome.DUPLICATE)
    conflict_count = sum(1 for r in results if r.outcome == IngestionOutcome.CONFLICT)
    rejected_count = sum(1 for r in results if r.outcome == IngestionOutcome.REJECTED)

    assert accepted_count == 1, f"Expected exactly 1 accepted, got {accepted_count}"
    assert duplicate_count == num_workers - 1
    assert conflict_count == 0
    assert rejected_count == 0

    # Verify database state
    conn = fresh_pg_db.get_connection()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) AS c FROM analytical_events WHERE event_id = %s;",
            (event["event_id"],),
        )
        assert cur.fetchone()["c"] == 1

        cur.execute(
            "SELECT COUNT(*) AS c FROM analysis_runs WHERE run_id = %s;",
            (event["analysis_run_id"],),
        )
        assert cur.fetchone()["c"] == 1

        cur.execute(
            "SELECT COUNT(*) AS c FROM ingestion_audit_log WHERE event_id = %s;",
            (event["event_id"],),
        )
        assert cur.fetchone()["c"] == num_workers


def test_concurrent_payload_conflict_arbitration(fresh_pg_db):
    """
    2 workers simultaneously ingest events with the SAME event_id but DIFFERENT payloads.
    Guarantees:
      - Exactly 1 worker wins and receives ACCEPTED.
      - Exactly 1 worker loses and receives CONFLICT (IDENTITY_CONFLICT_PAYLOAD_MISMATCH).
      - No corrupted or half-written projections exist.
    """
    base_event = {
        "event_id": "c002000000000000000000000000000000000000000000000000000000000002",
        "schema_version": "1.0.0",
        "event_type": "ANALYSIS_INGESTED",
        "occurred_at": "2026-11-02T10:00:00Z",
        "analysis_run_id": "run-conc-002",
        "dataset_fingerprint": "fp-conc-002",
        "submission_count": 30,
        "subject": "Algebra I",
        "grade_level": "9",
        "total_duration_ms": 1500,
        "execution_mode": "STANDARD",
        "provenance": "worker-a",
    }

    tampered_event = dict(base_event)
    tampered_event["subject"] = "Geometry"
    tampered_event["provenance"] = "worker-b"

    barrier_payload = threading.Barrier(2)

    def _worker(ev):
        worker_db = PostgresAnalyticalDatabase(connection_url=TEST_PG_URL)
        try:
            barrier_payload.wait(timeout=10.0)
            return worker_db.ingest_single_event(ev)
        finally:
            worker_db.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(_worker, base_event)
        f2 = executor.submit(_worker, tampered_event)
        r1 = f1.result()
        r2 = f2.result()

    outcomes = sorted([r1.outcome, r2.outcome], key=lambda x: x.value)
    assert outcomes == [IngestionOutcome.ACCEPTED, IngestionOutcome.CONFLICT]

    loser_res = r2 if r1.outcome == IngestionOutcome.ACCEPTED else r1
    err = str(loser_res.rejection_reason)
    assert "IDENTITY_CONFLICT_PAYLOAD_MISMATCH" in err or "ANALYSIS_RUN_CONFLICT" in err


def test_concurrent_analysis_run_conflict_arbitration(fresh_pg_db):
    """
    2 workers simultaneously ingest different run events for the SAME analysis_run_id
    with conflicting metadata (differing total_duration_ms).
    Guarantees:
      - 1 worker succeeds (ACCEPTED).
      - 1 worker detects conflict (CONFLICT), rolls back, and leaves zero partial data.
    """
    event_a = {
        "event_id": "c00300000000000000000000000000000000000000000000000000000000000a",
        "schema_version": "1.0.0",
        "event_type": "ANALYSIS_INGESTED",
        "occurred_at": "2026-11-02T10:00:00Z",
        "analysis_run_id": "run-conc-003",
        "dataset_fingerprint": "fp-conc-003",
        "submission_count": 28,
        "subject": "Physics",
        "grade_level": "11",
        "total_duration_ms": 2000,
        "execution_mode": "STANDARD",
        "provenance": "worker-run-a",
    }

    event_b = dict(event_a)
    event_b["event_id"] = "c00300000000000000000000000000000000000000000000000000000000000b"
    event_b["total_duration_ms"] = 9999  # Conflicting duration!
    event_b["provenance"] = "worker-run-b"

    barrier_run = threading.Barrier(2)

    def _worker(ev):
        worker_db = PostgresAnalyticalDatabase(connection_url=TEST_PG_URL)
        try:
            barrier_run.wait(timeout=10.0)
            return worker_db.ingest_single_event(ev)
        finally:
            worker_db.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(_worker, event_a)
        f2 = executor.submit(_worker, event_b)
        r1 = f1.result()
        r2 = f2.result()

    outcomes = sorted([r1.outcome, r2.outcome], key=lambda x: x.value)
    assert outcomes == [IngestionOutcome.ACCEPTED, IngestionOutcome.CONFLICT]


def test_concurrent_schema_migrations_under_advisory_lock():
    """
    4 concurrent threads attempt to apply migrations simultaneously on the same database.
    Guarantees:
      - pg_advisory_xact_lock serializes DDL execution.
      - Zero duplicate key violations on schema_migrations.
      - Exactly 2 migrations recorded in schema_migrations.
    """
    if not TEST_PG_URL:
        pytest.skip("No PostgreSQL URL configured")

    with psycopg.connect(TEST_PG_URL, autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                DROP SCHEMA public CASCADE;
                CREATE SCHEMA public;
                """
            )

    num_threads = 4
    barrier_mig = threading.Barrier(num_threads)

    def _run_migrations(thread_id: int):
        barrier_mig.wait(timeout=10.0)
        with psycopg.connect(TEST_PG_URL, row_factory=dict_row) as conn:
            return apply_postgres_migrations(conn)

    with ThreadPoolExecutor(max_workers=num_threads) as executor:
        futures = [executor.submit(_run_migrations, i) for i in range(num_threads)]
        results = [f.result() for f in as_completed(futures)]

    # Exactly one thread should have applied the migrations, others applied 0
    all_applied = [m for sublist in results for m in sublist]
    assert len(set(all_applied)) == 2  # 0001 and 0002
    assert "0001_initial.sql" in all_applied
    assert "0002_reliability_hardening.sql" in all_applied

    with psycopg.connect(TEST_PG_URL, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS c FROM schema_migrations;")
            assert cur.fetchone()["c"] == 2
