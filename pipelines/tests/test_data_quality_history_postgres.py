from __future__ import annotations

import os
from collections.abc import Iterator
from uuid import UUID, uuid4

import psycopg
import pytest
from psycopg.rows import dict_row

from lotuslearn_pipeline.data_quality_history import (
    DataQualityPersistenceConflict,
    DataQualityPersistenceStatus,
    persist_data_quality_reconciliation,
    reconciliation_evidence_checksum,
)
from lotuslearn_pipeline.data_quality_reconciliation import (
    reconcile_datasets,
)
from lotuslearn_pipeline.postgres import apply_postgres_migrations


def _database_url() -> str | None:
    return (
        os.getenv("LOTUSLEARN_TEST_DATABASE_URL")
        or os.getenv("TEST_DATABASE_URL")
        or os.getenv("LOTUSLEARN_DATABASE_URL")
        or os.getenv("DATABASE_URL")
    )


@pytest.fixture
def postgres_conn() -> Iterator[psycopg.Connection]:
    url = _database_url()

    if not url:
        pytest.skip("PostgreSQL test URL is not configured")

    with psycopg.connect(
        url,
        autocommit=True,
        row_factory=dict_row,
    ) as conn:
        database_name = conn.execute("SELECT current_database() AS database_name").fetchone()[
            "database_name"
        ]

        if database_name != "lotuslearn_test":
            raise RuntimeError("Refusing PostgreSQL integration test outside lotuslearn_test")

        apply_postgres_migrations(conn)

        yield conn


def _delete_evidence(
    conn: psycopg.Connection,
    reconciliation_id: UUID,
) -> None:
    conn.execute(
        """
        DELETE FROM data_quality_reconciliation_runs
        WHERE reconciliation_id = %s
        """,
        (reconciliation_id,),
    )


def test_migration_0009_creates_quality_evidence_tables(postgres_conn):
    tables = {
        row["table_name"]
        for row in postgres_conn.execute(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name LIKE 'data_quality_reconciliation_%'
            ORDER BY table_name
            """
        ).fetchall()
    }

    assert tables == {
        "data_quality_reconciliation_key_differences",
        "data_quality_reconciliation_metrics",
        "data_quality_reconciliation_runs",
    }


def test_evidence_checksum_is_deterministic_and_context_sensitive():
    report = reconcile_datasets(
        [{"id": "a", "score": 10}],
        [{"id": "a", "score": 10}],
        key_fields=("id",),
    )

    first = reconciliation_evidence_checksum(
        report,
        key_fields=("id",),
    )
    second = reconciliation_evidence_checksum(
        report,
        key_fields=("id",),
    )
    contextual = reconciliation_evidence_checksum(
        report,
        key_fields=("id",),
        batch_id=UUID("11111111-1111-1111-1111-111111111111"),
    )

    assert first == second
    assert first != contextual
    assert len(first) == 64


def test_persist_reconciliation_is_atomic_and_idempotent(postgres_conn):
    reconciliation_id = uuid4()

    report = reconcile_datasets(
        [
            {"id": "a", "email": None},
            {"id": "a", "email": "duplicate@example.test"},
            {"id": "b", "email": "b@example.test"},
        ],
        [
            {"id": "a", "email": "a@example.test"},
            {"id": "b", "email": "b@example.test"},
            {"id": "b", "email": "duplicate@example.test"},
        ],
        key_fields=("id",),
        tracked_fields=("id", "email"),
    )

    try:
        inserted = persist_data_quality_reconciliation(
            postgres_conn,
            reconciliation_id=reconciliation_id,
            report=report,
            key_fields=("id",),
        )

        assert inserted.status is DataQualityPersistenceStatus.INSERTED

        replay = persist_data_quality_reconciliation(
            postgres_conn,
            reconciliation_id=reconciliation_id,
            report=report,
            key_fields=("id",),
        )

        assert replay.status is DataQualityPersistenceStatus.EXISTING
        assert replay.evidence_checksum == inserted.evidence_checksum

        run = postgres_conn.execute(
            """
            SELECT *
            FROM data_quality_reconciliation_runs
            WHERE reconciliation_id = %s
            """,
            (reconciliation_id,),
        ).fetchone()

        assert run is not None
        assert run["status"] == "FAIL"
        assert run["source_row_count"] == 3
        assert run["target_row_count"] == 3
        assert run["missing_key_count"] == 1
        assert run["extra_key_count"] == 1
        assert run["evidence_checksum"] == inserted.evidence_checksum

        metric_count = postgres_conn.execute(
            """
            SELECT COUNT(*) AS count
            FROM data_quality_reconciliation_metrics
            WHERE reconciliation_id = %s
            """,
            (reconciliation_id,),
        ).fetchone()["count"]

        assert metric_count == len(report.metrics)

        differences = postgres_conn.execute(
            """
            SELECT direction, occurrence_count
            FROM data_quality_reconciliation_key_differences
            WHERE reconciliation_id = %s
            ORDER BY direction
            """,
            (reconciliation_id,),
        ).fetchall()

        assert differences == [
            {
                "direction": "EXTRA_IN_TARGET",
                "occurrence_count": 1,
            },
            {
                "direction": "MISSING_FROM_TARGET",
                "occurrence_count": 1,
            },
        ]
    finally:
        _delete_evidence(
            postgres_conn,
            reconciliation_id,
        )


def test_reconciliation_id_rejects_conflicting_replay(postgres_conn):
    reconciliation_id = uuid4()

    original = reconcile_datasets(
        [{"id": "a", "value": 1}],
        [{"id": "a", "value": 1}],
        key_fields=("id",),
    )
    conflicting = reconcile_datasets(
        [{"id": "a", "value": 1}],
        [{"id": "a", "value": 2}],
        key_fields=("id",),
    )

    try:
        persist_data_quality_reconciliation(
            postgres_conn,
            reconciliation_id=reconciliation_id,
            report=original,
            key_fields=("id",),
        )

        with pytest.raises(
            DataQualityPersistenceConflict,
            match="different evidence",
        ):
            persist_data_quality_reconciliation(
                postgres_conn,
                reconciliation_id=reconciliation_id,
                report=conflicting,
                key_fields=("id",),
            )

        persisted = postgres_conn.execute(
            """
            SELECT status, source_digest, target_digest
            FROM data_quality_reconciliation_runs
            WHERE reconciliation_id = %s
            """,
            (reconciliation_id,),
        ).fetchone()

        assert persisted["status"] == "PASS"
        assert persisted["source_digest"] == original.source.digest
        assert persisted["target_digest"] == original.target.digest
    finally:
        _delete_evidence(
            postgres_conn,
            reconciliation_id,
        )


def test_child_evidence_is_removed_with_run(postgres_conn):
    reconciliation_id = uuid4()

    report = reconcile_datasets(
        [{"id": "a"}, {"id": "a"}],
        [{"id": "a"}, {"id": "b"}],
        key_fields=("id",),
    )

    persist_data_quality_reconciliation(
        postgres_conn,
        reconciliation_id=reconciliation_id,
        report=report,
        key_fields=("id",),
    )

    _delete_evidence(
        postgres_conn,
        reconciliation_id,
    )

    metric_count = postgres_conn.execute(
        """
        SELECT COUNT(*) AS count
        FROM data_quality_reconciliation_metrics
        WHERE reconciliation_id = %s
        """,
        (reconciliation_id,),
    ).fetchone()["count"]

    difference_count = postgres_conn.execute(
        """
        SELECT COUNT(*) AS count
        FROM data_quality_reconciliation_key_differences
        WHERE reconciliation_id = %s
        """,
        (reconciliation_id,),
    ).fetchone()["count"]

    assert metric_count == 0
    assert difference_count == 0
