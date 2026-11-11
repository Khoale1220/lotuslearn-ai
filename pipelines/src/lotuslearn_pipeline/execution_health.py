"""Read-only execution heartbeat health checks.

An overdue heartbeat is a signal for investigation, not proof that a
worker has stopped. This module never changes execution state.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from uuid import UUID

import psycopg
from psycopg.rows import dict_row

from lotuslearn_pipeline.execution_ledger import ExecutionIntegrityError


class ExecutionHealthState(str, Enum):
    RECENT = "RECENT"
    SUSPECTED_STALE = "SUSPECTED_STALE"
    FUTURE_HEARTBEAT = "FUTURE_HEARTBEAT"


@dataclass(frozen=True)
class RunningExecutionHealth:
    execution_id: UUID
    batch_id: UUID
    attempt_number: int
    started_at: datetime
    heartbeat_at: datetime
    observed_at: datetime
    heartbeat_age: timedelta
    health: ExecutionHealthState


def list_running_execution_health(
    database_url: str,
    *,
    stale_after: timedelta,
    limit: int = 100,
) -> list[RunningExecutionHealth]:
    """Inspect the oldest running attempts without altering their state.

    The caller supplies the investigative threshold; it is not a lease
    expiry. Results may be truncated at ``limit``.
    """
    if not isinstance(database_url, str) or not database_url.startswith(
        ("postgresql://", "postgres://")
    ):
        raise ValueError("Execution health requires a PostgreSQL URL")
    if not isinstance(stale_after, timedelta) or stale_after <= timedelta(0):
        raise ValueError("stale_after must be a positive timedelta")
    if type(limit) is not int or not 1 <= limit <= 1000:
        raise ValueError("limit must be an integer between 1 and 1000")

    with psycopg.connect(database_url, row_factory=dict_row) as conn:
        conn.execute("SET TRANSACTION READ ONLY")
        rows = conn.execute(
            """
            SELECT execution_id, batch_id, attempt_number,
                   started_at, heartbeat_at,
                   statement_timestamp() AS observed_at
            FROM pipeline_executions
            WHERE status = 'RUNNING'
            ORDER BY heartbeat_at ASC, execution_id ASC
            LIMIT %s
            """,
            (limit,),
        ).fetchall()

    samples = []
    for row in rows:
        if row["heartbeat_at"] < row["started_at"]:
            raise ExecutionIntegrityError("Heartbeat predates execution start")

        age = row["observed_at"] - row["heartbeat_at"]

        if age < timedelta(0):
            health = ExecutionHealthState.FUTURE_HEARTBEAT
        elif age > stale_after:
            health = ExecutionHealthState.SUSPECTED_STALE
        else:
            health = ExecutionHealthState.RECENT

        samples.append(
            RunningExecutionHealth(
                execution_id=row["execution_id"],
                batch_id=row["batch_id"],
                attempt_number=row["attempt_number"],
                started_at=row["started_at"],
                heartbeat_at=row["heartbeat_at"],
                observed_at=row["observed_at"],
                heartbeat_age=age,
                health=health,
            )
        )

    return samples
