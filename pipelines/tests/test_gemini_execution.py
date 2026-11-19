from __future__ import annotations

import pytest

from lotuslearn_pipeline.gemini_execution import (
    OBSERVER_FALLBACK_MODELS,
    OBSERVER_PRIMARY_MODEL,
    GeminiExecutionError,
    generate_observer_content,
)


class FakeResponse:
    def __init__(self, text: str) -> None:
        self.text = text


class FakeError(Exception):
    def __init__(self, code: int, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


class FakeModels:
    def __init__(self, scripted: list[object]) -> None:
        self.scripted = list(scripted)
        self.calls: list[dict[str, object]] = []

    def generate_content(self, **kwargs: object) -> FakeResponse:
        self.calls.append(kwargs)
        outcome = self.scripted.pop(0)
        if isinstance(outcome, BaseException):
            raise outcome
        assert isinstance(outcome, FakeResponse)
        return outcome


class FakeClient:
    def __init__(self, scripted: list[object]) -> None:
        self.models = FakeModels(scripted)


def test_primary_success_preserves_generation_contract() -> None:
    client = FakeClient([FakeResponse('[{"studentId":"S1"}]')])

    result = generate_observer_content(
        contents="prompt",
        config={"responseMimeType": "application/json"},
        client=client,
        jitter_fn=lambda _: 0,
    )

    assert result["modelUsed"] == OBSERVER_PRIMARY_MODEL
    assert result["text"] == '[{"studentId":"S1"}]'
    assert result["telemetry"]["requestedModel"] == OBSERVER_PRIMARY_MODEL
    assert result["telemetry"]["actualModel"] == OBSERVER_PRIMARY_MODEL


def test_quota_exhaustion_falls_back_without_same_model_retry() -> None:
    client = FakeClient(
        [
            FakeError(429, "Daily quota exhausted"),
            FakeResponse("[]"),
        ]
    )

    result = generate_observer_content(
        contents="prompt",
        client=client,
        jitter_fn=lambda _: 0,
    )

    assert len(client.models.calls) == 2
    assert client.models.calls[0]["model"] == OBSERVER_PRIMARY_MODEL
    assert client.models.calls[1]["model"] == OBSERVER_FALLBACK_MODELS[0]
    assert result["telemetry"]["errorCode"] == "QUOTA_EXHAUSTED"
    assert result["telemetry"]["cooldownApplied"]["reason"] == "429_quota_exceeded"


def test_503_falls_back_immediately() -> None:
    client = FakeClient(
        [
            FakeError(503, "Service unavailable"),
            FakeResponse("[]"),
        ]
    )

    result = generate_observer_content(
        contents="prompt",
        client=client,
        jitter_fn=lambda _: 0,
    )

    assert len(client.models.calls) == 2
    assert client.models.calls[1]["model"] == OBSERVER_FALLBACK_MODELS[0]
    assert result["telemetry"]["errorCode"] == "TRANSIENT_NETWORK_ERROR"


def test_rate_limit_retries_same_model_once() -> None:
    sleeps: list[float] = []
    client = FakeClient(
        [
            FakeError(429, "retry after: 0.5 sec"),
            FakeResponse("[]"),
        ]
    )

    result = generate_observer_content(
        contents="prompt",
        client=client,
        sleep_fn=sleeps.append,
        jitter_fn=lambda _: 0,
    )

    assert len(client.models.calls) == 2
    assert client.models.calls[0]["model"] == OBSERVER_PRIMARY_MODEL
    assert client.models.calls[1]["model"] == OBSERVER_PRIMARY_MODEL
    assert sleeps == [0.5]
    assert result["modelUsed"] == OBSERVER_PRIMARY_MODEL


def test_non_retryable_provider_error_halts() -> None:
    client = FakeClient([FakeError(400, "bad request")])

    with pytest.raises(GeminiExecutionError) as caught:
        generate_observer_content(
            contents="prompt",
            client=client,
            jitter_fn=lambda _: 0,
        )

    assert caught.value.code == "PROVIDER_ERROR"
    assert caught.value.retryable is False
    assert len(client.models.calls) == 1


def test_legacy_payload_keys_are_normalized_for_python_sdk() -> None:
    client = FakeClient([FakeResponse("[]")])

    generate_observer_content(
        contents={
            "parts": [
                {
                    "inlineData": {
                        "mimeType": "image/png",
                        "data": "abc",
                    }
                }
            ]
        },
        config={
            "responseMimeType": "application/json",
            "systemInstruction": "observer",
        },
        client=client,
        jitter_fn=lambda _: 0,
    )

    call = client.models.calls[0]
    assert call["contents"]["parts"][0]["inline_data"]["mime_type"] == "image/png"
    assert call["config"]["response_mime_type"] == "application/json"
    assert call["config"]["system_instruction"] == "observer"
    assert call["config"]["http_options"]["timeout"] == 25_000
