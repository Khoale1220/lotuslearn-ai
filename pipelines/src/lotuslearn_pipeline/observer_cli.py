"""JSON process boundary for the canonical Python Observer stage.

The CLI intentionally does not own provider/network transport.
It accepts a captured provider result and delegates all Observer business
transformation and validation to observer_service.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Sequence

from lotuslearn_pipeline.observer_service import (
    observe_submissions_from_provider_result,
)


def _parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=("Transform a provider result into the canonical LotusLearn Observer contract.")
    )
    parser.add_argument(
        "--input",
        default="-",
        help="Observer request JSON path, or '-' to read from stdin.",
    )
    parser.add_argument(
        "--output",
        default="-",
        help="Observer result JSON path, or '-' to write to stdout.",
    )
    return parser.parse_args(argv)


def _read_request(source: str) -> dict[str, Any]:
    if source == "-":
        raw = sys.stdin.read()
    else:
        raw = Path(source).read_text(encoding="utf-8")

    payload = json.loads(raw)

    if not isinstance(payload, dict):
        raise ValueError("observer CLI input must be a JSON object")

    return payload


def _render_result(result: dict[str, Any]) -> str:
    return json.dumps(
        result,
        ensure_ascii=False,
        indent=2,
    )


def _run_request(payload: dict[str, Any]) -> dict[str, Any]:
    context = payload.get("context")
    submissions = payload.get("submissions")
    if "providerResult" not in payload:
        from lotuslearn_pipeline.gemini_execution import GeminiExecutionError
        from lotuslearn_pipeline.observer_runtime import observe_submissions_live

        try:
            return observe_submissions_live(
                payload["context"],
                payload["submissions"],
            ).to_contract_dict()
        except GeminiExecutionError as exc:
            raise ValueError(str(exc)) from exc

    provider_result = payload.get("providerResult")

    result = observe_submissions_from_provider_result(
        context,
        submissions,
        provider_result,
    )

    return result.to_contract_dict()


def main(argv: Sequence[str] | None = None) -> int:
    args = _parse_args(argv)

    try:
        payload = _read_request(args.input)
        result = _run_request(payload)
        rendered = _render_result(result)
    except (json.JSONDecodeError, TypeError, ValueError) as exc:
        print(
            f"observer CLI request failed: {exc}",
            file=sys.stderr,
        )
        return 2

    if args.output == "-":
        sys.stdout.write(rendered)
        return 0

    output_path = Path(args.output).resolve()
    output_path.write_text(
        rendered,
        encoding="utf-8",
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
