"""Retry classification, backoff, and PostgreSQL transactional fault tests.

Validates bounded retries for transient serialization and deadlock failures,
immediate handling of permanent errors, and complete rollback after injected
transaction failures.
"""

import os
from typing import List

import psycopg
import pytest
from psycopg.errors import DeadlockDetected, SerializationFailure, UniqueViolation

from lotuslearn_pipeline.models import IngestionOutcome
from lotuslearn_pipeline.postgres import (
    AnalysisRunConflictError,
    MigrationDriftError,
    PostgresAnalyticalDatabase,
)
from lotuslearn_pipeline.retry import (
    execute_with_retry,
    is_transient_postgres_error,
)

TEST_PG_URL = (
    os.environ.get("LOTUSLEARN_TEST_DATABASE_URL")
    or os.environ.get("LOTUSLEARN_DATABASE_URL")
    or ""
)


def test_is_transient_postgres_error():
    """Only SQLSTATE 40001 and 40P01 are transient."""
    err_40001 = SerializationFailure("could not serialize access")
    assert is_transient_postgres_error(err_40001) is True

    err_40p01 = DeadlockDetected("deadlock detected")
    assert is_transient_postgres_error(err_40p01) is True

    err_23505 = UniqueViolation(
        "duplicate key value violates unique constraint"
    )
    assert is_transient_postgres_error(err_23505) is False

    assert is_transient_postgres_error(ValueError("bad input")) is False


def test_retry_transient_serialization_success():
    """A transient 40001 followed by success retries once."""
    sleeps: List[float] = []
    attempts = 0

    def mock_operation():
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise SerializationFailure(
                "40001: could not serialize access"
            )
        return "SUCCESS"

    result = execute_with_retry(
        mock_operation,
        max_attempts=3,
        base_delay=0.01,
        sleep_fn=sleeps.append,
    )

    assert result.result == "SUCCESS"
    assert result.attempts == 2
    assert attempts == 2
    assert len(sleeps) == 1
    assert sleeps[0] > 0.0


def test_retry_transient_deadlock_success():
    """Two transient 40P01 failures followed by success retry twice."""
    sleeps: List[float] = []
    attempts = 0

    def mock_operation():
        nonlocal attempts
        attempts += 1
        if attempts < 3:
            raise DeadlockDetected("40P01: deadlock detected")
        return "RESOLVED"

    result = execute_with_retry(
        mock_operation,
        max_attempts=3,
        base_delay=0.01,
        sleep_fn=sleeps.append,
    )

    assert result.result == "RESOLVED"
    assert result.attempts == 3
    assert attempts == 3
    assert len(sleeps) == 2


def test_retry_exhaustion_raises():
    """Persistent 40001 is raised after the configured retry budget."""
    sleeps: List[float] = []
    attempts = 0

    def always_fails():
        nonlocal attempts
        attempts += 1
        raise SerializationFailure("40001 persistent failure")

    with pytest.raises(SerializationFailure):
        execute_with_retry(
            always_fails,
            max_attempts=3,
            base_delay=0.001,
            sleep_fn=sleeps.append,
        )

    assert attempts == 3
    assert len(sleeps) == 2


def test_non_transient_error_not_retried():
    """Permanent errors are surfaced without retry."""
    from jsonschema.exceptions import ValidationError

    cases = [
        UniqueViolation("duplicate key"),
        AnalysisRunConflictError("run conflict"),
        ValidationError("Schema contract mismatch"),
        MigrationDriftError("Checksum drift"),
    ]

    for expected_error in cases:
        sleeps: List[float] = []
        attempts = 0

        def operation():
            nonlocal attempts
            attempts += 1
            raise expected_error

        with pytest.raises(type(expected_error)):
            execute_with_retry(
                operation,
                max_attempts=3,
                sleep_fn=sleeps.append,
            )

        assert attempts == 1
        assert sleeps == []


@pytest.fixture
def clean_pg_db():
    """Provides a PostgreSQL database with a freshly migrated public schema."""
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
        pytest.skip(
            f"Cannot connect to PostgreSQL at {TEST_PG_URL}: {exc}"
        )

    db = PostgresAnalyticalDatabase(connection_url=TEST_PG_URL)
    db.initialize_schema()

    try:
        yield db
    finally:
        db.close()


def test_fault_injection_rollback_after_run_insert(clean_pg_db):
    """A crash after run insertion rolls back all transactional state."""

    def inject_crash(point: str):
        if point == "after_run_insert":
            raise RuntimeError("CRASH_INJECTED_AFTER_RUN_INSERT")

    clean_pg_db.fault_hook = inject_crash

    event = {
        "event_id": "f001" + "0" * 60,
        "schema_version": "1.0.0",
        "event_type": "ANALYSIS_INGESTED",
        "occurred_at": "2026-11-02T10:00:00Z",
        "analysis_run_id": "run-fault-001",
        "dataset_fingerprint": "a" * 64,
        "submission_count": 15,
        "subject": "Algebra I",
        "grade_level": "9",
        "total_duration_ms": 1000,
        "execution_mode": "demo_resilience",
        "provenance": "deterministic_code",
    }

    result = clean_pg_db.ingest_single_event(event)

    assert result.outcome == IngestionOutcome.REJECTED
    assert result.rejection_reason is not None
    assert "CRASH_INJECTED_AFTER_RUN_INSERT" in result.rejection_reason

    conn = clean_pg_db.get_connection()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) AS c FROM analysis_runs WHERE run_id = %s;",
            (event["analysis_run_id"],),
        )
        assert cur.fetchone()["c"] == 0

        cur.execute(
            "SELECT COUNT(*) AS c FROM analytical_events WHERE event_id = %s;",
            (event["event_id"],),
        )
        assert cur.fetchone()["c"] == 0

        cur.execute(
            """
            SELECT outcome, COUNT(*) AS c
            FROM ingestion_audit_log
            WHERE event_id = %s
            GROUP BY outcome;
            """,
            (event["event_id"],),
        )
        audit_rows = {row["outcome"]: row["c"] for row in cur.fetchall()}

    assert audit_rows == {IngestionOutcome.REJECTED.value: 1}


def test_fault_injection_rollback_after_projection_insert(clean_pg_db):
    """A crash after projection writes rolls back event and projection rows."""
    clean_pg_db.fault_hook = None

    run_event = {
        "event_id": "f002" + "0" * 60,
        "schema_version": "1.0.0",
        "event_type": "ANALYSIS_INGESTED",
        "occurred_at": "2026-11-02T10:00:00Z",
        "analysis_run_id": "run-fault-002",
        "dataset_fingerprint": "b" * 64,
        "submission_count": 20,
        "subject": "Math",
        "grade_level": "8",
        "total_duration_ms": 900,
        "execution_mode": "demo_resilience",
        "provenance": "deterministic_code",
    }

    run_result = clean_pg_db.ingest_single_event(run_event)
    assert run_result.outcome == IngestionOutcome.ACCEPTED

    def inject_crash(point: str):
        if point == "after_projection_insert":
            raise RuntimeError("CRASH_INJECTED_AFTER_PROJECTION_INSERT")

    clean_pg_db.fault_hook = inject_crash

    finding_event = {
        "event_id": "f002" + "1" * 60,
        "schema_version": "1.0.0",
        "event_type": "FINDING_IDENTIFIED",
        "occurred_at": "2026-11-02T10:00:01Z",
        "analysis_run_id": "run-fault-002",
        "finding_id": "cluster-fault-001",
        "concept": "Fractions",
        "teaching_priority": "high",
        "affected_student_count": 2,
        "percentage_affected": 10.0,
        "affected_student_ids": ["s1", "s2"],
        "provenance": "deterministic_code",
    }

    failed_result = clean_pg_db.ingest_single_event(finding_event)

    assert failed_result.outcome == IngestionOutcome.REJECTED
    assert failed_result.rejection_reason is not None
    assert (
        "CRASH_INJECTED_AFTER_PROJECTION_INSERT"
        in failed_result.rejection_reason
    )

    conn = clean_pg_db.get_connection()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*) AS c
            FROM misconception_clusters
            WHERE cluster_id = %s;
            """,
            (finding_event["finding_id"],),
        )
        assert cur.fetchone()["c"] == 0

        cur.execute(
            "SELECT COUNT(*) AS c FROM analytical_events WHERE event_id = %s;",
            (finding_event["event_id"],),
        )
        assert cur.fetchone()["c"] == 0

        cur.execute(
            """
            SELECT outcome, COUNT(*) AS c
            FROM ingestion_audit_log
            WHERE event_id = %s
            GROUP BY outcome;
            """,
            (finding_event["event_id"],),
        )
        audit_rows = {row["outcome"]: row["c"] for row in cur.fetchall()}

    assert audit_rows == {IngestionOutcome.REJECTED.value: 1}

    clean_pg_db.fault_hook = None
    retry_result = clean_pg_db.ingest_single_event(finding_event)

    assert retry_result.outcome == IngestionOutcome.ACCEPTED

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*) AS c
            FROM misconception_clusters
            WHERE cluster_id = %s;
            """,
            (finding_event["finding_id"],),
        )
        assert cur.fetchone()["c"] == 1

        cur.execute(
            "SELECT COUNT(*) AS c FROM analytical_events WHERE event_id = %s;",
            (finding_event["event_id"],),
        )
        assert cur.fetchone()["c"] == 1

        cur.execute(
            """
            SELECT outcome, COUNT(*) AS c
            FROM ingestion_audit_log
            WHERE event_id = %s
            GROUP BY outcome;
            """,
            (finding_event["event_id"],),
        )
        audit_rows = {row["outcome"]: row["c"] for row in cur.fetchall()}

    assert audit_rows == {
        IngestionOutcome.ACCEPTED.value: 1,
        IngestionOutcome.REJECTED.value: 1,
    }


def test_postgres_full_transaction_retry_on_serialization_failure(clean_pg_db):
    """SQLSTATE 40001 rolls back attempt one and reruns the full transaction."""
    attempt_count = 0
    sleeps: List[float] = []

    def inject_40001_on_first_attempt(point: str):
        nonlocal attempt_count
        if point == "after_projection_insert":
            attempt_count += 1
            if attempt_count == 1:
                raise SerializationFailure(
                    "40001: could not serialize access due to concurrent update"
                )

    clean_pg_db.fault_hook = inject_40001_on_first_attempt

    event = {
        "event_id": "f003" + "0" * 60,
        "schema_version": "1.0.0",
        "event_type": "ANALYSIS_INGESTED",
        "occurred_at": "2026-11-02T10:00:00Z",
        "analysis_run_id": "run-retry-001",
        "dataset_fingerprint": "c" * 64,
        "submission_count": 30,
        "subject": "Geometry",
        "grade_level": "10",
        "total_duration_ms": 1500,
        "execution_mode": "demo_resilience",
        "provenance": "deterministic_code",
    }

    result = clean_pg_db.ingest_single_event(
        event,
        sleep_fn=sleeps.append,
    )

    assert result.outcome == IngestionOutcome.ACCEPTED
    assert result.retry_attempts == 2
    assert attempt_count == 2
    assert len(sleeps) == 1

    conn = clean_pg_db.get_connection()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) AS c FROM analysis_runs WHERE run_id = %s;",
            (event["analysis_run_id"],),
        )
        assert cur.fetchone()["c"] == 1

        cur.execute(
            "SELECT COUNT(*) AS c FROM analytical_events WHERE event_id = %s;",
            (event["event_id"],),
        )
        assert cur.fetchone()["c"] == 1

        cur.execute(
            "SELECT COUNT(*) AS c FROM ingestion_audit_log WHERE event_id = %s;",
            (event["event_id"],),
        )
        assert cur.fetchone()["c"] == 1

        cur.execute(
            """
            SELECT outcome
            FROM ingestion_audit_log
            WHERE event_id = %s;
            """,
            (event["event_id"],),
        )
        assert cur.fetchone()["outcome"] == IngestionOutcome.ACCEPTED.value


def test_postgres_full_transaction_retry_on_deadlock_detected(clean_pg_db):
    """SQLSTATE 40P01 rolls back attempt one and reruns the full transaction."""
    attempt_count = 0
    sleeps: List[float] = []

    def inject_40p01_on_first_attempt(point: str):
        nonlocal attempt_count
        if point == "after_projection_insert":
            attempt_count += 1
            if attempt_count == 1:
                raise DeadlockDetected("40P01: deadlock detected")

    clean_pg_db.fault_hook = inject_40p01_on_first_attempt

    event = {
        "event_id": "f004" + "0" * 60,
        "schema_version": "1.0.0",
        "event_type": "ANALYSIS_INGESTED",
        "occurred_at": "2026-11-02T10:00:00Z",
        "analysis_run_id": "run-retry-40p01",
        "dataset_fingerprint": "d" * 64,
        "submission_count": 25,
        "subject": "Algebra",
        "grade_level": "9",
        "total_duration_ms": 1200,
        "execution_mode": "demo_resilience",
        "provenance": "deterministic_code",
    }

    result = clean_pg_db.ingest_single_event(
        event,
        sleep_fn=sleeps.append,
    )

    assert result.outcome == IngestionOutcome.ACCEPTED
    assert result.retry_attempts == 2
    assert attempt_count == 2
    assert len(sleeps) == 1

    conn = clean_pg_db.get_connection()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) AS c FROM analysis_runs WHERE run_id = %s;",
            (event["analysis_run_id"],),
        )
        assert cur.fetchone()["c"] == 1

        cur.execute(
            "SELECT COUNT(*) AS c FROM analytical_events WHERE event_id = %s;",
            (event["event_id"],),
        )
        assert cur.fetchone()["c"] == 1

        cur.execute(
            "SELECT COUNT(*) AS c FROM ingestion_audit_log WHERE event_id = %s;",
            (event["event_id"],),
        )
        assert cur.fetchone()["c"] == 1

        cur.execute(
            """
            SELECT outcome
            FROM ingestion_audit_log
            WHERE event_id = %s;
            """,
            (event["event_id"],),
        )
        assert cur.fetchone()["outcome"] == IngestionOutcome.ACCEPTED.value
