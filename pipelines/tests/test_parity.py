"""Full behavioral and metric parity tests between SQLite and PostgreSQL backends."""

import os

import psycopg
import pytest

from lotuslearn_pipeline.models import IngestionOutcome
from lotuslearn_pipeline.postgres import PostgresAnalyticalDatabase
from lotuslearn_pipeline.storage import AnalyticalDatabase


def get_test_pg_url() -> str:
    candidates = [
        os.environ.get("LOTUSLEARN_TEST_DATABASE_URL"),
        os.environ.get("LOTUSLEARN_DATABASE_URL"),
        "postgresql://postgres@localhost/lotuslearn_test?host=/tmp",
        "postgresql://postgres:postgres@localhost:5432/lotuslearn_test",
    ]
    for url in candidates:
        if not url:
            continue
        try:
            conn = psycopg.connect(url, connect_timeout=2)
            conn.close()
            return url
        except Exception:
            continue
    return ""


TEST_PG_URL = get_test_pg_url()


def clean_postgres_db(url: str) -> None:
    with psycopg.connect(url, autocommit=True) as conn:
        conn.execute("DROP SCHEMA public CASCADE;")
        conn.execute("CREATE SCHEMA public;")
        conn.execute("GRANT ALL ON SCHEMA public TO PUBLIC;")


@pytest.fixture
def dual_databases():
    if not TEST_PG_URL:
        pytest.skip("No PostgreSQL instance available for dual parity testing")

    clean_postgres_db(TEST_PG_URL)

    sqlite_db = AnalyticalDatabase(":memory:")
    sqlite_db.initialize_schema()

    pg_db = PostgresAnalyticalDatabase(TEST_PG_URL)
    pg_db.initialize_schema()

    yield sqlite_db, pg_db

    sqlite_db.close()
    pg_db.close()


def generate_comprehensive_event_batch():
    run_id = "run-parity-001"
    run_id_2 = "run-parity-002"

    events = [
        # Run 1
        {
            "schema_version": "1.0.0",
            "event_id": "1111111111111111111111111111111111111111111111111111111111111111",
            "event_type": "ANALYSIS_INGESTED",
            "occurred_at": "2026-10-26T10:00:00Z",
            "analysis_run_id": run_id,
            "provenance": "source",
            "dataset_fingerprint": "a" * 64,
            "submission_count": 20,
            "subject": "Mathematics",
            "grade_level": "Grade 9",
            "total_duration_ms": 1500,
            "execution_mode": "live_gemini",
        },
        # Finding 1
        {
            "schema_version": "1.0.0",
            "event_id": "2222222222222222222222222222222222222222222222222222222222222222",
            "event_type": "FINDING_IDENTIFIED",
            "occurred_at": "2026-10-26T10:01:00Z",
            "analysis_run_id": run_id,
            "provenance": "gemini",
            "finding_id": "cluster-linear-equations",
            "concept": "Linear Equation Inverses",
            "teaching_priority": "urgent",
            "affected_student_count": 5,
            "affected_student_ids": ["stu-1", "stu-2", "stu-3", "stu-4", "stu-5"],
            "percentage_affected": 25.0,
            "explanation": "Sign confusion when isolating variables.",
        },
        # Group 1
        {
            "schema_version": "1.0.0",
            "event_id": "3333333333333333333333333333333333333333333333333333333333333333",
            "event_type": "GROUP_FORMED",
            "occurred_at": "2026-10-26T10:02:00Z",
            "analysis_run_id": run_id,
            "provenance": "gemini",
            "group_id": "group-inverse-workshop",
            "group_name": "Inverse Operation Hands-On",
            "student_count": 5,
            "student_ids": ["stu-1", "stu-2", "stu-3", "stu-4", "stu-5"],
            "suggested_activity": "Balancing scale manipulatives",
            "estimated_duration": "20 min",
        },
        # Verification 1
        {
            "schema_version": "1.0.0",
            "event_id": "4444444444444444444444444444444444444444444444444444444444444444",
            "event_type": "VERIFICATION_AUDITED",
            "occurred_at": "2026-10-26T10:03:00Z",
            "analysis_run_id": run_id,
            "provenance": "deterministic_code",
            "overall_status": "verified",
            "coverage_passed": True,
            "cluster_math_passed": True,
            "group_partition_passed": True,
            "quotes_grounded_count": 5,
            "quotes_flagged_count": 0,
        },
        # Decision 1 (accepted)
        {
            "schema_version": "1.0.0",
            "event_id": "5555555555555555555555555555555555555555555555555555555555555555",
            "event_type": "DECISION_RECORDED",
            "occurred_at": "2026-10-26T10:10:00Z",
            "decision_recorded_at": "2026-10-26T10:10:00Z",
            "analysis_run_id": run_id,
            "provenance": "human",
            "target_type": "misconception_cluster",
            "target_id": "cluster-linear-equations",
            "teacher_decision": "accepted",
            "notes": "Reviewed and approved",
        },
        # Decision 2 (edited later)
        {
            "schema_version": "1.0.0",
            "event_id": "6666666666666666666666666666666666666666666666666666666666666666",
            "event_type": "DECISION_RECORDED",
            "occurred_at": "2026-10-26T10:30:00Z",
            "decision_recorded_at": "2026-10-26T10:30:00Z",
            "analysis_run_id": run_id,
            "provenance": "human",
            "target_type": "differentiated_intervention",
            "target_id": "group-inverse-workshop",
            "teacher_decision": "edited",
            "notes": "Modified intervention activity",
        },
        # Run 2
        {
            "schema_version": "1.0.0",
            "event_id": "7777777777777777777777777777777777777777777777777777777777777777",
            "event_type": "ANALYSIS_INGESTED",
            "occurred_at": "2026-10-26T11:00:00Z",
            "analysis_run_id": run_id_2,
            "provenance": "source",
            "dataset_fingerprint": "b" * 64,
            "submission_count": 10,
            "subject": "Mathematics",
            "grade_level": "Grade 9",
            "total_duration_ms": 1100,
            "execution_mode": "live_gemini",
        },
        # Finding 2 in Run 2
        {
            "schema_version": "1.0.0",
            "event_id": "8888888888888888888888888888888888888888888888888888888888888888",
            "event_type": "FINDING_IDENTIFIED",
            "occurred_at": "2026-10-26T11:01:00Z",
            "analysis_run_id": run_id_2,
            "provenance": "gemini",
            "finding_id": "cluster-linear-equations",
            "concept": "Linear Equation Inverses",
            "teaching_priority": "urgent",
            "affected_student_count": 3,
            "affected_student_ids": ["stu-1", "stu-2", "stu-8"],
            "percentage_affected": 30.0,
            "explanation": "Sign inversion error.",
        },
    ]
    return events


def test_complete_backend_parity(dual_databases):
    sqlite_db, pg_db = dual_databases
    events = generate_comprehensive_event_batch()

    # 1. Ingest into SQLite
    sqlite_results = sqlite_db.load_events(events)
    # 2. Ingest into PostgreSQL
    pg_results = pg_db.load_events(events)

    # Outcome parity
    assert len(sqlite_results) == len(pg_results)
    for sr, pr in zip(sqlite_results, pg_results):
        assert sr.outcome == pr.outcome
        assert sr.event_id == pr.event_id

    # Duplicate replay parity
    dup_sr = sqlite_db.ingest_single_event(events[0])
    dup_pr = pg_db.ingest_single_event(events[0])
    assert dup_sr.outcome == IngestionOutcome.DUPLICATE
    assert dup_pr.outcome == IngestionOutcome.DUPLICATE

    # Conflict parity
    conflicting = dict(events[0])
    conflicting["total_duration_ms"] = 99999
    c_sr = sqlite_db.ingest_single_event(conflicting)
    c_pr = pg_db.ingest_single_event(conflicting)
    assert c_sr.outcome == IngestionOutcome.CONFLICT
    assert c_pr.outcome == IngestionOutcome.CONFLICT

    # Metric parity
    sq_metrics = sqlite_db.compute_metrics()
    pg_metrics = pg_db.compute_metrics()

    assert sq_metrics.total_accepted_events == pg_metrics.total_accepted_events
    assert sq_metrics.student_appearances == pg_metrics.student_appearances
    assert sq_metrics.total_analysis_runs == pg_metrics.total_analysis_runs
    assert sq_metrics.educator_modification_rate == pg_metrics.educator_modification_rate

    # Prevalence parity
    assert len(sq_metrics.prevalence_by_cluster) == len(pg_metrics.prevalence_by_cluster)
    for sq_c, pg_c in zip(sq_metrics.prevalence_by_cluster, pg_metrics.prevalence_by_cluster):
        assert sq_c["analysis_run_id"] == pg_c["analysis_run_id"]
        assert sq_c["concept"] == pg_c["concept"]
        assert sq_c["affected_students"] == pg_c["affected_students"]
        assert sq_c["total_students"] == pg_c["total_students"]
        assert sq_c["prevalence_rate"] == pg_c["prevalence_rate"]

    # Findings parity
    assert len(sq_metrics.findings_by_concept) == len(pg_metrics.findings_by_concept)
    for sq_f, pg_f in zip(sq_metrics.findings_by_concept, pg_metrics.findings_by_concept):
        assert sq_f["concept"] == pg_f["concept"]
        assert sq_f["cluster_count"] == pg_f["cluster_count"]
        assert sq_f["total_affected_instances"] == pg_f["total_affected_instances"]
