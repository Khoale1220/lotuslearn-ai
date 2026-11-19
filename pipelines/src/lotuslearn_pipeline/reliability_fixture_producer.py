"""Deterministic reliability fixtures for analytical-event persistence tests."""

from __future__ import annotations

import json
import sys
from typing import Any

from lotuslearn_pipeline.analytical_event_id import compute_event_id
from lotuslearn_pipeline.analytical_event_producer import assert_zero_pii

_RUN_ID = "run-de02b-rel-001"
_OCCURRED_AT = "2026-10-26T10:00:00Z"
_FINGERPRINT = (
    "a1b2c3d4e5f60718293a4b5c6d7e8f90"
    "a1b2c3d4e5f60718293a4b5c6d7e8f90"
)


def _base_event(
    *,
    event_type: str,
    run_id: str,
    occurred_at: str,
    provenance: str,
    business_key: str,
) -> dict[str, Any]:
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


def _analysis_run_event() -> dict[str, Any]:
    event = _base_event(
        event_type="ANALYSIS_INGESTED",
        run_id=_RUN_ID,
        occurred_at=_OCCURRED_AT,
        provenance="source",
        business_key="metadata",
    )

    event.update(
        {
            "dataset_fingerprint": _FINGERPRINT,
            "submission_count": 24,
            "subject": "Mathematics",
            "grade_level": "Grade 8",
            "total_duration_ms": 1850,
            "execution_mode": "live_gemini",
        }
    )

    return event


def _finding_fractions() -> dict[str, Any]:
    event = _base_event(
        event_type="FINDING_IDENTIFIED",
        run_id=_RUN_ID,
        occurred_at="2026-10-26T10:01:00Z",
        provenance="gemini",
        business_key="cluster-fractions",
    )

    event.update(
        {
            "finding_id": "cluster-fractions",
            "concept": "Adding Fractions with Unlike Denominators",
            "teaching_priority": "urgent",
            "affected_student_count": 8,
            "affected_student_ids": [
                "stu-01",
                "stu-02",
                "stu-03",
                "stu-04",
                "stu-05",
                "stu-06",
                "stu-07",
                "stu-08",
            ],
            "percentage_affected": 33.3,
            "explanation": (
                "Students add numerators and denominators directly across."
            ),
        }
    )

    return event


def _finding_decimals() -> dict[str, Any]:
    event = _base_event(
        event_type="FINDING_IDENTIFIED",
        run_id=_RUN_ID,
        occurred_at="2026-10-26T10:02:00Z",
        provenance="gemini",
        business_key="cluster-decimals",
    )

    event.update(
        {
            "finding_id": "cluster-decimals",
            "concept": "Decimal Place Alignment",
            "teaching_priority": "high",
            "affected_student_count": 4,
            "affected_student_ids": [
                "stu-09",
                "stu-10",
                "stu-11",
                "stu-12",
            ],
            "percentage_affected": 16.7,
            "explanation": (
                "Misaligned tenths and hundredths columns during subtraction."
            ),
        }
    )

    return event


def _group_event() -> dict[str, Any]:
    event = _base_event(
        event_type="GROUP_FORMED",
        run_id=_RUN_ID,
        occurred_at="2026-10-26T10:03:00Z",
        provenance="gemini",
        business_key="group-fractions-lab",
    )

    event.update(
        {
            "group_id": "group-fractions-lab",
            "group_name": "Visual Denominator Commonality Lab",
            "student_count": 8,
            "student_ids": [
                "stu-01",
                "stu-02",
                "stu-03",
                "stu-04",
                "stu-05",
                "stu-06",
                "stu-07",
                "stu-08",
            ],
            "suggested_activity": (
                "Fraction strip folding and common multiple visualization"
            ),
            "estimated_duration": "20 min",
        }
    )

    return event


def _verification_event() -> dict[str, Any]:
    event = _base_event(
        event_type="VERIFICATION_AUDITED",
        run_id=_RUN_ID,
        occurred_at="2026-10-26T10:04:00Z",
        provenance="deterministic_code",
        business_key="audit",
    )

    event.update(
        {
            "overall_status": "verified",
            "coverage_passed": True,
            "cluster_math_passed": True,
            "group_partition_passed": True,
            "quotes_grounded_count": 12,
            "quotes_flagged_count": 0,
        }
    )

    return event


def _decision_event(
    *,
    business_key: str,
    occurred_at: str,
    target_type: str,
    target_id: str,
    teacher_decision: str,
    notes: str,
) -> dict[str, Any]:
    event = _base_event(
        event_type="DECISION_RECORDED",
        run_id=_RUN_ID,
        occurred_at=occurred_at,
        provenance="human",
        business_key=business_key,
    )

    return {
        "schema_version": event["schema_version"],
        "event_id": event["event_id"],
        "event_type": event["event_type"],
        "occurred_at": event["occurred_at"],
        "decision_recorded_at": occurred_at,
        "analysis_run_id": event["analysis_run_id"],
        "provenance": event["provenance"],
        "target_type": target_type,
        "target_id": target_id,
        "teacher_decision": teacher_decision,
        "notes": notes,
    }


def _conflicting_analysis_runs() -> tuple[
    dict[str, Any],
    dict[str, Any],
]:
    run_id = "run-de02b-conflict-002"

    run_a = _base_event(
        event_type="ANALYSIS_INGESTED",
        run_id=run_id,
        occurred_at=_OCCURRED_AT,
        provenance="source",
        business_key="metadata-a",
    )

    run_a.update(
        {
            "dataset_fingerprint": _FINGERPRINT,
            "submission_count": 20,
            "subject": "Mathematics",
            "grade_level": "Grade 8",
            "total_duration_ms": 1200,
            "execution_mode": "live_gemini",
        }
    )

    run_b = _base_event(
        event_type="ANALYSIS_INGESTED",
        run_id=run_id,
        occurred_at=_OCCURRED_AT,
        provenance="source",
        business_key="metadata-b",
    )

    run_b.update(
        {
            "dataset_fingerprint": _FINGERPRINT,
            "submission_count": 20,
            "subject": "Mathematics",
            "grade_level": "Grade 8",
            "total_duration_ms": 9999,
            "execution_mode": "demo_resilience",
        }
    )

    return run_a, run_b


def generate_reliability_suite() -> dict[str, Any]:
    analysis_run = _analysis_run_event()
    finding_fractions = _finding_fractions()
    finding_decimals = _finding_decimals()
    group = _group_event()
    verification = _verification_event()

    initial_group_decision = _decision_event(
        business_key="action-group-fractions-1100",
        occurred_at="2026-10-26T11:00:00Z",
        target_type="differentiated_intervention",
        target_id="group-fractions-lab",
        teacher_decision="edited",
        notes="Teacher adjusted intervention time to 25 min",
    )

    final_group_decision = _decision_event(
        business_key="action-group-fractions-1230",
        occurred_at="2026-10-26T12:30:00Z",
        target_type="differentiated_intervention",
        target_id="group-fractions-lab",
        teacher_decision="dismissed",
        notes=(
            "Teacher dismissed recommendation "
            "in favor of whole-class review"
        ),
    )

    shared_timestamp = "2026-10-26T12:00:00Z"

    decision_a = _decision_event(
        business_key="action-cluster-fractions-1200-a",
        occurred_at=shared_timestamp,
        target_type="misconception_cluster",
        target_id="cluster-fractions",
        teacher_decision="accepted",
        notes=(
            "Teacher verified fraction diagnostic "
            "cluster (initial confirmation)"
        ),
    )

    decision_b = _decision_event(
        business_key="action-cluster-fractions-1200-b",
        occurred_at=shared_timestamp,
        target_type="misconception_cluster",
        target_id="cluster-fractions",
        teacher_decision="edited",
        notes="Teacher updated notes at identical timestamp",
    )

    standard_batch = [
        analysis_run,
        finding_fractions,
        finding_decimals,
        group,
        verification,
        initial_group_decision,
        final_group_decision,
    ]

    for event in [
        *standard_batch,
        decision_a,
        decision_b,
    ]:
        assert_zero_pii(event)

    replay_pair = {
        "original": dict(analysis_run),
        "replay": dict(analysis_run),
    }

    conflicting_payload = dict(analysis_run)
    conflicting_payload["subject"] = "Algebra I Honors"

    run_a, run_b = _conflicting_analysis_runs()

    return {
        "standardBatch": standard_batch,
        "replayPair": replay_pair,
        "payloadConflictPair": {
            "original": dict(analysis_run),
            "conflicting": conflicting_payload,
        },
        "analysisRunConflictPair": {
            "runA": run_a,
            "runB": run_b,
        },
        "equalTimestampDecisions": {
            "decisionA": decision_a,
            "decisionB": decision_b,
        },
    }


def render_reliability_fixture() -> str:
    return json.dumps(
        generate_reliability_suite(),
        indent=2,
        ensure_ascii=False,
    )


def main() -> int:
    sys.stdout.write(
        render_reliability_fixture()
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
