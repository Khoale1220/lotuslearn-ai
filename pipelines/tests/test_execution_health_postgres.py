"""PostgreSQL 18 integration tests for read-only execution health."""

from __future__ import annotations

import os
from datetime import timedelta
from urllib.parse import urlsplit
from uuid import UUID, uuid4

import psycopg
import pytest
from psycopg.rows import dict_row

from lotuslearn_pipeline.execution_health import (
    ExecutionHealthState,
    list_running_execution_health,
)
from lotuslearn_pipeline.postgres import (
    apply_postgres_migrations,
    get_migration_status,
)


@pytest.fixture(scope="module")
def pg_url():
    """Require the existing isolated PostgreSQL 18 test database."""
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
        url, autocommit=True, row_factory=dict_row
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

        version = int(identity["version_num"])
        assert 180000 <= version < 190000

        apply_postgres_migrations(conn)
        migrations = get_migration_status(conn)

        assert len(migrations) == 7
        assert all(
            row["applied"] and row["match"] is True
            for row in migrations
        )

    return url


def _snapshot(url: str, ids: dict[str, UUID]):
    """Capture complete persisted rows for test-owned identities."""
    with psycopg.connect(url, row_factory=dict_row) as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM pipeline_executions
            WHERE execution_id = ANY(%s::uuid[])
            ORDER BY execution_id
            """,
            (list(ids.values()),),
        ).fetchall()

    return {row["execution_id"]: row for row in rows}


@pytest.fixture
def pg_records(pg_url):
    """Create and remove only explicitly owned synthetic executions."""
    ids: dict[str, UUID] = {}
    batches: dict[str, UUID] = {}

    cases = (
        ("recent", "RUNNING", 120, 30),
        ("stale", "RUNNING", 7200, 3600),
        ("future", "RUNNING", 120, -600),
        ("terminal", "FAILED", 120, 30),
    )

    try:
        with psycopg.connect(pg_url, autocommit=True) as conn:
            for name, status, start_age, heartbeat_age in cases:
                execution_id = uuid4()
                batch_id = uuid4()

                ids[name] = execution_id
                batches[name] = batch_id

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
                        error_code
                    )
                    VALUES (
                        %(execution_id)s,
                        %(batch_id)s,
                        1,
                        %(status)s,
                        clock_timestamp()
                            - (%(start_age)s * INTERVAL '1 second'),
                        clock_timestamp()
                            - (%(heartbeat_age)s * INTERVAL '1 second'),
                        CASE
                            WHEN %(status)s = 'FAILED'
                            THEN clock_timestamp()
                            ELSE NULL
                        END,
                        CASE
                            WHEN %(status)s = 'FAILED'
                            THEN 'INGESTION_FAILED'
                            ELSE NULL
                        END
                    )
                    """,
                    {
                        "execution_id": execution_id,
                        "batch_id": batch_id,
                        "status": status,
                        "start_age": start_age,
                        "heartbeat_age": heartbeat_age,
                    },
                )

        yield pg_url, ids

    finally:
        if ids:
            with psycopg.connect(pg_url, autocommit=True) as conn:
                for name, execution_id in ids.items():
                    conn.execute(
                        """
                        DELETE FROM pipeline_executions
                        WHERE execution_id = %s
                          AND batch_id = %s
                        """,
                        (execution_id, batches[name]),
                    )


def test_postgres_classifies_health_without_mutation(pg_records):
    url, ids = pg_records

    before = _snapshot(url, ids)
    assert len(before) == 4

    health = list_running_execution_health(
        url,
        stale_after=timedelta(minutes=15),
        limit=1000,
    )

    found = {row.execution_id: row for row in health}

    assert found[ids["recent"]].health is ExecutionHealthState.RECENT

    assert (
        found[ids["stale"]].health
        is ExecutionHealthState.SUSPECTED_STALE
    )

    assert (
        found[ids["future"]].health
        is ExecutionHealthState.FUTURE_HEARTBEAT
    )

    assert ids["terminal"] not in found

    after = _snapshot(url, ids)

    assert before == after


def test_postgres_health_query_is_bounded_and_sorted(pg_records):
    url, _ = pg_records

    rows = list_running_execution_health(
        url,
        stale_after=timedelta(minutes=15),
        limit=2,
    )

    assert len(rows) == 2

    ordering = [
        (row.heartbeat_at, row.execution_id)
        for row in rows
    ]

    assert ordering == sorted(ordering)


def test_postgres_read_only_transaction_rejects_writes(pg_records):
    url, ids = pg_records

    before = _snapshot(url, ids)

    with psycopg.connect(url) as conn:
        conn.execute("SET TRANSACTION READ ONLY")

        with pytest.raises(psycopg.errors.ReadOnlySqlTransaction):
            conn.execute(
                """
                UPDATE pipeline_executions
                SET heartbeat_at = clock_timestamp()
                WHERE execution_id = %s
                """,
                (ids["recent"],),
            )

        conn.rollback()

    assert _snapshot(url, ids) == before
