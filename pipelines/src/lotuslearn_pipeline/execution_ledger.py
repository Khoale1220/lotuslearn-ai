"""Durable PostgreSQL execution lifecycle for LotusLearn batches.

Tracks operational executions separately from educational analysis runs.
Never stores raw input, event payloads, or exception messages.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

import psycopg
from psycopg.rows import dict_row

from lotuslearn_pipeline.reconciliation import ReconciliationReport
from lotuslearn_pipeline.retry import execute_with_retry


class ExecutionLedgerError(RuntimeError):
    """Base execution ledger error."""


class ExecutionConflictError(ExecutionLedgerError):
    """Existing execution identity or terminal state conflicts."""


class ExecutionIntegrityError(ExecutionLedgerError):
    """Missing or invalid persisted execution data."""


class ExecutionStatus(str, Enum):
    RUNNING = "RUNNING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"


class ExecutionWriteOutcome(str, Enum):
    INSERTED = "INSERTED"
    EXISTING = "EXISTING"
    TRANSITIONED = "TRANSITIONED"


ALLOWED_ERROR_CODES = frozenset(
    {
        "INPUT_READ_FAILED",
        "INGESTION_FAILED",
        "RECONCILIATION_FAILED",
        "DATABASE_OPERATION_FAILED",
        "EXECUTION_TIMEOUT",
        "UNEXPECTED_FAILURE",
    }
)

COUNT_FIELDS = (
    "total_attempted",
    "accepted_count",
    "duplicate_count",
    "conflict_count",
    "rejected_count",
    "failed_count",
    "internal_retry_count",
)


@dataclass(frozen=True)
class PipelineExecution:
    execution_id: UUID
    batch_id: UUID
    attempt_number: int
    status: str
    started_at: datetime
    heartbeat_at: datetime
    finished_at: Optional[datetime]
    total_attempted: Optional[int]
    accepted_count: Optional[int]
    duplicate_count: Optional[int]
    conflict_count: Optional[int]
    rejected_count: Optional[int]
    failed_count: Optional[int]
    internal_retry_count: Optional[int]
    error_code: Optional[str]


@dataclass(frozen=True)
class ExecutionWriteResult:
    outcome: ExecutionWriteOutcome
    execution: PipelineExecution


def _uuid(value: UUID | str, label: str) -> UUID:
    if isinstance(value, UUID):
        return value

    if not isinstance(value, str):
        raise ValueError(f"{label} must be a UUID")

    try:
        return UUID(value)
    except ValueError:
        raise ValueError(f"{label} must be a UUID") from None


def _counts(report: ReconciliationReport) -> dict[str, int]:
    if not isinstance(report, ReconciliationReport):
        raise ValueError("Expected a reconciliation report")

    counts = {
        key: getattr(report, key)
        for key in COUNT_FIELDS
    }

    if any(
        type(value) is not int or value < 0
        for value in counts.values()
    ):
        raise ValueError(
            "Reconciliation counters must be non-negative integers"
        )

    if not report.is_balanced:
        raise ValueError("Reconciliation accounting is unbalanced")

    return counts


class PostgresPipelineExecutionLedger:
    """Transactional execution history with strict state arbitration."""

    def __init__(self, database_url: str):
        if not isinstance(database_url, str) or not database_url.strip():
            raise ValueError("A PostgreSQL database URL is required")

        self._database_url = database_url

    def _connect(self) -> psycopg.Connection:
        return psycopg.connect(
            self._database_url,
            row_factory=dict_row,
        )

    @staticmethod
    def _get_row(
        conn: psycopg.Connection,
        execution_id: UUID,
    ) -> Optional[dict]:
        return conn.execute(
            """
            SELECT *
            FROM pipeline_executions
            WHERE execution_id = %s
            """,
            (execution_id,),
        ).fetchone()

    @staticmethod
    def _record(row: dict) -> PipelineExecution:
        try:
            record = PipelineExecution(**row)
            state = ExecutionStatus(record.status)

            values = tuple(
                getattr(record, field)
                for field in COUNT_FIELDS
            )

            if any(
                value is not None
                and (type(value) is not int or value < 0)
                for value in values
            ):
                raise ValueError("Invalid counters")

            if (
                any(value is None for value in values)
                and not all(value is None for value in values)
            ):
                raise ValueError("Partial counters")

            if state == ExecutionStatus.SUCCEEDED and (
                record.error_code is not None
                or record.failed_count != 0
            ):
                raise ValueError("Invalid successful completion")

            if (
                state == ExecutionStatus.FAILED
                and record.error_code not in ALLOWED_ERROR_CODES
            ):
                raise ValueError("Invalid failure classification")

            if (
                state == ExecutionStatus.RUNNING
                and record.finished_at is not None
            ):
                raise ValueError("Running execution has finished_at")

            if (
                state != ExecutionStatus.RUNNING
                and record.finished_at is None
            ):
                raise ValueError("Terminal execution missing finished_at")

            return record

        except (TypeError, ValueError):
            raise ExecutionIntegrityError(
                "Persisted pipeline execution failed validation"
            ) from None

    def get_execution(
        self,
        execution_id: UUID | str,
    ) -> Optional[PipelineExecution]:
        execution_id = _uuid(execution_id, "execution_id")

        with self._connect() as conn:
            row = self._get_row(conn, execution_id)
            return None if row is None else self._record(row)

    def start_execution(
        self,
        *,
        execution_id: UUID | str,
        batch_id: UUID | str,
        attempt_number: int,
    ) -> ExecutionWriteResult:
        execution_id = _uuid(execution_id, "execution_id")
        batch_id = _uuid(batch_id, "batch_id")

        if type(attempt_number) is not int or attempt_number <= 0:
            raise ValueError(
                "attempt_number must be a positive integer"
            )

        def operation() -> ExecutionWriteResult:
            with self._connect() as conn, conn.transaction():
                inserted = conn.execute(
                    """
                    INSERT INTO pipeline_executions (
                        execution_id,
                        batch_id,
                        attempt_number
                    )
                    VALUES (%s, %s, %s)
                    ON CONFLICT DO NOTHING
                    RETURNING execution_id
                    """,
                    (execution_id, batch_id, attempt_number),
                ).fetchone()

                if inserted is not None:
                    row = self._get_row(conn, execution_id)

                    if row is None:
                        raise ExecutionIntegrityError(
                            "Inserted execution could not be read"
                        )

                    return ExecutionWriteResult(
                        ExecutionWriteOutcome.INSERTED,
                        self._record(row),
                    )

                row = conn.execute(
                    """
                    SELECT *
                    FROM pipeline_executions
                    WHERE batch_id = %s
                      AND attempt_number = %s
                    """,
                    (batch_id, attempt_number),
                ).fetchone()

                if row is None:
                    if self._get_row(conn, execution_id) is not None:
                        raise ExecutionConflictError(
                            "execution_id belongs to another batch attempt"
                        )

                    raise ExecutionIntegrityError(
                        "Suppressed insertion could not be reconciled"
                    )

                if row["execution_id"] != execution_id:
                    raise ExecutionConflictError(
                        "Batch attempt already has another execution_id"
                    )

                return ExecutionWriteResult(
                    ExecutionWriteOutcome.EXISTING,
                    self._record(row),
                )

        return execute_with_retry(operation).result

    def heartbeat(
        self,
        execution_id: UUID | str,
    ) -> PipelineExecution:
        execution_id = _uuid(execution_id, "execution_id")

        def operation() -> PipelineExecution:
            with self._connect() as conn, conn.transaction():
                row = conn.execute(
                    """
                    UPDATE pipeline_executions
                    SET heartbeat_at = GREATEST(
                        heartbeat_at,
                        clock_timestamp()
                    )
                    WHERE execution_id = %s
                      AND status = 'RUNNING'
                    RETURNING *
                    """,
                    (execution_id,),
                ).fetchone()

                if row is None:
                    if self._get_row(conn, execution_id) is None:
                        raise ExecutionIntegrityError(
                            "Execution does not exist"
                        )

                    raise ExecutionConflictError(
                        "Cannot heartbeat a terminal execution"
                    )

                return self._record(row)

        return execute_with_retry(operation).result

    def finish_execution(
        self,
        *,
        execution_id: UUID | str,
        status: ExecutionStatus,
        report: Optional[ReconciliationReport] = None,
        error_code: Optional[str] = None,
    ) -> ExecutionWriteResult:
        execution_id = _uuid(execution_id, "execution_id")

        if (
            not isinstance(status, ExecutionStatus)
            or status == ExecutionStatus.RUNNING
        ):
            raise ValueError(
                "Only SUCCEEDED and FAILED are terminal states"
            )

        if status == ExecutionStatus.SUCCEEDED:
            if report is None or error_code is not None:
                raise ValueError(
                    "Success requires a report and no error code"
                )

        elif error_code not in ALLOWED_ERROR_CODES:
            raise ValueError(
                "Failure requires an allowlisted error code"
            )

        counters = None if report is None else _counts(report)

        if (
            status == ExecutionStatus.SUCCEEDED
            and counters["failed_count"] != 0
        ):
            raise ValueError(
                "A run with failed events cannot be SUCCEEDED"
            )

        update_counts = counters or dict.fromkeys(COUNT_FIELDS)

        def operation() -> ExecutionWriteResult:
            with self._connect() as conn, conn.transaction():
                row = conn.execute(
                    """
                    SELECT *
                    FROM pipeline_executions
                    WHERE execution_id = %s
                    FOR UPDATE
                    """,
                    (execution_id,),
                ).fetchone()

                if row is None:
                    raise ExecutionIntegrityError(
                        "Execution does not exist"
                    )

                previous = self._record(row)

                if (
                    report is not None
                    and report.batch_id != str(previous.batch_id)
                ):
                    raise ValueError(
                        "Report batch_id does not match execution"
                    )

                if previous.status != ExecutionStatus.RUNNING:
                    same_counts = all(
                        getattr(previous, key) == value
                        for key, value in update_counts.items()
                    )

                    if (
                        previous.status == status
                        and previous.error_code == error_code
                        and same_counts
                    ):
                        return ExecutionWriteResult(
                            ExecutionWriteOutcome.EXISTING,
                            previous,
                        )

                    raise ExecutionConflictError(
                        "Execution already ended with different content"
                    )

                updated = conn.execute(
                    """
                    UPDATE pipeline_executions
                    SET status = %(status)s,
                        finished_at = GREATEST(
                            started_at,
                            heartbeat_at,
                            statement_timestamp()
                        ),
                        heartbeat_at = GREATEST(
                            started_at,
                            heartbeat_at,
                            statement_timestamp()
                        ),
                        total_attempted = %(total_attempted)s,
                        accepted_count = %(accepted_count)s,
                        duplicate_count = %(duplicate_count)s,
                        conflict_count = %(conflict_count)s,
                        rejected_count = %(rejected_count)s,
                        failed_count = %(failed_count)s,
                        internal_retry_count = %(internal_retry_count)s,
                        error_code = %(error_code)s
                    WHERE execution_id = %(execution_id)s
                      AND status = 'RUNNING'
                    RETURNING *
                    """,
                    {
                        "status": status.value,
                        "execution_id": execution_id,
                        "error_code": error_code,
                        **update_counts,
                    },
                ).fetchone()

                if updated is None:
                    raise ExecutionIntegrityError(
                        "Atomic terminal transition was not applied"
                    )

                return ExecutionWriteResult(
                    ExecutionWriteOutcome.TRANSITIONED,
                    self._record(updated),
                )

        return execute_with_retry(operation).result
