"""Bridge analytical ingestion with a durable PostgreSQL execution ledger.

Tracks one operational attempt, not an educational analysis run.
No event payloads or exception messages are written to the ledger.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable
from uuid import UUID

from lotuslearn_pipeline.execution_ledger import (
    ExecutionConflictError,
    ExecutionIntegrityError,
    ExecutionStatus,
    ExecutionWriteOutcome,
    ExecutionWriteResult,
    PostgresPipelineExecutionLedger,
)
from lotuslearn_pipeline.models import IngestionResult
from lotuslearn_pipeline.reconciliation import ReconciliationReport, reconcile_batch


@dataclass(frozen=True)
class TrackedBatchResult:
    results: list[IngestionResult]
    report: ReconciliationReport
    completion: ExecutionWriteResult


def run_tracked_batch(
    *,
    db: Any,
    database_url: str,
    input_path: Path,
    load_events: Callable[[Path], list[dict[str, Any]]],
    batch_id: UUID,
    execution_id: UUID,
    attempt_number: int,
    fail_on_rejection: bool = False,
) -> TrackedBatchResult:
    """Track one invocation; never resume an existing ledger attempt."""
    if not isinstance(database_url, str) or not database_url.startswith(
        ("postgresql://", "postgres://")
    ):
        raise ValueError("Execution tracking requires a PostgreSQL URL")

    if not isinstance(batch_id, UUID) or not isinstance(execution_id, UUID):
        raise ValueError("Execution tracking identities must be UUID objects")

    if type(attempt_number) is not int or attempt_number <= 0:
        raise ValueError("attempt_number must be a positive integer")

    ledger = PostgresPipelineExecutionLedger(database_url)

    start = ledger.start_execution(
        execution_id=execution_id,
        batch_id=batch_id,
        attempt_number=attempt_number,
    )

    if start.outcome != ExecutionWriteOutcome.INSERTED:
        raise ExecutionConflictError(
            "Execution attempt already exists; ingestion was not started"
        )

    error_code = "INPUT_READ_FAILED"

    try:
        events = load_events(input_path)

        if not isinstance(events, list):
            raise ValueError("Input loader did not return a list")

        error_code = "INGESTION_FAILED"

        ledger.heartbeat(execution_id)
        results = db.load_events(events)

        error_code = "RECONCILIATION_FAILED"

        if len(results) != len(events):
            raise ExecutionIntegrityError("Ingestion result count mismatch")

        internal_retries = 0

        for result in results:
            attempts = result.retry_attempts

            if type(attempts) is not int or attempts < 1:
                raise ExecutionIntegrityError("Invalid event retry counter")

            internal_retries += attempts - 1

        report = reconcile_batch(
            results,
            total_attempted=len(events),
            batch_id=str(batch_id),
            internal_retry_count=internal_retries,
        )

        if not report.is_balanced:
            raise ExecutionIntegrityError(
                "Unbalanced ingestion reconciliation"
            )

        ledger.heartbeat(execution_id)

    except Exception:
        # Persist only an allowlisted code, never exception text.
        ledger.finish_execution(
            execution_id=execution_id,
            status=ExecutionStatus.FAILED,
            error_code=error_code,
        )
        raise

    unsuccessful = report.failed_count > 0 or (
        fail_on_rejection
        and (report.conflict_count > 0 or report.rejected_count > 0)
    )

    status = (
        ExecutionStatus.FAILED
        if unsuccessful
        else ExecutionStatus.SUCCEEDED
    )

    completion = ledger.finish_execution(
        execution_id=execution_id,
        status=status,
        report=report,
        error_code="INGESTION_FAILED" if unsuccessful else None,
    )

    return TrackedBatchResult(
        results=results,
        report=report,
        completion=completion,
    )
