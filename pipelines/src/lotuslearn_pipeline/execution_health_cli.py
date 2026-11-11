"""Read-only, alert-ready execution health monitoring CLI."""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import timedelta
from typing import Sequence

from lotuslearn_pipeline.execution_health import (
    ExecutionHealthState,
    RunningExecutionHealth,
    list_running_execution_health,
)


def _positive_int(value: str) -> int:
    try:
        number = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(
            "Expected a positive integer"
        ) from exc

    if number <= 0:
        raise argparse.ArgumentTypeError(
            "Expected a positive integer"
        )

    return number


def _bounded_limit(value: str) -> int:
    number = _positive_int(value)

    if number > 1000:
        raise argparse.ArgumentTypeError(
            "Limit cannot exceed 1000"
        )

    return number


def _serialize_execution(
    row: RunningExecutionHealth,
) -> dict[str, object]:
    return {
        "execution_id": str(row.execution_id),
        "batch_id": str(row.batch_id),
        "attempt_number": row.attempt_number,
        "started_at": row.started_at.isoformat(),
        "heartbeat_at": row.heartbeat_at.isoformat(),
        "observed_at": row.observed_at.isoformat(),
        "heartbeat_age_seconds": row.heartbeat_age.total_seconds(),
        "health": row.health.value,
    }


def _build_report(
    rows: list[RunningExecutionHealth],
    *,
    limit: int,
    stale_after_seconds: int,
) -> tuple[dict[str, object], int]:
    if len(rows) > limit:
        raise ValueError("Health query exceeded its result limit")

    counts = {
        state.value: 0
        for state in ExecutionHealthState
    }

    for row in rows:
        if not isinstance(row.health, ExecutionHealthState):
            raise ValueError("Unknown execution health state")

        counts[row.health.value] += 1

    limit_reached = len(rows) == limit

    has_alert = (
        counts[ExecutionHealthState.SUSPECTED_STALE.value] > 0
        or counts[ExecutionHealthState.FUTURE_HEARTBEAT.value] > 0
    )

    if limit_reached:
        status = "INCOMPLETE_SAMPLE"
        exit_code = 2
    elif has_alert:
        status = "ALERT"
        exit_code = 1
    else:
        status = "OK"
        exit_code = 0

    report = {
        "status": status,
        "stale_after_seconds": stale_after_seconds,
        "running_sampled": len(rows),
        "sample_limit": limit,
        "sample_limit_reached": limit_reached,
        "counts": counts,
        "executions": [
            _serialize_execution(row)
            for row in rows
        ],
    }

    return report, exit_code


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Inspect PostgreSQL execution heartbeat health "
            "without modifying execution state"
        )
    )

    parser.add_argument(
        "--db",
        help="PostgreSQL URL; defaults to LOTUSLEARN_DATABASE_URL",
    )

    parser.add_argument(
        "--stale-after-seconds",
        type=_positive_int,
        required=True,
    )

    parser.add_argument(
        "--limit",
        type=_bounded_limit,
        default=100,
    )

    parser.add_argument(
        "--format",
        choices=("json", "text"),
        default="json",
    )

    args = parser.parse_args(argv)

    database_url = (
        args.db
        if args.db is not None
        else os.environ.get("LOTUSLEARN_DATABASE_URL", "")
    ).strip()

    if not database_url.startswith(
        ("postgresql://", "postgres://")
    ):
        parser.error("A PostgreSQL database URL is required")

    try:
        rows = list_running_execution_health(
            database_url,
            stale_after=timedelta(
                seconds=args.stale_after_seconds
            ),
            limit=args.limit,
        )

        report, exit_code = _build_report(
            rows,
            limit=args.limit,
            stale_after_seconds=args.stale_after_seconds,
        )

    except Exception:
        # Never print exception details that may contain credentials.
        print(
            "ERROR: Execution health check failed",
            file=sys.stderr,
        )
        return 2

    if args.format == "json":
        print(json.dumps(report, sort_keys=True))
    else:
        print(f"Status: {report['status']}")
        print(f"Running sampled: {report['running_sampled']}")
        print(f"Sample limit reached: {report['sample_limit_reached']}")

        counts = report["counts"]

        for state in ExecutionHealthState:
            print(f"{state.value}: {counts[state.value]}")

        for row in report["executions"]:
            print(
                f"{row['execution_id']} "
                f"{row['health']} "
                f"age={row['heartbeat_age_seconds']}s"
            )

    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
