from __future__ import annotations

import difflib
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

    committed = FIXTURE.read_bytes()

    if committed.endswith(b"\n") and not payload.endswith(b"\n"):
        payload += b"\n"
    elif not committed.endswith(b"\n") and payload.endswith(b"\n"):
        payload = payload[:-1]

    return payload


def main() -> int:
    if not FIXTURE.is_file():
        print(
            f"ERROR: reliability fixture does not exist: "
            f"{FIXTURE.relative_to(ROOT)}",
            file=sys.stderr,
        )
        return 1

    expected = FIXTURE.read_bytes()
    actual = render_bytes()

    if actual != expected:
        expected_text = expected.decode("utf-8").splitlines(keepends=True)
        actual_text = actual.decode("utf-8").splitlines(keepends=True)

        diff = difflib.unified_diff(
            expected_text,
            actual_text,
            fromfile="committed-fixture",
            tofile="python-generator",
        )

        sys.stderr.writelines(diff)
        print(
            "FAIL: reliability fixture drift detected.",
            file=sys.stderr,
        )
        return 1

    print(
        "PASS: Reliability fixtures verified. "
        "Zero drift detected between Python generator "
        "and committed JSON."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
