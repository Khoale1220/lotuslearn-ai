"""Read-only health classification and connection contract tests."""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from lotuslearn_pipeline import execution_health as health
from lotuslearn_pipeline.execution_ledger import ExecutionIntegrityError


class FakeConnection:
    def __init__(self, rows):
        self.rows = rows
        self.calls = []

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def execute(self, sql, params=None):
        self.calls.append((sql, params))
        return self

    def fetchall(self):
        return self.rows


def _sample(*, age_seconds):
    now = datetime(2026, 11, 11, tzinfo=timezone.utc)
    return {
        "execution_id": uuid4(),
        "batch_id": uuid4(),
        "attempt_number": 1,
        "started_at": now - timedelta(minutes=30),
        "heartbeat_at": now - timedelta(seconds=age_seconds),
        "observed_at": now,
    }


@pytest.mark.parametrize(
    ("age_seconds", "expected"),
    [
        (899, health.ExecutionHealthState.RECENT),
        (900, health.ExecutionHealthState.RECENT),
        (901, health.ExecutionHealthState.SUSPECTED_STALE),
        (-30, health.ExecutionHealthState.FUTURE_HEARTBEAT),
    ],
)
def test_classification_uses_database_time_and_read_only_transaction(
    monkeypatch, age_seconds, expected
):
    conn = FakeConnection([_sample(age_seconds=age_seconds)])
    monkeypatch.setattr(health.psycopg, "connect", lambda *a, **kw: conn)

    result = health.list_running_execution_health(
        "postgresql://example/test",
        stale_after=timedelta(minutes=15),
    )

    assert len(result) == 1
    assert result[0].health is expected
    assert result[0].heartbeat_age == timedelta(seconds=age_seconds)
    assert conn.calls[0] == ("SET TRANSACTION READ ONLY", None)
    assert "WHERE status = 'RUNNING'" in conn.calls[1][0]
    assert conn.calls[1][1] == (100,)


@pytest.mark.parametrize(
    ("url", "threshold", "limit"),
    [
        ("sqlite://local", timedelta(minutes=1), 100),
        ("postgresql://example/test", timedelta(0), 100),
        ("postgresql://example/test", timedelta(minutes=1), 0),
        ("postgresql://example/test", timedelta(minutes=1), True),
        ("postgresql://example/test", timedelta(minutes=1), 1001),
    ],
)
def test_invalid_arguments_are_rejected_before_database_access(
    monkeypatch, url, threshold, limit
):
    def fail_connect(*args, **kwargs):
        raise AssertionError("Must not connect")

    monkeypatch.setattr(health.psycopg, "connect", fail_connect)

    with pytest.raises(ValueError):
        health.list_running_execution_health(
            url, stale_after=threshold, limit=limit
        )


def test_invalid_temporal_data_fails_closed(monkeypatch):
    row = _sample(age_seconds=1200)
    row["started_at"] = row["heartbeat_at"] + timedelta(seconds=1)

    conn = FakeConnection([row])
    monkeypatch.setattr(health.psycopg, "connect", lambda *a, **kw: conn)

    with pytest.raises(ExecutionIntegrityError):
        health.list_running_execution_health(
            "postgresql://example/test",
            stale_after=timedelta(minutes=15),
        )


def test_empty_running_set(monkeypatch):
    conn = FakeConnection([])
    monkeypatch.setattr(health.psycopg, "connect", lambda *a, **kw: conn)

    assert list(
        health.list_running_execution_health(
            "postgresql://example/test",
            stale_after=timedelta(minutes=1),
        )
    ) == []
