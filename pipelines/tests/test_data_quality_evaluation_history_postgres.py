from __future__ import annotations

import os
from dataclasses import replace
from urllib.parse import urlsplit

import psycopg
import pytest
from psycopg.rows import dict_row

from lotuslearn_pipeline.data_quality_evaluation import (
    QualityEvaluationStatus,
    evaluate_dataset_quality,
)
from lotuslearn_pipeline.data_quality_evaluation_history import (
    QualityEvaluationConflictError,
    QualityEvaluationPersistenceDisposition,
    persist_quality_evaluation,
)
from lotuslearn_pipeline.postgres import apply_postgres_migrations


def _safe_test_database_url() -> str:
    preferred = (
        "LOTUSLEARN_POSTGRES_TEST_URL",
        "LOTUSLEARN_DATABASE_URL",
        "POSTGRES_TEST_URL",
        "DATABASE_URL",
    )

    candidates: list[str] = []

    for name in preferred:
        value = os.environ.get(name)

        if value:
            candidates.append(value)

    for name, value in os.environ.items():
        upper = name.upper()

        if (
            ("POSTGRES" in upper or "DATABASE" in upper)
            and value.startswith(("postgresql://", "postgres://"))
            and value not in candidates
        ):
            candidates.append(value)

    for url in candidates:
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
def conn():
    url = _safe_test_database_url()

    with psycopg.connect(
        url,
        autocommit=True,
        row_factory=dict_row,
    ) as connection:
        apply_postgres_migrations(connection)

        connection.execute("TRUNCATE TABLE data_quality_evaluation_history")

        yield connection

        connection.execute("TRUNCATE TABLE data_quality_evaluation_history")


def make_decision(
    *,
    target_score: int = 10,
):
    return evaluate_dataset_quality(
        [
            {"id": "a", "score": 10},
        ],
        [
            {
                "id": "a",
                "score": target_score,
            },
        ],
        key_fields=("id",),
        tracked_fields=("id", "score"),
        min_history=20,
    )


def test_persist_and_exact_replay_are_idempotent(
    conn,
):
    decision = make_decision()

    first = persist_quality_evaluation(
        conn,
        evaluation_key="quality-run-001",
        decision=decision,
    )

    second = persist_quality_evaluation(
        conn,
        evaluation_key="quality-run-001",
        decision=decision,
    )

    assert first.disposition is QualityEvaluationPersistenceDisposition.INSERTED

    assert second.disposition is QualityEvaluationPersistenceDisposition.EXISTING

    assert first.record.decision_fingerprint == second.record.decision_fingerprint

    assert first.record.created_at == second.record.created_at

    count_row = conn.execute(
        """
        SELECT COUNT(*) AS record_count
        FROM data_quality_evaluation_history
        WHERE evaluation_key = %s
        """,
        ("quality-run-001",),
    ).fetchone()

    assert count_row is not None
    assert count_row["record_count"] == 1


def test_same_key_with_different_evidence_fails_closed(
    conn,
):
    original = make_decision()

    persist_quality_evaluation(
        conn,
        evaluation_key="quality-run-conflict",
        decision=original,
    )

    changed = replace(
        original,
        status=QualityEvaluationStatus.REVIEW,
        reasons=("changed_evidence",),
    )

    with pytest.raises(QualityEvaluationConflictError):
        persist_quality_evaluation(
            conn,
            evaluation_key="quality-run-conflict",
            decision=changed,
        )


def test_database_rejects_update_of_audit_record(
    conn,
):
    persist_quality_evaluation(
        conn,
        evaluation_key="quality-run-immutable",
        decision=make_decision(),
    )

    with pytest.raises(psycopg.Error) as exc_info:
        conn.execute(
            """
            UPDATE data_quality_evaluation_history
            SET evaluation_status = 'ALERT'
            WHERE evaluation_key = %s
            """,
            ("quality-run-immutable",),
        )

    assert exc_info.value.sqlstate == "55000"


def test_database_rejects_delete_of_audit_record(
    conn,
):
    persist_quality_evaluation(
        conn,
        evaluation_key="quality-run-delete",
        decision=make_decision(),
    )

    with pytest.raises(psycopg.Error) as exc_info:
        conn.execute(
            """
            DELETE FROM data_quality_evaluation_history
            WHERE evaluation_key = %s
            """,
            ("quality-run-delete",),
        )

    assert exc_info.value.sqlstate == "55000"
