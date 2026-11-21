"""Live Stage 3 diagnosis composition root; business validation stays in service."""

from __future__ import annotations

import os
import time
from collections.abc import Callable, Mapping, Sequence
from typing import Any

from google import genai

from lotuslearn_pipeline.diagnosis_provider import build_diagnosis_provider_request
from lotuslearn_pipeline.diagnosis_service import DiagnosisResult, diagnose_class_patterns
from lotuslearn_pipeline.gemini_execution import (
    GeminiExecutionError,
    _classify_error,
    extract_retry_after_ms,
)

PRIMARY_MODEL = "gemini-3.8-flash"
FALLBACK_MODELS = ("gemini-3.6-flash", "gemini-3.5-flash-lite")
TIMEOUT_MS = 45_000


def generate_diagnosis_provider_result(
    context: Mapping[str, Any],
    observations: Sequence[Mapping[str, Any]],
    *,
    client: Any | None = None,
    sleep_fn: Callable[[float], None] = time.sleep,
    clock_fn: Callable[[], float] = time.monotonic,
) -> dict[str, Any]:
    """Call the diagnosis model route with bounded retries and Stage 3 telemetry."""
    request = build_diagnosis_provider_request(context, observations)
    if client is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise GeminiExecutionError(
                code="MISSING_GEMINI_API_KEY",
                stage=request.stage_name,
                message="GEMINI_API_KEY is required for live Diagnosis execution.",
                retryable=False,
            )
        client = genai.Client(api_key=api_key)

    started = clock_fn()
    last_code: str | None = None
    fallback_reason: str | None = None
    cooldown: dict[str, Any] | None = None
    for index, model in enumerate((PRIMARY_MODEL, *FALLBACK_MODELS)):
        if index and fallback_reason is None:
            fallback_reason = f"Switched from {PRIMARY_MODEL} to {model}"
        for attempt in range(2):
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=request.contents,
                    config={
                        "response_mime_type": request.response_mime_type,
                        "response_schema": request.response_schema,
                        "system_instruction": request.system_instruction,
                        "http_options": {"timeout": TIMEOUT_MS},
                    },
                )
                text = str(getattr(response, "text", "") or "").strip()
                if not text:
                    last_code = "EMPTY_PROVIDER_RESPONSE"
                    if attempt == 0:
                        continue
                    fallback_reason = f"Empty response from {model} after 2 attempts"
                    break

                duration_ms = max(0, int((clock_fn() - started) * 1000))
                telemetry: dict[str, Any] = {
                    "stage": request.stage_name,
                    "requestedModel": PRIMARY_MODEL,
                    "actualModel": model,
                    "latencyMs": duration_ms,
                }
                if fallback_reason:
                    telemetry["fallbackReason"] = fallback_reason
                if last_code:
                    telemetry["errorCode"] = last_code
                if cooldown:
                    telemetry["cooldownApplied"] = cooldown
                return {
                    "text": text,
                    "modelUsed": model,
                    "durationMs": duration_ms,
                    "telemetry": telemetry,
                }
            except Exception as exc:
                code, retryable = _classify_error(exc)
                last_code = code
                if not retryable:
                    raise GeminiExecutionError(
                        code=code,
                        stage=request.stage_name,
                        message=str(exc),
                        retryable=False,
                    ) from exc
                if code in {"QUOTA_EXHAUSTED", "TRANSIENT_NETWORK_ERROR"}:
                    cooldown = {
                        "model": model,
                        "durationMs": 86_400_000 if code == "QUOTA_EXHAUSTED" else 12_000,
                        "reason": (
                            "429_quota_exceeded"
                            if code == "QUOTA_EXHAUSTED"
                            else "transient_provider_error"
                        ),
                    }
                    fallback_reason = f"{code} on {model}; falling back"
                    break
                if attempt == 0:
                    retry_ms = extract_retry_after_ms(str(exc)) or 1_000
                    sleep_fn(min(retry_ms, 3_000) / 1000)
                    continue
                fallback_reason = f"{code} on {model} after 2 attempts"

    raise GeminiExecutionError(
        code=last_code or "PROVIDER_ERROR",
        stage=request.stage_name,
        message="Diagnosis failed across all stage-routed Gemini model candidates.",
        retryable=True,
    )


def diagnose_class_patterns_live(
    context: Mapping[str, Any],
    observations: Sequence[Mapping[str, Any]],
    *,
    provider: Callable[..., Mapping[str, Any]] = generate_diagnosis_provider_result,
) -> DiagnosisResult:
    """Run Python-owned diagnosis without moving JS orchestration."""
    return diagnose_class_patterns(context, observations, provider=provider)
