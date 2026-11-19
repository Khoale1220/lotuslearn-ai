from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any

import pytest

from lotuslearn_pipeline.observer_service import (
    observe_submissions_from_provider_result,
)

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "observer_service_parity.json"


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
        case["provider_result"],
    ).to_contract_dict()

    assert _normalize_contract(result) == _normalize_contract(case["expected"])


def test_observer_service_accepts_fenced_provider_json() -> None:
    case = deepcopy(_load_fixture()["cases"][0])

    provider_result = case["provider_result"]

    provider_result["text"] = f"```json\n{provider_result['text']}\n```"

    result = observe_submissions_from_provider_result(
        case["input"]["context"],
        case["input"]["submissions"],
        provider_result,
    ).to_contract_dict()

    assert _normalize_contract(result) == _normalize_contract(case["expected"])


@pytest.mark.parametrize(
    ("observations", "expected_message"),
    [
        (
            [],
            "omitted expected student ID",
        ),
        (
            [
                {
                    "studentId": "Unknown 99",
                }
            ],
            "unknown student ID",
        ),
        (
            [
                {
                    "studentId": "Custom 01",
                },
                {
                    "studentId": "Custom 01",
                },
            ],
            "duplicate observation",
        ),
    ],
)
def test_observer_service_fails_closed_on_identity_mismatch(
    observations: list[dict[str, Any]],
    expected_message: str,
) -> None:
    case = deepcopy(_load_fixture()["cases"][0])

    case["provider_result"]["text"] = json.dumps(observations)

    with pytest.raises(
        ValueError,
        match=expected_message,
    ):
        observe_submissions_from_provider_result(
            case["input"]["context"],
            case["input"]["submissions"],
            case["provider_result"],
        )


def test_observer_service_preserves_image_evidence_semantics() -> None:
    case = deepcopy(_load_fixture()["cases"][0])

    submission = case["input"]["submissions"][0]

    submission["workType"] = "handwritten_work"
    submission["imageBase64"] = "ZmFrZS1pbWFnZQ=="

    case["provider_result"]["text"] = json.dumps(
        [
            {
                "studentId": "Custom 01",
                "demonstratedUnderstanding": ["Uses have auxiliary"],
                "misconceptions": [],
                "supportingEvidence": [
                    {
                        "quoteOrDetail": ("I have finished my homework"),
                        "interpretation": ("Transcribed supporting evidence"),
                    }
                ],
                "extractedSourceText": ("I have finished my homework."),
            }
        ]
    )

    result = observe_submissions_from_provider_result(
        case["input"]["context"],
        case["input"]["submissions"],
        case["provider_result"],
    ).to_contract_dict()

    assert result["normalizedEvidence"] == [
        {
            "studentId": "Custom 01",
            "sourceType": "image_transcription",
            "extractedText": ("I have finished my homework."),
            "confidenceOrStatus": ("transcription_unverified"),
        }
    ]

    assert result["observations"][0]["supportingEvidence"][0]["sourceType"] == "image_transcription"

    assert result["observations"][0]["rubricAlignment"] == "Evaluated against lesson rubric."

    assert result["observations"][0]["confidence"] == 0.92

    assert result["observations"][0]["recommendedSupportLevel"] == "guided_practice"


def test_fixture_declares_typescript_source() -> None:
    fixture = _load_fixture()

    source = fixture.get("source_implementation") or fixture.get("sourceImplementation")

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


def test_observer_service_preserves_reordered_identity_mapping() -> None:
    case = deepcopy(_load_fixture()["cases"][0])

    case["input"]["submissions"] = [
        {
            "studentId": "Student 01",
            "studentText": "Text 1",
            "workType": "typed",
        },
        {
            "studentId": "Student 02",
            "studentText": "Text 2",
            "workType": "typed",
        },
        {
            "studentId": "Student 03",
            "studentText": "Text 3",
            "workType": "typed",
        },
    ]

    case["provider_result"]["text"] = json.dumps(
        [
            {
                "studentId": "Student 03",
                "demonstratedUnderstanding": ["Skill 3"],
            },
            {
                "studentId": "Student 01",
                "demonstratedUnderstanding": ["Skill 1"],
            },
            {
                "studentId": "Student 02",
                "demonstratedUnderstanding": ["Skill 2"],
            },
        ]
    )

    result = observe_submissions_from_provider_result(
        case["input"]["context"],
        case["input"]["submissions"],
        case["provider_result"],
    ).to_contract_dict()

    assert [item["studentId"] for item in result["observations"]] == [
        "Student 01",
        "Student 02",
        "Student 03",
    ]

    assert [item["demonstratedUnderstanding"][0] for item in result["observations"]] == [
        "Skill 1",
        "Skill 2",
        "Skill 3",
    ]


def test_observer_service_rejects_equal_length_wrong_identity_set() -> None:
    case = deepcopy(_load_fixture()["cases"][0])

    case["input"]["submissions"] = [
        {
            "studentId": "Student 01",
            "studentText": "Text 1",
            "workType": "typed",
        },
        {
            "studentId": "Student 02",
            "studentText": "Text 2",
            "workType": "typed",
        },
        {
            "studentId": "Student 03",
            "studentText": "Text 3",
            "workType": "typed",
        },
    ]

    case["provider_result"]["text"] = json.dumps(
        [
            {"studentId": "Student 01"},
            {"studentId": "Student 03"},
            {"studentId": "Student 99"},
        ]
    )

    with pytest.raises(ValueError) as exc_info:
        observe_submissions_from_provider_result(
            case["input"]["context"],
            case["input"]["submissions"],
            case["provider_result"],
        )

    message = str(exc_info.value)

    assert 'unknown student ID: "Student 99"' in message
    assert 'omitted expected student ID: "Student 02"' in message


def test_observer_service_reports_duplicate_and_missing_together() -> None:
    case = deepcopy(_load_fixture()["cases"][0])

    case["input"]["submissions"] = [
        {
            "studentId": "Student 01",
            "studentText": "Text 1",
            "workType": "typed",
        },
        {
            "studentId": "Student 02",
            "studentText": "Text 2",
            "workType": "typed",
        },
    ]

    case["provider_result"]["text"] = json.dumps(
        [
            {"studentId": "Student 01"},
            {"studentId": "Student 01"},
        ]
    )

    with pytest.raises(ValueError) as exc_info:
        observe_submissions_from_provider_result(
            case["input"]["context"],
            case["input"]["submissions"],
            case["provider_result"],
        )

    message = str(exc_info.value)

    assert 'duplicate observation for student ID: "Student 01"' in message
    assert 'omitted expected student ID: "Student 02"' in message
