"""Isolated Alertmanager webhook firing/resolved smoke test; no production access."""

from __future__ import annotations

import json
import os
import subprocess
import tempfile
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path
from urllib.request import Request, urlopen
from uuid import uuid4

RECEIVER = """\
import json
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200 if self.path == "/health" else 404)
        self.end_headers()

    def do_POST(self):
        if self.path != "/notify":
            self.send_error(404)
            return
        size = int(self.headers.get("Content-Length", "0"))
        if not 0 < size <= 65536:
            self.send_error(413)
            return
        body = json.loads(self.rfile.read(size))
        (Path("/events") / f"{time.time_ns()}.json").write_text(json.dumps(body))
        self.send_response(200)
        self.end_headers()

    def log_message(self, *args):
        pass

ThreadingHTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
"""

CONFIG = """\
global:
  resolve_timeout: 30s
route:
  receiver: smoke-webhook
  group_by: [alertname]
  group_wait: 1s
  group_interval: 1s
  repeat_interval: 1m
receivers:
  - name: smoke-webhook
    webhook_configs:
      - url: http://webhook:8080/notify
        send_resolved: true
"""

COMPOSE = """\
services:
  webhook:
    image: python:3.12-alpine
    command: ["python", "/receiver.py"]
    volumes:
      - ./receiver.py:/receiver.py:ro
      - ./events:/events
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health', timeout=2).close()"]
      interval: 1s
      timeout: 3s
      retries: 15
  alertmanager:
    image: prom/alertmanager:v0.35.0
    command: ["--config.file=/etc/alertmanager/alertmanager.yml", "--storage.path=/tmp/amdata"]
    volumes:
      - ./alertmanager.yml:/etc/alertmanager/alertmanager.yml:ro
    ports:
      - target: 9093
        host_ip: 127.0.0.1
        protocol: tcp
    depends_on:
      webhook:
        condition: service_healthy
"""


def request(url: str, data: object | None = None) -> None:
    body = None if data is None else json.dumps(data).encode("utf-8")
    headers = {} if body is None else {"Content-Type": "application/json"}
    with urlopen(Request(url, data=body, headers=headers), timeout=5) as response:
        if response.status not in (200, 202):
            raise RuntimeError(f"Unexpected HTTP status {response.status}")


def wait_until(check, label: str, seconds: int = 45) -> None:
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        try:
            if check():
                print(f"PASS: {label}")
                return
        except (OSError, ValueError):
            pass
        time.sleep(0.25)
    raise RuntimeError(f"FAIL: timed out waiting for {label}")


def contains_status(events: Path, expected: str, alertname: str) -> bool:
    for path in events.glob("*.json"):
        try:
            event = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if event.get("status") != expected:
            continue
        if any(
            alert.get("labels", {}).get("alertname") == alertname
            for alert in event.get("alerts", [])
        ):
            return True
    return False


def main() -> None:
    project = f"ops01h{uuid4().hex[:10]}"
    with tempfile.TemporaryDirectory(prefix="ops01h-") as temp:
        root = Path(temp)
        events = root / "events"
        events.mkdir(mode=0o777)
        events.chmod(0o777)
        (root / "receiver.py").write_text(RECEIVER, encoding="utf-8")
        (root / "alertmanager.yml").write_text(CONFIG, encoding="utf-8")
        (root / "compose.yml").write_text(COMPOSE, encoding="utf-8")
        env = {**os.environ, "COMPOSE_PROJECT_NAME": project}
        cmd = ["docker", "compose", "-f", str(root / "compose.yml")]

        def docker(*args: str) -> subprocess.CompletedProcess[str]:
            return subprocess.run(
                [*cmd, *args],
                check=True,
                text=True,
                capture_output=True,
                env=env,
            )

        try:
            docker("config", "--quiet")
            docker("up", "-d", "--wait", "--wait-timeout", "90")
            raw_port = docker("port", "alertmanager", "9093").stdout.strip()
            host_port = int(raw_port.rsplit(":", 1)[-1])
            api = f"http://127.0.0.1:{host_port}"
            wait_until(
                lambda: request(api + "/-/ready") is None,
                "Alertmanager ready",
            )

            now = datetime.now(UTC)
            starts_at = (now - timedelta(seconds=20)).isoformat()
            alertname = "OPS01HIsolatedDeliveryTest"
            alert = {
                "labels": {
                    "alertname": alertname,
                    "severity": "warning",
                    "service": "lotuslearn",
                },
                "annotations": {
                    "summary": "Synthetic notification test only",
                },
                "startsAt": starts_at,
                "endsAt": (now + timedelta(minutes=5)).isoformat(),
            }

            request(api + "/api/v2/alerts", [alert])
            wait_until(
                lambda: contains_status(events, "firing", alertname),
                "FIRING delivered",
            )

            alert["endsAt"] = (datetime.now(UTC) - timedelta(seconds=1)).isoformat()
            request(api + "/api/v2/alerts", [alert])
            wait_until(
                lambda: contains_status(events, "resolved", alertname),
                "RESOLVED delivered",
            )
            print("=== OPS-01H ISOLATED DELIVERY SMOKE PASSED ===")

        except Exception:
            print("=== ISOLATED STACK LOGS ===")
            result = subprocess.run(
                [*cmd, "logs", "--tail", "35"],
                text=True,
                capture_output=True,
                env=env,
                check=False,
            )
            print(result.stdout[-5000:])
            print(result.stderr[-2000:])
            raise
        finally:
            subprocess.run(
                [*cmd, "down", "-v", "--remove-orphans"],
                text=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                env=env,
                check=False,
            )


if __name__ == "__main__":
    main()
