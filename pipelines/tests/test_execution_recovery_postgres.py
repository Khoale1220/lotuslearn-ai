from __future__ import annotations

import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit
from uuid import uuid4

import psycopg
import pytest

from lotuslearn_pipeline.execution_recovery import (
    list_stale_executions,
    recover_stale_executions,
)


def _database_url() -> str:
    url = os.environ.get("LOTUSLEARN_TEST_DATABASE_URL")

    if not url:
        pytest.skip("Dedicated PostgreSQL test URL is not configured")

    parsed = urlsplit(url)

    if (
        parsed.scheme not in {"postgresql", "postgres"}
        or parsed.hostname not in {"127.0.0.1", "localhost"}
        or parsed.path != "/lotuslearn_test"
    ):
        pytest.fail("Unsafe PostgreSQL integration test target")

    return url


def _delete_execution(url: str, execution_id) -> None:
    with psycopg.connect(url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM pipeline_execution_recoveries
                WHERE execution_id = %s
                """,
                (execution_id,),
            )
            cur.execute(
                """
                DELETE FROM pipeline_executions
                WHERE execution_id = %s
                """,
                (execution_id,),
            )


def _insert_running(
    url: str,
    *,
    execution_id,
    batch_id,
    heartbeat_age: timedelta,
) -> None:
    now = datetime.now(timezone.utc)
    heartbeat_at = now - heartbeat_age
    started_at = heartbeat_at - timedelta(minutes=1)

    with psycopg.connect(url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO pipeline_executions (
                    execution_id,
                    batch_id,
                    attempt_number,
                    status,
                    started_at,
                    heartbeat_at
                )
                VALUES (%s, %s, 1, 'RUNNING', %s, %s)
                """,
                (
                    execution_id,
                    batch_id,
                    started_at,
                    heartbeat_at,
                ),
            )


def test_recovery_ignores_recent_execution():
    url = _database_url()
    execution_id = uuid4()
    batch_id = uuid4()

    try:
        _insert_running(
            url,
            execution_id=execution_id,
            batch_id=batch_id,
            heartbeat_age=timedelta(seconds=5),
        )

        candidates = list_stale_executions(
            url,
            stale_after=timedelta(minutes=5),
        )

        assert execution_id not in {item.execution_id for item in candidates}

        recovered = recover_stale_executions(
            url,
            stale_after=timedelta(minutes=5),
            actor="pytest",
            reason="recent execution must remain untouched",
        )

        assert execution_id not in {item.execution_id for item in recovered}

        with psycopg.connect(url) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT status, finished_at
                    FROM pipeline_executions
                    WHERE execution_id = %s
                    """,
                    (execution_id,),
                )
                status, finished_at = cur.fetchone()

        assert status == "RUNNING"
        assert finished_at is None

    finally:
        _delete_execution(url, execution_id)


def test_recovery_fails_stale_execution_and_writes_evidence():
    url = _database_url()
    execution_id = uuid4()
    batch_id = uuid4()

    try:
        _insert_running(
            url,
            execution_id=execution_id,
            batch_id=batch_id,
            heartbeat_age=timedelta(minutes=30),
        )

        recovered = recover_stale_executions(
            url,
            stale_after=timedelta(minutes=5),
            actor="pytest",
            reason="integration stale recovery",
        )

        record = next(item for item in recovered if item.execution_id == execution_id)

        assert record.batch_id == batch_id
        assert record.actor == "pytest"
        assert record.reason == "integration stale recovery"
        assert record.finished_at >= record.heartbeat_at

        with psycopg.connect(url) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT status, finished_at
                    FROM pipeline_executions
                    WHERE execution_id = %s
                    """,
                    (execution_id,),
                )
                status, finished_at = cur.fetchone()

                cur.execute(
                    """
                    SELECT
                        previous_status,
                        recovery_status,
                        actor,
                        reason
                    FROM pipeline_execution_recoveries
                    WHERE execution_id = %s
                    """,
                    (execution_id,),
                )
                evidence = cur.fetchone()

        assert status == "FAILED"
        assert finished_at is not None
        assert evidence == (
            "RUNNING",
            "FAILED",
            "pytest",
            "integration stale recovery",
        )

    finally:
        _delete_execution(url, execution_id)


def test_concurrent_recovery_claims_execution_exactly_once():
    url = _database_url()
    execution_id = uuid4()
    batch_id = uuid4()

    try:
        _insert_running(
            url,
            execution_id=execution_id,
            batch_id=batch_id,
            heartbeat_age=timedelta(hours=1),
        )

        def recover():
            return recover_stale_executions(
                url,
                stale_after=timedelta(minutes=5),
                actor="pytest-concurrency",
                reason="exactly once recovery race",
                limit=1,
            )

        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(lambda _: recover(), range(2)))

        recovered_ids = [item.execution_id for result in results for item in result]

        assert recovered_ids.count(execution_id) == 1

        with psycopg.connect(url) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT status
                    FROM pipeline_executions
                    WHERE execution_id = %s
                    """,
                    (execution_id,),
                )
                status = cur.fetchone()[0]

                cur.execute(
                    """
                    SELECT count(*)
                    FROM pipeline_execution_recoveries
                    WHERE execution_id = %s
                    """,
                    (execution_id,),
                )
                evidence_count = cur.fetchone()[0]

        assert status == "FAILED"
        assert evidence_count == 1

    finally:
        _delete_execution(url, execution_id)


@pytest.mark.parametrize(
    ("stale_after", "limit"),
    [
        (timedelta(0), 1),
        (timedelta(seconds=-1), 1),
        (timedelta(seconds=1), 0),
        (timedelta(seconds=1), 1001),
    ],
)
def test_recovery_policy_rejects_unsafe_bounds(
    stale_after,
    limit,
):
    with pytest.raises((TypeError, ValueError)):
        list_stale_executions(
            "postgresql://localhost/lotuslearn_test",
            stale_after=stale_after,
            limit=limit,
        )
