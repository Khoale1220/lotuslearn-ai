"""Contract tests for the read-only execution health CLI."""

import json
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from lotuslearn_pipeline import execution_health_cli as cli
from lotuslearn_pipeline.execution_health import (
    ExecutionHealthState,
    RunningExecutionHealth,
)

URL = "postgresql://localhost/lotuslearn_test"


def _sample(
    state: ExecutionHealthState,
    age_seconds: int,
) -> RunningExecutionHealth:
    now = datetime(2026, 11, 11, tzinfo=timezone.utc)

    return RunningExecutionHealth(
        execution_id=uuid4(),
        batch_id=uuid4(),
        attempt_number=1,
        started_at=now - timedelta(hours=4),
        heartbeat_at=now - timedelta(seconds=age_seconds),
        observed_at=now,
        heartbeat_age=timedelta(seconds=age_seconds),
        health=state,
    )


def test_empty_running_set_is_healthy(monkeypatch, capsys):
    monkeypatch.setattr(
        cli,
        "list_running_execution_health",
        lambda *args, **kwargs: [],
    )

    rc = cli.main([
        "--db", URL,
        "--stale-after-seconds", "900",
    ])

    report = json.loads(capsys.readouterr().out)

    assert rc == 0
    assert report["status"] == "OK"
    assert report["running_sampled"] == 0
    assert report["sample_limit_reached"] is False


@pytest.mark.parametrize(
    ("state", "age", "expected_code", "expected_status"),
    [
        (ExecutionHealthState.RECENT, 30, 0, "OK"),
        (
            ExecutionHealthState.SUSPECTED_STALE,
            1800,
            1,
            "ALERT",
        ),
        (
            ExecutionHealthState.FUTURE_HEARTBEAT,
            -30,
            1,
            "ALERT",
        ),
    ],
)
def test_health_classification(
    monkeypatch,
    capsys,
    state,
    age,
    expected_code,
    expected_status,
):
    sample = _sample(state, age)

    monkeypatch.setattr(
        cli,
        "list_running_execution_health",
        lambda *args, **kwargs: [sample],
    )

    rc = cli.main([
        "--db", URL,
        "--stale-after-seconds", "900",
    ])

    report = json.loads(capsys.readouterr().out)

    assert rc == expected_code
    assert report["status"] == expected_status
    assert report["counts"][state.value] == 1
    assert report["executions"][0]["health"] == state.value
    assert report["executions"][0]["heartbeat_age_seconds"] == age


def test_query_parameters_are_forwarded(monkeypatch, capsys):
    calls = []

    def fake_monitor(url, *, stale_after, limit):
        calls.append((url, stale_after, limit))
        return []

    monkeypatch.setattr(
        cli,
        "list_running_execution_health",
        fake_monitor,
    )

    rc = cli.main([
        "--db", URL,
        "--stale-after-seconds", "120",
        "--limit", "25",
    ])

    capsys.readouterr()

    assert rc == 0
    assert calls == [(URL, timedelta(seconds=120), 25)]


def test_environment_database_url(monkeypatch, capsys):
    monkeypatch.setenv("LOTUSLEARN_DATABASE_URL", URL)

    observed = []

    def fake_monitor(url, *, stale_after, limit):
        observed.append(url)
        return []

    monkeypatch.setattr(
        cli,
        "list_running_execution_health",
        fake_monitor,
    )

    rc = cli.main(["--stale-after-seconds", "900"])

    capsys.readouterr()

    assert rc == 0
    assert observed == [URL]


def test_limit_saturation_fails_closed(monkeypatch, capsys):
    sample = _sample(ExecutionHealthState.RECENT, 20)

    monkeypatch.setattr(
        cli,
        "list_running_execution_health",
        lambda *args, **kwargs: [sample],
    )

    rc = cli.main([
        "--db", URL,
        "--stale-after-seconds", "900",
        "--limit", "1",
    ])

    report = json.loads(capsys.readouterr().out)

    assert rc == 2
    assert report["status"] == "INCOMPLETE_SAMPLE"
    assert report["sample_limit_reached"] is True


@pytest.mark.parametrize(
    ("argument", "value"),
    [
        ("--stale-after-seconds", "0"),
        ("--stale-after-seconds", "-5"),
        ("--stale-after-seconds", "invalid"),
        ("--limit", "0"),
        ("--limit", "1001"),
    ],
)
def test_invalid_numeric_options_fail(argument, value):
    args = [
        "--db", URL,
        "--stale-after-seconds", "900",
        argument, value,
    ]

    with pytest.raises(SystemExit) as error:
        cli.main(args)

    assert error.value.code == 2


def test_non_postgres_database_rejected():
    with pytest.raises(SystemExit) as error:
        cli.main([
            "--db", "sqlite://local",
            "--stale-after-seconds", "900",
        ])

    assert error.value.code == 2


def test_missing_database_url(monkeypatch):
    monkeypatch.delenv(
        "LOTUSLEARN_DATABASE_URL",
        raising=False,
    )

    with pytest.raises(SystemExit) as error:
        cli.main(["--stale-after-seconds", "900"])

    assert error.value.code == 2


def test_database_error_does_not_leak_secrets(
    monkeypatch,
    capsys,
):
    secret = "PRIVATE_DATABASE_PASSWORD"

    def failing_monitor(*args, **kwargs):
        raise RuntimeError(f"Connection failure: {secret}")

    monkeypatch.setattr(
        cli,
        "list_running_execution_health",
        failing_monitor,
    )

    rc = cli.main([
        "--db", URL,
        "--stale-after-seconds", "900",
    ])

    output = capsys.readouterr()

    assert rc == 2
    assert secret not in output.out
    assert secret not in output.err
    assert "Execution health check failed" in output.err


def test_text_output(monkeypatch, capsys):
    sample = _sample(ExecutionHealthState.RECENT, 30)

    monkeypatch.setattr(
        cli,
        "list_running_execution_health",
        lambda *args, **kwargs: [sample],
    )

    rc = cli.main([
        "--db", URL,
        "--stale-after-seconds", "900",
        "--format", "text",
    ])

    output = capsys.readouterr().out

    assert rc == 0
    assert "Status: OK" in output
    assert "RECENT: 1" in output
    assert str(sample.execution_id) in output
