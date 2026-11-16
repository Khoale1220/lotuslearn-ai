"""Operational recovery for abandoned LotusLearn pipeline executions.

Recovery is intentionally conservative:

* only RUNNING executions with stale heartbeats are candidates;
* candidates are claimed using PostgreSQL row locks;
* SKIP LOCKED permits multiple operators/workers without double recovery;
* state transition and audit evidence are committed atomically;
* one execution can have at most one recovery audit record.

This module is an operational control plane. It does not retry business data
processing itself.
"""

from __future__ import annotations

import argparse
import json
import os
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta
from typing import Any
from urllib.parse import urlsplit
from uuid import UUID

import psycopg
from psycopg.rows import dict_row


@dataclass(frozen=True)
class StaleExecution:
    execution_id: UUID
    batch_id: UUID
    attempt_number: int
    started_at: datetime
    heartbeat_at: datetime
    observed_at: datetime
    heartbeat_age: timedelta


@dataclass(frozen=True)
class RecoveryRecord:
    recovery_id: int
    execution_id: UUID
    batch_id: UUID
    attempt_number: int
    started_at: datetime
    heartbeat_at: datetime
    finished_at: datetime
    actor: str
    reason: str


def _uuid(value: Any) -> UUID:
    if isinstance(value, UUID):
        return value
    return UUID(str(value))


def _validate_database_url(database_url: str) -> None:
    if not isinstance(database_url, str) or not database_url.strip():
        raise ValueError("database_url is required")

    parsed = urlsplit(database_url)

    if parsed.scheme not in {"postgresql", "postgres"}:
        raise ValueError("Operational recovery requires a PostgreSQL URL")

    if not parsed.hostname:
        raise ValueError("PostgreSQL URL must contain a hostname")


def _validate_policy(
    *,
    stale_after: timedelta,
    limit: int,
) -> None:
    if not isinstance(stale_after, timedelta):
        raise TypeError("stale_after must be datetime.timedelta")

    if stale_after <= timedelta(0):
        raise ValueError("stale_after must be positive")

    if isinstance(limit, bool) or not isinstance(limit, int):
        raise TypeError("limit must be an integer")

    if limit <= 0:
        raise ValueError("limit must be positive")

    if limit > 1000:
        raise ValueError("limit cannot exceed 1000")


def _validate_recovery_metadata(
    *,
    actor: str,
    reason: str,
) -> tuple[str, str]:
    normalized_actor = actor.strip() if isinstance(actor, str) else ""
    normalized_reason = reason.strip() if isinstance(reason, str) else ""

    if not normalized_actor:
        raise ValueError("actor is required")

    if not normalized_reason:
        raise ValueError("reason is required")

    if len(normalized_actor) > 200:
        raise ValueError("actor is too long")

    if len(normalized_reason) > 1000:
        raise ValueError("reason is too long")

    return normalized_actor, normalized_reason


def list_stale_executions(
    database_url: str,
    *,
    stale_after: timedelta,
    limit: int = 100,
) -> list[StaleExecution]:
    """Return bounded stale RUNNING executions without mutating state."""

    _validate_database_url(database_url)
    _validate_policy(stale_after=stale_after, limit=limit)

    sql = """
        SELECT
            execution_id,
            batch_id,
            attempt_number,
            started_at,
            heartbeat_at,
            statement_timestamp() AS observed_at,
            statement_timestamp() - heartbeat_at AS heartbeat_age
        FROM pipeline_executions
        WHERE status = 'RUNNING'
          AND heartbeat_at <= statement_timestamp() - %(stale_after)s
        ORDER BY heartbeat_at ASC, execution_id ASC
        LIMIT %(limit)s
    """

    with psycopg.connect(database_url, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(
                sql,
                {
                    "stale_after": stale_after,
                    "limit": limit,
                },
            )
            rows = cur.fetchall()

    return [
        StaleExecution(
            execution_id=_uuid(row["execution_id"]),
            batch_id=_uuid(row["batch_id"]),
            attempt_number=row["attempt_number"],
            started_at=row["started_at"],
            heartbeat_at=row["heartbeat_at"],
            observed_at=row["observed_at"],
            heartbeat_age=row["heartbeat_age"],
        )
        for row in rows
    ]


def recover_stale_executions(
    database_url: str,
    *,
    stale_after: timedelta,
    actor: str,
    reason: str,
    limit: int = 100,
) -> list[RecoveryRecord]:
    """Atomically fail and audit bounded stale RUNNING executions.

    PostgreSQL row-level locking prevents multiple concurrent recovery workers
    from claiming the same execution. State transition and evidence insertion
    occur in one transaction.
    """

    _validate_database_url(database_url)
    _validate_policy(stale_after=stale_after, limit=limit)

    actor, reason = _validate_recovery_metadata(
        actor=actor,
        reason=reason,
    )

    sql = """
        WITH candidates AS (
            SELECT
                execution_id,
                batch_id,
                attempt_number,
                started_at,
                heartbeat_at
            FROM pipeline_executions
            WHERE status = 'RUNNING'
              AND heartbeat_at <= statement_timestamp() - %(stale_after)s
            ORDER BY heartbeat_at ASC, execution_id ASC
            FOR UPDATE SKIP LOCKED
            LIMIT %(limit)s
        ),
        recovered AS (
            UPDATE pipeline_executions AS execution
            SET
                status = 'FAILED',
                error_code = 'STALE_EXECUTION',
                finished_at = GREATEST(
                    execution.started_at,
                    execution.heartbeat_at,
                    statement_timestamp()
                )
            FROM candidates
            WHERE execution.execution_id = candidates.execution_id
              AND execution.status = 'RUNNING'
            RETURNING
                execution.execution_id,
                execution.batch_id,
                execution.attempt_number,
                execution.started_at,
                execution.heartbeat_at,
                execution.finished_at
        ),
        evidence AS (
            INSERT INTO pipeline_execution_recoveries (
                execution_id,
                batch_id,
                attempt_number,
                observed_started_at,
                observed_heartbeat_at,
                recovered_at,
                previous_status,
                recovery_status,
                actor,
                reason
            )
            SELECT
                recovered.execution_id,
                recovered.batch_id,
                recovered.attempt_number,
                recovered.started_at,
                recovered.heartbeat_at,
                recovered.finished_at,
                'RUNNING',
                'FAILED',
                %(actor)s,
                %(reason)s
            FROM recovered
            RETURNING
                recovery_id,
                execution_id,
                batch_id,
                attempt_number,
                observed_started_at,
                observed_heartbeat_at,
                recovered_at,
                actor,
                reason
        )
        SELECT
            recovery_id,
            execution_id,
            batch_id,
            attempt_number,
            observed_started_at,
            observed_heartbeat_at,
            recovered_at,
            actor,
            reason
        FROM evidence
        ORDER BY recovered_at ASC, recovery_id ASC
    """

    with psycopg.connect(database_url, row_factory=dict_row) as conn:
        with conn.transaction():
            with conn.cursor() as cur:
                cur.execute(
                    sql,
                    {
                        "stale_after": stale_after,
                        "limit": limit,
                        "actor": actor,
                        "reason": reason,
                    },
                )
                rows = cur.fetchall()

    return [
        RecoveryRecord(
            recovery_id=row["recovery_id"],
            execution_id=_uuid(row["execution_id"]),
            batch_id=_uuid(row["batch_id"]),
            attempt_number=row["attempt_number"],
            started_at=row["observed_started_at"],
            heartbeat_at=row["observed_heartbeat_at"],
            finished_at=row["recovered_at"],
            actor=row["actor"],
            reason=row["reason"],
        )
        for row in rows
    ]


def _json_default(value: object) -> object:
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, timedelta):
        return value.total_seconds()
    raise TypeError(f"Unsupported JSON value: {type(value).__name__}")


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Recover abandoned LotusLearn pipeline executions",
    )
    parser.add_argument(
        "--database-url",
        default=os.environ.get("LOTUSLEARN_DATABASE_URL"),
    )
    parser.add_argument(
        "--stale-seconds",
        type=int,
        required=True,
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=100,
    )
    parser.add_argument(
        "--actor",
        default="operator",
    )
    parser.add_argument(
        "--reason",
        default="stale heartbeat operational recovery",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
    )
    parser.add_argument(
        "--json",
        action="store_true",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)

    if not args.database_url:
        raise SystemExit("LOTUSLEARN_DATABASE_URL or --database-url is required")

    stale_after = timedelta(seconds=args.stale_seconds)

    if args.dry_run:
        result: list[StaleExecution] | list[RecoveryRecord]
        result = list_stale_executions(
            args.database_url,
            stale_after=stale_after,
            limit=args.limit,
        )
        action = "candidates"
    else:
        result = recover_stale_executions(
            args.database_url,
            stale_after=stale_after,
            actor=args.actor,
            reason=args.reason,
            limit=args.limit,
        )
        action = "recovered"

    if args.json:
        print(
            json.dumps(
                [asdict(item) for item in result],
                default=_json_default,
                sort_keys=True,
            )
        )
    else:
        print(f"{action}: {len(result)}")
        for item in result:
            print(item)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
