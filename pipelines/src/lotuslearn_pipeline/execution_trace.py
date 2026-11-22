"""Read-only composition of operational execution evidence."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

import psycopg

from lotuslearn_pipeline.data_quality_evaluation_history import (
    PersistedQualityEvaluation,
    list_quality_evaluations_for_execution,
)
from lotuslearn_pipeline.execution_ledger import (
    PipelineExecution,
    PostgresPipelineExecutionLedger,
)
from lotuslearn_pipeline.execution_recovery import (
    RecoveryRecord,
    get_recovery_record,
)


@dataclass(frozen=True)
class OperationalExecutionTrace:
    """Operator-facing durable evidence linked to one execution."""

    execution: PipelineExecution
    recovery: RecoveryRecord | None
    quality_evaluations: tuple[PersistedQualityEvaluation, ...]


def get_execution_trace(
    database_url: str,
    *,
    execution_id: UUID | str,
    quality_limit: int = 100,
) -> OperationalExecutionTrace | None:
    """Compose bounded execution, recovery, and quality evidence."""
    ledger = PostgresPipelineExecutionLedger(database_url)
    execution = ledger.get_execution(execution_id)

    if execution is None:
        return None

    recovery = get_recovery_record(
        database_url,
        execution_id=execution.execution_id,
    )

    with psycopg.connect(database_url) as conn:
        quality_evaluations = list_quality_evaluations_for_execution(
            conn,
            execution_id=execution.execution_id,
            limit=quality_limit,
        )

    return OperationalExecutionTrace(
        execution=execution,
        recovery=recovery,
        quality_evaluations=quality_evaluations,
    )
