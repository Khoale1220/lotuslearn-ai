from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Sequence

from lotuslearn_pipeline.analytical_event_producer import produce_analytical_events


def _parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Convert one LotusLearn analysis-result JSON document into canonical analytical events."
        )
    )
    parser.add_argument(
        "--input",
        default="-",
        help="Analysis-result JSON path, or '-' to read from stdin.",
    )
    parser.add_argument(
        "--output",
        default="-",
        help="Analytical-event JSON path, or '-' to write to stdout.",
    )
    return parser.parse_args(argv)


def _read_analysis(source: str) -> dict[str, Any]:
    if source == "-":
        raw = sys.stdin.read()
    else:
        raw = Path(source).read_text(encoding="utf-8")

    payload = json.loads(raw)

    if not isinstance(payload, dict):
        raise ValueError("analysis input must be a JSON object")

    return payload


def _render_events(events: list[dict[str, Any]]) -> str:
    return json.dumps(
        events,
        ensure_ascii=False,
        indent=2,
    )


def main(argv: Sequence[str] | None = None) -> int:
    args = _parse_args(argv)
    analysis = _read_analysis(args.input)
    events = produce_analytical_events(analysis)
    rendered = _render_events(events)

    if args.output == "-":
        sys.stdout.write(rendered)
        return 0

    output_path = Path(args.output).resolve()
    output_path.write_text(
        rendered,
        encoding="utf-8",
    )

    print(f"Exported {len(events)} analytical events to {args.output}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
