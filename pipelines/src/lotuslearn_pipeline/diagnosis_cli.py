"""Fail-closed JSON stdio boundary for Stage 3 Python-owned diagnosis."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Sequence

from lotuslearn_pipeline.diagnosis_service import diagnose_class_patterns_from_provider_result
from lotuslearn_pipeline.gemini_execution import GeminiExecutionError


def _run_request(payload: dict[str, Any]) -> dict[str, Any]:
    context = payload.get("context")
    observations = payload.get("observations")
    if not isinstance(context, dict):
        raise ValueError("context must be a JSON object")
    if not isinstance(observations, list) or any(
        not isinstance(item, dict) for item in observations
    ):
        raise ValueError("observations must be an array of JSON objects")

    if "providerResult" in payload:
        result = diagnose_class_patterns_from_provider_result(
            context, observations, payload["providerResult"]
        )
    else:
        from lotuslearn_pipeline.diagnosis_runtime import diagnose_class_patterns_live

        result = diagnose_class_patterns_live(context, observations)
    return result.to_contract_dict()


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Stage 3 diagnosis JSON stdio boundary")
    parser.add_argument("--input", default="-", help="JSON file or '-' for stdin")
    parser.add_argument("--output", default="-", help="JSON file or '-' for stdout")
    args = parser.parse_args(argv)
    try:
        if args.input == "-":
            raw = sys.stdin.read()
        else:
            raw = Path(args.input).read_text(encoding="utf-8-sig")
        payload = json.loads(raw)
        if not isinstance(payload, dict):
            raise ValueError("diagnosis CLI input must be a JSON object")
        result = _run_request(payload)
        rendered = json.dumps(result, ensure_ascii=False, allow_nan=False)
        if args.output == "-":
            sys.stdout.write(rendered)
        else:
            Path(args.output).write_text(rendered, encoding="utf-8")
    except (ValueError, TypeError, KeyError, OSError, GeminiExecutionError) as exc:
        print(f"diagnosis CLI request failed: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
