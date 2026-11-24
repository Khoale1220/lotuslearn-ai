from __future__ import annotations

import os
from urllib.parse import urlsplit
from uuid import uuid4

import psycopg
import pytest

from lotuslearn_pipeline.dataset_lineage import (
    DatasetLineageWriteOutcome,
    DatasetRef,
    list_dataset_lineage_for_execution,
    persist_dataset_lineage_edge,
)
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


def _initialize(url: str) -> None:
    with psycopg.connect(url, autocommit=True) as conn:
        apply_postgres_migrations(conn)


def _start_execution(url: str):
    execution_id = uuid4()
    batch_id = uuid4()

    PostgresPipelineExecutionLedger(url).start_execution(
        execution_id=execution_id,
        batch_id=batch_id,
        attempt_number=1,
    )

    return execution_id


def _cleanup(url: str, execution_id) -> None:
    with psycopg.connect(url, autocommit=True) as conn:
        conn.execute("TRUNCATE TABLE pipeline_execution_dataset_lineage")

        conn.execute(
            """
            DELETE FROM pipeline_execution_recoveries
            WHERE execution_id = %s
            """,
            (execution_id,),
        )

        conn.execute(
            """
            DELETE FROM data_quality_evaluation_history
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


def test_dataset_ref_normalizes_and_validates_identity():
    dataset = DatasetRef(
        namespace="  postgresql://warehouse  ",
        name="  analytics.student_findings  ",
    )

    assert dataset.namespace == "postgresql://warehouse"
    assert dataset.name == "analytics.student_findings"

    with pytest.raises(ValueError):
        DatasetRef(namespace=" ", name="valid")

    with pytest.raises(ValueError):
        DatasetRef(namespace="valid", name="")


def test_lineage_edge_persistence_is_idempotent():
    url = _database_url()
    _initialize(url)

    execution_id = _start_execution(url)

    source = DatasetRef(
        namespace="postgresql://lotuslearn",
        name="public.analytical_events",
    )
    target = DatasetRef(
        namespace="postgresql://lotuslearn",
        name="analytics.student_findings",
    )

    try:
        with psycopg.connect(url, autocommit=True) as conn:
            first = persist_dataset_lineage_edge(
                conn,
                execution_id=execution_id,
                input_dataset=source,
                output_dataset=target,
            )

            replay = persist_dataset_lineage_edge(
                conn,
                execution_id=execution_id,
                input_dataset=source,
                output_dataset=target,
            )

        assert first.outcome is DatasetLineageWriteOutcome.INSERTED
        assert replay.outcome is DatasetLineageWriteOutcome.EXISTING
        assert replay.edge == first.edge

    finally:
        _cleanup(url, execution_id)


def test_lineage_is_scoped_ordered_and_bounded():
    url = _database_url()
    _initialize(url)

    execution_id = _start_execution(url)

    output = DatasetRef(
        namespace="postgresql://lotuslearn",
        name="analytics.student_findings",
    )

    inputs = (
        DatasetRef(
            namespace="postgresql://lotuslearn",
            name="public.analysis_runs",
        ),
        DatasetRef(
            namespace="postgresql://lotuslearn",
            name="public.analytical_events",
        ),
    )

    try:
        with psycopg.connect(url, autocommit=True) as conn:
            for source in inputs:
                persist_dataset_lineage_edge(
                    conn,
                    execution_id=execution_id,
                    input_dataset=source,
                    output_dataset=output,
                )

            rows = list_dataset_lineage_for_execution(
                conn,
                execution_id=execution_id,
                limit=100,
            )

            bounded = list_dataset_lineage_for_execution(
                conn,
                execution_id=execution_id,
                limit=1,
            )

        assert tuple(row.input_dataset.name for row in rows) == (
            "public.analysis_runs",
            "public.analytical_events",
        )

        assert len(bounded) == 1

    finally:
        _cleanup(url, execution_id)


@pytest.mark.parametrize(
    "limit",
    [
        True,
        0,
        1001,
    ],
)
def test_lineage_read_model_rejects_unsafe_limits(limit):
    with pytest.raises((TypeError, ValueError)):
        list_dataset_lineage_for_execution(
            None,
            execution_id=uuid4(),
            limit=limit,
        )


def test_lineage_foreign_key_rejects_unknown_execution():
    url = _database_url()
    _initialize(url)

    with psycopg.connect(url, autocommit=True) as conn:
        with pytest.raises(psycopg.errors.ForeignKeyViolation):
            persist_dataset_lineage_edge(
                conn,
                execution_id=uuid4(),
                input_dataset=DatasetRef(
                    namespace="postgresql://lotuslearn",
                    name="public.analytical_events",
                ),
                output_dataset=DatasetRef(
                    namespace="postgresql://lotuslearn",
                    name="analytics.student_findings",
                ),
            )


def test_lineage_rows_are_immutable():
    url = _database_url()
    _initialize(url)

    execution_id = _start_execution(url)

    try:
        with psycopg.connect(url, autocommit=True) as conn:
            persist_dataset_lineage_edge(
                conn,
                execution_id=execution_id,
                input_dataset=DatasetRef(
                    namespace="postgresql://lotuslearn",
                    name="public.analytical_events",
                ),
                output_dataset=DatasetRef(
                    namespace="postgresql://lotuslearn",
                    name="analytics.student_findings",
                ),
            )

            with pytest.raises(psycopg.errors.ObjectNotInPrerequisiteState):
                conn.execute(
                    """
                    UPDATE pipeline_execution_dataset_lineage
                    SET output_name = 'analytics.mutated'
                    WHERE execution_id = %s
                    """,
                    (execution_id,),
                )

    finally:
        _cleanup(url, execution_id)


def test_operational_trace_includes_explicit_dataset_lineage():
    url = _database_url()
    _initialize(url)

    execution_id = _start_execution(url)

    source = DatasetRef(
        namespace="postgresql://lotuslearn",
        name="public.analytical_events",
    )
    target = DatasetRef(
        namespace="postgresql://lotuslearn",
        name="analytics.student_findings",
    )

    try:
        with psycopg.connect(url, autocommit=True) as conn:
            persist_dataset_lineage_edge(
                conn,
                execution_id=execution_id,
                input_dataset=source,
                output_dataset=target,
            )

        trace = get_execution_trace(
            url,
            execution_id=execution_id,
        )

        assert trace is not None
        assert len(trace.dataset_lineage) == 1
        assert trace.dataset_lineage[0].input_dataset == source
        assert trace.dataset_lineage[0].output_dataset == target

    finally:
        _cleanup(url, execution_id)
