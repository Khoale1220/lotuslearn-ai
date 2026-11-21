"""No-network characterization of the Python-owned diagnosis runtime."""

from __future__ import annotations

import json

import pytest

from lotuslearn_pipeline.diagnosis_runtime import (
    FALLBACK_MODELS,
    PRIMARY_MODEL,
    TIMEOUT_MS,
    diagnose_class_patterns_live,
    generate_diagnosis_provider_result,
)
from lotuslearn_pipeline.gemini_execution import GeminiExecutionError


def _context() -> dict[str, str]:
    return {"learningObjective": "Distinguish past simple from present perfect"}


def _observations() -> list[dict[str, str]]:
    return [{"studentId": "S-01"}]


def _payload() -> dict[str, object]:
    return {
        "classSnapshot": {
            "strongestConcept": "Experience",
            "highestPriorityNeed": "Finished time",
            "overallRecommendation": "Contrast time markers",
        },
        "misconceptionClusters": [
            {
                "clusterId": "cluster-1",
                "misconceptionTitle": "Finished time",
                "explanation": "Confuses completed and ongoing time",
                "affectedStudentIds": ["S-01"],
                "evidenceExamples": [],
                "recommendedInstructionalResponse": "Model the contrast",
            }
        ],
    }


class FakeResponse:
    def __init__(self, text: str) -> None:
        self.text = text


class FakeError(Exception):
    def __init__(self, code: int, message: str) -> None:
        super().__init__(message)
        self.code = code


class FakeClient:
    def __init__(self, outcomes: list[object]) -> None:
        self.outcomes = list(outcomes)
        self.calls: list[dict[str, object]] = []
        self.models = self

    def generate_content(self, **kwargs: object) -> FakeResponse:
        self.calls.append(kwargs)
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, BaseException):
            raise outcome
        assert isinstance(outcome, FakeResponse)
        return outcome


def test_primary_route_uses_diagnosis_metadata() -> None:
    client = FakeClient([FakeResponse(json.dumps(_payload()))])
    provider_result = generate_diagnosis_provider_result(
        _context(), _observations(), client=client
    )
    assert client.calls[0]["model"] == PRIMARY_MODEL
    config = client.calls[0]["config"]
    assert isinstance(config, dict)
    assert config["http_options"]["timeout"] == TIMEOUT_MS
    assert config["response_mime_type"] == "application/json"
    assert provider_result["telemetry"]["stage"] == "Stage 2: Diagnosis"
    assert provider_result["telemetry"]["actualModel"] == PRIMARY_MODEL


def test_quota_error_falls_back_without_retry() -> None:
    client = FakeClient([FakeError(429, "daily quota exhausted"), FakeResponse("{}")])
    result = generate_diagnosis_provider_result(_context(), _observations(), client=client)
    assert [call["model"] for call in client.calls] == [PRIMARY_MODEL, FALLBACK_MODELS[0]]
    assert result["telemetry"]["errorCode"] == "QUOTA_EXHAUSTED"
    assert result["telemetry"]["cooldownApplied"]["reason"] == "429_quota_exceeded"


def test_nonretryable_provider_error_fails_closed() -> None:
    client = FakeClient([FakeError(400, "invalid request")])
    with pytest.raises(GeminiExecutionError) as raised:
        generate_diagnosis_provider_result(_context(), _observations(), client=client)
    assert raised.value.stage == "Stage 2: Diagnosis"
    assert raised.value.retryable is False
    assert len(client.calls) == 1


def test_missing_live_key_fails_before_network(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    with pytest.raises(GeminiExecutionError, match="GEMINI_API_KEY"):
        generate_diagnosis_provider_result(_context(), _observations())


def test_reuses_certified_c4c_business_transformation() -> None:
    provider_result = {
        "text": json.dumps(_payload()),
        "modelUsed": "fixture-model",
        "durationMs": 20,
        "telemetry": {"stage": "Stage 2: Diagnosis"},
    }
    result = diagnose_class_patterns_live(
        _context(), _observations(), provider=lambda **_: provider_result
    ).to_contract_dict()
    assert result["classSnapshot"]["totalSubmissions"] == 1
    assert result["classSnapshot"]["misconceptionCount"] == 1
    assert result["misconceptionClusters"][0]["teacherDecision"] == "pending"
    assert result["modelUsed"] == "fixture-model"


def test_transient_error_falls_back_without_same_model_retry() -> None:
    client = FakeClient([FakeError(503, "service unavailable"), FakeResponse("{}")])
    result = generate_diagnosis_provider_result(_context(), _observations(), client=client)
    assert [call["model"] for call in client.calls] == [PRIMARY_MODEL, FALLBACK_MODELS[0]]
    assert result["telemetry"]["errorCode"] == "TRANSIENT_NETWORK_ERROR"


def test_rate_limit_retries_once_with_bounded_backoff() -> None:
    sleeps: list[float] = []
    client = FakeClient([FakeError(429, "retry after: 0.5 sec"), FakeResponse("{}")])
    result = generate_diagnosis_provider_result(
        _context(), _observations(), client=client, sleep_fn=sleeps.append
    )
    assert len(client.calls) == 2
    assert all(call["model"] == PRIMARY_MODEL for call in client.calls)
    assert sleeps == [0.5]
    assert result["modelUsed"] == PRIMARY_MODEL


def test_empty_responses_fail_closed_after_bounded_attempts() -> None:
    client = FakeClient([FakeResponse("")] * 6)
    with pytest.raises(GeminiExecutionError) as raised:
        generate_diagnosis_provider_result(_context(), _observations(), client=client)
    assert raised.value.code == "EMPTY_PROVIDER_RESPONSE"
    assert len(client.calls) == 6
