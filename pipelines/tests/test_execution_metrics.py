"""Prometheus contract and CLI regression tests."""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from lotuslearn_pipeline import execution_health_cli as cli
from lotuslearn_pipeline.execution_health import (
    ExecutionHealthState,
    RunningExecutionHealth,
)
from lotuslearn_pipeline.execution_metrics import render_prometheus

URL = "postgresql://demo:PRIVATE_PASSWORD@localhost/test"


def _sample(
    state: ExecutionHealthState,
    seconds: int,
) -> RunningExecutionHealth:
    now = datetime(2026, 11, 11, tzinfo=timezone.utc)

    return RunningExecutionHealth(
        execution_id=uuid4(),
        batch_id=uuid4(),
        attempt_number=1,
        started_at=now - timedelta(hours=4),
        heartbeat_at=now - timedelta(seconds=seconds),
        observed_at=now,
        heartbeat_age=timedelta(seconds=seconds),
        health=state,
    )


@pytest.mark.parametrize(
    ("state", "seconds", "expected_exit", "expected_status"),
    [
        (ExecutionHealthState.RECENT, 30, 0, "OK"),
        (ExecutionHealthState.SUSPECTED_STALE, 1800, 1, "ALERT"),
        (ExecutionHealthState.FUTURE_HEARTBEAT, -30, 1, "ALERT"),
    ],
)
def test_prometheus_cli_states(
    monkeypatch,
    capsys,
    state,
    seconds,
    expected_exit,
    expected_status,
):
    row = _sample(state, seconds)

    monkeypatch.setattr(
        cli,
        "list_running_execution_health",
        lambda *args, **kwargs: [row],
    )

    rc = cli.main(
        [
            "--db",
            URL,
            "--stale-after-seconds",
            "900",
            "--format",
            "prometheus",
        ]
    )

    output = capsys.readouterr().out

    assert rc == expected_exit
    assert "# TYPE lotuslearn_execution_health_state gauge" in output
    assert f'lotuslearn_execution_health_state{{state="{state.value}"}} 1' in output
    assert (f'lotuslearn_execution_health_check_status{{status="{expected_status}"}} 1') in output
    assert str(row.execution_id) not in output
    assert str(row.batch_id) not in output
    assert "PRIVATE_PASSWORD" not in output
    assert output.endswith("\n")


def test_prometheus_empty_sample(monkeypatch, capsys):
    monkeypatch.setattr(
        cli,
        "list_running_execution_health",
        lambda *args, **kwargs: [],
    )

    rc = cli.main(
        [
            "--db",
            URL,
            "--stale-after-seconds",
            "900",
            "--format",
            "prometheus",
        ]
    )

    output = capsys.readouterr().out

    assert rc == 0
    assert "lotuslearn_execution_health_running_sampled 0" in output
    assert 'lotuslearn_execution_health_check_status{status="OK"} 1' in output


def test_prometheus_sample_cap_fails_closed(monkeypatch, capsys):
    monkeypatch.setattr(
        cli,
        "list_running_execution_health",
        lambda *args, **kwargs: [_sample(ExecutionHealthState.RECENT, 30)],
    )

    rc = cli.main(
        [
            "--db",
            URL,
            "--stale-after-seconds",
            "900",
            "--limit",
            "1",
            "--format",
            "prometheus",
        ]
    )

    output = capsys.readouterr().out

    assert rc == 2
    assert "lotuslearn_execution_health_sample_limit_reached 1" in output
    assert 'lotuslearn_execution_health_check_status{status="INCOMPLETE_SAMPLE"} 1' in output
    assert 'lotuslearn_execution_health_check_status{status="OK"} 0' in output


def test_prometheus_failed_query_does_not_leak(monkeypatch, capsys):
    def fail_query(*args, **kwargs):
        raise RuntimeError("PRIVATE_DATABASE_PASSWORD")

    monkeypatch.setattr(
        cli,
        "list_running_execution_health",
        fail_query,
    )

    rc = cli.main(
        [
            "--db",
            URL,
            "--stale-after-seconds",
            "900",
            "--format",
            "prometheus",
        ]
    )

    captured = capsys.readouterr()

    assert rc == 2
    assert not captured.out
    assert "PRIVATE_DATABASE_PASSWORD" not in captured.err
    assert "Execution health check failed" in captured.err


def test_prometheus_rejects_inconsistent_report():
    report, _ = cli._build_report(
        [],
        limit=100,
        stale_after_seconds=900,
    )

    report["running_sampled"] = 1

    with pytest.raises(
        ValueError,
        match="Inconsistent health counts",
    ):
        render_prometheus(report)
