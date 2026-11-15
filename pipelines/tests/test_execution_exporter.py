"""HTTP exporter safety and metrics contract tests."""

from threading import Thread
from urllib.error import HTTPError
from urllib.request import urlopen

import pytest

from lotuslearn_pipeline import execution_exporter as exporter


@pytest.fixture
def start_server():
    servers = []

    def start(collector):
        server = exporter.ExporterServer(
            ("127.0.0.1", 0),
            collector,
        )
        thread = Thread(
            target=server.serve_forever,
            kwargs={"poll_interval": 0.01},
            daemon=True,
        )
        thread.start()
        servers.append((server, thread))

        return f"http://127.0.0.1:{server.server_port}"

    yield start

    for server, thread in servers:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def test_existing_report_is_reused(monkeypatch):
    calls = []

    def query(url, **kwargs):
        calls.append((url, kwargs))
        return []

    monkeypatch.setattr(
        exporter,
        "list_running_execution_health",
        query,
    )

    output = exporter.collect_metrics(
        "postgresql://localhost/test",
        stale_after_seconds=900,
        limit=100,
    ).decode("utf-8")

    assert len(calls) == 1
    assert calls[0][1]["limit"] == 100
    assert calls[0][1]["stale_after"] is not None
    assert "lotuslearn_execution_health_running_sampled 0" in output
    assert 'lotuslearn_execution_health_check_status{status="OK"} 1' in output
    assert output.endswith("\n")


def test_http_metrics_success(start_server):
    payload = b'lotuslearn_execution_health_check_status{status="ALERT"} 1\n'

    address = start_server(lambda: payload)

    with urlopen(address + "/metrics", timeout=3) as response:
        assert response.status == 200
        assert response.read() == payload
        assert "text/plain" in response.headers["Content-Type"]
        assert response.headers["Cache-Control"] == "no-store"


def test_failed_scrape_does_not_expose_secrets(start_server):
    def broken_query():
        raise RuntimeError("PRIVATE_DATABASE_PASSWORD")

    address = start_server(broken_query)

    with pytest.raises(HTTPError) as error:
        urlopen(address + "/metrics", timeout=3)

    assert error.value.code == 503
    assert b"PRIVATE_DATABASE_PASSWORD" not in error.value.read()


def test_liveness_does_not_query_database(start_server):
    def broken_query():
        raise AssertionError("Database should not be queried")

    address = start_server(broken_query)

    with urlopen(address + "/-/healthy", timeout=3) as response:
        assert response.status == 200
        assert response.read() == b"ok\n"


def test_unknown_path_is_rejected(start_server):
    address = start_server(lambda: b"metrics\n")

    with pytest.raises(HTTPError) as error:
        urlopen(address + "/private", timeout=3)

    assert error.value.code == 404


def test_database_url_is_required(monkeypatch):
    monkeypatch.delenv("LOTUSLEARN_DATABASE_URL", raising=False)

    with pytest.raises(SystemExit) as error:
        exporter.main([])

    assert error.value.code == 2
