"""Regression tests for immutable metadata governance history."""

from __future__ import annotations

import hashlib
import json
import os
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from threading import Barrier
from uuid import uuid4

import psycopg
import pytest
from psycopg.rows import dict_row

from lotuslearn_pipeline.metadata_drift import MetadataDiff
from lotuslearn_pipeline.metadata_governance_history import (
    MetadataGovernanceHistoryConflictError,
    MetadataGovernanceHistoryIntegrityError,
    MetadataGovernanceHistoryWriteOutcome,
    PostgresMetadataGovernanceHistoryStore,
)
from lotuslearn_pipeline.metadata_policy import (
    evaluate_metadata_governance,
)
from lotuslearn_pipeline.postgres import apply_postgres_migrations


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _make_decision():
    token = uuid4().hex
    baseline = _sha256(f"baseline:{token}")
    current = _sha256(f"current:{token}")

    comparison = _sha256(
        json.dumps(
            {
                "baseline_checksum": baseline,
                "current_checksum": current,
            },
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=True,
        )
    )

    metadata_diff = MetadataDiff(
        comparison_id=comparison,
        baseline_checksum=baseline,
        current_checksum=current,
        changes=(),
        directly_changed_assets=(),
        downstream_impacted_assets=(),
    )

    return evaluate_metadata_governance(metadata_diff)


@pytest.fixture
def governance_store():
    url = os.environ.get(
        "LOTUSLEARN_TEST_DATABASE_URL", ""
    ).strip()

    if not url:
        pytest.skip(
            "Requires LOTUSLEARN_TEST_DATABASE_URL"
        )

    # Never initialize or modify a non-test database.
    with psycopg.connect(
        url, autocommit=True, row_factory=dict_row
    ) as conn:
        database_name = conn.execute(
            "SELECT current_database() AS database_name"
        ).fetchone()["database_name"]

        if database_name != "lotuslearn_test":
            pytest.fail(
                "Refusing access outside lotuslearn_test"
            )

        apply_postgres_migrations(conn)

    created_ids = []
    store = PostgresMetadataGovernanceHistoryStore(url)

    yield store, created_ids

    # Delete only decisions created by this test.
    with psycopg.connect(url) as conn:
        database_name = conn.execute(
            "SELECT current_database()"
        ).fetchone()[0]

        if database_name != "lotuslearn_test":
            pytest.fail(
                "Refusing cleanup outside lotuslearn_test"
            )

        for decision_id in created_ids:
            conn.execute(
                """
                DELETE FROM metadata_governance_decision_history
                WHERE decision_id = %s
                """,
                (decision_id,),
            )


def test_invalid_decision_rejected_before_database_io():
    store = PostgresMetadataGovernanceHistoryStore(
        "postgresql://localhost:1/lotuslearn_test"
    )

    invalid = replace(
        _make_decision(),
        change_count=1,
    )

    with pytest.raises(
        MetadataGovernanceHistoryIntegrityError
    ):
        store.record_decision(invalid)


def test_insert_and_exact_replay(governance_store):
    store, created_ids = governance_store
    decision = _make_decision()
    created_ids.append(decision.decision_id)

    first = store.record_decision(decision)

    assert (
        first.outcome
        == MetadataGovernanceHistoryWriteOutcome.INSERTED
    )

    replay = store.record_decision(decision)

    assert (
        replay.outcome
        == MetadataGovernanceHistoryWriteOutcome.EXISTING
    )

    assert store.get_decision(
        decision.decision_id
    ) == decision

    assert store.get_policy_decision(
        comparison_id=decision.comparison_id,
        policy_id=decision.policy_id,
        policy_version=decision.policy_version,
    ) == decision


def test_conflicting_replay_preserves_original(governance_store):
    store, created_ids = governance_store
    decision = _make_decision()
    created_ids.append(decision.decision_id)

    store.record_decision(decision)

    conflict = replace(
        decision,
        directly_changed_assets=(
            _sha256("synthetic-changed-asset"),
        ),
    )

    with pytest.raises(
        MetadataGovernanceHistoryConflictError
    ):
        store.record_decision(conflict)

    assert store.get_decision(
        decision.decision_id
    ) == decision


def test_concurrent_exact_replay_creates_one_row(governance_store):
    """Concurrent identical writes must resolve to one durable record."""
    store, created_ids = governance_store
    decision = _make_decision()
    created_ids.append(decision.decision_id)

    worker_count = 5
    barrier = Barrier(worker_count)

    def write_once():
        barrier.wait(timeout=15)
        return store.record_decision(decision).outcome

    with ThreadPoolExecutor(max_workers=worker_count) as executor:
        futures = [
            executor.submit(write_once)
            for _ in range(worker_count)
        ]
        outcomes = [
            future.result(timeout=30)
            for future in futures
        ]

    assert outcomes.count(
        MetadataGovernanceHistoryWriteOutcome.INSERTED
    ) == 1

    assert outcomes.count(
        MetadataGovernanceHistoryWriteOutcome.EXISTING
    ) == worker_count - 1

    with psycopg.connect(
        os.environ["LOTUSLEARN_TEST_DATABASE_URL"],
        row_factory=dict_row,
    ) as conn:
        row = conn.execute(
            """
            SELECT COUNT(*) AS row_count
            FROM metadata_governance_decision_history
            WHERE comparison_id = %s
              AND policy_id = %s
              AND policy_version = %s
            """,
            (
                decision.comparison_id,
                decision.policy_id,
                decision.policy_version,
            ),
        ).fetchone()

    assert row["row_count"] == 1
    assert store.get_decision(decision.decision_id) == decision

def test_exact_replay_preserves_recorded_at_and_row_version(governance_store):
    """Exact replay must not update the persisted row."""
    store, created_ids = governance_store
    decision = _make_decision()
    created_ids.append(decision.decision_id)

    first = store.record_decision(decision)
    assert first.outcome == MetadataGovernanceHistoryWriteOutcome.INSERTED

    def read_row_state():
        with psycopg.connect(
            os.environ["LOTUSLEARN_TEST_DATABASE_URL"],
            row_factory=dict_row,
        ) as conn:
            return conn.execute(
                """
                SELECT recorded_at, xmin::text AS row_version
                FROM metadata_governance_decision_history
                WHERE decision_id = %s
                """,
                (decision.decision_id,),
            ).fetchone()

    before = read_row_state()
    assert before is not None

    replay = store.record_decision(decision)
    after = read_row_state()

    assert replay.outcome == MetadataGovernanceHistoryWriteOutcome.EXISTING
    assert after == before


def test_post_insert_failure_rolls_back(governance_store, monkeypatch):
    """A failure after INSERT must roll back the entire transaction."""
    store, created_ids = governance_store
    decision = _make_decision()
    created_ids.append(decision.decision_id)

    original_insert = store._insert_decision

    def fail_after_insert(conn, candidate):
        outcome = original_insert(conn, candidate)
        assert outcome == MetadataGovernanceHistoryWriteOutcome.INSERTED
        raise RuntimeError("injected post-insert failure")

    monkeypatch.setattr(store, "_insert_decision", fail_after_insert)

    with pytest.raises(
        RuntimeError,
        match="injected post-insert failure",
    ):
        store.record_decision(decision)

    assert store.get_decision(decision.decision_id) is None

    monkeypatch.setattr(store, "_insert_decision", original_insert)

    recovered = store.record_decision(decision)
    assert recovered.outcome == MetadataGovernanceHistoryWriteOutcome.INSERTED
    assert store.get_decision(decision.decision_id) == decision


def test_corrupted_summary_is_rejected_on_read(governance_store):
    """Reading a tampered summary must raise an integrity error."""
    store, created_ids = governance_store
    decision = _make_decision()
    created_ids.append(decision.decision_id)

    result = store.record_decision(decision)
    assert result.outcome == MetadataGovernanceHistoryWriteOutcome.INSERTED

    with psycopg.connect(
        os.environ["LOTUSLEARN_TEST_DATABASE_URL"],
        row_factory=dict_row,
    ) as conn:
        database = conn.execute(
            "SELECT current_database() AS name"
        ).fetchone()["name"]

        assert database == "lotuslearn_test"

        updated = conn.execute(
            """
            UPDATE metadata_governance_decision_history
            SET directly_changed_asset_count =
                directly_changed_asset_count + 1
            WHERE decision_id = %s
            RETURNING decision_id
            """,
            (decision.decision_id,),
        ).fetchone()

        assert updated is not None

    with pytest.raises(MetadataGovernanceHistoryIntegrityError):
        store.get_decision(decision.decision_id)

@pytest.mark.parametrize("iteration", range(5))
def test_concurrent_conflicting_writes_preserve_one_decision(
    governance_store, iteration
):
    """Concurrent conflicting writes must preserve one durable winner."""
    store, created_ids = governance_store

    original = _make_decision()
    conflicting = replace(
        original,
        directly_changed_assets=(
            _sha256("synthetic-changed-asset"),
        ),
    )

    created_ids.append(original.decision_id)

    barrier = Barrier(2)

    def write(candidate):
        barrier.wait(timeout=15)
        try:
            return store.record_decision(candidate).outcome
        except MetadataGovernanceHistoryConflictError:
            return "CONFLICT"

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [
            executor.submit(write, candidate)
            for candidate in (original, conflicting)
        ]

        outcomes = [
            future.result(timeout=30)
            for future in futures
        ]

    assert outcomes.count(
        MetadataGovernanceHistoryWriteOutcome.INSERTED
    ) == 1

    assert outcomes.count("CONFLICT") == 1

    persisted = store.get_policy_decision(
        comparison_id=original.comparison_id,
        policy_id=original.policy_id,
        policy_version=original.policy_version,
    )

    assert persisted in (original, conflicting)

    with psycopg.connect(
        os.environ["LOTUSLEARN_TEST_DATABASE_URL"],
        row_factory=dict_row,
    ) as conn:
        row = conn.execute(
            """
            SELECT COUNT(*) AS row_count
            FROM metadata_governance_decision_history
            WHERE comparison_id = %s
              AND policy_id = %s
              AND policy_version = %s
            """,
            (
                original.comparison_id,
                original.policy_id,
                original.policy_version,
            ),
        ).fetchone()

    assert row["row_count"] == 1


def test_missing_conflict_row_fails_closed():
    """A suppressed unique conflict without a matching row must fail closed."""
    from unittest.mock import Mock

    store = PostgresMetadataGovernanceHistoryStore(
        "postgresql://localhost:1/lotuslearn_test"
    )

    conn = Mock()
    conn.execute.return_value.fetchone.return_value = None

    with pytest.raises(
        MetadataGovernanceHistoryIntegrityError,
        match="could not be read",
    ):
        store._insert_decision(conn, _make_decision())

    assert conn.execute.call_count == 2
