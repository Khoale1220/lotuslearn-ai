from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any

import pytest

from lotuslearn_pipeline.observer_service import (
    observe_submissions_from_provider_result,
)

FIXTURE_PATH = (
    Path(__file__).parent
    / "fixtures"
    / "observer_service_parity.json"
)


def _load_fixture() -> dict[str, Any]:
    return json.loads(FIXTURE_PATH.read_text())


def _normalize_contract(value: Any) -> Any:
    """Normalize only explicitly non-deterministic runtime evidence."""

    value = deepcopy(value)

    if isinstance(value, dict):
        normalized: dict[str, Any] = {}

        for key, item in value.items():
            if key == "durationMs":
                normalized[key] = "<normalized-duration>"
                continue

            if key in {
                "latencyMs",
                "providerLatencyMs",
                "runtimeLatencyMs",
                "elapsedMs",
            }:
                normalized[key] = "<normalized-runtime>"
                continue

            normalized[key] = _normalize_contract(item)

        return normalized

    if isinstance(value, list):
        return [_normalize_contract(item) for item in value]

    return value


@pytest.mark.parametrize(
    "case",
    _load_fixture()["cases"],
)
def test_observer_service_matches_golden_contract(
    case: dict[str, Any],
) -> None:
    input_payload = case["input"]

    result = observe_submissions_from_provider_result(
        input_payload["context"],
        input_payload["submissions"],
        case['provider_result'],
    ).to_contract_dict()

    assert _normalize_contract(result) == _normalize_contract(
        case["expected"]
    )


def test_fixture_declares_typescript_source() -> None:
    fixture = _load_fixture()

    source = fixture.get("source_implementation") or fixture.get(
        "sourceImplementation"
    )

    assert source is not None
    assert "observerService" in str(source)


def test_fixture_contains_no_credentials() -> None:
    raw = FIXTURE_PATH.read_text().lower()

    forbidden = (
        "gemini_api_key=",
        "authorization: bearer",
        '"api_key"',
        '"apikey"',
        "private_key",
    )

    for token in forbidden:
        assert token not in raw
