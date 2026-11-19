"""Observer-scoped Gemini execution boundary.

This module ports only the execution semantics required by the Python-owned
Observer stage. Other stages remain owned by the legacy TypeScript client
until their vertical migrations begin.
"""

from __future__ import annotations

import os
import random
import re
import time
from collections.abc import Callable, Mapping
from typing import Any

from google import genai

JsonObject = dict[str, Any]

OBSERVER_STAGE_NAME = "Stage 1: Observer"
OBSERVER_PRIMARY_MODEL = "gemini-3.5-flash-lite"
OBSERVER_FALLBACK_MODELS = ("gemini-3.1-flash-lite",)
OBSERVER_TIMEOUT_MS = 25_000
MAX_ATTEMPTS_PER_MODEL = 2


class GeminiExecutionError(RuntimeError):
    """Stable Python error contract for Gemini execution failures."""

    def __init__(
        self,
        *,
        code: str,
        stage: str,
        message: str,
        retryable: bool,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.stage = stage
        self.retryable = retryable


_KEY_ALIASES = {
    "inlineData": "inline_data",
    "mimeType": "mime_type",
    "responseMimeType": "response_mime_type",
    "responseSchema": "response_schema",
    "systemInstruction": "system_instruction",
}


def _normalize_sdk_value(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {
            _KEY_ALIASES.get(str(key), str(key)): _normalize_sdk_value(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_normalize_sdk_value(item) for item in value]
    return value


def extract_retry_after_ms(message: str | None) -> int | None:
    if not message:
        return None

    sec_match = re.search(
        r"retry(?:[-_\s]+after|[-_\s]+in)?[:\s]+"
        r"([0-9]+(?:\.[0-9]+)?)\s*s(?:ec)?",
        message,
        re.IGNORECASE,
    )
    if sec_match:
        seconds = float(sec_match.group(1))
        if seconds > 0:
            return int(seconds * 1000 + 0.999)

    ms_match = re.search(
        r"retry(?:[-_\s]+after|[-_\s]+in)?[:\s]+([0-9]+)\s*ms",
        message,
        re.IGNORECASE,
    )
    if ms_match:
        milliseconds = int(ms_match.group(1))
        if milliseconds > 0:
            return milliseconds

    return None


def _error_status(error: BaseException) -> int | None:
    for attribute in ("code", "status_code"):
        value = getattr(error, attribute, None)
        if isinstance(value, int):
            return value
        if isinstance(value, str) and value.isdigit():
            return int(value)
    return None


def _error_message(error: BaseException) -> str:
    return str(getattr(error, "message", None) or error)


def _classify_error(error: BaseException) -> tuple[str, bool]:
    status = _error_status(error)
    message = _error_message(error).lower()

    if status == 429:
        quota_markers = (
            "daily quota",
            "per day",
            "quota exhausted",
            "quota_exhausted",
            "current quota",
        )
        if any(marker in message for marker in quota_markers):
            return "QUOTA_EXHAUSTED", True
        return "RATE_LIMIT_ERROR", True

    if status in {503, 504}:
        return "TRANSIENT_NETWORK_ERROR", True

    transient_markers = (
        "timed out",
        "timeout",
        "deadline",
        "connection reset",
        "connection error",
        "service unavailable",
    )
    if isinstance(error, (TimeoutError, ConnectionError)) or any(
        marker in message for marker in transient_markers
    ):
        return "TRANSIENT_NETWORK_ERROR", True

    return "PROVIDER_ERROR", False


def _provider_config(config: Mapping[str, Any] | None) -> JsonObject:
    normalized = dict(_normalize_sdk_value(config or {}))
    http_options = dict(normalized.get("http_options") or {})
    http_options["timeout"] = OBSERVER_TIMEOUT_MS
    normalized["http_options"] = http_options
    return normalized


def _duration_ms(
    started_at: float,
    clock_fn: Callable[[], float],
) -> int:
    return max(0, int((clock_fn() - started_at) * 1000))


def generate_observer_content(
    *,
    contents: Any,
    config: Mapping[str, Any] | None = None,
    client: Any | None = None,
    api_key: str | None = None,
    sleep_fn: Callable[[float], None] = time.sleep,
    clock_fn: Callable[[], float] = time.monotonic,
    jitter_fn: Callable[[int], int] = random.randrange,
) -> JsonObject:
    """Execute the Observer Gemini request with bounded fallback semantics."""

    if client is None:
        resolved_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not resolved_key:
            raise GeminiExecutionError(
                code="MISSING_GEMINI_API_KEY",
                stage=OBSERVER_STAGE_NAME,
                message="GEMINI_API_KEY is required for live Observer execution.",
                retryable=False,
            )
        client = genai.Client(api_key=resolved_key)

    started_at = clock_fn()
    requested_model = OBSERVER_PRIMARY_MODEL
    candidates = (OBSERVER_PRIMARY_MODEL, *OBSERVER_FALLBACK_MODELS)
    normalized_contents = _normalize_sdk_value(contents)
    normalized_config = _provider_config(config)

    fallback_reason: str | None = None
    last_error_code: str | None = None
    last_cooldown: JsonObject | None = None

    for model_index, model_name in enumerate(candidates):
        if model_index > 0 and fallback_reason is None:
            fallback_reason = f"Switched from {requested_model} to {model_name}"

        for attempt in range(1, MAX_ATTEMPTS_PER_MODEL + 1):
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=normalized_contents,
                    config=normalized_config,
                )
                text = str(getattr(response, "text", "") or "").strip()

                if not text:
                    if attempt < MAX_ATTEMPTS_PER_MODEL:
                        continue
                    fallback_reason = (
                        f"Empty response from {model_name} after {MAX_ATTEMPTS_PER_MODEL} attempts"
                    )
                    break

                telemetry: JsonObject = {
                    "stage": OBSERVER_STAGE_NAME,
                    "requestedModel": requested_model,
                    "actualModel": model_name,
                    "latencyMs": _duration_ms(started_at, clock_fn),
                }
                if fallback_reason is not None:
                    telemetry["fallbackReason"] = fallback_reason
                if last_error_code is not None:
                    telemetry["errorCode"] = last_error_code
                if last_cooldown is not None:
                    telemetry["cooldownApplied"] = last_cooldown

                return {
                    "text": text,
                    "modelUsed": model_name,
                    "durationMs": _duration_ms(started_at, clock_fn),
                    "telemetry": telemetry,
                }

            except Exception as error:
                code, retryable = _classify_error(error)
                last_error_code = code
                message = _error_message(error)

                if code == "QUOTA_EXHAUSTED":
                    cooldown_ms = 24 * 60 * 60 * 1000
                    last_cooldown = {
                        "model": model_name,
                        "durationMs": cooldown_ms,
                        "reason": "429_quota_exceeded",
                    }
                    fallback_reason = (
                        f"HTTP 429 Daily Quota Exhausted on {model_name}, immediately falling back"
                    )
                    break

                if not retryable:
                    raise GeminiExecutionError(
                        code=code,
                        stage=OBSERVER_STAGE_NAME,
                        message=message,
                        retryable=False,
                    ) from error

                if code == "TRANSIENT_NETWORK_ERROR":
                    lower_message = message.lower()
                    is_timeout = any(
                        marker in lower_message for marker in ("time", "deadline", "504")
                    )
                    reason = "timeout" if is_timeout else "503_service_overload"
                    cooldown_ms = 12_000 + jitter_fn(2000)
                    last_cooldown = {
                        "model": model_name,
                        "durationMs": cooldown_ms,
                        "reason": reason,
                    }
                    failure_label = (
                        "Timeout / Deadline Exceeded" if is_timeout else "HTTP 503 Service Overload"
                    )
                    fallback_reason = f"{failure_label} on {model_name}, immediately falling back"
                    break

                if attempt < MAX_ATTEMPTS_PER_MODEL:
                    retry_after_ms = extract_retry_after_ms(message)
                    backoff_ms = retry_after_ms or (
                        min(1000 * (2 ** (attempt - 1)), 3000) + jitter_fn(250)
                    )
                    sleep_fn(backoff_ms / 1000)
                    continue

                cooldown_ms = 10_000 + jitter_fn(2000)
                last_cooldown = {
                    "model": model_name,
                    "durationMs": cooldown_ms,
                    "reason": "429_rate_limit",
                }
                fallback_reason = (
                    f"HTTP 429 Rate Limit exceeded on {model_name} after "
                    f"{MAX_ATTEMPTS_PER_MODEL} attempts"
                )
                break

    raise GeminiExecutionError(
        code=last_error_code or "TRANSIENT_NETWORK_ERROR",
        stage=OBSERVER_STAGE_NAME,
        message=("Observer failed across all stage-routed Gemini model candidates."),
        retryable=True,
    )
