"""Canonical Python business transformation for Stage 3 diagnosis."""

from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass
from typing import Any, Mapping, Protocol, Sequence

JsonObject = dict[str, Any]

_TEACHING_PRIORITIES = {
    "urgent",
    "high",
    "moderate",
}

_SOURCE_TYPES = {
    "typed",
    "image_transcription",
}

_DETERMINISTIC_MATCHES = {
    "exact_match",
    "exact_quote_found",
    "normalized_exact_match",
    "image_transcription_match",
    "image_transcription_verified",
    "approximate_match",
    "unsupported_citation",
}


class DiagnosisProvider(Protocol):
    """Injected provider boundary."""

    def __call__(
        self,
        *,
        context: Mapping[str, Any],
        observations: Sequence[Mapping[str, Any]],
    ) -> Mapping[str, Any]: ...


@dataclass(frozen=True)
class DiagnosisResult:
    """Canonical Stage 3 output."""

    class_snapshot: JsonObject
    misconception_clusters: list[JsonObject]
    model_used: str
    duration_ms: float
    telemetry: JsonObject

    def to_contract_dict(self) -> JsonObject:
        return {
            "classSnapshot": self.class_snapshot,
            "misconceptionClusters": self.misconception_clusters,
            "modelUsed": self.model_used,
            "durationMs": self.duration_ms,
            "telemetry": self.telemetry,
        }


def _require_mapping(
    value: object,
    *,
    field: str,
) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise ValueError(f"{field} must be an object")

    return value


def _require_list(
    value: object,
    *,
    field: str,
) -> list[Any]:
    if not isinstance(value, list):
        raise ValueError(f"{field} must be an array")

    return value


def _require_string(
    value: object,
    *,
    field: str,
) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{field} must be a string")

    return value


def _require_non_empty_string(
    value: object,
    *,
    field: str,
) -> str:
    text = _require_string(
        value,
        field=field,
    )

    if not text.strip():
        raise ValueError(
            f"{field} must be a non-empty string"
        )

    return text


def _require_probability(
    value: object,
    *,
    field: str,
    default: float,
) -> float:
    if value is None:
        return default

    if (
        not isinstance(value, (int, float))
        or isinstance(value, bool)
    ):
        raise ValueError(
            f"{field} must be numeric"
        )

    probability = float(value)

    if probability < 0 or probability > 1:
        raise ValueError(
            f"{field} must be between 0 and 1"
        )

    return probability


def _js_round_nonnegative(
    value: float,
) -> int:
    return int(
        math.floor(value + 0.5)
    )


def _decode_provider_payload(
    provider_result: Mapping[str, Any],
) -> Mapping[str, Any]:
    text = _require_non_empty_string(
        provider_result.get("text"),
        field="provider_result.text",
    )

    try:
        decoded = json.loads(text)

    except json.JSONDecodeError:
        cleaned = re.sub(
            r"```json\n?|\n?```",
            "",
            text,
        ).strip()

        try:
            decoded = json.loads(cleaned)

        except json.JSONDecodeError as exc:
            raise ValueError(
                "provider_result.text contains malformed JSON: "
                f"{exc.msg}"
            ) from exc

    return _require_mapping(
        decoded,
        field="provider_result.text",
    )


def _normalize_evidence_examples(
    value: object,
    *,
    cluster_index: int,
) -> list[JsonObject]:
    if value is None:
        return []

    items = _require_list(
        value,
        field=(
            f"misconceptionClusters[{cluster_index}]"
            ".evidenceExamples"
        ),
    )

    normalized: list[JsonObject] = []

    for evidence_index, item in enumerate(items):
        field = (
            f"misconceptionClusters[{cluster_index}]"
            f".evidenceExamples[{evidence_index}]"
        )

        evidence = _require_mapping(
            item,
            field=field,
        )

        normalized_item: JsonObject = {
            "studentId": _require_string(
                evidence.get("studentId"),
                field=f"{field}.studentId",
            ),
            "excerpt": _require_string(
                evidence.get("excerpt"),
                field=f"{field}.excerpt",
            ),
            "groundingReason": _require_string(
                evidence.get("groundingReason"),
                field=f"{field}.groundingReason",
            ),
        }

        source_type = evidence.get("sourceType")

        if source_type is not None:
            source_type = _require_string(
                source_type,
                field=f"{field}.sourceType",
            )

            if source_type not in _SOURCE_TYPES:
                raise ValueError(
                    f"{field}.sourceType is invalid"
                )

            normalized_item["sourceType"] = source_type

        deterministic_match = evidence.get(
            "deterministicMatch"
        )

        if deterministic_match is not None:
            deterministic_match = _require_string(
                deterministic_match,
                field=f"{field}.deterministicMatch",
            )

            if deterministic_match not in _DETERMINISTIC_MATCHES:
                raise ValueError(
                    f"{field}.deterministicMatch is invalid"
                )

            normalized_item["deterministicMatch"] = deterministic_match

        normalized.append(normalized_item)

    return normalized


def _normalize_clusters(
    raw_clusters: object,
    *,
    observation_count: int,
) -> list[JsonObject]:
    if raw_clusters is None:
        clusters = []
    else:
        clusters = _require_list(
            raw_clusters,
            field="misconceptionClusters",
        )

    normalized: list[JsonObject] = []

    for index, item in enumerate(clusters):
        field = f"misconceptionClusters[{index}]"

        cluster = _require_mapping(
            item,
            field=field,
        )

        cluster_id = _require_string(
            cluster.get("clusterId"),
            field=f"{field}.clusterId",
        )

        title = _require_string(
            cluster.get("misconceptionTitle"),
            field=f"{field}.misconceptionTitle",
        )

        explanation = _require_string(
            cluster.get("explanation"),
            field=f"{field}.explanation",
        )

        affected_raw = _require_list(
            cluster.get("affectedStudentIds"),
            field=f"{field}.affectedStudentIds",
        )

        affected: list[str] = []

        for student_index, student_id in enumerate(
            affected_raw
        ):
            affected.append(
                _require_string(
                    student_id,
                    field=(
                        f"{field}.affectedStudentIds"
                        f"[{student_index}]"
                    ),
                )
            )

        teaching_priority = cluster.get(
            "teachingPriority",
            "high",
        )

        teaching_priority = _require_string(
            teaching_priority,
            field=f"{field}.teachingPriority",
        )

        if teaching_priority not in _TEACHING_PRIORITIES:
            raise ValueError(
                f"{field}.teachingPriority is invalid"
            )

        confidence = _require_probability(
            cluster.get("confidence"),
            field=f"{field}.confidence",
            default=0.9,
        )

        recommended_response = _require_string(
            cluster.get(
                "recommendedInstructionalResponse"
            ),
            field=(
                f"{field}."
                "recommendedInstructionalResponse"
            ),
        )

        count = len(affected)
        denominator = max(
            1,
            observation_count,
        )

        percentage = _js_round_nonnegative(
            count / denominator * 100
        )

        normalized.append(
            {
                "clusterId": cluster_id or f"cluster-{index + 1}",
                "misconceptionTitle": (
                    title or f"Misconception {index + 1}"
                ),
                "explanation": explanation,
                "affectedStudentIds": affected,
                "studentCount": count,
                "percentageAffected": percentage,
                "evidenceExamples": (
                    _normalize_evidence_examples(
                        cluster.get("evidenceExamples"),
                        cluster_index=index,
                    )
                ),
                "teachingPriority": teaching_priority,
                "confidence": confidence,
                "recommendedInstructionalResponse": recommended_response,
                "status": "pending",
                "teacherDecision": "pending",
            }
        )

    return normalized


def _normalize_snapshot(
    raw_snapshot: object,
    *,
    observation_count: int,
    cluster_count: int,
) -> JsonObject:
    if raw_snapshot is None:
        return {
            "totalSubmissions": observation_count,
            "misconceptionCount": cluster_count,
            "strongestConcept": "Core objective foundation",
            "highestPriorityNeed": (
                "Targeted misconception remediation"
            ),
            "overallRecommendation": (
                "Address the highest-prevalence misconception "
                "in tomorrow's opening diagnostic review."
            ),
        }

    snapshot = _require_mapping(
        raw_snapshot,
        field="classSnapshot",
    )

    strongest = snapshot.get(
        "strongestConcept",
        "Core objective foundation",
    )

    highest_priority = snapshot.get(
        "highestPriorityNeed",
        "Targeted misconception remediation",
    )

    recommendation = snapshot.get(
        "overallRecommendation",
        (
            "Address highest-prevalence misconception "
            "in tomorrow warm-up."
        ),
    )

    return {
        "totalSubmissions": observation_count,
        "misconceptionCount": cluster_count,
        "strongestConcept": _require_string(
            strongest,
            field="classSnapshot.strongestConcept",
        ),
        "highestPriorityNeed": _require_string(
            highest_priority,
            field="classSnapshot.highestPriorityNeed",
        ),
        "overallRecommendation": _require_string(
            recommendation,
            field="classSnapshot.overallRecommendation",
        ),
    }


def diagnose_class_patterns_from_provider_result(
    context: Mapping[str, Any],
    observations: Sequence[Mapping[str, Any]],
    provider_result: Mapping[str, Any],
) -> DiagnosisResult:
    _require_mapping(
        context,
        field="context",
    )

    if isinstance(
        observations,
        (str, bytes, bytearray),
    ):
        raise ValueError(
            "observations must be an array"
        )

    normalized_observations: list[
        Mapping[str, Any]
    ] = []

    for index, observation in enumerate(
        observations
    ):
        normalized_observations.append(
            _require_mapping(
                observation,
                field=f"observations[{index}]",
            )
        )

    provider_result = _require_mapping(
        provider_result,
        field="provider_result",
    )

    raw = _decode_provider_payload(
        provider_result
    )

    clusters = _normalize_clusters(
        raw.get("misconceptionClusters"),
        observation_count=len(
            normalized_observations
        ),
    )

    snapshot = _normalize_snapshot(
        raw.get("classSnapshot"),
        observation_count=len(
            normalized_observations
        ),
        cluster_count=len(clusters),
    )

    model_used = _require_non_empty_string(
        provider_result.get("modelUsed"),
        field="provider_result.modelUsed",
    )

    duration = provider_result.get(
        "durationMs"
    )

    if (
        not isinstance(
            duration,
            (int, float),
        )
        or isinstance(duration, bool)
    ):
        raise ValueError(
            "provider_result.durationMs must be numeric"
        )

    if duration < 0:
        raise ValueError(
            "provider_result.durationMs must be non-negative"
        )

    telemetry = dict(
        _require_mapping(
            provider_result.get("telemetry"),
            field="provider_result.telemetry",
        )
    )

    return DiagnosisResult(
        class_snapshot=snapshot,
        misconception_clusters=clusters,
        model_used=model_used,
        duration_ms=float(duration),
        telemetry=telemetry,
    )


def diagnose_class_patterns(
    context: Mapping[str, Any],
    observations: Sequence[Mapping[str, Any]],
    *,
    provider: DiagnosisProvider,
) -> DiagnosisResult:
    normalized_context = _require_mapping(
        context,
        field="context",
    )

    if isinstance(
        observations,
        (str, bytes, bytearray),
    ):
        raise ValueError(
            "observations must be an array"
        )

    normalized_observations: list[
        Mapping[str, Any]
    ] = []

    for index, observation in enumerate(
        observations
    ):
        normalized_observations.append(
            _require_mapping(
                observation,
                field=f"observations[{index}]",
            )
        )

    provider_result = provider(
        context=normalized_context,
        observations=normalized_observations,
    )

    return diagnose_class_patterns_from_provider_result(
        normalized_context,
        normalized_observations,
        provider_result,
    )
