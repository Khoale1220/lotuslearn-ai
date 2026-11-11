"""Pure runtime contract tests: no PostgreSQL service required."""

from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock
from uuid import uuid4

import pytest

from lotuslearn_pipeline import execution_runtime as runtime
from lotuslearn_pipeline.execution_ledger import (
    ExecutionConflictError,
    ExecutionIntegrityError,
    ExecutionStatus,
    ExecutionWriteOutcome,
)
from lotuslearn_pipeline.models import IngestionOutcome, IngestionResult


class LedgerStub:
    def __init__(self, outcome=ExecutionWriteOutcome.INSERTED):
        self.outcome = outcome
        self.started = []
        self.heartbeats = []
        self.finished = []

    def start_execution(self, **kwargs):
        self.started.append(kwargs)
        return SimpleNamespace(outcome=self.outcome)

    def heartbeat(self, execution_id):
        self.heartbeats.append(execution_id)

    def finish_execution(self, **kwargs):
        self.finished.append(kwargs)
        return SimpleNamespace(
            outcome=ExecutionWriteOutcome.TRANSITIONED
        )


def invoke(monkeypatch, ledger, events, results=None, failure=None, **kwargs):
    monkeypatch.setattr(
        runtime, "PostgresPipelineExecutionLedger", lambda _: ledger
    )

    def do_load(items):
        if failure is not None:
            raise failure
        return results if results is not None else []

    db = SimpleNamespace(load_events=Mock(side_effect=do_load))
    loader = Mock(return_value=events)

    if kwargs.pop("read_fails", False):
        loader.side_effect = OSError("No file")

    identity = dict(
        batch_id=uuid4(),
        execution_id=uuid4(),
        attempt_number=1,
    )

    def result():
        return runtime.run_tracked_batch(
            db=db,
            database_url="postgresql://example/test",
            input_path=Path("example.ndjson"),
            load_events=loader,
            **identity,
            **kwargs,
        )

    return result, ledger, db, loader, identity


def test_success_counts_logical_attempts_and_retries(monkeypatch):
    ledger = LedgerStub()

    results = [
        IngestionResult(
            "e1", IngestionOutcome.ACCEPTED, retry_attempts=3
        ),
        IngestionResult("e2", IngestionOutcome.DUPLICATE),
    ]

    run, ledger, db, loader, ids = invoke(
        monkeypatch,
        ledger,
        [{"event_id": "e1"}, {"event_id": "e2"}],
        results,
    )

    response = run()

    assert response.report.total_attempted == 2
    assert response.report.internal_retry_count == 2
    assert response.report.is_balanced
    assert ledger.started == [ids]
    assert ledger.heartbeats == [ids["execution_id"]] * 2
    assert ledger.finished[0]["status"] == ExecutionStatus.SUCCEEDED
    assert ledger.finished[0]["report"].batch_id == str(ids["batch_id"])
    db.load_events.assert_called_once()


def test_existing_execution_never_reingests(monkeypatch):
    run, ledger, db, loader, _ = invoke(
        monkeypatch,
        LedgerStub(ExecutionWriteOutcome.EXISTING),
        [{}],
    )

    with pytest.raises(ExecutionConflictError):
        run()

    loader.assert_not_called()
    db.load_events.assert_not_called()
    assert ledger.finished == []


@pytest.mark.parametrize(
    ("phase", "expected"),
    [
        ("read", "INPUT_READ_FAILED"),
        ("ingest", "INGESTION_FAILED"),
        ("reconcile", "RECONCILIATION_FAILED"),
    ],
)
def test_failure_records_fixed_safe_error_code(
    monkeypatch, phase, expected
):
    run, ledger, *_ = invoke(
        monkeypatch,
        LedgerStub(),
        [{"event_id": "e1"}],
        results=[],
        failure=(
            RuntimeError("Secret not safe to persist")
            if phase == "ingest"
            else None
        ),
        read_fails=phase == "read",
    )

    with pytest.raises(
        (OSError, RuntimeError, ExecutionIntegrityError)
    ):
        run()

    assert ledger.finished[0]["status"] == ExecutionStatus.FAILED
    assert ledger.finished[0]["error_code"] == expected
    assert "report" not in ledger.finished[0]


@pytest.mark.parametrize("fail_on_rejection", [False, True])
def test_rejection_policy(monkeypatch, fail_on_rejection):
    run, ledger, *_ = invoke(
        monkeypatch,
        LedgerStub(),
        [{}],
        [IngestionResult("e1", IngestionOutcome.REJECTED)],
        fail_on_rejection=fail_on_rejection,
    )

    run()

    expected = (
        ExecutionStatus.FAILED
        if fail_on_rejection
        else ExecutionStatus.SUCCEEDED
    )

    assert ledger.finished[0]["status"] == expected
