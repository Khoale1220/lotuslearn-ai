from __future__ import annotations

import json

import pytest

from lotuslearn_pipeline.diagnosis_service import (
    diagnose_class_patterns,
    diagnose_class_patterns_from_provider_result,
)


def _context() -> dict[str, str]:
    return {
        "learningObjective": ("Distinguish present perfect from past simple."),
    }


def _observations(
    count: int = 8,
) -> list[dict[str, object]]:
    return [
        {
            "studentId": f"S-{index + 1:02d}",
            "demonstratedUnderstanding": [],
            "misconceptions": [],
            "supportingEvidence": [],
            "recommendedSupportLevel": "guided_practice",
        }
        for index in range(count)
    ]


def _payload() -> dict[str, object]:
    return {
        "classSnapshot": {
            "totalSubmissions": 999,
            "misconceptionCount": 999,
            "strongestConcept": "Experience language",
            "highestPriorityNeed": "Finished-time adverbs",
            "overallRecommendation": ("Contrast finished and unfinished time."),
        },
        "misconceptionClusters": [
            {
                "clusterId": "cluster-1",
                "misconceptionTitle": "Finished-time adverbs",
                "explanation": ("Students combine incompatible time framing."),
                "affectedStudentIds": ["S-01"],
                "evidenceExamples": [
                    {
                        "studentId": "S-01",
                        "excerpt": ("I have visited Hue last year."),
                        "groundingReason": ("The quote combines both forms."),
                    }
                ],
                "teachingPriority": "urgent",
                "confidence": 0.97,
                "recommendedInstructionalResponse": (
                    "Contrast finished and unfinished time markers."
                ),
            }
        ],
    }


def _provider_result(
    payload: dict[str, object],
    *,
    model: str = "gemini-test-model",
) -> dict[str, object]:
    return {
        "text": json.dumps(payload),
        "modelUsed": model,
        "durationMs": 42,
        "telemetry": {
            "stage": "Stage 2: Diagnosis",
            "requestedModel": "gemini-test-model",
            "actualModel": model,
            "latencyMs": 42,
        },
    }


def test_recomputes_counts_and_rounding() -> None:
    result = diagnose_class_patterns_from_provider_result(
        _context(),
        _observations(8),
        _provider_result(_payload()),
    )

    assert result.class_snapshot["totalSubmissions"] == 8
    assert result.class_snapshot["misconceptionCount"] == 1

    cluster = result.misconception_clusters[0]

    assert cluster["studentCount"] == 1
    assert cluster["percentageAffected"] == 13
    assert cluster["status"] == "pending"
    assert cluster["teacherDecision"] == "pending"


def test_preserves_provider_metadata() -> None:
    result = diagnose_class_patterns_from_provider_result(
        _context(),
        _observations(),
        _provider_result(
            _payload(),
            model="gemini-test-model",
        ),
    )

    contract = result.to_contract_dict()

    assert contract["modelUsed"] == "gemini-test-model"
    assert contract["durationMs"] == 42.0
    assert contract["telemetry"]["actualModel"] == "gemini-test-model"


def test_applies_current_defaults() -> None:
    payload = _payload()

    clusters = payload["misconceptionClusters"]

    assert isinstance(
        clusters,
        list,
    )

    cluster = clusters[0]

    assert isinstance(
        cluster,
        dict,
    )

    cluster.pop("teachingPriority")

    cluster.pop("confidence")

    result = diagnose_class_patterns_from_provider_result(
        _context(),
        _observations(),
        _provider_result(payload),
    )

    normalized = result.misconception_clusters[0]

    assert normalized["teachingPriority"] == "high"
    assert normalized["confidence"] == 0.9


def test_rejects_missing_required_response() -> None:
    payload = _payload()

    clusters = payload["misconceptionClusters"]

    assert isinstance(
        clusters,
        list,
    )

    cluster = clusters[0]

    assert isinstance(
        cluster,
        dict,
    )

    cluster.pop("recommendedInstructionalResponse")

    with pytest.raises(
        ValueError,
        match="recommendedInstructionalResponse",
    ):
        diagnose_class_patterns_from_provider_result(
            _context(),
            _observations(),
            _provider_result(payload),
        )


def test_rejects_malformed_json() -> None:
    provider_result = _provider_result(_payload())

    provider_result["text"] = "{not-json"

    with pytest.raises(
        ValueError,
        match="malformed JSON",
    ):
        diagnose_class_patterns_from_provider_result(
            _context(),
            _observations(),
            provider_result,
        )


def test_accepts_fenced_json_compatibility() -> None:
    provider_result = _provider_result(_payload())

    provider_result["text"] = "```json\n" + json.dumps(_payload()) + "\n```"

    result = diagnose_class_patterns_from_provider_result(
        _context(),
        _observations(),
        provider_result,
    )

    assert len(result.misconception_clusters) == 1


def test_injected_provider_receives_inputs() -> None:
    calls: list[
        tuple[
            dict[str, object],
            list[dict[str, object]],
        ]
    ] = []

    def provider(
        *,
        context: dict[str, object],
        observations: list[dict[str, object]],
    ) -> dict[str, object]:
        calls.append(
            (
                context,
                observations,
            )
        )

        return _provider_result(_payload())

    observations = _observations()

    result = diagnose_class_patterns(
        _context(),
        observations,
        provider=provider,
    )

    assert result.model_used == "gemini-test-model"

    assert calls == [
        (
            _context(),
            observations,
        )
    ]
