"""Unit tests for analytical event validation and privacy boundaries."""

import pytest

from lotuslearn_pipeline.ingestion import AnalyticalEventValidator, validate_event_batch
from lotuslearn_pipeline.models import IngestionOutcome


@pytest.fixture
def validator():
    return AnalyticalEventValidator()


@pytest.fixture
def sample_ingested_event():
    return {
        "schema_version": "1.0.0",
        "event_id": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        "event_type": "ANALYSIS_INGESTED",
        "occurred_at": "2026-10-26T10:00:00Z",
        "analysis_run_id": "run-001",
        "provenance": "source",
        "dataset_fingerprint": "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
        "submission_count": 25,
        "subject": "English Language Arts",
        "grade_level": "Grade 10",
    }


@pytest.fixture
def sample_finding_event():
    return {
        "schema_version": "1.0.0",
        "event_id": "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
        "event_type": "FINDING_IDENTIFIED",
        "occurred_at": "2026-10-26T10:00:00Z",
        "analysis_run_id": "run-001",
        "provenance": "gemini",
        "finding_id": "cluster-time-markers",
        "concept": "Finished-Time Markers with Present Perfect",
        "teaching_priority": "urgent",
        "affected_student_count": 8,
        "affected_student_ids": ["Student 01", "Student 02", "Student 03"],
        "percentage_affected": 32.0,
        "explanation": "Conflation of finished time markers with indefinite experiential past.",
    }


def test_valid_events_accepted(validator, sample_ingested_event, sample_finding_event):
    res1 = validator.validate_event(sample_ingested_event)
    assert res1.outcome == IngestionOutcome.ACCEPTED
    assert res1.event_id == sample_ingested_event["event_id"]

    res2 = validator.validate_event(sample_finding_event)
    assert res2.outcome == IngestionOutcome.ACCEPTED
    assert res2.event_id == sample_finding_event["event_id"]


def test_schema_violation_rejected_with_safe_path(validator, sample_ingested_event):
    bad_event = dict(sample_ingested_event)
    del bad_event["subject"]  # Required field missing

    res = validator.validate_event(bad_event)
    assert res.outcome == IngestionOutcome.REJECTED
    assert "SCHEMA_VALIDATION_FAILED" in (res.rejection_reason or "")


def test_pii_email_detected_fails_closed_safely(validator, sample_finding_event):
    sensitive_email = "student.name@district.k12.us"
    leaked_event = dict(sample_finding_event)
    leaked_event["concept"] = f"Error noticed by {sensitive_email}"

    res = validator.validate_event(leaked_event)
    assert res.outcome == IngestionOutcome.REJECTED
    assert "PII_EMAIL_DETECTED" in (res.rejection_reason or "")
    # Safe diagnostic requirement: sensitive email text must NOT appear in rejection reason!
    assert sensitive_email not in (res.rejection_reason or "")


def test_pii_phone_detected_fails_closed_safely(validator, sample_finding_event):
    sensitive_phone = "415-555-0199"
    leaked_event = dict(sample_finding_event)
    leaked_event["explanation"] = f"Call parent at {sensitive_phone}"

    res = validator.validate_event(leaked_event)
    assert res.outcome == IngestionOutcome.REJECTED
    assert "PII_PHONE_DETECTED" in (res.rejection_reason or "")
    assert sensitive_phone not in (res.rejection_reason or "")


def test_forbidden_key_rejected_safely(validator, sample_ingested_event):
    raw_event = dict(sample_ingested_event)
    raw_event["studentText"] = "I have went yesterday to market"

    res = validator.validate_event(raw_event)
    assert res.outcome == IngestionOutcome.REJECTED
    assert "FORBIDDEN_KEY_DETECTED" in (res.rejection_reason or "")


def test_duplicate_classification_in_batch(validator, sample_ingested_event):
    events = [sample_ingested_event, dict(sample_ingested_event)]
    results, accepted = validate_event_batch(events, validator=validator)

    assert len(results) == 2
    assert results[0].outcome == IngestionOutcome.ACCEPTED
    assert results[1].outcome == IngestionOutcome.DUPLICATE
    assert len(accepted) == 1
