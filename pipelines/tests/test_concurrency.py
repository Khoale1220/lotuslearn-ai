"""
Concurrency integration tests for LotusLearn PostgreSQL persistence.

Tests multi-threaded concurrent ingestion, atomic event arbitration,
advisory locking for migrations, and race-condition guarantees.
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

TEST_PG_URL = (
    os.environ.get("LOTUSLEARN_TEST_DATABASE_URL")
    or os.environ.get("LOTUSLEARN_DATABASE_URL")
    or ""
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
    except Exception as exc:
        pytest.skip(f"Cannot connect to PostgreSQL at {TEST_PG_URL}: {exc}")

    db = PostgresAnalyticalDatabase(connection_url=TEST_PG_URL)
    db.initialize_schema()

    try:
        yield db
    finally:
        db.close()


def test_concurrent_identical_event_ingestion(fresh_pg_db):
    """
    Eight workers ingest the same valid event concurrently.

    Guarantees:
      - Exactly one worker receives ACCEPTED.
      - Exactly seven workers receive DUPLICATE.
      - No worker receives CONFLICT or REJECTED.
      - Exactly one analytical event is committed.
      - Exactly one analysis run is committed.
      - Exactly eight durable ingestion audit attempts are recorded.
    """
    event = {
        "event_id": "1" * 64,
        "schema_version": "1.0.0",
        "event_type": "ANALYSIS_INGESTED",
        "occurred_at": "2026-11-02T10:00:00Z",
        "analysis_run_id": "run-conc-001",
        "dataset_fingerprint": "a" * 64,
        "submission_count": 25,
        "subject": "Algebra I",
        "grade_level": "9",
        "total_duration_ms": 1200,
        "execution_mode": "demo_resilience",
        "provenance": "deterministic_code",
    }

    worker_count = 8
    barrier = threading.Barrier(worker_count)

    def _worker(_worker_id: int):
        worker_db = PostgresAnalyticalDatabase(connection_url=TEST_PG_URL)
        try:
            barrier.wait(timeout=10.0)
            return worker_db.ingest_single_event(event)
        finally:
            worker_db.close()

    with ThreadPoolExecutor(max_workers=worker_count) as executor:
        futures = [executor.submit(_worker, i) for i in range(worker_count)]
        results = [future.result() for future in as_completed(futures)]

    accepted_count = sum(
        1 for result in results if result.outcome == IngestionOutcome.ACCEPTED
    )
    duplicate_count = sum(
        1 for result in results if result.outcome == IngestionOutcome.DUPLICATE
    )
    conflict_count = sum(
        1 for result in results if result.outcome == IngestionOutcome.CONFLICT
    )
    rejected_count = sum(
        1 for result in results if result.outcome == IngestionOutcome.REJECTED
    )

    assert accepted_count == 1, f"Expected exactly 1 accepted, got {accepted_count}"
    assert duplicate_count == worker_count - 1
    assert conflict_count == 0
    assert rejected_count == 0

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
        assert cur.fetchone()["c"] == worker_count

        cur.execute(
            """
            SELECT outcome, COUNT(*) AS c
            FROM ingestion_audit_log
            WHERE event_id = %s
            GROUP BY outcome;
            """,
            (event["event_id"],),
        )
        audit_counts = {row["outcome"]: row["c"] for row in cur.fetchall()}

    assert audit_counts == {
        IngestionOutcome.ACCEPTED.value: 1,
        IngestionOutcome.DUPLICATE.value: worker_count - 1,
    }


def test_concurrent_payload_conflict_arbitration(fresh_pg_db):
    """
    Two workers ingest the same event_id with different valid payloads.

    The analysis-run metadata remains identical so this test isolates event-id
    arbitration rather than analysis-run conflict detection.

    Guarantees:
      - Exactly one worker receives ACCEPTED.
      - Exactly one worker receives CONFLICT.
      - The losing result reports payload identity conflict.
      - Exactly one analytical event is committed.
      - Exactly two durable audit attempts are recorded.
    """
    base_event = {
        "event_id": "2" * 64,
        "schema_version": "1.0.0",
        "event_type": "ANALYSIS_INGESTED",
        "occurred_at": "2026-11-02T10:00:00Z",
        "analysis_run_id": "run-conc-002",
        "dataset_fingerprint": "b" * 64,
        "submission_count": 30,
        "subject": "Algebra I",
        "grade_level": "9",
        "total_duration_ms": 1500,
        "execution_mode": "demo_resilience",
        "provenance": "deterministic_code",
    }

    conflicting_event = dict(base_event)
    conflicting_event["provenance"] = "human"

    barrier = threading.Barrier(2)

    def _worker(event):
        worker_db = PostgresAnalyticalDatabase(connection_url=TEST_PG_URL)
        try:
            barrier.wait(timeout=10.0)
            return worker_db.ingest_single_event(event)
        finally:
            worker_db.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        first_future = executor.submit(_worker, base_event)
        second_future = executor.submit(_worker, conflicting_event)
        first_result = first_future.result()
        second_result = second_future.result()

    outcomes = sorted(
        [first_result.outcome, second_result.outcome],
        key=lambda outcome: outcome.value,
    )

    assert outcomes == [
        IngestionOutcome.ACCEPTED,
        IngestionOutcome.CONFLICT,
    ]

    losing_result = (
        second_result
        if first_result.outcome == IngestionOutcome.ACCEPTED
        else first_result
    )

    assert losing_result.rejection_reason is not None
    assert "IDENTITY_CONFLICT_PAYLOAD_MISMATCH" in losing_result.rejection_reason

    conn = fresh_pg_db.get_connection()

    with conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) AS c FROM analytical_events WHERE event_id = %s;",
            (base_event["event_id"],),
        )
        assert cur.fetchone()["c"] == 1

        cur.execute(
            "SELECT COUNT(*) AS c FROM ingestion_audit_log WHERE event_id = %s;",
            (base_event["event_id"],),
        )
        assert cur.fetchone()["c"] == 2


def test_concurrent_analysis_run_conflict_arbitration(fresh_pg_db):
    """
    Two workers ingest different valid events for the same analysis_run_id
    with conflicting immutable run metadata.

    Guarantees:
      - Exactly one worker receives ACCEPTED.
      - Exactly one worker receives CONFLICT.
      - Only the winning analytical event is committed.
      - The stored run metadata matches the winning event.
    """
    event_a = {
        "event_id": "3" * 64,
        "schema_version": "1.0.0",
        "event_type": "ANALYSIS_INGESTED",
        "occurred_at": "2026-11-02T10:00:00Z",
        "analysis_run_id": "run-conc-003",
        "dataset_fingerprint": "c" * 64,
        "submission_count": 28,
        "subject": "Physics",
        "grade_level": "11",
        "total_duration_ms": 2000,
        "execution_mode": "demo_resilience",
        "provenance": "deterministic_code",
    }

    event_b = dict(event_a)
    event_b["event_id"] = "4" * 64
    event_b["total_duration_ms"] = 9999

    barrier = threading.Barrier(2)

    def _worker(event):
        worker_db = PostgresAnalyticalDatabase(connection_url=TEST_PG_URL)
        try:
            barrier.wait(timeout=10.0)
            return worker_db.ingest_single_event(event)
        finally:
            worker_db.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        first_future = executor.submit(_worker, event_a)
        second_future = executor.submit(_worker, event_b)
        first_result = first_future.result()
        second_result = second_future.result()

    outcomes = sorted(
        [first_result.outcome, second_result.outcome],
        key=lambda outcome: outcome.value,
    )

    assert outcomes == [
        IngestionOutcome.ACCEPTED,
        IngestionOutcome.CONFLICT,
    ]

    winning_event = (
        event_a
        if first_result.outcome == IngestionOutcome.ACCEPTED
        else event_b
    )
    losing_result = (
        second_result
        if first_result.outcome == IngestionOutcome.ACCEPTED
        else first_result
    )

    assert losing_result.rejection_reason is not None
    assert "ANALYSIS_RUN_CONFLICT" in losing_result.rejection_reason

    conn = fresh_pg_db.get_connection()

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                dataset_fingerprint,
                submission_count,
                subject,
                grade_level,
                total_duration_ms,
                execution_mode
            FROM analysis_runs
            WHERE run_id = %s;
            """,
            (event_a["analysis_run_id"],),
        )
        stored_run = cur.fetchone()

        assert stored_run is not None
        assert stored_run["dataset_fingerprint"] == winning_event["dataset_fingerprint"]
        assert stored_run["submission_count"] == winning_event["submission_count"]
        assert stored_run["subject"] == winning_event["subject"]
        assert stored_run["grade_level"] == winning_event["grade_level"]
        assert stored_run["total_duration_ms"] == winning_event["total_duration_ms"]
        assert stored_run["execution_mode"] == winning_event["execution_mode"]

        cur.execute(
            """
            SELECT COUNT(*) AS c
            FROM analytical_events
            WHERE analysis_run_id = %s;
            """,
            (event_a["analysis_run_id"],),
        )
        assert cur.fetchone()["c"] == 1

        cur.execute(
            """
            SELECT outcome, COUNT(*) AS c
            FROM ingestion_audit_log
            WHERE event_id IN (%s, %s)
            GROUP BY outcome;
            """,
            (event_a["event_id"], event_b["event_id"]),
        )
        audit_counts = {row["outcome"]: row["c"] for row in cur.fetchall()}

    assert audit_counts == {
        IngestionOutcome.ACCEPTED.value: 1,
        IngestionOutcome.CONFLICT.value: 1,
    }


def test_concurrent_schema_migrations_under_advisory_lock():
    """
    Four threads apply migrations concurrently to the same database.

    Guarantees:
      - pg_advisory_xact_lock serializes migration execution.
      - No duplicate migration-history rows are created.
      - Exactly the packaged 0001 and 0002 migrations are recorded.
    """
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
    except Exception as exc:
        pytest.skip(f"Cannot connect to PostgreSQL at {TEST_PG_URL}: {exc}")

    thread_count = 4
    barrier = threading.Barrier(thread_count)

    def _run_migrations(_thread_id: int):
        barrier.wait(timeout=10.0)

        with psycopg.connect(
            TEST_PG_URL,
            row_factory=dict_row,
            autocommit=True,
        ) as conn:
            return apply_postgres_migrations(conn)

    with ThreadPoolExecutor(max_workers=thread_count) as executor:
        futures = [executor.submit(_run_migrations, i) for i in range(thread_count)]
        results = [future.result() for future in as_completed(futures)]

    all_applied = [migration for result in results for migration in result]

    assert len(all_applied) == 2
    assert set(all_applied) == {
        "0001_initial.sql",
        "0002_reliability_hardening.sql",
    }

    with psycopg.connect(
        TEST_PG_URL,
        row_factory=dict_row,
        autocommit=True,
    ) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS c FROM schema_migrations;"
            )
            assert cur.fetchone()["c"] == 2
