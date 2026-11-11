"""CLI contracts for opt-in PostgreSQL execution tracking (OPS-01B)."""

from types import SimpleNamespace
from unittest.mock import Mock
from uuid import UUID

import pytest

from lotuslearn_pipeline import cli, execution_runtime, storage
from lotuslearn_pipeline.execution_ledger import ExecutionConflictError
from lotuslearn_pipeline.models import IngestionOutcome, IngestionResult
from lotuslearn_pipeline.postgres import PostgresAnalyticalDatabase
from lotuslearn_pipeline.reconciliation import reconcile_batch

BATCH_ID = "00000000-0000-4000-8000-000000000001"
EXECUTION_ID = "00000000-0000-4000-8000-000000000002"
EXPLICIT_URL = "postgresql://example.invalid/explicit"
ENV_URL = "postgresql://example.invalid/environment"


def tracked_args(*, url=None, reject=False):
    args = [
        "ingest",
        "--track-execution",
        "--input",
        "unused.ndjson",
        "--batch-id",
        BATCH_ID,
        "--execution-id",
        EXECUTION_ID,
        "--attempt-number",
        "1",
    ]
    if url is not None:
        args.extend(["--db", url])
    if reject:
        args.append("--exit-on-rejection")
    return args


def fake_database():
    db = Mock()
    db.initialize_schema.return_value = []
    return db


def tracking_result(outcome=IngestionOutcome.ACCEPTED):
    results = [
        IngestionResult(
            event_id="event-1",
            outcome=outcome,
            rejection_reason=(
                "synthetic rejection"
                if outcome == IngestionOutcome.REJECTED
                else None
            ),
        )
    ]
    report = reconcile_batch(results, batch_id=BATCH_ID)
    return SimpleNamespace(results=results, report=report)


@pytest.mark.parametrize(
    ("explicit", "expected_url"),
    [(False, ENV_URL), (True, EXPLICIT_URL)],
)
def test_tracked_ingestion_routes_to_one_postgres_target(
    monkeypatch, explicit, expected_url
):
    monkeypatch.setenv("LOTUSLEARN_DATABASE_URL", ENV_URL)
    databases = []
    calls = []

    def factory(target):
        db = storage.get_database(target)
        assert isinstance(db, PostgresAnalyticalDatabase)
        db.initialize_schema = Mock(return_value=[])
        db.close = Mock()
        databases.append(db)
        return db

    def runner(**kwargs):
        calls.append(kwargs)
        return tracking_result()

    monkeypatch.setattr(cli, "get_database", factory)
    monkeypatch.setattr(execution_runtime, "run_tracked_batch", runner)
    monkeypatch.setattr(
        cli,
        "load_events_from_file",
        Mock(side_effect=AssertionError("CLI must not reload tracked input")),
    )

    rc = cli.main(tracked_args(url=EXPLICIT_URL if explicit else None))

    assert rc == 0
    assert len(databases) == len(calls) == 1
    assert databases[0].connection_string == expected_url
    databases[0].initialize_schema.assert_called_once_with()
    databases[0].close.assert_called_once_with()
    assert calls[0]["database_url"] == expected_url
    assert calls[0]["db"] is databases[0]
    assert calls[0]["batch_id"] == UUID(BATCH_ID)
    assert calls[0]["execution_id"] == UUID(EXECUTION_ID)
    assert calls[0]["attempt_number"] == 1
    assert calls[0]["fail_on_rejection"] is False


def test_legacy_ingest_keeps_original_load_path(monkeypatch):
    db = fake_database()
    db.load_events.return_value = tracking_result().results
    events = [{"event_id": "event-1"}]

    monkeypatch.setattr(cli, "get_database", lambda _: db)
    monkeypatch.setattr(cli, "load_events_from_file", lambda _: events)
    monkeypatch.setattr(
        execution_runtime,
        "run_tracked_batch",
        Mock(side_effect=AssertionError("Unexpected tracked invocation")),
    )

    rc = cli.main(["ingest", "--input", "unused.ndjson", "--db", ":memory:"])

    assert rc == 0
    db.initialize_schema.assert_called_once_with()
    db.load_events.assert_called_once_with(events)
    db.close.assert_called_once_with()


@pytest.mark.parametrize(
    "fail_on_rejection, expected",
    [(False, 0), (True, 1)],
)
def test_rejection_flag_is_forwarded_and_preserves_exit_contract(
    monkeypatch, fail_on_rejection, expected
):
    db = fake_database()
    calls = []
    monkeypatch.setattr(cli, "get_database", lambda _: db)

    def runner(**kwargs):
        calls.append(kwargs)
        return tracking_result(IngestionOutcome.REJECTED)

    monkeypatch.setattr(execution_runtime, "run_tracked_batch", runner)

    rc = cli.main(tracked_args(url=EXPLICIT_URL, reject=fail_on_rejection))

    assert rc == expected
    assert len(calls) == 1
    assert calls[0]["fail_on_rejection"] is fail_on_rejection
    db.close.assert_called_once_with()


def test_duplicate_execution_aborts_without_direct_ingestion(
    monkeypatch, capsys
):
    db = fake_database()
    monkeypatch.setattr(cli, "get_database", lambda _: db)
    monkeypatch.setattr(
        execution_runtime,
        "run_tracked_batch",
        Mock(side_effect=ExecutionConflictError("existing attempt")),
    )
    monkeypatch.setattr(
        cli,
        "load_events_from_file",
        Mock(side_effect=AssertionError("Input must not be reloaded")),
    )

    rc = cli.main(tracked_args(url=EXPLICIT_URL))

    assert rc == 1
    assert "ingestion not restarted" in capsys.readouterr().err
    db.load_events.assert_not_called()
    db.close.assert_called_once_with()


def test_unexpected_runtime_error_is_not_silenced(monkeypatch):
    db = fake_database()
    monkeypatch.setattr(cli, "get_database", lambda _: db)
    monkeypatch.setattr(
        execution_runtime,
        "run_tracked_batch",
        Mock(side_effect=RuntimeError("synthetic runtime error")),
    )

    with pytest.raises(RuntimeError, match="synthetic runtime error"):
        cli.main(tracked_args(url=EXPLICIT_URL))

    db.close.assert_called_once_with()


@pytest.mark.parametrize(
    "args",
    [
        ["ingest", "--input", "unused.ndjson", "--batch-id", BATCH_ID],
        ["ingest", "--track-execution", "--db", EXPLICIT_URL],
        tracked_args(),
        [
            "ingest", "--track-execution", "--input", "unused.ndjson",
            "--db", EXPLICIT_URL, "--batch-id", BATCH_ID,
        ],
        [
            "ingest", "--track-execution", "--input", "unused.ndjson",
            "--db", EXPLICIT_URL, "--batch-id", "invalid",
            "--execution-id", EXECUTION_ID, "--attempt-number", "1",
        ],
        [
            "ingest", "--track-execution", "--input", "unused.ndjson",
            "--db", EXPLICIT_URL, "--batch-id", BATCH_ID,
            "--execution-id", EXECUTION_ID, "--attempt-number", "0",
        ],
        [
            "ingest", "--track-execution", "--input", "unused.ndjson",
            "--db", "sqlite:///tmp/test.db", "--batch-id", BATCH_ID,
            "--execution-id", EXECUTION_ID, "--attempt-number", "1",
        ],
        ["verify", "--track-execution", "--input", "unused.ndjson"],
    ],
)
def test_invalid_tracking_arguments_fail_before_database_access(
    monkeypatch, args
):
    monkeypatch.delenv("LOTUSLEARN_DATABASE_URL", raising=False)
    monkeypatch.setattr(
        cli,
        "get_database",
        Mock(side_effect=AssertionError("Database must not be constructed")),
    )

    with pytest.raises(SystemExit) as error:
        cli.main(args)

    assert error.value.code == 2
