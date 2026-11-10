"""PostgreSQL 18 integration tests for durable execution lifecycle."""

from __future__ import annotations

import os
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, replace
from threading import Barrier
from uuid import uuid4

import psycopg
import pytest
from psycopg.rows import dict_row

from lotuslearn_pipeline.execution_ledger import (
    ExecutionConflictError,
    ExecutionIntegrityError,
    ExecutionStatus,
    ExecutionWriteOutcome,
    PostgresPipelineExecutionLedger,
)
from lotuslearn_pipeline.postgres import apply_postgres_migrations
from lotuslearn_pipeline.reconciliation import ReconciliationReport


@pytest.fixture(scope="module")
def test_db_url():
    url = os.environ.get("LOTUSLEARN_TEST_DATABASE_URL")

    if not url:
        pytest.skip("Dedicated PostgreSQL test URL is not configured")

    with psycopg.connect(
        url,
        autocommit=True,
        row_factory=dict_row,
    ) as conn:
        identity = conn.execute(
            """
            SELECT
                current_database() AS database_name,
                current_setting('server_version_num') AS version_num
            """
        ).fetchone()

        if identity["database_name"] != "lotuslearn_test":
            pytest.fail("Unsafe PostgreSQL database target")

        version = int(identity["version_num"])

        if not 180000 <= version < 190000:
            pytest.fail("PostgreSQL 18 required")

        apply_postgres_migrations(conn)

    return url


@pytest.fixture
def case(test_db_url):
    """Use isolated UUID identities and remove only test-owned rows."""
    batch_ids = []

    def new_batch():
        batch_id = uuid4()
        batch_ids.append(batch_id)
        return batch_id

    ledger = PostgresPipelineExecutionLedger(test_db_url)

    yield ledger, new_batch, test_db_url

    with psycopg.connect(test_db_url, autocommit=True) as conn:
        for batch_id in batch_ids:
            conn.execute(
                "DELETE FROM pipeline_executions WHERE batch_id = %s",
                (batch_id,),
            )


def _report(batch_id):
    return ReconciliationReport(
        batch_id=str(batch_id),
        total_attempted=4,
        accepted_count=2,
        duplicate_count=1,
        conflict_count=0,
        rejected_count=1,
        failed_count=0,
        internal_retry_count=3,
    )


def test_start_and_exact_replay_preserve_identity(case):
    ledger, new_batch, _ = case
    batch_id = new_batch()
    execution_id = uuid4()

    first = ledger.start_execution(
        execution_id=execution_id,
        batch_id=batch_id,
        attempt_number=1,
    )

    second = ledger.start_execution(
        execution_id=execution_id,
        batch_id=batch_id,
        attempt_number=1,
    )

    assert first.outcome == ExecutionWriteOutcome.INSERTED
    assert second.outcome == ExecutionWriteOutcome.EXISTING
    assert first.execution == second.execution
    assert first.execution.status == ExecutionStatus.RUNNING
    assert ledger.get_execution(execution_id) == first.execution


def test_unique_attempt_rejects_different_execution_id(case):
    ledger, new_batch, _ = case
    batch_id = new_batch()

    ledger.start_execution(
        execution_id=uuid4(),
        batch_id=batch_id,
        attempt_number=1,
    )

    with pytest.raises(ExecutionConflictError):
        ledger.start_execution(
            execution_id=uuid4(),
            batch_id=batch_id,
            attempt_number=1,
        )


def test_execution_id_cannot_be_reassigned(case):
    ledger, new_batch, _ = case
    first_batch = new_batch()
    second_batch = new_batch()
    execution_id = uuid4()

    ledger.start_execution(
        execution_id=execution_id,
        batch_id=first_batch,
        attempt_number=1,
    )

    with pytest.raises(ExecutionConflictError):
        ledger.start_execution(
            execution_id=execution_id,
            batch_id=second_batch,
            attempt_number=1,
        )


def test_heartbeat_only_updates_running_execution(case):
    ledger, new_batch, _ = case
    batch_id = new_batch()
    execution_id = uuid4()

    started = ledger.start_execution(
        execution_id=execution_id,
        batch_id=batch_id,
        attempt_number=1,
    ).execution

    updated = ledger.heartbeat(execution_id)

    assert updated.heartbeat_at >= started.heartbeat_at
    assert updated.status == ExecutionStatus.RUNNING

    ledger.finish_execution(
        execution_id=execution_id,
        status=ExecutionStatus.FAILED,
        error_code="INGESTION_FAILED",
    )

    with pytest.raises(ExecutionConflictError):
        ledger.heartbeat(execution_id)


def test_success_completion_is_immutable_and_idempotent(case):
    ledger, new_batch, _ = case
    batch_id = new_batch()
    execution_id = uuid4()
    report = _report(batch_id)

    ledger.start_execution(
        execution_id=execution_id,
        batch_id=batch_id,
        attempt_number=1,
    )

    first = ledger.finish_execution(
        execution_id=execution_id,
        status=ExecutionStatus.SUCCEEDED,
        report=report,
    )

    replay = ledger.finish_execution(
        execution_id=execution_id,
        status=ExecutionStatus.SUCCEEDED,
        report=report,
    )

    assert first.outcome == ExecutionWriteOutcome.TRANSITIONED
    assert replay.outcome == ExecutionWriteOutcome.EXISTING
    assert first.execution == replay.execution
    assert first.execution.total_attempted == 4
    assert first.execution.internal_retry_count == 3
    assert first.execution.failed_count == 0
    assert first.execution.finished_at >= first.execution.started_at

    changed = replace(
        report,
        accepted_count=1,
        rejected_count=2,
    )

    with pytest.raises(ExecutionConflictError):
        ledger.finish_execution(
            execution_id=execution_id,
            status=ExecutionStatus.SUCCEEDED,
            report=changed,
        )

    assert ledger.get_execution(execution_id) == first.execution


def test_failed_completion_requires_safe_error_code(case):
    ledger, new_batch, _ = case
    batch_id = new_batch()
    execution_id = uuid4()

    ledger.start_execution(
        execution_id=execution_id,
        batch_id=batch_id,
        attempt_number=1,
    )

    with pytest.raises(ValueError):
        ledger.finish_execution(
            execution_id=execution_id,
            status=ExecutionStatus.FAILED,
            error_code="student@example.com",
        )

    assert ledger.get_execution(execution_id).status == ExecutionStatus.RUNNING

    first = ledger.finish_execution(
        execution_id=execution_id,
        status=ExecutionStatus.FAILED,
        error_code="INGESTION_FAILED",
    )

    replay = ledger.finish_execution(
        execution_id=execution_id,
        status=ExecutionStatus.FAILED,
        error_code="INGESTION_FAILED",
    )

    assert first.outcome == ExecutionWriteOutcome.TRANSITIONED
    assert replay.outcome == ExecutionWriteOutcome.EXISTING
    assert first.execution == replay.execution
    assert first.execution.error_code == "INGESTION_FAILED"

    with pytest.raises(ExecutionConflictError):
        ledger.finish_execution(
            execution_id=execution_id,
            status=ExecutionStatus.FAILED,
            error_code="EXECUTION_TIMEOUT",
        )


def test_invalid_reconciliation_cannot_finish_execution(case):
    ledger, new_batch, _ = case
    batch_id = new_batch()
    execution_id = uuid4()

    ledger.start_execution(
        execution_id=execution_id,
        batch_id=batch_id,
        attempt_number=1,
    )

    unbalanced = replace(_report(batch_id), total_attempted=5)

    with pytest.raises(ValueError):
        ledger.finish_execution(
            execution_id=execution_id,
            status=ExecutionStatus.SUCCEEDED,
            report=unbalanced,
        )

    negative = replace(
        _report(batch_id),
        accepted_count=-1,
        rejected_count=4,
    )

    with pytest.raises(ValueError):
        ledger.finish_execution(
            execution_id=execution_id,
            status=ExecutionStatus.SUCCEEDED,
            report=negative,
        )

    assert ledger.get_execution(execution_id).status == ExecutionStatus.RUNNING


def test_mismatched_report_batch_rolls_back(case):
    ledger, new_batch, _ = case
    batch_id = new_batch()
    other_batch = new_batch()
    execution_id = uuid4()

    ledger.start_execution(
        execution_id=execution_id,
        batch_id=batch_id,
        attempt_number=1,
    )

    with pytest.raises(ValueError):
        ledger.finish_execution(
            execution_id=execution_id,
            status=ExecutionStatus.SUCCEEDED,
            report=_report(other_batch),
        )

    assert ledger.get_execution(execution_id).status == ExecutionStatus.RUNNING


def test_concurrent_start_inserts_only_one_execution(case):
    ledger, new_batch, _ = case
    batch_id = new_batch()
    execution_id = uuid4()
    barrier = Barrier(6)

    def start():
        barrier.wait(timeout=15)
        return ledger.start_execution(
            execution_id=execution_id,
            batch_id=batch_id,
            attempt_number=1,
        )

    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = [pool.submit(start) for _ in range(6)]
        results = [future.result(timeout=30) for future in futures]

    outcomes = [result.outcome for result in results]

    assert outcomes.count(ExecutionWriteOutcome.INSERTED) == 1
    assert outcomes.count(ExecutionWriteOutcome.EXISTING) == 5
    assert len({result.execution.execution_id for result in results}) == 1


def test_concurrent_terminal_conflicts_have_one_winner(case):
    ledger, new_batch, _ = case
    batch_id = new_batch()
    execution_id = uuid4()
    barrier = Barrier(2)

    ledger.start_execution(
        execution_id=execution_id,
        batch_id=batch_id,
        attempt_number=1,
    )

    def finish(status):
        barrier.wait(timeout=15)

        if status == ExecutionStatus.SUCCEEDED:
            return ledger.finish_execution(
                execution_id=execution_id,
                status=status,
                report=_report(batch_id),
            )

        return ledger.finish_execution(
            execution_id=execution_id,
            status=status,
            error_code="INGESTION_FAILED",
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [
            pool.submit(finish, ExecutionStatus.SUCCEEDED),
            pool.submit(finish, ExecutionStatus.FAILED),
        ]

        successes = []
        conflicts = 0

        for future in futures:
            try:
                successes.append(future.result(timeout=30))
            except ExecutionConflictError:
                conflicts += 1

    assert len(successes) == 1
    assert conflicts == 1
    assert successes[0].outcome == ExecutionWriteOutcome.TRANSITIONED
    assert ledger.get_execution(execution_id) == successes[0].execution


def test_postgres_rejects_unbalanced_accounting(case):
    _, new_batch, url = case
    batch_id = new_batch()

    with psycopg.connect(url, autocommit=True) as conn:
        with pytest.raises(psycopg.errors.CheckViolation):
            conn.execute(
                """
                INSERT INTO pipeline_executions (
                    execution_id,
                    batch_id,
                    attempt_number,
                    status,
                    finished_at,
                    total_attempted,
                    accepted_count,
                    duplicate_count,
                    conflict_count,
                    rejected_count,
                    failed_count,
                    internal_retry_count
                )
                VALUES (
                    %s, %s, 1, 'SUCCEEDED',
                    clock_timestamp(),
                    2, 1, 0, 0, 0, 0, 0
                )
                """,
                (uuid4(), batch_id),
            )

        count = conn.execute(
            """
            SELECT count(*)
            FROM pipeline_executions
            WHERE batch_id = %s
            """,
            (batch_id,),
        ).fetchone()[0]

    assert count == 0


def test_corrupted_success_record_fails_closed(case):
    ledger, new_batch, _ = case
    batch_id = new_batch()

    started = ledger.start_execution(
        execution_id=uuid4(),
        batch_id=batch_id,
        attempt_number=1,
    ).execution

    corrupted = asdict(started)

    corrupted.update(
        status="SUCCEEDED",
        finished_at=started.started_at,
        total_attempted=1,
        accepted_count=0,
        duplicate_count=0,
        conflict_count=0,
        rejected_count=0,
        failed_count=1,
        internal_retry_count=0,
    )

    with pytest.raises(ExecutionIntegrityError):
        ledger._record(corrupted)


def test_db_invariant_success_rejects_failed_events(case):
    """Database must reject successful runs containing failed events."""
    _, new_batch, url = case
    batch_id = new_batch()

    with psycopg.connect(url, autocommit=True) as conn:
        with pytest.raises(psycopg.errors.CheckViolation):
            conn.execute(
                """
                INSERT INTO pipeline_executions (
                    execution_id,
                    batch_id,
                    attempt_number,
                    status,
                    finished_at,
                    total_attempted,
                    accepted_count,
                    duplicate_count,
                    conflict_count,
                    rejected_count,
                    failed_count,
                    internal_retry_count
                )
                VALUES (
                    %s, %s, 1, 'SUCCEEDED',
                    CURRENT_TIMESTAMP,
                    1, 0, 0, 0, 0, 1, 0
                )
                """,
                (uuid4(), batch_id),
            )


def test_db_invariant_terminal_execution_cannot_reopen(case):
    """A terminal execution must remain terminal."""
    ledger, new_batch, url = case
    batch_id = new_batch()
    execution_id = uuid4()

    ledger.start_execution(
        execution_id=execution_id,
        batch_id=batch_id,
        attempt_number=1,
    )

    ledger.finish_execution(
        execution_id=execution_id,
        status=ExecutionStatus.FAILED,
        error_code="INGESTION_FAILED",
    )

    with psycopg.connect(url, autocommit=True) as conn:
        with pytest.raises(psycopg.errors.CheckViolation):
            conn.execute(
                """
                UPDATE pipeline_executions
                SET status = 'RUNNING',
                    finished_at = NULL,
                    error_code = NULL
                WHERE execution_id = %s
                """,
                (execution_id,),
            )


def test_db_invariant_heartbeat_cannot_move_backwards(case):
    """An execution heartbeat must never regress."""
    ledger, new_batch, url = case
    batch_id = new_batch()
    execution_id = uuid4()

    ledger.start_execution(
        execution_id=execution_id,
        batch_id=batch_id,
        attempt_number=1,
    )

    with psycopg.connect(url, autocommit=True) as conn:
        with pytest.raises(psycopg.errors.CheckViolation):
            conn.execute(
                """
                UPDATE pipeline_executions
                SET heartbeat_at =
                    started_at - INTERVAL '1 second'
                WHERE execution_id = %s
                """,
                (execution_id,),
            )


def test_db_invariant_heartbeat_rejects_regression_above_start(case):
    """Heartbeat cannot regress even when still later than started_at."""
    ledger, new_batch, url = case

    batch_id = new_batch()
    execution_id = uuid4()

    ledger.start_execution(
        execution_id=execution_id,
        batch_id=batch_id,
        attempt_number=1,
    )

    with psycopg.connect(url, autocommit=True) as conn:
        original = conn.execute(
            """
            UPDATE pipeline_executions
            SET heartbeat_at = started_at + INTERVAL '120 seconds'
            WHERE execution_id = %s
              AND status = 'RUNNING'
            RETURNING started_at, heartbeat_at
            """,
            (execution_id,),
        ).fetchone()

        assert original is not None
        assert original[1] > original[0]

        with pytest.raises(
            psycopg.errors.CheckViolation
        ) as error:
            conn.execute(
                """
                UPDATE pipeline_executions
                SET heartbeat_at = started_at + INTERVAL '60 seconds'
                WHERE execution_id = %s
                """,
                (execution_id,),
            )

        assert error.value.sqlstate == "23514"
        assert (
            error.value.diag.constraint_name
            == "pipeline_execution_heartbeat_monotonic"
        )

        persisted = conn.execute(
            """
            SELECT heartbeat_at
            FROM pipeline_executions
            WHERE execution_id = %s
            """,
            (execution_id,),
        ).fetchone()

        assert persisted is not None
        assert persisted[0] == original[1]


def test_finish_never_precedes_last_heartbeat(case):
    """Terminal completion must not precede the last persisted heartbeat."""
    ledger, new_batch, url = case

    batch_id = new_batch()
    execution_id = uuid4()

    ledger.start_execution(
        execution_id=execution_id,
        batch_id=batch_id,
        attempt_number=1,
    )

    with psycopg.connect(url, autocommit=True) as conn:
        row = conn.execute(
            """
            UPDATE pipeline_executions
            SET heartbeat_at = clock_timestamp()
                + INTERVAL '120 seconds'
            WHERE execution_id = %s
              AND status = 'RUNNING'
            RETURNING heartbeat_at
            """,
            (execution_id,),
        ).fetchone()

    assert row is not None
    last_heartbeat = row[0]

    completed = ledger.finish_execution(
        execution_id=execution_id,
        status=ExecutionStatus.FAILED,
        error_code="INGESTION_FAILED",
    )

    assert completed.execution.finished_at >= last_heartbeat
    assert (
        completed.execution.finished_at
        >= completed.execution.heartbeat_at
    )
