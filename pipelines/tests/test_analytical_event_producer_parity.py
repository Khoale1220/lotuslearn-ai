"""Characterization contract for TypeScript analytical event producer migration."""

from __future__ import annotations

import hashlib
import json
from collections import Counter
from pathlib import Path
from typing import Any

import pytest

from lotuslearn_pipeline.analytical_event_id import compute_event_id
from lotuslearn_pipeline.ingestion import AnalyticalEventValidator
from lotuslearn_pipeline.models import IngestionOutcome

FIXTURE = (
    Path(__file__).parent
    / "fixtures"
    / "analytical_event_producer_parity.json"
)

EXPECTED_EVENT_COUNTS = {
    "ANALYSIS_INGESTED": 1,
    "DECISION_RECORDED": 2,
    "FINDING_IDENTIFIED": 4,
    "GROUP_FORMED": 4,
    "VERIFICATION_AUDITED": 1,
}


def _load_fixture() -> dict[str, Any]:
    payload = json.loads(FIXTURE.read_text(encoding="utf-8"))

    assert payload["fixture_version"] == 1
    assert (
        payload["source_implementation"]
        == "server/services/analyticalEventProducer.ts"
    )

    return payload


def _typescript_fallback_dataset_fingerprint(
    analysis_result: dict[str, Any],
) -> str:
    observation_keys: list[str] = []

    for observation in analysis_result.get(
        "studentObservations",
        [],
    ):
        demonstrated = sorted(
            observation.get(
                "demonstratedUnderstanding",
                [],
            )
        )
        misconceptions = sorted(
            observation.get(
                "misconceptions",
                [],
            )
        )

        observation_keys.append(
            (
                f"{observation['studentId']}:"
                f"{','.join(demonstrated)}:"
                f"{','.join(misconceptions)}"
            )
        )

    canonical = ";".join(sorted(observation_keys))

    return hashlib.sha256(
        canonical.encode("utf-8")
    ).hexdigest()


def _business_key(event: dict[str, Any]) -> str:
    event_type = event["event_type"]

    if event_type == "ANALYSIS_INGESTED":
        return event["dataset_fingerprint"]

    if event_type == "FINDING_IDENTIFIED":
        return event["finding_id"]

    if event_type == "GROUP_FORMED":
        return event["group_id"]

    if event_type == "VERIFICATION_AUDITED":
        return "audit"

    if event_type == "DECISION_RECORDED":
        target_prefix = {
            "misconception_cluster": "cluster",
            "differentiated_intervention": "intervention",
        }[event["target_type"]]

        return (
            f"{target_prefix}:"
            f"{event['target_id']}:"
            f"{event['teacher_decision']}:"
            f"{event['decision_recorded_at']}"
        )

    raise AssertionError(
        f"Unsupported event type: {event_type}"
    )


def test_golden_fixture_contract_metadata() -> None:
    payload = _load_fixture()

    normalization = payload["normalization"]
    result = payload["analysis_result"]
    events = payload["expected_events"]

    assert normalization["analysis_run_id"] == (
        "run-mig01-analytical-producer-parity-001"
    )
    assert normalization["analysis_timestamp"] == (
        "2026-10-26T10:00:00.000Z"
    )

    assert result["id"] == normalization["analysis_run_id"]
    assert result["timestamp"] == normalization["analysis_timestamp"]

    assert len(events) == 12

    counts = Counter(
        event["event_type"]
        for event in events
    )

    assert dict(counts) == EXPECTED_EVENT_COUNTS


def test_golden_events_pass_python_contract_and_privacy() -> None:
    payload = _load_fixture()
    validator = AnalyticalEventValidator()

    event_ids: set[str] = set()

    for event in payload["expected_events"]:
        result = validator.validate_event(
            event,
            seen_event_ids=event_ids,
        )

        assert result.outcome == IngestionOutcome.ACCEPTED, (
            f"{event['event_type']} rejected: "
            f"{result.rejection_reason}"
        )

        event_ids.add(event["event_id"])

    assert len(event_ids) == len(
        payload["expected_events"]
    )


def test_golden_event_ids_match_python_sha256_contract() -> None:
    payload = _load_fixture()

    for event in payload["expected_events"]:
        expected = compute_event_id(
            event["event_type"],
            event["analysis_run_id"],
            _business_key(event),
        )

        assert event["event_id"] == expected


def test_dataset_fingerprint_matches_typescript_fallback() -> None:
    payload = _load_fixture()
    analysis_result = payload["analysis_result"]

    execution_metadata = analysis_result.get(
        "executionMetadata",
        {},
    )

    assert "datasetFingerprint" not in execution_metadata

    expected_fingerprint = (
        _typescript_fallback_dataset_fingerprint(
            analysis_result
        )
    )

    ingested = next(
        event
        for event in payload["expected_events"]
        if event["event_type"] == "ANALYSIS_INGESTED"
    )

    assert ingested["dataset_fingerprint"] == (
        expected_fingerprint
    )

    assert ingested["submission_count"] == (
        analysis_result["classSnapshot"][
            "totalSubmissions"
        ]
    )


def test_golden_fixture_captures_stable_sorting() -> None:
    payload = _load_fixture()
    events = payload["expected_events"]

    finding_ids = [
        event["finding_id"]
        for event in events
        if event["event_type"] == "FINDING_IDENTIFIED"
    ]

    group_ids = [
        event["group_id"]
        for event in events
        if event["event_type"] == "GROUP_FORMED"
    ]

    assert finding_ids == sorted(finding_ids)
    assert group_ids == sorted(group_ids)

    for event in events:
        if event["event_type"] == "FINDING_IDENTIFIED":
            assert event["affected_student_ids"] == sorted(
                event["affected_student_ids"]
            )

        if event["event_type"] == "GROUP_FORMED":
            assert event["student_ids"] == sorted(
                event["student_ids"]
            )


def test_decision_events_preserve_authentic_timestamps() -> None:
    payload = _load_fixture()

    analysis_timestamp = payload[
        "normalization"
    ]["analysis_timestamp"]

    decision_events = [
        event
        for event in payload["expected_events"]
        if event["event_type"] == "DECISION_RECORDED"
    ]

    assert len(decision_events) == 2

    for event in decision_events:
        assert event["provenance"] == "human"
        assert event["occurred_at"] == (
            event["decision_recorded_at"]
        )
        assert event["occurred_at"] != analysis_timestamp

    non_decision_events = [
        event
        for event in payload["expected_events"]
        if event["event_type"] != "DECISION_RECORDED"
    ]

    for event in non_decision_events:
        assert event["occurred_at"] == analysis_timestamp


def test_python_producer_matches_typescript_golden_output_exactly() -> None:
    """Python replacement must reproduce the frozen TypeScript output exactly."""

    from lotuslearn_pipeline.analytical_event_producer import (
        produce_analytical_events,
    )

    payload = _load_fixture()

    expected = payload["expected_events"]

    first = produce_analytical_events(
        payload["analysis_result"]
    )

    second = produce_analytical_events(
        payload["analysis_result"]
    )

    assert first == expected
    assert second == expected
    assert first == second


def _fresh_analysis_result() -> dict[str, Any]:
    """Return a deep JSON-compatible copy of the frozen analysis input."""

    return json.loads(
        json.dumps(
            _load_fixture()["analysis_result"]
        )
    )


def test_python_producer_rejects_missing_subject_or_grade_level() -> None:
    from lotuslearn_pipeline.analytical_event_producer import (
        produce_analytical_events,
    )

    missing_subject = _fresh_analysis_result()
    del missing_subject["context"]["subject"]

    with pytest.raises(
        ValueError,
        match="missing subject in analysis context",
    ):
        produce_analytical_events(missing_subject)

    blank_grade = _fresh_analysis_result()
    blank_grade["context"]["gradeLevel"] = ""

    with pytest.raises(
        ValueError,
        match="missing grade_level in analysis context",
    ):
        produce_analytical_events(blank_grade)


def test_python_producer_rejects_missing_or_zero_submission_count() -> None:
    from lotuslearn_pipeline.analytical_event_producer import (
        produce_analytical_events,
    )

    missing = _fresh_analysis_result()
    del missing["classSnapshot"]["totalSubmissions"]
    missing["studentObservations"] = []

    with pytest.raises(
        ValueError,
        match="missing or invalid submission_count",
    ):
        produce_analytical_events(missing)

    zero = _fresh_analysis_result()
    zero["classSnapshot"]["totalSubmissions"] = 0

    with pytest.raises(
        ValueError,
        match="missing or invalid submission_count",
    ):
        produce_analytical_events(zero)


def test_python_producer_rejects_cluster_without_teaching_priority() -> None:
    from lotuslearn_pipeline.analytical_event_producer import (
        produce_analytical_events,
    )

    invalid = _fresh_analysis_result()

    del invalid["misconceptionClusters"][0]["teachingPriority"]

    with pytest.raises(
        ValueError,
        match="missing teachingPriority",
    ):
        produce_analytical_events(invalid)


def test_python_producer_rejects_group_without_suggested_activity() -> None:
    from lotuslearn_pipeline.analytical_event_producer import (
        produce_analytical_events,
    )

    invalid = _fresh_analysis_result()

    invalid["instructionalGroups"][0][
        "suggestedActivity"
    ] = ""

    with pytest.raises(
        ValueError,
        match="missing suggestedActivity",
    ):
        produce_analytical_events(invalid)


def test_python_producer_fails_closed_on_malformed_verification() -> None:
    from lotuslearn_pipeline.analytical_event_producer import (
        produce_analytical_events,
    )

    missing_check = _fresh_analysis_result()

    del missing_check["verification"][
        "deterministicChecks"
    ]["coveragePassed"]

    with pytest.raises(
        ValueError,
        match="missing mandatory deterministic check booleans",
    ):
        produce_analytical_events(missing_check)

    invalid_status = _fresh_analysis_result()

    invalid_status["verification"][
        "overallStatus"
    ] = "fabricated_success"

    with pytest.raises(
        ValueError,
        match="verification overallStatus is invalid or missing",
    ):
        produce_analytical_events(invalid_status)


def test_python_producer_omits_verification_when_not_performed() -> None:
    from lotuslearn_pipeline.analytical_event_producer import (
        produce_analytical_events,
    )

    result = _fresh_analysis_result()
    del result["verification"]

    events = produce_analytical_events(result)

    assert all(
        event["event_type"] != "VERIFICATION_AUDITED"
        for event in events
    )


def test_python_producer_suppresses_pending_and_legacy_decisions() -> None:
    from lotuslearn_pipeline.analytical_event_producer import (
        produce_analytical_events,
    )

    pending = _fresh_analysis_result()

    for cluster in pending["misconceptionClusters"]:
        cluster["teacherDecision"] = "pending"

    for intervention in pending["interventions"]:
        intervention["teacherDecision"] = "pending"

    pending_events = produce_analytical_events(
        pending
    )

    assert not [
        event
        for event in pending_events
        if event["event_type"] == "DECISION_RECORDED"
    ]

    legacy = _fresh_analysis_result()

    for cluster in legacy["misconceptionClusters"]:
        cluster.pop(
            "decisionRecordedAt",
            None,
        )

    for intervention in legacy["interventions"]:
        intervention.pop(
            "decisionRecordedAt",
            None,
        )

    legacy_events = produce_analytical_events(
        legacy
    )

    assert not [
        event
        for event in legacy_events
        if event["event_type"] == "DECISION_RECORDED"
    ]


def test_python_producer_decision_ids_change_with_authentic_timestamp() -> None:
    from lotuslearn_pipeline.analytical_event_producer import (
        produce_analytical_events,
    )

    first_result = _fresh_analysis_result()
    second_result = _fresh_analysis_result()

    first_result["misconceptionClusters"][0][
        "decisionRecordedAt"
    ] = "2026-10-26T10:15:00.000Z"

    second_result["misconceptionClusters"][0][
        "decisionRecordedAt"
    ] = "2026-10-26T10:25:00.000Z"

    first_events = produce_analytical_events(
        first_result
    )

    second_events = produce_analytical_events(
        second_result
    )

    first_decision = next(
        event
        for event in first_events
        if (
            event["event_type"]
            == "DECISION_RECORDED"
            and event["target_type"]
            == "misconception_cluster"
        )
    )

    second_decision = next(
        event
        for event in second_events
        if (
            event["event_type"]
            == "DECISION_RECORDED"
            and event["target_type"]
            == "misconception_cluster"
        )
    )

    assert (
        first_decision["event_id"]
        != second_decision["event_id"]
    )

    assert (
        first_decision["occurred_at"]
        != second_decision["occurred_at"]
    )


def test_python_producer_fails_closed_on_email_and_phone_pii() -> None:
    from lotuslearn_pipeline.analytical_event_producer import (
        produce_analytical_events,
    )

    email_result = _fresh_analysis_result()

    email_result["context"]["subject"] = (
        "English teacher@school.edu"
    )

    with pytest.raises(
        ValueError,
        match="PII_EMAIL_DETECTED",
    ):
        produce_analytical_events(email_result)

    phone_result = _fresh_analysis_result()

    phone_result["context"]["subject"] = (
        "English 415-555-1212"
    )

    with pytest.raises(
        ValueError,
        match="PII_PHONE_DETECTED",
    ):
        produce_analytical_events(phone_result)
