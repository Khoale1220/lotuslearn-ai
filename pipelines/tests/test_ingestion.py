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


def test_untrusted_event_id_with_email_is_sanitized_and_never_leaked(
    validator, sample_ingested_event
):
    sensitive_email = "student.john.doe@district.k12.us"
    bad_event = dict(sample_ingested_event)
    bad_event["event_id"] = sensitive_email

    res = validator.validate_event(bad_event)
    assert res.outcome == IngestionOutcome.REJECTED
    assert sensitive_email not in res.event_id
    assert sensitive_email not in (res.rejection_reason or "")
    assert res.event_id.startswith("unvalidated_")


def test_untrusted_event_id_with_phone_is_sanitized(
    validator, sample_ingested_event
):
    sensitive_phone = "+84901234567"
    bad_event = dict(sample_ingested_event)
    bad_event["event_id"] = sensitive_phone

    res = validator.validate_event(bad_event)
    assert res.outcome == IngestionOutcome.REJECTED
    assert sensitive_phone not in res.event_id
    assert sensitive_phone not in (res.rejection_reason or "")
    assert res.event_id.startswith("unvalidated_")


@pytest.mark.parametrize(
    "vn_phone",
    [
        "0901234567",
        "+84987654321",
        "098 765 4321",
        "091-234-5678",
    ],
)
def test_vietnamese_phone_formats_detected_in_payload(
    validator, sample_finding_event, vn_phone
):
    leaked_event = dict(sample_finding_event)
    leaked_event["explanation"] = f"Teacher notes with contact {vn_phone}"

    res = validator.validate_event(leaked_event)
    assert res.outcome == IngestionOutcome.REJECTED
    assert "PII_PHONE_DETECTED" in (res.rejection_reason or "")
    assert vn_phone not in (res.rejection_reason or "")


def test_unsupported_schema_version_rejected(
    validator, sample_ingested_event
):
    bad_future_event = dict(sample_ingested_event)
    bad_future_event["schema_version"] = "2.0.0"

    res = validator.validate_event(bad_future_event)
    assert res.outcome == IngestionOutcome.REJECTED
    assert "UNSUPPORTED_SCHEMA_VERSION" in (res.rejection_reason or "")

    bad_minor_event = dict(sample_ingested_event)
    bad_minor_event["schema_version"] = "1.99.0"

    res2 = validator.validate_event(bad_minor_event)
    assert res2.outcome == IngestionOutcome.REJECTED
    assert "UNSUPPORTED_SCHEMA_VERSION" in (res2.rejection_reason or "")


def test_untrusted_event_type_sanitized(
    validator, sample_ingested_event
):
    bad_event = dict(sample_ingested_event)
    bad_event["event_type"] = "MALICIOUS_TYPE_student.name@district.k12.us"

    res = validator.validate_event(bad_event)
    assert res.outcome == IngestionOutcome.REJECTED
    assert res.event_type is None
    assert "student.name@district.k12.us" not in (res.rejection_reason or "")


def test_valid_64_hex_event_id_preserved_when_schema_fails(
    validator, sample_ingested_event
):
    bad_event = dict(sample_ingested_event)
    del bad_event["subject"]  # Missing required field

    res = validator.validate_event(bad_event)
    assert res.outcome == IngestionOutcome.REJECTED
    # Valid canonical 64-hex SHA-256 event_id is preserved for operational correlation
    assert res.event_id == sample_ingested_event["event_id"]
