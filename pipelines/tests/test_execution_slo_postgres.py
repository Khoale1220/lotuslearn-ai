"""PostgreSQL 18 integration tests for execution SLO evaluation."""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from urllib.parse import urlsplit
from uuid import UUID, uuid4

import psycopg
import pytest
from psycopg.rows import dict_row

from lotuslearn_pipeline.execution_slo import (
    ExecutionSloStatus,
    evaluate_execution_slo,
)
from lotuslearn_pipeline.postgres import (
    apply_postgres_migrations,
    get_migration_status,
)


@pytest.fixture(scope="module")
def pg_url():
    url = os.environ.get("LOTUSLEARN_TEST_DATABASE_URL")

    if not url:
        pytest.skip("Dedicated PostgreSQL test URL is not configured")

    parsed = urlsplit(url)

    if (
        parsed.scheme not in ("postgresql", "postgres")
        or parsed.hostname not in ("127.0.0.1", "localhost")
        or parsed.port not in (5432, 55432)
        or parsed.path != "/lotuslearn_test"
    ):
        pytest.fail("Unsafe PostgreSQL integration test target")

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

        assert identity is not None
        assert identity["database_name"] == "lotuslearn_test"
        assert 180000 <= int(identity["version_num"]) < 190000

        apply_postgres_migrations(conn)

        migrations = get_migration_status(conn)

        assert migrations
        assert all(row["applied"] for row in migrations)
        assert all(row["match"] is True for row in migrations)

    return url


def _snapshot(url: str, ids: tuple[UUID, ...]):
    with psycopg.connect(
        url,
        row_factory=dict_row,
    ) as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM pipeline_executions
            WHERE execution_id = ANY(%s::uuid[])
            ORDER BY execution_id
            """,
            (list(ids),),
        ).fetchall()

    return tuple(dict(row) for row in rows)


@pytest.fixture
def terminal_records(pg_url):
    anchor = datetime.now(timezone.utc)
    records: list[tuple[UUID, UUID]] = []

    cases = (
        ("SUCCEEDED", 60),
        ("FAILED", 120),
        ("SUCCEEDED", 7200),
        ("FAILED", -60),
    )

    try:
        with psycopg.connect(
            pg_url,
            autocommit=True,
        ) as conn:
            for status, finished_age_seconds in cases:
                execution_id = uuid4()
                batch_id = uuid4()

                finished_at = anchor - timedelta(seconds=finished_age_seconds)
                started_at = finished_at - timedelta(seconds=30)
                heartbeat_at = finished_at - timedelta(seconds=10)

                records.append((execution_id, batch_id))

                conn.execute(
                    """
                    INSERT INTO pipeline_executions (
                        execution_id,
                        batch_id,
                        attempt_number,
                        status,
                        started_at,
                        heartbeat_at,
                        finished_at,
                        total_attempted,
                        accepted_count,
                        duplicate_count,
                        conflict_count,
                        rejected_count,
                        failed_count,
                        internal_retry_count,
                        error_code
                    )
                    VALUES (
                        %(execution_id)s,
                        %(batch_id)s,
                        1,
                        %(status)s,
                        %(started_at)s,
                        %(heartbeat_at)s,
                        %(finished_at)s,
                        1,
                        %(accepted_count)s,
                        0,
                        0,
                        0,
                        %(failed_count)s,
                        0,
                        %(error_code)s
                    )
                    """,
                    {
                        "execution_id": execution_id,
                        "batch_id": batch_id,
                        "status": status,
                        "started_at": started_at,
                        "heartbeat_at": heartbeat_at,
                        "finished_at": finished_at,
                        "accepted_count": (1 if status == "SUCCEEDED" else 0),
                        "failed_count": (1 if status == "FAILED" else 0),
                        "error_code": (None if status == "SUCCEEDED" else "C10_TEST_FAILURE"),
                    },
                )

        yield pg_url, anchor, tuple(execution_id for execution_id, _ in records)

    finally:
        if records:
            with psycopg.connect(
                pg_url,
                autocommit=True,
            ) as conn:
                for execution_id, batch_id in records:
                    conn.execute(
                        """
                        DELETE FROM pipeline_executions
                        WHERE execution_id = %s
                          AND batch_id = %s
                        """,
                        (execution_id, batch_id),
                    )


def test_postgres_window_is_bounded_and_future_safe(
    terminal_records,
):
    url, anchor, _ = terminal_records

    report = evaluate_execution_slo(
        url,
        window=timedelta(hours=1),
        target=Decimal("0.99"),
        observed_at=anchor,
    )

    assert report.total_terminal >= 2
    assert report.good_count >= 1
    assert report.bad_count >= 1
    assert report.status is ExecutionSloStatus.BREACHED


def test_postgres_slo_evaluation_does_not_mutate_ledger(
    terminal_records,
):
    url, anchor, ids = terminal_records

    before = _snapshot(url, ids)

    evaluate_execution_slo(
        url,
        window=timedelta(hours=1),
        target=Decimal("0.99"),
        observed_at=anchor,
    )

    after = _snapshot(url, ids)

    assert before == after


def test_terminal_window_index_is_installed(pg_url):
    with psycopg.connect(
        pg_url,
        row_factory=dict_row,
    ) as conn:
        row = conn.execute(
            """
            SELECT indexdef
            FROM pg_indexes
            WHERE schemaname = current_schema()
              AND tablename = 'pipeline_executions'
              AND indexname =
                  'idx_pipeline_executions_terminal_finished_at'
            """
        ).fetchone()

    assert row is not None

    indexdef = row["indexdef"]

    assert "finished_at DESC" in indexdef
    assert "execution_id" in indexdef
    assert "SUCCEEDED" in indexdef
    assert "FAILED" in indexdef


def test_invalid_database_url_fails_before_connection():
    with pytest.raises(ValueError):
        evaluate_execution_slo(
            "sqlite:///lotuslearn.db",
            window=timedelta(days=28),
            target="0.99",
        )
