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

import json
import re
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
    ) -> Mapping[str, Any]: ...


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


def _decode_provider_observations(
    provider_result: Mapping[str, Any],
) -> list[JsonObject]:
    text = _require_non_empty_string(
        provider_result.get("text"),
        field="provider_result.text",
    )

    try:
        raw = json.loads(text)
    except json.JSONDecodeError:
        cleaned = re.sub(r"```json\n?|\n?```", "", text).strip()
        try:
            raw = json.loads(cleaned)
        except json.JSONDecodeError as exc:
            raise ValueError(f"provider_result.text contains malformed JSON: {exc.msg}") from exc

    observations_raw = _require_list(
        raw,
        field="provider_result.text",
    )

    observations: list[JsonObject] = []

    for index, item in enumerate(observations_raw):
        observation = dict(
            _require_mapping(
                item,
                field=f"provider_result.text[{index}]",
            )
        )

        observation["studentId"] = _require_non_empty_string(
            observation.get("studentId"),
            field=f"provider_result.text[{index}].studentId",
        )

        observations.append(observation)

    return observations


def _match_observations(
    submissions: Sequence[Mapping[str, Any]],
    observations: Sequence[Mapping[str, Any]],
) -> dict[str, Mapping[str, Any]]:
    expected_ids: list[str] = []

    for index, submission in enumerate(submissions):
        expected_ids.append(
            _require_non_empty_string(
                submission.get("studentId"),
                field=f"submissions[{index}].studentId",
            )
        )

    expected_set = set(expected_ids)
    seen: set[str] = set()
    matched: dict[str, Mapping[str, Any]] = {}

    duplicate_ids: list[str] = []
    unknown_ids: list[str] = []

    for observation in observations:
        student_id = _require_non_empty_string(
            observation.get("studentId"),
            field="observation.studentId",
        )

        if student_id not in expected_set:
            unknown_ids.append(student_id)

        if student_id in seen:
            duplicate_ids.append(student_id)
        else:
            seen.add(student_id)
            matched[student_id] = observation

    missing_ids = [student_id for student_id in expected_ids if student_id not in seen]

    issues: list[str] = []

    issues.extend(f'unknown student ID: "{student_id}"' for student_id in unknown_ids)
    issues.extend(
        f'duplicate observation for student ID: "{student_id}"' for student_id in duplicate_ids
    )
    issues.extend(f'omitted expected student ID: "{student_id}"' for student_id in missing_ids)

    if issues:
        raise ValueError("observer identity validation failed: " + "; ".join(issues))

    return matched


def _normalize_evidence(
    submission: Mapping[str, Any],
    observation: Mapping[str, Any],
) -> JsonObject:
    student_id = _require_non_empty_string(
        submission.get("studentId"),
        field="submission.studentId",
    )

    is_image = submission.get("workType") == "handwritten_work" or bool(
        submission.get("imageBase64")
    )

    extracted_text = submission.get("studentText")

    if is_image and observation.get("extractedSourceText"):
        extracted_text = observation.get("extractedSourceText")

    if extracted_text is None:
        extracted_text = ""

    if not isinstance(extracted_text, str):
        raise ValueError("submission.studentText must be a string")

    if is_image:
        confidence_or_status = (
            "unreadable" if not extracted_text.strip() else "transcription_unverified"
        )
    else:
        confidence_or_status = "exact_source"

    return {
        "studentId": student_id,
        "sourceType": ("image_transcription" if is_image else "typed"),
        "extractedText": extracted_text,
        "confidenceOrStatus": confidence_or_status,
    }


def _normalize_observation(
    submission: Mapping[str, Any],
    observation: Mapping[str, Any],
    *,
    source_type: str,
) -> JsonObject:
    student_id = _require_non_empty_string(
        submission.get("studentId"),
        field="submission.studentId",
    )

    supporting_raw = observation.get("supportingEvidence") or []

    supporting_items = _require_list(
        supporting_raw,
        field=f"observation[{student_id}].supportingEvidence",
    )

    supporting_evidence: list[JsonObject] = []

    for index, item in enumerate(supporting_items):
        evidence = _require_mapping(
            item,
            field=(f"observation[{student_id}].supportingEvidence[{index}]"),
        )

        supporting_evidence.append(
            {
                "quoteOrDetail": (evidence.get("quoteOrDetail") or ""),
                "interpretation": (evidence.get("interpretation") or ""),
                "sourceType": source_type,
            }
        )

    demonstrated_understanding = observation.get("demonstratedUnderstanding") or []
    misconceptions = observation.get("misconceptions") or []

    demonstrated_understanding = _require_list(
        demonstrated_understanding,
        field=(f"observation[{student_id}].demonstratedUnderstanding"),
    )

    misconceptions = _require_list(
        misconceptions,
        field=f"observation[{student_id}].misconceptions",
    )

    confidence = observation.get("confidence")

    if not isinstance(confidence, (int, float)) or isinstance(confidence, bool):
        confidence = 0.92

    return {
        "studentId": student_id,
        "demonstratedUnderstanding": demonstrated_understanding,
        "misconceptions": misconceptions,
        "supportingEvidence": supporting_evidence,
        "rubricAlignment": (
            observation.get("rubricAlignment") or "Evaluated against lesson rubric."
        ),
        "confidence": confidence,
        "recommendedSupportLevel": (
            observation.get("recommendedSupportLevel") or "guided_practice"
        ),
    }


def _extract_provider_result(
    provider_result: Mapping[str, Any],
    submissions: Sequence[Mapping[str, Any]],
) -> ObserverResult:
    """Validate and normalize the provider seam into the observer contract."""

    provider_result = _require_mapping(
        provider_result,
        field="provider_result",
    )

    observations_raw = _decode_provider_observations(provider_result)

    matched_observations = _match_observations(
        submissions,
        observations_raw,
    )

    normalized_evidence: list[JsonObject] = []
    observations: list[JsonObject] = []

    for submission in submissions:
        student_id = _require_non_empty_string(
            submission.get("studentId"),
            field="submission.studentId",
        )

        raw_observation = matched_observations[student_id]

        evidence = _normalize_evidence(
            submission,
            raw_observation,
        )

        normalized_evidence.append(evidence)

        observations.append(
            _normalize_observation(
                submission,
                raw_observation,
                source_type=evidence["sourceType"],
            )
        )

    model_used = _require_non_empty_string(
        provider_result.get("modelUsed"),
        field="provider_result.modelUsed",
    )

    duration = provider_result.get("durationMs", 0)

    if not isinstance(duration, (int, float)) or isinstance(duration, bool):
        raise ValueError("provider_result.durationMs must be numeric")

    telemetry_raw = provider_result.get(
        "telemetry",
        {},
    )

    telemetry = dict(
        _require_mapping(
            telemetry_raw,
            field="provider_result.telemetry",
        )
    )

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

    _require_mapping(
        context,
        field="context",
    )

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

    return _extract_provider_result(
        provider_result,
        normalized_submissions,
    )


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
