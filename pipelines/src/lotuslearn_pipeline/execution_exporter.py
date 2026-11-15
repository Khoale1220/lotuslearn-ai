"""Bounded, read-only Prometheus execution-health HTTP exporter."""

from __future__ import annotations

import argparse
import os
from datetime import timedelta
from functools import partial
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import BoundedSemaphore
from typing import Callable, Sequence

from lotuslearn_pipeline.execution_health import list_running_execution_health
from lotuslearn_pipeline.execution_health_cli import _build_report
from lotuslearn_pipeline.execution_metrics import render_prometheus

CONTENT_TYPE = "text/plain; version=0.0.4; charset=utf-8"


def collect_metrics(
    database_url: str,
    *,
    stale_after_seconds: int,
    limit: int,
) -> bytes:
    """Query fresh database state on every scrape."""
    rows = list_running_execution_health(
        database_url,
        stale_after=timedelta(seconds=stale_after_seconds),
        limit=limit,
    )

    report, _ = _build_report(
        rows,
        limit=limit,
        stale_after_seconds=stale_after_seconds,
    )

    return render_prometheus(report).encode("utf-8")


class ExporterHandler(BaseHTTPRequestHandler):
    """HTTP handler that never caches metrics or exposes query errors."""

    def log_message(self, format: str, *args: object) -> None:
        """Disable request logging to avoid leaking URL parameters."""

    def _respond(
        self,
        status: int,
        body: bytes,
        content_type: str = "text/plain; charset=utf-8",
    ) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path == "/-/healthy":
            self._respond(200, b"ok\n")
            return

        if self.path != "/metrics":
            self._respond(404, b"not found\n")
            return

        if not self.server.slots.acquire(blocking=False):
            self._respond(503, b"temporarily unavailable\n")
            return

        try:
            metrics = self.server.collector()
        except Exception:
            # No cached metrics and no database exception details.
            self._respond(503, b"metrics unavailable\n")
            return
        finally:
            self.server.slots.release()

        # ALERT and INCOMPLETE_SAMPLE are valid metric observations.
        self._respond(200, metrics, CONTENT_TYPE)


class ExporterServer(ThreadingHTTPServer):
    """HTTP server with bounded concurrent PostgreSQL collection."""

    daemon_threads = True

    def __init__(
        self,
        address: tuple[str, int],
        collector: Callable[[], bytes],
    ) -> None:
        self.collector = collector
        self.slots = BoundedSemaphore(value=2)
        super().__init__(address, ExporterHandler)


def _positive_int(value: str) -> int:
    try:
        number = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("Expected a positive integer") from exc

    if number <= 0:
        raise argparse.ArgumentTypeError("Expected a positive integer")

    return number


def _bounded_limit(value: str) -> int:
    number = _positive_int(value)
    if number > 1000:
        raise argparse.ArgumentTypeError("Limit cannot exceed 1000")
    return number


def _port(value: str) -> int:
    number = _positive_int(value)
    if number > 65535:
        raise argparse.ArgumentTypeError("Invalid TCP port")
    return number


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Read-only execution-health Prometheus exporter")

    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=_port, default=9108)
    parser.add_argument(
        "--stale-after-seconds",
        type=_positive_int,
        default=900,
    )
    parser.add_argument(
        "--limit",
        type=_bounded_limit,
        default=100,
    )

    args = parser.parse_args(argv)

    database_url = os.environ.get("LOTUSLEARN_DATABASE_URL", "").strip()

    if not database_url.startswith(("postgresql://", "postgres://")):
        parser.error("LOTUSLEARN_DATABASE_URL must be PostgreSQL")

    collector = partial(
        collect_metrics,
        database_url,
        stale_after_seconds=args.stale_after_seconds,
        limit=args.limit,
    )

    with ExporterServer(
        (args.host, args.port),
        collector,
    ) as server:
        try:
            server.serve_forever(poll_interval=0.5)
        except KeyboardInterrupt:
            pass

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
