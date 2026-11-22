from __future__ import annotations

import os
from urllib.parse import urlsplit
from uuid import uuid4

import psycopg
import pytest

from lotuslearn_pipeline.data_quality_evaluation import evaluate_dataset_quality
from lotuslearn_pipeline.data_quality_evaluation_history import persist_quality_evaluation
from lotuslearn_pipeline.execution_ledger import PostgresPipelineExecutionLedger
from lotuslearn_pipeline.execution_trace import get_execution_trace
from lotuslearn_pipeline.postgres import apply_postgres_migrations


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


def _decision():
    return evaluate_dataset_quality(
        [{"id": "a", "score": 10}],
        [{"id": "a", "score": 10}],
        key_fields=("id",),
        tracked_fields=("id", "score"),
        min_history=20,
    )


def test_execution_trace_composes_execution_and_quality_evidence():
    url = _database_url()
    execution_id = uuid4()
    batch_id = uuid4()
    evaluation_key = f"trace-{execution_id}"

    with psycopg.connect(url, autocommit=True) as conn:
        apply_postgres_migrations(conn)

    ledger = PostgresPipelineExecutionLedger(url)

    try:
        ledger.start_execution(
            execution_id=execution_id,
            batch_id=batch_id,
            attempt_number=1,
        )

        with psycopg.connect(url, autocommit=True) as conn:
            persist_quality_evaluation(
                conn,
                evaluation_key=evaluation_key,
                decision=_decision(),
                execution_id=execution_id,
            )

        trace = get_execution_trace(
            url,
            execution_id=execution_id,
        )

        assert trace is not None
        assert trace.execution.execution_id == execution_id
        assert trace.recovery is None
        assert tuple(
            item.evaluation_key
            for item in trace.quality_evaluations
        ) == (evaluation_key,)

    finally:
        with psycopg.connect(url, autocommit=True) as conn:
            conn.execute("TRUNCATE TABLE data_quality_evaluation_history")
            conn.execute(
                """
                DELETE FROM pipeline_execution_recoveries
                WHERE execution_id = %s
                """,
                (execution_id,),
            )
            conn.execute(
                """
                DELETE FROM pipeline_executions
                WHERE execution_id = %s
                """,
                (execution_id,),
            )


def test_execution_trace_returns_none_for_unknown_execution():
    url = _database_url()

    assert get_execution_trace(
        url,
        execution_id=uuid4(),
    ) is None
