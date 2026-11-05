"""
Retry classification, exponential backoff, and transactional fault injection tests.
Validates bounded retries for transient serialization/deadlock failures,
immediate classification of permanent constraint/conflict errors, and complete rollback on crash.
"""

import os
from typing import List

import psycopg
import pytest
from psycopg.errors import DeadlockDetected, SerializationFailure, UniqueViolation

from lotuslearn_pipeline.models import IngestionOutcome
from lotuslearn_pipeline.postgres import (
    AnalysisRunConflictError,
    PostgresAnalyticalDatabase,
)
from lotuslearn_pipeline.retry import (
    execute_with_retry,
    is_transient_postgres_error,
)

TEST_PG_URL = os.environ.get(
    "LOTUSLEARN_DATABASE_URL",
    "postgresql://postgres@127.0.0.1:5432/lotuslearn_test",
)


def test_is_transient_postgres_error():
    """Validates SQLSTATE classification."""
    # 40001 is transient
    err_40001 = SerializationFailure("could not serialize access")
    assert is_transient_postgres_error(err_40001) is True

    # 40P01 is transient
    err_40p01 = DeadlockDetected("deadlock detected")
    assert is_transient_postgres_error(err_40p01) is True

    # 23505 (unique violation) is NOT transient
    err_23505 = UniqueViolation("duplicate key value violates unique constraint")
    assert is_transient_postgres_error(err_23505) is False

    # Plain exception is NOT transient
    assert is_transient_postgres_error(ValueError("bad input")) is False


def test_retry_transient_serialization_success():
    """A transient 40001 error followed by success retries and succeeds."""
    sleeps: List[float] = []
    attempts = 0

    def mock_operation():
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise SerializationFailure("40001: could not serialize access")
        return "SUCCESS"

    result = execute_with_retry(
        mock_operation,
        max_attempts=3,
        base_delay=0.01,
        sleep_fn=sleeps.append,
    )

    assert result.result == "SUCCESS"
    assert attempts == 2
    assert len(sleeps) == 1
    assert sleeps[0] > 0.0


def test_retry_transient_deadlock_success():
    """Two transient 40P01 errors followed by success retries twice and succeeds."""
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
    assert attempts == 3
    assert len(sleeps) == 2


def test_retry_exhaustion_raises():
    """Persistent 40001 error exceeding max_attempts is raised."""
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
    assert len(sleeps) == 2  # slept before attempt 2 and attempt 3


def test_non_transient_error_not_retried():
    """Non-transient constraint errors, validation failures, or conflicts must NOT be retried."""
    from jsonschema.exceptions import ValidationError

    from lotuslearn_pipeline.postgres import MigrationDriftError

    sleeps: List[float] = []
    attempts = 0

    def fails_with_unique_violation():
        nonlocal attempts
        attempts += 1
        raise UniqueViolation("duplicate key")

    with pytest.raises(UniqueViolation):
        execute_with_retry(
            fails_with_unique_violation,
            max_attempts=3,
            sleep_fn=sleeps.append,
        )

    assert attempts == 1
    assert len(sleeps) == 0

    attempts = 0

    def fails_with_run_conflict():
        nonlocal attempts
        attempts += 1
        raise AnalysisRunConflictError("run conflict")

    with pytest.raises(AnalysisRunConflictError):
        execute_with_retry(
            fails_with_run_conflict,
            max_attempts=3,
            sleep_fn=sleeps.append,
        )

    assert attempts == 1
    assert len(sleeps) == 0

    # Schema validation failures must not be retried
    attempts = 0

    def fails_with_validation_error():
        nonlocal attempts
        attempts += 1
        raise ValidationError("Schema contract mismatch")

    with pytest.raises(ValidationError):
        execute_with_retry(
            fails_with_validation_error,
            max_attempts=3,
            sleep_fn=sleeps.append,
        )

    assert attempts == 1
    assert len(sleeps) == 0

    # Migration drift must not be retried
    attempts = 0

    def fails_with_migration_drift():
        nonlocal attempts
        attempts += 1
        raise MigrationDriftError("Checksum drift")

    with pytest.raises(MigrationDriftError):
        execute_with_retry(
            fails_with_migration_drift,
            max_attempts=3,
            sleep_fn=sleeps.append,
        )

    assert attempts == 1
    assert len(sleeps) == 0


@pytest.fixture
def clean_pg_db():
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


def test_fault_injection_rollback_after_run_insert(clean_pg_db):
    """
    Fault injection at 'after_run_insert' point must trigger complete transaction rollback.
    Zero rows in analysis_runs, zero rows in analytical_events.
    """
    def inject_crash(point: str):
        if point == "after_run_insert":
            raise RuntimeError("CRASH_INJECTED_AFTER_RUN_INSERT")

    clean_pg_db.fault_hook = inject_crash

    event = {
        "event_id": "f001000000000000000000000000000000000000000000000000000000000001",
        "schema_version": "1.0.0",
        "event_type": "ANALYSIS_INGESTED",
        "occurred_at": "2026-11-02T10:00:00Z",
        "analysis_run_id": "run-fault-001",
        "dataset_fingerprint": "fp-fault-001",
        "submission_count": 15,
        "subject": "Algebra I",
        "grade_level": "9",
        "total_duration_ms": 1000,
        "execution_mode": "STANDARD",
        "provenance": "fault-test",
    }

    with pytest.raises(RuntimeError) as exc_info:
        clean_pg_db.ingest_single_event(event)

    assert "CRASH_INJECTED_AFTER_RUN_INSERT" in str(exc_info.value)

    # Verify zero partial state persisted
    conn = clean_pg_db.get_connection()
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS c FROM analysis_runs WHERE run_id = 'run-fault-001';")
        assert cur.fetchone()["c"] == 0
        cur.execute(
            "SELECT COUNT(*) AS c FROM analytical_events WHERE event_id = %s;",
            (event["event_id"],),
        )
        assert cur.fetchone()["c"] == 0


def test_fault_injection_rollback_after_projection_insert(clean_pg_db):
    """
    Fault injection at 'after_projection_insert' point must trigger complete transaction rollback.
    Zero rows in misconception_clusters, zero rows in analytical_events.
    """
    # First ingest parent run successfully without fault
    clean_pg_db.fault_hook = None
    run_event = {
        "event_id": "f002000000000000000000000000000000000000000000000000000000000001",
        "schema_version": "1.0.0",
        "event_type": "ANALYSIS_INGESTED",
        "occurred_at": "2026-11-02T10:00:00Z",
        "analysis_run_id": "run-fault-002",
        "dataset_fingerprint": "fp-fault-002",
        "submission_count": 20,
        "subject": "Math",
        "grade_level": "8",
        "total_duration_ms": 900,
        "execution_mode": "STANDARD",
        "provenance": "fault-test",
    }
    res_run = clean_pg_db.ingest_single_event(run_event)
    assert res_run.outcome == IngestionOutcome.ACCEPTED

    # Now inject fault at canonical after_projection_insert hook
    def inject_crash(point: str):
        if point == "after_projection_insert":
            raise RuntimeError("CRASH_INJECTED_AFTER_PROJECTION_INSERT")

    clean_pg_db.fault_hook = inject_crash

    finding_event = {
        "event_id": "f002000000000000000000000000000000000000000000000000000000000002",
        "schema_version": "1.0.0",
        "event_type": "FINDING_IDENTIFIED",
        "occurred_at": "2026-11-02T10:00:01Z",
        "analysis_run_id": "run-fault-002",
        "finding_id": "cluster-fault-001",
        "concept": "Fractions",
        "teaching_priority": "HIGH",
        "affected_student_count": 5,
        "percentage_affected": 25.0,
        "affected_student_ids": ["s1", "s2"],
        "provenance": "fault-test",
    }

    with pytest.raises(RuntimeError) as exc_info:
        clean_pg_db.ingest_single_event(finding_event)

    assert "CRASH_INJECTED_AFTER_PROJECTION_INSERT" in str(exc_info.value)

    # Verify atomic rollback: neither the finding nor the cluster exists
    conn = clean_pg_db.get_connection()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*) AS c FROM misconception_clusters
            WHERE cluster_id = 'cluster-fault-001';
            """
        )
        assert cur.fetchone()["c"] == 0
        cur.execute(
            "SELECT COUNT(*) AS c FROM analytical_events WHERE event_id = %s;",
            (finding_event["event_id"],),
        )
        assert cur.fetchone()["c"] == 0

    # Event remains safely retryable
    clean_pg_db.fault_hook = None
    retry_res = clean_pg_db.ingest_single_event(finding_event)
    assert retry_res.outcome == IngestionOutcome.ACCEPTED

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*) AS c FROM misconception_clusters
            WHERE cluster_id = 'cluster-fault-001';
            """
        )
        assert cur.fetchone()["c"] == 1
        cur.execute(
            "SELECT COUNT(*) AS c FROM analytical_events WHERE event_id = %s;",
            (finding_event["event_id"],),
        )
        assert cur.fetchone()["c"] == 1


def test_postgres_full_transaction_retry_on_serialization_failure(clean_pg_db):
    """
    Proves that a retryable error (SQLSTATE 40001 serialization_failure) injected after
    intermediate transactional writes causes complete rollback of attempt 1,
    and attempt 2 reruns the complete logical transaction to success.
    """
    attempt_count = 0
    sleeps: List[float] = []

    # Ingest a new run event; inject 40001 on attempt 1 after intermediate writes
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
        "event_id": "f003000000000000000000000000000000000000000000000000000000000001",
        "schema_version": "1.0.0",
        "event_type": "ANALYSIS_INGESTED",
        "occurred_at": "2026-11-02T10:00:00Z",
        "analysis_run_id": "run-retry-001",
        "dataset_fingerprint": "fp-retry-001",
        "submission_count": 30,
        "subject": "Geometry",
        "grade_level": "10",
        "total_duration_ms": 1500,
        "execution_mode": "STANDARD",
        "provenance": "retry-test",
    }

    res = clean_pg_db.ingest_single_event(event, sleep_fn=sleeps.append)

    assert res.outcome == IngestionOutcome.ACCEPTED
    assert attempt_count == 2
    assert len(sleeps) == 1
    assert res.retry_attempts == 2

    # Verify final state in database
    conn = clean_pg_db.get_connection()
    with conn.cursor() as cur:
        # Exactly one parent run
        cur.execute(
            "SELECT COUNT(*) AS c FROM analysis_runs WHERE run_id = 'run-retry-001';"
        )
        assert cur.fetchone()["c"] == 1

        # Exactly one immutable analytical event
        cur.execute(
            "SELECT COUNT(*) AS c FROM analytical_events WHERE event_id = %s;",
            (event["event_id"],),
        )
        assert cur.fetchone()["c"] == 1

        # Exactly one audit entry for this event
        cur.execute(
            "SELECT COUNT(*) AS c FROM ingestion_audit_log WHERE event_id = %s;",
            (event["event_id"],),
        )
        assert cur.fetchone()["c"] == 1


def test_postgres_full_transaction_retry_on_deadlock_detected(clean_pg_db):
    """
    Proves that SQLSTATE 40P01 (deadlock_detected) injected after intermediate transactional writes
    causes complete rollback of attempt 1, and attempt 2 reruns the complete transaction to success.
    """
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
        "event_id": "f004000000000000000000000000000000000000000000000000000000000001",
        "schema_version": "1.0.0",
        "event_type": "ANALYSIS_INGESTED",
        "occurred_at": "2026-11-02T10:00:00Z",
        "analysis_run_id": "run-retry-40p01",
        "dataset_fingerprint": "fp-retry-40p01",
        "submission_count": 25,
        "subject": "Algebra",
        "grade_level": "9",
        "total_duration_ms": 1200,
        "execution_mode": "STANDARD",
        "provenance": "deadlock-test",
    }

    res = clean_pg_db.ingest_single_event(event, sleep_fn=sleeps.append)

    assert res.outcome == IngestionOutcome.ACCEPTED
    assert attempt_count == 2
    assert len(sleeps) == 1
    assert res.retry_attempts == 2

    # Verify final state in database
    conn = clean_pg_db.get_connection()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) AS c FROM analysis_runs WHERE run_id = 'run-retry-40p01';"
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
