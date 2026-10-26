"""Unit tests for SQLite relational pipeline, foreign keys, and analytical metrics."""

import sqlite3

import pytest
from pipelines.db import AnalyticalDatabase
from pipelines.models import IngestionOutcome


@pytest.fixture
def db():
    database = AnalyticalDatabase(":memory:")
    database.initialize_schema()
    yield database
    database.close()


@pytest.fixture
def run_event():
    return {
        "schema_version": "1.0.0",
        "event_id": "1111111111111111111111111111111111111111111111111111111111111111",
        "event_type": "ANALYSIS_INGESTED",
        "occurred_at": "2026-10-26T10:00:00Z",
        "analysis_run_id": "run-test-001",
        "provenance": "source",
        "dataset_fingerprint": "2222222222222222222222222222222222222222222222222222222222222222",
        "submission_count": 20,
        "subject": "English Language Arts",
        "grade_level": "Grade 10",
        "total_duration_ms": 1200,
        "execution_mode": "demo_resilience",
    }


@pytest.fixture
def finding_event():
    return {
        "schema_version": "1.0.0",
        "event_id": "3333333333333333333333333333333333333333333333333333333333333333",
        "event_type": "FINDING_IDENTIFIED",
        "occurred_at": "2026-10-26T10:00:00Z",
        "analysis_run_id": "run-test-001",
        "provenance": "gemini",
        "finding_id": "cluster-time-markers",
        "concept": "Finished-Time Markers with Present Perfect",
        "teaching_priority": "urgent",
        "affected_student_count": 5,
        "affected_student_ids": [
            "Student 01",
            "Student 02",
            "Student 03",
            "Student 04",
            "Student 05",
        ],
        "percentage_affected": 25.0,
        "explanation": "Temporal conflict with past adverbs.",
    }


@pytest.fixture
def group_event():
    return {
        "schema_version": "1.0.0",
        "event_id": "4444444444444444444444444444444444444444444444444444444444444444",
        "event_type": "GROUP_FORMED",
        "occurred_at": "2026-10-26T10:00:00Z",
        "analysis_run_id": "run-test-001",
        "provenance": "gemini",
        "group_id": "group-review-1",
        "group_name": "Targeted Time Marker Clarification",
        "student_count": 5,
        "student_ids": ["Student 01", "Student 02", "Student 03", "Student 04", "Student 05"],
        "suggested_activity": "Adverb sorting timeline drill",
        "estimated_duration": "15 min",
    }


@pytest.fixture
def verification_event():
    return {
        "schema_version": "1.0.0",
        "event_id": "5555555555555555555555555555555555555555555555555555555555555555",
        "event_type": "VERIFICATION_AUDITED",
        "occurred_at": "2026-10-26T10:00:00Z",
        "analysis_run_id": "run-test-001",
        "provenance": "deterministic_code",
        "overall_status": "verified",
        "coverage_passed": True,
        "cluster_math_passed": True,
        "group_partition_passed": True,
        "quotes_grounded_count": 5,
        "quotes_flagged_count": 0,
    }


@pytest.fixture
def decision_events():
    return [
        {
            "schema_version": "1.0.0",
            "event_id": "6666666666666666666666666666666666666666666666666666666666666666",
            "event_type": "DECISION_RECORDED",
            "occurred_at": "2026-10-26T10:00:00Z",
            "analysis_run_id": "run-test-001",
            "provenance": "human",
            "target_type": "misconception_cluster",
            "target_id": "cluster-time-markers",
            "teacher_decision": "accepted",
        },
        {
            "schema_version": "1.0.0",
            "event_id": "7777777777777777777777777777777777777777777777777777777777777777",
            "event_type": "DECISION_RECORDED",
            "occurred_at": "2026-10-26T10:00:00Z",
            "analysis_run_id": "run-test-001",
            "provenance": "human",
            "target_type": "differentiated_intervention",
            "target_id": "intervention-time-markers",
            "teacher_decision": "edited",
        },
    ]


def test_foreign_key_constraint_fails_on_orphan_child(db, finding_event):
    # Attempting to insert child without parent analysis run must fail closed
    with pytest.raises(sqlite3.IntegrityError):
        db.load_events([finding_event])


def test_full_pipeline_load_and_metrics(
    db, run_event, finding_event, group_event, verification_event, decision_events
):
    all_events = [run_event, finding_event, group_event, verification_event] + decision_events
    db.load_events(all_events)

    metrics = db.compute_metrics()
    assert metrics.total_accepted_events == 6
    assert metrics.distinct_students_count == 5
    assert metrics.total_analysis_runs == 1

    # Verify prevalence calculation (5 affected / 20 total = 0.25)
    assert len(metrics.prevalence_by_cluster) == 1
    prev = metrics.prevalence_by_cluster[0]
    assert prev["affected_students"] == 5
    assert prev["total_students"] == 20
    assert prev["prevalence_rate"] == 0.25

    # Verify educator modification rate: 1 accepted + 1 edited => 1 / 2 = 0.5
    assert metrics.educator_modification_rate == 0.5


def test_cascade_deletion(db, run_event, finding_event):
    db.load_events([run_event, finding_event])

    conn = db.get_connection()
    # Delete parent analysis run
    conn.execute("DELETE FROM analysis_runs WHERE run_id = ?", (run_event["analysis_run_id"],))
    conn.commit()

    # Child rows must cascade delete
    cur = conn.execute("SELECT COUNT(*) FROM misconception_clusters")
    assert cur.fetchone()[0] == 0
    cur = conn.execute("SELECT COUNT(*) FROM analytical_events")
    assert cur.fetchone()[0] == 0


def test_replay_idempotency_audit_log(db, run_event):
    from pipelines.ingestion import validate_event_batch

    existing = db.get_existing_event_ids()
    results1, accepted1 = validate_event_batch([run_event], existing_ids=existing)
    db.record_audit_log(results1)
    db.load_events(accepted1)

    assert len(accepted1) == 1
    assert results1[0].outcome == IngestionOutcome.ACCEPTED

    # Replay same event second time
    existing = db.get_existing_event_ids()
    results2, accepted2 = validate_event_batch([run_event], existing_ids=existing)
    db.record_audit_log(results2)

    assert len(accepted2) == 0
    assert results2[0].outcome == IngestionOutcome.DUPLICATE

    # Ensure total accepted remains 1
    metrics = db.compute_metrics()
    assert metrics.total_accepted_events == 1
