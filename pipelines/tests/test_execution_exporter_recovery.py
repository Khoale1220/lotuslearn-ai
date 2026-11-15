"""Exporter fail-closed behavior and recovery without stale responses."""

from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from threading import Event, Lock, Thread
from urllib.error import HTTPError
from urllib.request import urlopen

import pytest

from lotuslearn_pipeline.execution_exporter import ExporterServer


@contextmanager
def serve(collector):
    server = ExporterServer(("127.0.0.1", 0), collector)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}/metrics"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)


def fetch(url):
    with urlopen(url, timeout=6) as response:
        return response.status, response.read()


def test_fresh_failure_recovery_never_replays_stale_metrics():
    outcomes = iter(
        [
            b"sample_before 1\n",
            RuntimeError("PRIVATE_DB_PASSWORD"),
            b"sample_after 2\n",
        ]
    )

    def collect():
        outcome = next(outcomes)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    with serve(collect) as url:
        assert fetch(url) == (200, b"sample_before 1\n")
        with pytest.raises(HTTPError) as failure:
            fetch(url)
        assert failure.value.code == 503
        error_text = failure.value.read()
        assert b"PRIVATE_DB_PASSWORD" not in error_text
        assert b"sample_before" not in error_text
        assert fetch(url) == (200, b"sample_after 2\n")


def test_concurrency_capacity_releases_after_overload():
    release = Event()
    two_inside = Event()
    lock = Lock()
    entered = 0

    def collect():
        nonlocal entered
        with lock:
            entered += 1
            if entered == 2:
                two_inside.set()
        if not release.wait(timeout=5):
            raise TimeoutError("Collector test exceeded deadline")
        return b"recovered 1\n"

    with serve(collect) as url:
        with ThreadPoolExecutor(max_workers=2) as workers:
            futures = [workers.submit(fetch, url) for _ in range(2)]
            try:
                assert two_inside.wait(timeout=3)
                with pytest.raises(HTTPError) as overloaded:
                    fetch(url)
                assert overloaded.value.code == 503
                assert overloaded.value.read() == b"temporarily unavailable\n"
            finally:
                release.set()
            assert [future.result(timeout=5)[0] for future in futures] == [
                200,
                200,
            ]
        assert fetch(url) == (200, b"recovered 1\n")
