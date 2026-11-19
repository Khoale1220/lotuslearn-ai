"""Canonical analytical event production for LotusLearn analysis results.

This module is the Python ownership target for the legacy TypeScript
analytical-event producer.

It intentionally reuses the canonical Python event-ID and privacy contracts
instead of maintaining duplicate implementations.
"""

from __future__ import annotations

import hashlib
from typing import Any

from lotuslearn_pipeline.analytical_event_id import compute_event_id
from lotuslearn_pipeline.ingestion import AnalyticalEventValidator

_VALID_DECISIONS = frozenset(
    {
        "accepted",
        "edited",
        "dismissed",
    }
)

_VALID_VERIFICATION_STATUSES = frozenset(
    {
        "verified",
        "partially_verified",
        "needs_review",
    }
)

_PRIVACY_VALIDATOR = AnalyticalEventValidator()


def assert_zero_pii(event: dict[str, Any]) -> None:
    """Apply the canonical Python privacy contract."""

    privacy_ok, reason = _PRIVACY_VALIDATOR.validate_privacy(event)

    if not privacy_ok:
        raise ValueError(
            f"Analytical event rejected: {reason}"
        )

    for key in (
        "affected_student_ids",
        "student_ids",
    ):
        values = event.get(key)

        if not isinstance(values, list):
            continue

        for student_id in values:
            if (
                not isinstance(student_id, str)
                or not student_id.strip()
            ):
                raise ValueError(
                    "Analytical event rejected: "
                    "invalid student ID format."
                )


def _fallback_dataset_fingerprint(
    observations: Any,
) -> str:
    """Match the TypeScript fallback dataset fingerprint."""

    if not isinstance(observations, list):
        observations = []

    observation_keys: list[str] = []

    for observation in observations:
        if not isinstance(observation, dict):
            continue

        student_id = observation.get(
            "studentId",
            "",
        )

        demonstrated = observation.get(
            "demonstratedUnderstanding"
        )

        misconceptions = (
            observation.get("misconceptions")
            or []
        )

        demonstrated_values = (
            sorted(demonstrated)
            if isinstance(demonstrated, list)
            else []
        )

        misconception_values = (
            sorted(misconceptions)
            if isinstance(misconceptions, list)
            else []
        )

        observation_keys.append(
            f"{student_id}:"
            f"{','.join(demonstrated_values)}:"
            f"{','.join(misconception_values)}"
        )

    canonical = ";".join(
        sorted(observation_keys)
    )

    return hashlib.sha256(
        canonical.encode("utf-8")
    ).hexdigest()


def _put_if_present(
    event: dict[str, Any],
    key: str,
    value: Any,
) -> None:
    """Omit None like JSON.stringify omits JavaScript undefined."""

    if value is not None:
        event[key] = value


def _base_event(
    *,
    event_type: str,
    run_id: str,
    occurred_at: str,
    provenance: str,
    business_key: str,
) -> dict[str, Any]:
    """Build the canonical event envelope."""

    return {
        "schema_version": "1.0.0",
        "event_id": compute_event_id(
            event_type,
            run_id,
            business_key,
        ),
        "event_type": event_type,
        "occurred_at": occurred_at,
        "analysis_run_id": run_id,
        "provenance": provenance,
    }


def _decision_event(
    *,
    run_id: str,
    target_prefix: str,
    target_type: str,
    target_id: str,
    decision: str,
    decision_recorded_at: str,
) -> dict[str, Any]:
    """Build an authentic human decision event."""

    event = _base_event(
        event_type="DECISION_RECORDED",
        run_id=run_id,
        occurred_at=decision_recorded_at,
        provenance="human",
        business_key=(
            f"{target_prefix}:"
            f"{target_id}:"
            f"{decision}:"
            f"{decision_recorded_at}"
        ),
    )

    event.update(
        {
            "target_type": target_type,
            "target_id": target_id,
            "teacher_decision": decision,
            "decision_recorded_at": decision_recorded_at,
        }
    )

    assert_zero_pii(event)

    return event


def _validated_context(
    result: dict[str, Any],
) -> tuple[str, str]:
    """Validate and return subject and grade level."""

    context = result.get("context")

    if not isinstance(context, dict):
        context = {}

    subject = context.get("subject")

    if (
        not isinstance(subject, str)
        or not subject.strip()
    ):
        raise ValueError(
            "Analytical event rejected: "
            "missing subject in analysis context."
        )

    grade_level = context.get("gradeLevel")

    if (
        not isinstance(grade_level, str)
        or not grade_level.strip()
    ):
        raise ValueError(
            "Analytical event rejected: "
            "missing grade_level in analysis context."
        )

    return subject, grade_level


def _resolve_submission_count(
    result: dict[str, Any],
) -> int | float:
    """Resolve submission count using TypeScript nullish semantics."""

    class_snapshot = result.get("classSnapshot")

    if not isinstance(class_snapshot, dict):
        class_snapshot = {}

    submission_count = class_snapshot.get(
        "totalSubmissions"
    )

    if submission_count is None:
        observations = result.get(
            "studentObservations"
        )

        if (
            isinstance(observations, list)
            and observations
        ):
            submission_count = len(observations)

    if (
        isinstance(submission_count, bool)
        or not isinstance(
            submission_count,
            (int, float),
        )
        or submission_count < 1
    ):
        raise ValueError(
            "Analytical event rejected: "
            "missing or invalid submission_count."
        )

    return submission_count


def _execution_metadata(
    result: dict[str, Any],
) -> dict[str, Any]:
    """Return execution metadata as a mapping."""

    metadata = result.get("executionMetadata")

    if isinstance(metadata, dict):
        return metadata

    return {}


def _dataset_fingerprint(
    result: dict[str, Any],
    execution_metadata: dict[str, Any],
) -> str:
    """Resolve the TypeScript dataset-fingerprint contract."""

    return (
        execution_metadata.get("datasetFingerprint")
        or _fallback_dataset_fingerprint(
            result.get("studentObservations")
        )
    )


def _build_analysis_ingested_event(
    *,
    result: dict[str, Any],
    run_id: str,
    occurred_at: str,
    subject: str,
    grade_level: str,
    submission_count: int | float,
    execution_metadata: dict[str, Any],
) -> dict[str, Any]:
    """Build the single ANALYSIS_INGESTED event."""

    fingerprint = _dataset_fingerprint(
        result,
        execution_metadata,
    )

    event = _base_event(
        event_type="ANALYSIS_INGESTED",
        run_id=run_id,
        occurred_at=occurred_at,
        provenance="source",
        business_key=fingerprint,
    )

    event.update(
        {
            "dataset_fingerprint": fingerprint,
            "submission_count": submission_count,
            "subject": subject,
            "grade_level": grade_level,
        }
    )

    _put_if_present(
        event,
        "total_duration_ms",
        execution_metadata.get(
            "totalDurationMs"
        ),
    )

    _put_if_present(
        event,
        "execution_mode",
        execution_metadata.get(
            "executionMode"
        ),
    )

    assert_zero_pii(event)

    return event


def _cluster_decision(
    *,
    cluster: dict[str, Any],
    run_id: str,
    cluster_id: str,
) -> dict[str, Any] | None:
    """Return a cluster decision only when authentic and final."""

    decision = (
        cluster.get("teacherDecision")
        or cluster.get("status")
    )

    decision_recorded_at = cluster.get(
        "decisionRecordedAt"
    )

    if (
        not decision
        or decision == "pending"
        or decision not in _VALID_DECISIONS
        or not decision_recorded_at
    ):
        return None

    return _decision_event(
        run_id=run_id,
        target_prefix="cluster",
        target_type="misconception_cluster",
        target_id=cluster_id,
        decision=decision,
        decision_recorded_at=decision_recorded_at,
    )


def _build_cluster_events(
    *,
    result: dict[str, Any],
    run_id: str,
    occurred_at: str,
) -> list[dict[str, Any]]:
    """Build findings and their immediately-following decisions."""

    clusters = result.get("misconceptionClusters")

    if not isinstance(clusters, list):
        return []

    events: list[dict[str, Any]] = []

    for cluster in sorted(
        clusters,
        key=lambda item: item.get(
            "clusterId",
            "",
        ),
    ):
        teaching_priority = cluster.get(
            "teachingPriority"
        )

        if not teaching_priority:
            raise ValueError(
                "Analytical event rejected: "
                f"cluster {cluster.get('clusterId')} "
                "is missing teachingPriority."
            )

        cluster_id = cluster.get("clusterId")

        student_ids = sorted(
            cluster.get("affectedStudentIds")
            or []
        )

        affected_count = (
            cluster.get("studentCount")
            or len(student_ids)
        )

        event = _base_event(
            event_type="FINDING_IDENTIFIED",
            run_id=run_id,
            occurred_at=occurred_at,
            provenance="gemini",
            business_key=cluster_id,
        )

        event.update(
            {
                "finding_id": cluster_id,
                "concept": cluster.get(
                    "misconceptionTitle"
                ),
                "teaching_priority": teaching_priority,
                "affected_student_count": affected_count,
                "affected_student_ids": student_ids,
            }
        )

        _put_if_present(
            event,
            "percentage_affected",
            cluster.get("percentageAffected"),
        )

        _put_if_present(
            event,
            "explanation",
            cluster.get("explanation"),
        )

        assert_zero_pii(event)

        events.append(event)

        decision_event = _cluster_decision(
            cluster=cluster,
            run_id=run_id,
            cluster_id=cluster_id,
        )

        if decision_event is not None:
            events.append(decision_event)

    return events


def _build_group_events(
    *,
    result: dict[str, Any],
    run_id: str,
    occurred_at: str,
) -> list[dict[str, Any]]:
    """Build deterministic GROUP_FORMED events."""

    groups = result.get("instructionalGroups")

    if not isinstance(groups, list):
        return []

    events: list[dict[str, Any]] = []

    for group in sorted(
        groups,
        key=lambda item: item.get(
            "groupId",
            "",
        ),
    ):
        suggested_activity = group.get(
            "suggestedActivity"
        )

        if (
            not isinstance(
                suggested_activity,
                str,
            )
            or not suggested_activity.strip()
        ):
            raise ValueError(
                "Analytical event rejected: "
                f"group {group.get('groupId')} "
                "is missing suggestedActivity."
            )

        group_id = group.get("groupId")

        student_ids = sorted(
            group.get("studentIds")
            or []
        )

        event = _base_event(
            event_type="GROUP_FORMED",
            run_id=run_id,
            occurred_at=occurred_at,
            provenance="gemini",
            business_key=group_id,
        )

        event.update(
            {
                "group_id": group_id,
                "group_name": group.get(
                    "groupName"
                ),
                "student_count": len(
                    student_ids
                ),
                "student_ids": student_ids,
                "suggested_activity": suggested_activity,
            }
        )

        _put_if_present(
            event,
            "estimated_duration",
            group.get("estimatedDuration"),
        )

        assert_zero_pii(event)

        events.append(event)

    return events


def _validated_verification_checks(
    verification: dict[str, Any],
) -> dict[str, Any]:
    """Validate mandatory deterministic verification booleans."""

    checks = verification.get(
        "deterministicChecks"
    )

    if (
        not isinstance(checks, dict)
        or not isinstance(
            checks.get("coveragePassed"),
            bool,
        )
        or not isinstance(
            checks.get("clusterMathPassed"),
            bool,
        )
        or not isinstance(
            checks.get("groupPartitionPassed"),
            bool,
        )
    ):
        raise ValueError(
            "Analytical event rejected: "
            "verification event missing mandatory "
            "deterministic check booleans."
        )

    return checks


def _validated_verification_status(
    verification: dict[str, Any],
) -> str:
    """Validate the verification overall status."""

    status = verification.get(
        "overallStatus"
    )

    if status not in _VALID_VERIFICATION_STATUSES:
        raise ValueError(
            "Analytical event rejected: "
            "verification overallStatus is "
            "invalid or missing "
            f"('{status}')."
        )

    return status


def _build_verification_event(
    *,
    result: dict[str, Any],
    run_id: str,
    occurred_at: str,
) -> dict[str, Any] | None:
    """Build verification event only when verification occurred."""

    verification = result.get("verification")

    if verification is None:
        return None

    if not isinstance(verification, dict):
        raise ValueError(
            "Analytical event rejected: "
            "verification event missing mandatory "
            "deterministic check booleans."
        )

    checks = _validated_verification_checks(
        verification
    )

    status = _validated_verification_status(
        verification
    )

    quotes_grounded_count = checks.get(
        "quotesGroundedCount"
    )

    if quotes_grounded_count is None:
        quotes_grounded_count = 0

    quotes_flagged_count = checks.get(
        "quotesFlaggedCount"
    )

    if quotes_flagged_count is None:
        quotes_flagged_count = 0

    event = _base_event(
        event_type="VERIFICATION_AUDITED",
        run_id=run_id,
        occurred_at=occurred_at,
        provenance="deterministic_code",
        business_key="audit",
    )

    event.update(
        {
            "overall_status": status,
            "coverage_passed": checks[
                "coveragePassed"
            ],
            "cluster_math_passed": checks[
                "clusterMathPassed"
            ],
            "group_partition_passed": checks[
                "groupPartitionPassed"
            ],
            "quotes_grounded_count": (
                quotes_grounded_count
            ),
            "quotes_flagged_count": (
                quotes_flagged_count
            ),
        }
    )

    assert_zero_pii(event)

    return event


def _intervention_decision(
    *,
    intervention: dict[str, Any],
    run_id: str,
) -> dict[str, Any] | None:
    """Return an authentic intervention decision when present."""

    decision = (
        intervention.get("teacherDecision")
        or intervention.get("status")
    )

    decision_recorded_at = intervention.get(
        "decisionRecordedAt"
    )

    if (
        not decision
        or decision == "pending"
        or decision not in _VALID_DECISIONS
        or not decision_recorded_at
    ):
        return None

    intervention_id = intervention.get(
        "interventionId"
    )

    return _decision_event(
        run_id=run_id,
        target_prefix="intervention",
        target_type="differentiated_intervention",
        target_id=intervention_id,
        decision=decision,
        decision_recorded_at=decision_recorded_at,
    )


def _build_intervention_decision_events(
    *,
    result: dict[str, Any],
    run_id: str,
) -> list[dict[str, Any]]:
    """Build final intervention decision events."""

    interventions = result.get(
        "interventions"
    )

    if not isinstance(interventions, list):
        return []

    events: list[dict[str, Any]] = []

    for intervention in sorted(
        interventions,
        key=lambda item: item.get(
            "interventionId",
            "",
        ),
    ):
        event = _intervention_decision(
            intervention=intervention,
            run_id=run_id,
        )

        if event is not None:
            events.append(event)

    return events


def produce_analytical_events(
    result: dict[str, Any],
) -> list[dict[str, Any]]:
    """Produce canonical deterministic analytical events."""

    if (
        not isinstance(result, dict)
        or not result.get("id")
    ):
        raise ValueError(
            "Invalid analysis result: missing id."
        )

    if not result.get("timestamp"):
        raise ValueError(
            "Invalid analysis result: missing timestamp."
        )

    run_id = result["id"]
    occurred_at = result["timestamp"]

    subject, grade_level = _validated_context(
        result
    )

    submission_count = _resolve_submission_count(
        result
    )

    execution_metadata = _execution_metadata(
        result
    )

    events = [
        _build_analysis_ingested_event(
            result=result,
            run_id=run_id,
            occurred_at=occurred_at,
            subject=subject,
            grade_level=grade_level,
            submission_count=submission_count,
            execution_metadata=execution_metadata,
        )
    ]

    events.extend(
        _build_cluster_events(
            result=result,
            run_id=run_id,
            occurred_at=occurred_at,
        )
    )

    events.extend(
        _build_group_events(
            result=result,
            run_id=run_id,
            occurred_at=occurred_at,
        )
    )

    verification_event = (
        _build_verification_event(
            result=result,
            run_id=run_id,
            occurred_at=occurred_at,
        )
    )

    if verification_event is not None:
        events.append(verification_event)

    events.extend(
        _build_intervention_decision_events(
            result=result,
            run_id=run_id,
        )
    )

    return events
