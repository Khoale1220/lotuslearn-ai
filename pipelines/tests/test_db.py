"""Unit tests for SQLite relational pipeline, transactions, conflicts, and metrics."""

import pytest

from lotuslearn_pipeline.models import IngestionOutcome
from lotuslearn_pipeline.storage import AnalyticalDatabase


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
            "occurred_at": "2026-10-26T10:15:00Z",
            "analysis_run_id": "run-test-001",
            "provenance": "human",
            "target_type": "misconception_cluster",
            "target_id": "cluster-time-markers",
            "teacher_decision": "accepted",
            "decision_recorded_at": "2026-10-26T10:15:00Z",
        },
        {
            "schema_version": "1.0.0",
            "event_id": "7777777777777777777777777777777777777777777777777777777777777777",
            "event_type": "DECISION_RECORDED",
            "occurred_at": "2026-10-26T10:20:00Z",
            "analysis_run_id": "run-test-001",
            "provenance": "human",
            "target_type": "differentiated_intervention",
            "target_id": "intervention-time-markers",
            "teacher_decision": "edited",
            "decision_recorded_at": "2026-10-26T10:20:00Z",
        },
    ]


def test_foreign_key_constraint_fails_on_orphan_child(db, finding_event):
    """Orphan child without parent analysis run must fail closed with IntegrityError."""
    res = db.ingest_single_event(finding_event)
    assert res.outcome == IngestionOutcome.REJECTED
    assert "IntegrityError" in (res.rejection_reason or "")


def test_foreign_key_check_passes(db, run_event, finding_event):
    """PRAGMA foreign_key_check returns 0 rows after valid ingestion."""
    db.load_events([run_event, finding_event])
    conn = db.get_connection()
    fk_violations = conn.execute("PRAGMA foreign_key_check;").fetchall()
    assert len(fk_violations) == 0


def test_full_pipeline_load_and_metrics(
    db, run_event, finding_event, group_event, verification_event, decision_events
):
    all_events = [run_event, finding_event, group_event, verification_event] + decision_events
    results = db.load_events(all_events)
    assert all(r.outcome == IngestionOutcome.ACCEPTED for r in results)

    metrics = db.compute_metrics()
    assert metrics.total_accepted_events == 6
    assert metrics.run_scoped_student_appearances_count == 5
    assert metrics.student_appearances == 5
    assert metrics.total_analysis_runs == 1

    # Verify prevalence calculation (5 affected / 20 total = 0.25)
    assert len(metrics.prevalence_by_cluster) == 1
    prev = metrics.prevalence_by_cluster[0]
    assert prev["affected_students"] == 5
    assert prev["total_students"] == 20
    assert prev["prevalence_rate"] == 0.25

    # Verify educator modification rate: 1 accepted + 1 edited => 1 / 2 = 0.5
    assert metrics.educator_modification_rate == 0.5


def test_cascade_delete_safety_on_parent_replay(db, run_event, finding_event):
    """
    Replaying parent ANALYSIS_INGESTED event must NOT trigger cascade deletion
    on existing child rows (verifies DO UPDATE / DO NOTHING semantics).
    """
    db.load_events([run_event, finding_event])
    conn = db.get_connection()

    child_count = conn.execute("SELECT COUNT(*) FROM misconception_clusters").fetchone()[0]
    assert child_count == 1

    # Replay parent run event
    db.load_events([run_event])

    # Child rows must still exist!
    child_count_after = conn.execute("SELECT COUNT(*) FROM misconception_clusters").fetchone()[0]
    assert child_count_after == 1


def test_idempotent_duplicate_replay_vs_payload_conflict(db, run_event):
    """
    Same event_id + identical payload = DUPLICATE (harmless).
    Same event_id + different payload = CONFLICT (IDENTITY_CONFLICT_PAYLOAD_MISMATCH).
    """
    res1 = db.ingest_single_event(run_event)
    assert res1.outcome == IngestionOutcome.ACCEPTED

    # Replay identical event
    res2 = db.ingest_single_event(dict(run_event))
    assert res2.outcome == IngestionOutcome.DUPLICATE

    # Conflicting payload with same event_id
    conflicting_event = dict(run_event)
    conflicting_event["submission_count"] = 99  # Changed payload!

    res3 = db.ingest_single_event(conflicting_event)
    assert res3.outcome == IngestionOutcome.CONFLICT
    assert "IDENTITY_CONFLICT_PAYLOAD_MISMATCH" in (res3.rejection_reason or "")


def test_append_only_ingestion_audit_log(db, run_event):
    """Ingestion audit log appends every attempt with AUTOINCREMENT attempt_id."""
    db.ingest_single_event(run_event)
    db.ingest_single_event(dict(run_event))  # Duplicate attempt

    conn = db.get_connection()
    audit_rows = conn.execute(
        "SELECT attempt_id, event_id, outcome FROM ingestion_audit_log ORDER BY attempt_id"
    ).fetchall()
    assert len(audit_rows) == 2
    assert audit_rows[0]["attempt_id"] == 1
    assert audit_rows[0]["outcome"] == "accepted"
    assert audit_rows[1]["attempt_id"] == 2
    assert audit_rows[1]["outcome"] == "duplicate"


def test_run_scoped_pseudonym_metric_semantics(db, run_event, finding_event):
    """
    Student 01 appearing in Run A and Student 01 appearing in Run B represents
    2 run-scoped appearances, not 1 longitudinal identity.
    """
    # Run A
    db.load_events([run_event, finding_event])

    # Run B with same student pseudonym
    run_event_b = dict(run_event)
    run_event_b["event_id"] = "b" * 64
    run_event_b["analysis_run_id"] = "run-test-002"

    finding_event_b = dict(finding_event)
    finding_event_b["event_id"] = "c" * 64
    finding_event_b["analysis_run_id"] = "run-test-002"
    finding_event_b["affected_student_ids"] = ["Student 01"]
    finding_event_b["affected_student_count"] = 1

    db.load_events([run_event_b, finding_event_b])

    metrics = db.compute_metrics()
    # Run A has 5 students, Run B has 1 student => 6 appearances across cohorts
    assert metrics.student_appearances == 6
    assert metrics.run_scoped_student_appearances_count == 6


def test_analysis_run_conflict_different_metadata(db, run_event, finding_event):
    """
    Submitting an ANALYSIS_INGESTED event with the same analysis_run_id but
    differing immutable metadata (e.g. changed submission_count) produces CONFLICT
    (ANALYSIS_RUN_CONFLICT) and does not corrupt or modify existing child records.
    """
    res1 = db.load_events([run_event, finding_event])
    assert res1[0].outcome == IngestionOutcome.ACCEPTED
    assert res1[1].outcome == IngestionOutcome.ACCEPTED

    # Re-submitting same run_id under a new event_id with changed submission count
    conflicting_run_event = dict(run_event)
    conflicting_run_event["event_id"] = "f" * 64
    conflicting_run_event["submission_count"] = 99

    res2 = db.ingest_single_event(conflicting_run_event)
    assert res2.outcome == IngestionOutcome.CONFLICT
    assert "ANALYSIS_RUN_CONFLICT" in (res2.rejection_reason or "")

    # Ensure existing metadata and child records remain intact
    conn = db.get_connection()
    run_row = conn.execute(
        "SELECT submission_count FROM analysis_runs WHERE run_id = ?",
        (run_event["analysis_run_id"],),
    ).fetchone()
    assert run_row["submission_count"] == 20
    child_count = conn.execute("SELECT COUNT(*) FROM misconception_clusters").fetchone()[0]
    assert child_count == 1


def test_teacher_decision_action_stream_and_current_projection(db, run_event, finding_event):
    """
    When teacher performs accepted, then edited on the same target:
    Both actions are preserved in teacher_decisions stream.
    current_teacher_decisions projection reflects the latest action.
    """
    db.load_events([run_event, finding_event])

    action1 = {
        "schema_version": "1.0.0",
        "event_id": "d" * 64,
        "event_type": "DECISION_RECORDED",
        "occurred_at": "2026-10-26T10:15:00Z",
        "analysis_run_id": "run-test-001",
        "provenance": "human",
        "target_type": "misconception_cluster",
        "target_id": "cluster-time-markers",
        "teacher_decision": "accepted",
        "decision_recorded_at": "2026-10-26T10:15:00Z",
    }
    action2 = {
        "schema_version": "1.0.0",
        "event_id": "e" * 64,
        "event_type": "DECISION_RECORDED",
        "occurred_at": "2026-10-26T10:25:00Z",
        "analysis_run_id": "run-test-001",
        "provenance": "human",
        "target_type": "misconception_cluster",
        "target_id": "cluster-time-markers",
        "teacher_decision": "edited",
        "decision_recorded_at": "2026-10-26T10:25:00Z",
    }

    db.load_events([action1, action2])

    conn = db.get_connection()
    # History stream has 2 distinct actions
    history_count = conn.execute("SELECT COUNT(*) FROM teacher_decisions").fetchone()[0]
    assert history_count == 2

    # Current projection has 1 row with 'edited'
    proj = conn.execute("SELECT teacher_decision FROM current_teacher_decisions").fetchone()
    assert proj["teacher_decision"] == "edited"


def test_out_of_order_teacher_decisions(db, run_event):
    """
    Out-of-order ingestion must not regress current teacher decision projection.
    11:00 edited arrives first.
    10:30 accepted arrives later.
    Current projection must remain 11:00 edited.
    Equal timestamps must break ties deterministically.
    """
    db.ingest_single_event(run_event)

    # 11:00 edited event arrives first
    event_1100 = {
        "schema_version": "1.0.0",
        "event_id": "2a" * 32,
        "event_type": "DECISION_RECORDED",
        "occurred_at": "2026-10-26T11:00:00Z",
        "analysis_run_id": "run-test-001",
        "provenance": "human",
        "target_type": "misconception_cluster",
        "target_id": "cluster-time-markers",
        "teacher_decision": "edited",
        "decision_recorded_at": "2026-10-26T11:00:00Z",
    }
    res1 = db.ingest_single_event(event_1100)
    assert res1.outcome == IngestionOutcome.ACCEPTED

    conn = db.get_connection()
    proj = conn.execute(
        "SELECT teacher_decision, updated_at FROM current_teacher_decisions WHERE target_id = ?",
        ("cluster-time-markers",),
    ).fetchone()
    assert proj["teacher_decision"] == "edited"
    assert proj["updated_at"] == "2026-10-26T11:00:00Z"

    # 10:30 accepted event arrives later (out of order)
    event_1030 = {
        "schema_version": "1.0.0",
        "event_id": "2b" * 32,
        "event_type": "DECISION_RECORDED",
        "occurred_at": "2026-10-26T10:30:00Z",
        "analysis_run_id": "run-test-001",
        "provenance": "human",
        "target_type": "misconception_cluster",
        "target_id": "cluster-time-markers",
        "teacher_decision": "accepted",
        "decision_recorded_at": "2026-10-26T10:30:00Z",
    }
    res2 = db.ingest_single_event(event_1030)
    assert res2.outcome == IngestionOutcome.ACCEPTED

    # Current projection must STILL be 'edited' from 11:00!
    proj_after = conn.execute(
        "SELECT teacher_decision, updated_at FROM current_teacher_decisions WHERE target_id = ?",
        ("cluster-time-markers",),
    ).fetchone()
    assert proj_after["teacher_decision"] == "edited"
    assert proj_after["updated_at"] == "2026-10-26T11:00:00Z"

    # Historical stream must retain both
    hist = conn.execute(
        "SELECT teacher_decision, recorded_at FROM teacher_decisions ORDER BY recorded_at ASC"
    ).fetchall()
    assert len(hist) == 2
    assert hist[0]["teacher_decision"] == "accepted"
    assert hist[1]["teacher_decision"] == "edited"

    # Deterministic tie-breaking on equal timestamps: higher last_event_id wins
    tie_lower = {
        "schema_version": "1.0.0",
        "event_id": "aa" * 32,
        "event_type": "DECISION_RECORDED",
        "occurred_at": "2026-10-26T12:00:00Z",
        "analysis_run_id": "run-test-001",
        "provenance": "human",
        "target_type": "misconception_cluster",
        "target_id": "cluster-time-markers",
        "teacher_decision": "accepted",
        "decision_recorded_at": "2026-10-26T12:00:00Z",
    }
    tie_higher = {
        "schema_version": "1.0.0",
        "event_id": "bb" * 32,
        "event_type": "DECISION_RECORDED",
        "occurred_at": "2026-10-26T12:00:00Z",
        "analysis_run_id": "run-test-001",
        "provenance": "human",
        "target_type": "misconception_cluster",
        "target_id": "cluster-time-markers",
        "teacher_decision": "dismissed",
        "decision_recorded_at": "2026-10-26T12:00:00Z",
    }
    # Higher event_id arrives first
    db.ingest_single_event(tie_higher)
    proj_tie1 = conn.execute(
        "SELECT teacher_decision, last_event_id FROM current_teacher_decisions WHERE target_id = ?",
        ("cluster-time-markers",),
    ).fetchone()
    assert proj_tie1["teacher_decision"] == "dismissed"
    assert proj_tie1["last_event_id"] == "bb" * 32

    # Lower event_id arrives later with identical timestamp: must NOT overwrite
    db.ingest_single_event(tie_lower)
    proj_tie2 = conn.execute(
        "SELECT teacher_decision, last_event_id FROM current_teacher_decisions WHERE target_id = ?",
        ("cluster-time-markers",),
    ).fetchone()
    assert proj_tie2["teacher_decision"] == "dismissed"
    assert proj_tie2["last_event_id"] == "bb" * 32


def test_analysis_run_conflict_changed_duration(db, run_event, finding_event):
    """
    Submitting an ANALYSIS_INGESTED event with changed total_duration_ms produces
    ANALYSIS_RUN_CONFLICT and does not mutate existing run or child state.
    """
    db.load_events([run_event, finding_event])

    conflicting_run = dict(run_event)
    conflicting_run["event_id"] = "d1" * 32
    conflicting_run["total_duration_ms"] = 99999

    res = db.ingest_single_event(conflicting_run)
    assert res.outcome == IngestionOutcome.CONFLICT
    assert "ANALYSIS_RUN_CONFLICT" in (res.rejection_reason or "")

    conn = db.get_connection()
    row = conn.execute(
        "SELECT total_duration_ms FROM analysis_runs WHERE run_id = ?",
        (run_event["analysis_run_id"],),
    ).fetchone()
    assert row["total_duration_ms"] == run_event["total_duration_ms"]


def test_analysis_run_conflict_changed_execution_mode(db, run_event, finding_event):
    """
    Submitting an ANALYSIS_INGESTED event with changed execution_mode produces
    ANALYSIS_RUN_CONFLICT and does not mutate existing run or child state.
    """
    db.load_events([run_event, finding_event])

    conflicting_run = dict(run_event)
    conflicting_run["event_id"] = "e1" * 32
    conflicting_run["execution_mode"] = "live_gemini"

    res = db.ingest_single_event(conflicting_run)
    assert res.outcome == IngestionOutcome.CONFLICT
    assert "ANALYSIS_RUN_CONFLICT" in (res.rejection_reason or "")

    conn = db.get_connection()
    row = conn.execute(
        "SELECT execution_mode FROM analysis_runs WHERE run_id = ?",
        (run_event["analysis_run_id"],),
    ).fetchone()
    assert row["execution_mode"] == run_event["execution_mode"]
