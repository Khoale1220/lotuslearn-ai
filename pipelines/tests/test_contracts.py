"""Tests for JSON Schema Draft 2020-12 meta-validation and strict format checking."""

from lotuslearn_pipeline.contracts import get_schema_validator, load_canonical_schema


def test_schema_itself_is_valid_draft_2020_12():
    """Canonical schema must validate cleanly against Draft 2020-12 meta-schema."""
    schema = load_canonical_schema()
    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    assert "$defs" in schema
    assert "oneOf" in schema


def test_format_validation_rejects_invalid_date_time():
    """Format validation must fail for strings that are not valid ISO 8601 UTC date-times."""
    validator = get_schema_validator()

    bad_event = {
        "schema_version": "1.0.0",
        "event_id": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        "event_type": "ANALYSIS_INGESTED",
        "occurred_at": "not-a-date",  # Invalid date-time format
        "analysis_run_id": "run-001",
        "provenance": "source",
        "dataset_fingerprint": "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
        "submission_count": 20,
        "subject": "English Language Arts",
        "grade_level": "Grade 10",
    }

    errors = list(validator.iter_errors(bad_event))
    assert len(errors) > 0, "Expected format validation error for 'not-a-date'"
    all_errs = [e for e in errors] + [sub for e in errors for sub in e.context]
    format_errors = [e for e in all_errs if e.validator == "format"]
    assert len(format_errors) > 0, "Expected validator to be 'format'"
    assert format_errors[0].path[0] == "occurred_at"


def test_decision_recorded_rejects_pending_decision():
    """'pending' is application recommendation state, not a teacher decision."""
    validator = get_schema_validator()

    pending_event = {
        "schema_version": "1.0.0",
        "event_id": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        "event_type": "DECISION_RECORDED",
        "occurred_at": "2026-10-26T10:15:00Z",
        "analysis_run_id": "run-001",
        "provenance": "human",
        "target_type": "misconception_cluster",
        "target_id": "cluster-123",
        "teacher_decision": "pending",  # Invalid enum
        "decision_recorded_at": "2026-10-26T10:15:00Z",
    }

    errors = list(validator.iter_errors(pending_event))
    assert len(errors) > 0, "'pending' must be rejected in DECISION_RECORDED events"
