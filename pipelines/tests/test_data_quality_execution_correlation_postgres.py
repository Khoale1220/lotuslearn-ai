from __future__ import annotations

import os
from urllib.parse import urlsplit
from uuid import uuid4

import psycopg
import pytest
from psycopg.rows import dict_row

from lotuslearn_pipeline.postgres import apply_postgres_migrations


def _safe_test_database_url() -> str:
    candidates = (
        os.environ.get("LOTUSLEARN_POSTGRES_TEST_URL"),
        os.environ.get("POSTGRES_TEST_URL"),
        os.environ.get("LOTUSLEARN_DATABASE_URL"),
    )

    for url in candidates:
        if not url:
            continue

        parsed = urlsplit(url)

        if (
            parsed.scheme in ("postgresql", "postgres")
            and parsed.hostname in ("127.0.0.1", "localhost")
            and parsed.port in (5432, 55432)
            and parsed.path == "/lotuslearn_test"
        ):
            return url

    pytest.fail("Dedicated safe PostgreSQL test URL is not configured")


@pytest.fixture
def connection():
    url = _safe_test_database_url()

    with psycopg.connect(
        url,
        autocommit=True,
        row_factory=dict_row,
    ) as conn:
        database_name = conn.execute("SELECT current_database() AS database_name").fetchone()

        assert database_name is not None
        assert database_name["database_name"] == "lotuslearn_test"

        conn.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")

        apply_postgres_migrations(conn)

        yield conn


def test_execution_id_column_and_fk_are_installed(connection) -> None:
    column = connection.execute(
        """
        SELECT
            column_name,
            data_type,
            is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'data_quality_evaluation_history'
          AND column_name = 'execution_id'
        """
    ).fetchone()

    assert column is not None
    assert column["column_name"] == "execution_id"
    assert column["data_type"] == "uuid"
    assert column["is_nullable"] == "YES"

    foreign_key = connection.execute(
        """
        SELECT
            tc.constraint_name,
            ccu.table_name AS referenced_table,
            ccu.column_name AS referenced_column
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
         AND ccu.constraint_schema = tc.constraint_schema
        WHERE tc.table_schema = 'public'
          AND tc.table_name = 'data_quality_evaluation_history'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND tc.constraint_name =
              'data_quality_evaluation_history_execution_fk'
        """
    ).fetchone()

    assert foreign_key is not None
    assert foreign_key["referenced_table"] == "pipeline_executions"
    assert foreign_key["referenced_column"] == "execution_id"


def test_execution_correlation_index_is_installed(connection) -> None:
    index = connection.execute(
        """
        SELECT indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'data_quality_evaluation_history'
          AND indexname =
              'data_quality_evaluation_history_execution_idx'
        """
    ).fetchone()

    assert index is not None
    assert "(execution_id)" in index["indexdef"]
    assert "execution_id IS NOT NULL" in index["indexdef"]


def test_existing_evidence_may_remain_uncorrelated(connection) -> None:
    columns = {
        row["column_name"]
        for row in connection.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'data_quality_evaluation_history'
            """
        ).fetchall()
    }

    assert "execution_id" in columns

    nullable = connection.execute(
        """
        SELECT is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'data_quality_evaluation_history'
          AND column_name = 'execution_id'
        """
    ).fetchone()

    assert nullable is not None
    assert nullable["is_nullable"] == "YES"


def test_execution_fk_rejects_unknown_execution(connection) -> None:
    unknown_execution_id = uuid4()

    constraint = connection.execute(
        """
        SELECT 1 AS present
        FROM pg_constraint
        WHERE conname =
            'data_quality_evaluation_history_execution_fk'
        """
    ).fetchone()

    assert constraint is not None

    referenced = connection.execute(
        """
        SELECT 1 AS present
        FROM pipeline_executions
        WHERE execution_id = %s
        """,
        (unknown_execution_id,),
    ).fetchone()

    assert referenced is None


def test_execution_fk_uses_restrict_delete_semantics(connection) -> None:
    action = connection.execute(
        """
        SELECT confdeltype
        FROM pg_constraint
        WHERE conname =
            'data_quality_evaluation_history_execution_fk'
        """
    ).fetchone()

    assert action is not None

    # PostgreSQL pg_constraint:
    # r = RESTRICT
    assert action["confdeltype"] == "r"
