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
    get_quality_evaluation,
    list_quality_evaluations_for_execution,
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


# DE-04F4B execution-lineage PostgreSQL contracts


def _f4b_create_execution(conn):
    """Create a committed execution through the production ledger API."""
    import os
    from uuid import uuid4

    from lotuslearn_pipeline.execution_ledger import (
        PostgresPipelineExecutionLedger,
    )

    execution_id = uuid4()
    batch_id = uuid4()

    ledger = PostgresPipelineExecutionLedger(
        database_url=os.environ["LOTUSLEARN_DATABASE_URL"],
    )

    ledger.start_execution(
        execution_id=execution_id,
        batch_id=batch_id,
        attempt_number=1,
    )

    row = conn.execute(
        """
        SELECT execution_id
        FROM pipeline_executions
        WHERE execution_id = %s
        """,
        (execution_id,),
    ).fetchone()

    assert row is not None
    assert row["execution_id"] == execution_id

    return execution_id


def _f4b_assert_existing(result):
    """Verify replay disposition without coupling to enum implementation."""
    disposition = result.disposition

    name = getattr(disposition, "name", None)
    value = getattr(disposition, "value", disposition)

    assert name == "EXISTING" or value == "EXISTING" or value == "existing"


def test_execution_lineage_exact_replay_is_existing(conn):
    from uuid import uuid4

    execution_id = _f4b_create_execution(conn)
    evaluation_key = f"f4b-exact-replay-{uuid4()}"
    decision = make_decision()

    first = persist_quality_evaluation(
        conn,
        evaluation_key=evaluation_key,
        decision=decision,
        execution_id=execution_id,
    )

    replay = persist_quality_evaluation(
        conn,
        evaluation_key=evaluation_key,
        decision=decision,
        execution_id=execution_id,
    )

    assert first.record.execution_id == execution_id
    assert replay.record.execution_id == execution_id

    _f4b_assert_existing(replay)

    row = conn.execute(
        """
        SELECT
            execution_id,
            COUNT(*) OVER () AS record_count
        FROM data_quality_evaluation_history
        WHERE evaluation_key = %s
        LIMIT 1
        """,
        (evaluation_key,),
    ).fetchone()

    assert row is not None
    assert row["record_count"] == 1
    assert row["execution_id"] == execution_id


def test_same_evaluation_key_cannot_rebind_to_different_execution(
    conn,
):
    from uuid import uuid4

    first_execution_id = _f4b_create_execution(conn)
    second_execution_id = _f4b_create_execution(conn)

    assert first_execution_id != second_execution_id

    evaluation_key = f"f4b-cross-execution-{uuid4()}"
    decision = make_decision()

    persist_quality_evaluation(
        conn,
        evaluation_key=evaluation_key,
        decision=decision,
        execution_id=first_execution_id,
    )

    with pytest.raises(QualityEvaluationConflictError):
        persist_quality_evaluation(
            conn,
            evaluation_key=evaluation_key,
            decision=decision,
            execution_id=second_execution_id,
        )

    row = conn.execute(
        """
        SELECT execution_id
        FROM data_quality_evaluation_history
        WHERE evaluation_key = %s
        """,
        (evaluation_key,),
    ).fetchone()

    assert row is not None
    assert row["execution_id"] == first_execution_id


def test_legacy_null_execution_replay_remains_existing(conn):
    from uuid import uuid4

    evaluation_key = f"f4b-legacy-null-{uuid4()}"
    decision = make_decision()

    first = persist_quality_evaluation(
        conn,
        evaluation_key=evaluation_key,
        decision=decision,
    )

    replay = persist_quality_evaluation(
        conn,
        evaluation_key=evaluation_key,
        decision=decision,
    )

    assert first.record.execution_id is None
    assert replay.record.execution_id is None

    _f4b_assert_existing(replay)

    row = conn.execute(
        """
        SELECT
            execution_id,
            COUNT(*) OVER () AS record_count
        FROM data_quality_evaluation_history
        WHERE evaluation_key = %s
        LIMIT 1
        """,
        (evaluation_key,),
    ).fetchone()

    assert row is not None
    assert row["record_count"] == 1
    assert row["execution_id"] is None


def test_legacy_null_execution_cannot_be_rebound_to_uuid(conn):
    from uuid import uuid4

    execution_id = _f4b_create_execution(conn)
    evaluation_key = f"f4b-null-rebind-{uuid4()}"
    decision = make_decision()

    persist_quality_evaluation(
        conn,
        evaluation_key=evaluation_key,
        decision=decision,
    )

    with pytest.raises(QualityEvaluationConflictError):
        persist_quality_evaluation(
            conn,
            evaluation_key=evaluation_key,
            decision=decision,
            execution_id=execution_id,
        )

    row = conn.execute(
        """
        SELECT execution_id
        FROM data_quality_evaluation_history
        WHERE evaluation_key = %s
        """,
        (evaluation_key,),
    ).fetchone()

    assert row is not None
    assert row["execution_id"] is None


def test_unknown_execution_uuid_is_rejected_by_database_fk(conn):
    from uuid import uuid4

    from psycopg.errors import ForeignKeyViolation

    unknown_execution_id = uuid4()

    row = conn.execute(
        """
        SELECT execution_id
        FROM pipeline_executions
        WHERE execution_id = %s
        """,
        (unknown_execution_id,),
    ).fetchone()

    assert row is None

    evaluation_key = f"f4b-unknown-execution-{uuid4()}"

    with pytest.raises(ForeignKeyViolation):
        persist_quality_evaluation(
            conn,
            evaluation_key=evaluation_key,
            decision=make_decision(),
            execution_id=unknown_execution_id,
        )

    # PostgreSQL errors abort a non-autocommit transaction. Recover before
    # proving that no evidence row survived the rejected insert.
    conn.rollback()

    row = conn.execute(
        """
        SELECT evaluation_key
        FROM data_quality_evaluation_history
        WHERE evaluation_key = %s
        """,
        (evaluation_key,),
    ).fetchone()

    assert row is None


def test_detector_evidence_round_trips_through_postgres_and_exact_replay(conn):
    from dataclasses import replace

    from lotuslearn_pipeline.data_quality_anomaly import (
        DetectorComparison,
        IsolationForestCandidateScore,
    )

    comparison = DetectorComparison(
        isolation_forest=IsolationForestCandidateScore(
            history_size=3,
            feature_columns=("row_count_delta",),
            decision_function=-0.25,
            anomaly_score=0.25,
            prediction=-1,
            is_anomaly=True,
        ),
        robust_is_anomaly=True,
        robust_anomaly_metrics=("row_count_delta",),
        detectors_agree=True,
    )
    decision = replace(
        make_decision(),
        detector_comparison=comparison,
    )
    evaluation_key = "quality-run-detector-evidence-roundtrip-001"

    persist_quality_evaluation(
        conn,
        evaluation_key=evaluation_key,
        decision=decision,
    )

    first_row = conn.execute(
        """
        SELECT detector_evidence
        FROM data_quality_evaluation_history
        WHERE evaluation_key = %s
        """,
        (evaluation_key,),
    ).fetchone()

    assert first_row is not None
    first_evidence = first_row["detector_evidence"] if hasattr(first_row, "keys") else first_row[0]

    assert first_evidence is not None
    assert first_evidence["detectors_agree"] is True
    assert first_evidence["robust_is_anomaly"] is True
    assert first_evidence["robust_anomaly_metrics"] == ["row_count_delta"]
    assert first_evidence["isolation_forest"]["history_size"] == 3
    assert first_evidence["isolation_forest"]["feature_columns"] == ["row_count_delta"]
    assert first_evidence["isolation_forest"]["decision_function"] == pytest.approx(-0.25)
    assert first_evidence["isolation_forest"]["anomaly_score"] == pytest.approx(0.25)
    assert first_evidence["isolation_forest"]["prediction"] == -1
    assert first_evidence["isolation_forest"]["is_anomaly"] is True

    persist_quality_evaluation(
        conn,
        evaluation_key=evaluation_key,
        decision=decision,
    )

    replay_row = conn.execute(
        """
        SELECT detector_evidence
        FROM data_quality_evaluation_history
        WHERE evaluation_key = %s
        """,
        (evaluation_key,),
    ).fetchone()

    assert replay_row is not None
    replay_evidence = (
        replay_row["detector_evidence"] if hasattr(replay_row, "keys") else replay_row[0]
    )

    assert replay_evidence == first_evidence


# DE04 C6 operational evidence read-model contracts


def test_get_quality_evaluation_returns_persisted_record(conn):
    from uuid import uuid4

    execution_id = _f4b_create_execution(conn)
    evaluation_key = f"c6-get-{uuid4()}"

    persisted = persist_quality_evaluation(
        conn,
        evaluation_key=evaluation_key,
        decision=make_decision(),
        execution_id=execution_id,
    )

    loaded = get_quality_evaluation(
        conn,
        evaluation_key=evaluation_key,
    )

    assert loaded == persisted.record
    assert loaded is not None
    assert loaded.evaluation_key == evaluation_key
    assert loaded.execution_id == execution_id


def test_get_quality_evaluation_returns_none_for_unknown_key(conn):
    from uuid import uuid4

    loaded = get_quality_evaluation(
        conn,
        evaluation_key=f"c6-missing-{uuid4()}",
    )

    assert loaded is None


def test_get_quality_evaluation_validates_key(conn):
    with pytest.raises(TypeError):
        get_quality_evaluation(
            conn,
            evaluation_key=123,  # type: ignore[arg-type]
        )

    with pytest.raises(ValueError):
        get_quality_evaluation(
            conn,
            evaluation_key="   ",
        )


def test_list_quality_evaluations_for_execution_is_filtered_and_bounded(conn):
    from uuid import uuid4

    execution_id = _f4b_create_execution(conn)
    other_execution_id = _f4b_create_execution(conn)

    first_key = f"c6-list-001-{uuid4()}"
    second_key = f"c6-list-002-{uuid4()}"
    third_key = f"c6-list-003-{uuid4()}"
    other_key = f"c6-list-other-{uuid4()}"

    first = persist_quality_evaluation(
        conn,
        evaluation_key=first_key,
        decision=make_decision(),
        execution_id=execution_id,
    )

    persist_quality_evaluation(
        conn,
        evaluation_key=other_key,
        decision=make_decision(),
        execution_id=other_execution_id,
    )

    second = persist_quality_evaluation(
        conn,
        evaluation_key=second_key,
        decision=make_decision(),
        execution_id=execution_id,
    )

    persist_quality_evaluation(
        conn,
        evaluation_key=third_key,
        decision=make_decision(),
        execution_id=execution_id,
    )

    records = list_quality_evaluations_for_execution(
        conn,
        execution_id=execution_id,
        limit=2,
    )

    assert len(records) == 2
    assert records[0] == first.record
    assert records[1] == second.record
    assert all(record.execution_id == execution_id for record in records)


def test_list_quality_evaluations_for_execution_returns_empty_tuple(conn):
    from uuid import uuid4

    records = list_quality_evaluations_for_execution(
        conn,
        execution_id=uuid4(),
    )

    assert records == ()


@pytest.mark.parametrize(
    ("limit", "error"),
    [
        (True, TypeError),
        (0, ValueError),
        (1001, ValueError),
    ],
)
def test_list_quality_evaluations_for_execution_validates_limit(
    conn,
    limit,
    error,
):
    from uuid import uuid4

    with pytest.raises(error):
        list_quality_evaluations_for_execution(
            conn,
            execution_id=uuid4(),
            limit=limit,
        )


def test_list_quality_evaluations_for_execution_requires_uuid(conn):
    with pytest.raises(TypeError):
        list_quality_evaluations_for_execution(
            conn,
            execution_id="not-a-uuid",  # type: ignore[arg-type]
        )
