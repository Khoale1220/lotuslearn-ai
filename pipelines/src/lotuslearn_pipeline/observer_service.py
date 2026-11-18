"""Canonical Python implementation of the LotusLearn observer stage.

This module owns deterministic observer-stage business transformation.

Migration principles:
- behavior first;
- golden fixture is the compatibility contract;
- provider/network transport is injected;
- no production credentials;
- no wall-clock dependence in business output;
- no line-by-line TypeScript translation.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Protocol, Sequence

JsonObject = dict[str, Any]


class ObserverProvider(Protocol):
    """Injected provider boundary used by the observer stage."""

    def __call__(
        self,
        *,
        context: Mapping[str, Any],
        submissions: Sequence[Mapping[str, Any]],
    ) -> Mapping[str, Any]:
        ...


@dataclass(frozen=True)
class ObserverResult:
    """Canonical observer-stage output."""

    observations: list[JsonObject]
    normalized_evidence: list[JsonObject]
    model_used: str
    duration_ms: float
    telemetry: JsonObject

    def to_contract_dict(self) -> JsonObject:
        """Return the public cross-language contract shape."""

        return {
            "observations": self.observations,
            "normalizedEvidence": self.normalized_evidence,
            "modelUsed": self.model_used,
            "durationMs": self.duration_ms,
            "telemetry": self.telemetry,
        }


def _require_mapping(value: Any, *, field: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise ValueError(f"{field} must be an object")
    return value


def _require_list(value: Any, *, field: str) -> list[Any]:
    if not isinstance(value, list):
        raise ValueError(f"{field} must be an array")
    return value


def _require_non_empty_string(value: Any, *, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field} must be a non-empty string")
    return value


def _normalize_observation(raw: Any) -> JsonObject:
    item = dict(_require_mapping(raw, field="observation"))

    student_id = item.get("studentId")
    if student_id is not None:
        _require_non_empty_string(student_id, field="observation.studentId")

    return item


def _normalize_evidence(raw: Any) -> JsonObject:
    item = dict(_require_mapping(raw, field="normalizedEvidence"))

    student_id = item.get("studentId")
    if student_id is not None:
        _require_non_empty_string(
            student_id,
            field="normalizedEvidence.studentId",
        )

    return item


def _extract_provider_result(provider_result: Mapping[str, Any]) -> ObserverResult:
    """Validate and normalize the provider seam into the observer contract."""

    provider_result = _require_mapping(
        provider_result,
        field="provider_result",
    )

    observations_raw = _require_list(
        provider_result.get("observations"),
        field="provider_result.observations",
    )
    evidence_raw = _require_list(
        provider_result.get("normalizedEvidence"),
        field="provider_result.normalizedEvidence",
    )

    model_used = _require_non_empty_string(
        provider_result.get("modelUsed"),
        field="provider_result.modelUsed",
    )

    duration = provider_result.get("durationMs", 0)
    if not isinstance(duration, (int, float)) or isinstance(duration, bool):
        raise ValueError("provider_result.durationMs must be numeric")

    telemetry_raw = provider_result.get("telemetry", {})
    telemetry = dict(
        _require_mapping(
            telemetry_raw,
            field="provider_result.telemetry",
        )
    )

    observations = [
        _normalize_observation(item)
        for item in observations_raw
    ]
    normalized_evidence = [
        _normalize_evidence(item)
        for item in evidence_raw
    ]

    return ObserverResult(
        observations=observations,
        normalized_evidence=normalized_evidence,
        model_used=model_used,
        duration_ms=float(duration),
        telemetry=telemetry,
    )


def observe_submissions(
    context: Mapping[str, Any],
    submissions: Sequence[Mapping[str, Any]],
    *,
    provider: ObserverProvider,
) -> ObserverResult:
    """Observe submissions through an injected hermetic provider boundary.

    The observer owns validation and canonical output shaping.
    Transport/provider behavior stays outside the business transformation.
    """

    _require_mapping(context, field="context")

    if not isinstance(submissions, Sequence) or isinstance(
        submissions,
        (str, bytes, bytearray),
    ):
        raise ValueError("submissions must be an array")

    normalized_submissions: list[Mapping[str, Any]] = []
    for index, submission in enumerate(submissions):
        normalized_submissions.append(
            _require_mapping(
                submission,
                field=f"submissions[{index}]",
            )
        )

    provider_result = provider(
        context=context,
        submissions=normalized_submissions,
    )

    return _extract_provider_result(provider_result)


def observe_submissions_from_provider_result(
    context: Mapping[str, Any],
    submissions: Sequence[Mapping[str, Any]],
    provider_result: Mapping[str, Any],
) -> ObserverResult:
    """Hermetic parity seam.

    Used for migration fixtures and tests where the legacy provider response
    is already captured. No network access occurs here.
    """

    def captured_provider(
        *,
        context: Mapping[str, Any],
        submissions: Sequence[Mapping[str, Any]],
    ) -> Mapping[str, Any]:
        del context
        del submissions
        return provider_result

    return observe_submissions(
        context,
        submissions,
        provider=captured_provider,
    )
