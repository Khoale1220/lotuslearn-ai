"""Read-only execution SLI/SLO and error-budget evaluation."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from enum import Enum
from typing import Final

import psycopg
from psycopg.rows import dict_row

MAX_SLO_WINDOW: Final = timedelta(days=366)


class ExecutionSloStatus(str, Enum):
    NO_DATA = "NO_DATA"
    WITHIN_BUDGET = "WITHIN_BUDGET"
    BUDGET_EXHAUSTED = "BUDGET_EXHAUSTED"
    BREACHED = "BREACHED"


@dataclass(frozen=True)
class ExecutionSloReport:
    observed_at: datetime
    window_start: datetime
    window: timedelta
    target: Decimal
    error_budget_fraction: Decimal
    total_terminal: int
    good_count: int
    bad_count: int
    success_ratio: Decimal | None
    bad_ratio: Decimal | None
    burn_rate: Decimal | None
    budget_remaining_ratio: Decimal | None
    allowed_bad_events: Decimal | None
    remaining_bad_events: Decimal | None
    status: ExecutionSloStatus


def _target(value: Decimal | str | float | int) -> Decimal:
    if isinstance(value, bool):
        raise TypeError("target must be a decimal ratio")

    try:
        result = value if isinstance(value, Decimal) else Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise ValueError("target must be a finite decimal ratio") from None

    if not result.is_finite():
        raise ValueError("target must be finite")

    if result <= Decimal("0") or result >= Decimal("1"):
        raise ValueError("target must be greater than 0 and less than 1")

    return result


def _window(value: timedelta) -> timedelta:
    if not isinstance(value, timedelta):
        raise TypeError("window must be timedelta")

    if value <= timedelta(0):
        raise ValueError("window must be positive")

    if value > MAX_SLO_WINDOW:
        raise ValueError("window cannot exceed 366 days")

    return value


def _observed_at(value: datetime) -> datetime:
    if not isinstance(value, datetime):
        raise TypeError("observed_at must be datetime")

    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("observed_at must be timezone-aware")

    return value.astimezone(timezone.utc)


def _count(value: int, name: str) -> int:
    if type(value) is not int:
        raise TypeError(f"{name} must be an integer")

    if value < 0:
        raise ValueError(f"{name} must be non-negative")

    return value


def build_execution_slo_report(
    *,
    observed_at: datetime,
    window: timedelta,
    target: Decimal | str | float | int,
    total_terminal: int,
    good_count: int,
    bad_count: int,
) -> ExecutionSloReport:
    observed_at = _observed_at(observed_at)
    window = _window(window)
    target = _target(target)

    total_terminal = _count(total_terminal, "total_terminal")
    good_count = _count(good_count, "good_count")
    bad_count = _count(bad_count, "bad_count")

    if good_count + bad_count != total_terminal:
        raise ValueError("good_count + bad_count must equal total_terminal")

    budget = Decimal("1") - target
    window_start = observed_at - window

    if total_terminal == 0:
        return ExecutionSloReport(
            observed_at=observed_at,
            window_start=window_start,
            window=window,
            target=target,
            error_budget_fraction=budget,
            total_terminal=0,
            good_count=0,
            bad_count=0,
            success_ratio=None,
            bad_ratio=None,
            burn_rate=None,
            budget_remaining_ratio=None,
            allowed_bad_events=None,
            remaining_bad_events=None,
            status=ExecutionSloStatus.NO_DATA,
        )

    total = Decimal(total_terminal)
    good = Decimal(good_count)
    bad = Decimal(bad_count)

    success_ratio = good / total
    bad_ratio = bad / total
    burn_rate = bad_ratio / budget

    allowed_bad_events = total * budget
    remaining_bad_events = max(
        Decimal("0"),
        allowed_bad_events - bad,
    )

    budget_remaining_ratio = max(
        Decimal("0"),
        Decimal("1") - burn_rate,
    )

    if burn_rate < Decimal("1"):
        status = ExecutionSloStatus.WITHIN_BUDGET
    elif burn_rate == Decimal("1"):
        status = ExecutionSloStatus.BUDGET_EXHAUSTED
    else:
        status = ExecutionSloStatus.BREACHED

    return ExecutionSloReport(
        observed_at=observed_at,
        window_start=window_start,
        window=window,
        target=target,
        error_budget_fraction=budget,
        total_terminal=total_terminal,
        good_count=good_count,
        bad_count=bad_count,
        success_ratio=success_ratio,
        bad_ratio=bad_ratio,
        burn_rate=burn_rate,
        budget_remaining_ratio=budget_remaining_ratio,
        allowed_bad_events=allowed_bad_events,
        remaining_bad_events=remaining_bad_events,
        status=status,
    )


def evaluate_execution_slo(
    database_url: str,
    *,
    window: timedelta,
    target: Decimal | str | float | int,
    observed_at: datetime | None = None,
) -> ExecutionSloReport:
    if not isinstance(database_url, str):
        raise TypeError("database_url must be a string")

    database_url = database_url.strip()

    if not database_url.startswith(("postgresql://", "postgres://")):
        raise ValueError("Execution SLO evaluation requires PostgreSQL")

    window = _window(window)
    target = _target(target)

    anchor = None if observed_at is None else _observed_at(observed_at)

    with psycopg.connect(
        database_url,
        row_factory=dict_row,
    ) as conn:
        conn.execute("SET TRANSACTION READ ONLY")

        row = conn.execute(
            """
            WITH anchor AS (
                SELECT COALESCE(
                    %s::timestamptz,
                    statement_timestamp()
                ) AS observed_at
            )
            SELECT
                a.observed_at,
                COUNT(p.execution_id)::bigint AS total_terminal,
                COUNT(*) FILTER (
                    WHERE p.status = 'SUCCEEDED'
                )::bigint AS good_count,
                COUNT(*) FILTER (
                    WHERE p.status = 'FAILED'
                )::bigint AS bad_count
            FROM anchor AS a
            LEFT JOIN pipeline_executions AS p
              ON p.status IN ('SUCCEEDED', 'FAILED')
             AND p.finished_at IS NOT NULL
             AND p.finished_at >
                 a.observed_at - (%s * INTERVAL '1 second')
             AND p.finished_at <= a.observed_at
            GROUP BY a.observed_at
            """,
            (
                anchor,
                window.total_seconds(),
            ),
        ).fetchone()

    if row is None:
        raise RuntimeError("Execution SLO query returned no summary row")

    return build_execution_slo_report(
        observed_at=row["observed_at"],
        window=window,
        target=target,
        total_terminal=row["total_terminal"],
        good_count=row["good_count"],
        bad_count=row["bad_count"],
    )
