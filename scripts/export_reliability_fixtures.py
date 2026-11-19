from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PIPELINES_SRC = ROOT / "pipelines" / "src"
FIXTURE = ROOT / "pipelines/tests/fixtures/reliability_events.json"

sys.path.insert(0, str(PIPELINES_SRC))

from lotuslearn_pipeline.reliability_fixture_producer import (  # noqa: E402
    render_reliability_fixture,
)


def render_bytes() -> bytes:
    payload = render_reliability_fixture().encode("utf-8")

    if FIXTURE.exists():
        committed = FIXTURE.read_bytes()

        if committed.endswith(b"\n") and not payload.endswith(b"\n"):
            payload += b"\n"
        elif not committed.endswith(b"\n") and payload.endswith(b"\n"):
            payload = payload[:-1]

    return payload


def main() -> int:
    payload = render_bytes()

    FIXTURE.parent.mkdir(parents=True, exist_ok=True)
    FIXTURE.write_bytes(payload)

    print(f"WROTE={FIXTURE.relative_to(ROOT)}")
    print(f"BYTES={len(payload)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
