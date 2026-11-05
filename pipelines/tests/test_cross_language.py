"""Cross-language test ensuring TypeScript output satisfies Python validator."""

import json
import subprocess
from pathlib import Path

from lotuslearn_pipeline.models import IngestionOutcome
from lotuslearn_pipeline.storage import AnalyticalDatabase

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def test_typescript_producer_output_accepted_by_python_pipeline():
    """
    Executes TypeScript export script, captures generated analytical events,
    and asserts that 100% of events pass Python JSON schema validation and zero-PII gates.
    """
    script_path = REPO_ROOT / "scripts" / "export_demo_events.ts"
    cmd = ["npx", "tsx", str(script_path)]

    proc = subprocess.run(
        cmd,
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    )

    events = json.loads(proc.stdout)
    assert isinstance(events, list)
    assert len(events) >= 5, "Expected at least 5 analytical events"

    # Load into SQLite database with foreign keys enabled and transactional validation
    db = AnalyticalDatabase(":memory:")
    db.initialize_schema()
    results = db.load_events(events)

    assert len(results) == len(events)
    for r in results:
        err_msg = f"Event {r.event_id} was not accepted: {r.rejection_reason}"
        assert r.outcome == IngestionOutcome.ACCEPTED, err_msg

    metrics = db.compute_metrics()
    assert metrics.total_accepted_events == len(events)
    assert metrics.student_appearances == 12
    assert metrics.run_scoped_student_appearances_count == 12
    assert len(metrics.prevalence_by_cluster) >= 3
    db.close()


def test_reliability_fixture_cross_language_validation_and_sqlite_history():
    """
    Automates the cross-language reliability path:
      TypeScript generation -> JSON fixture -> Python JSON Schema validation -> SQLite.
    Validates that equal-timestamp teacher decision actions both survive in history,
    and current projection deterministically selects the winning decision via event_id tie-breaking.
    """
    from lotuslearn_pipeline.ingestion import AnalyticalEventValidator

    fixture_path = REPO_ROOT / "pipelines" / "tests" / "fixtures" / "reliability_events.json"
    assert fixture_path.exists(), f"Reliability fixture missing at {fixture_path}"

    with open(fixture_path, encoding="utf-8") as f:
        fixtures = json.load(f)

    validator = AnalyticalEventValidator()

    # 1. Validate all standard batch events against Draft 2020-12 schema
    standard_batch = fixtures["standardBatch"]
    for ev in standard_batch:
        validator.validate_event(ev)

    # 2. Validate equal timestamp decision events against Draft 2020-12 schema
    eq_decisions = fixtures["equalTimestampDecisions"]
    dec_a = eq_decisions["decisionA"]
    dec_b = eq_decisions["decisionB"]

    validator.validate_event(dec_a)
    validator.validate_event(dec_b)

    # Assert invariant: same run, same target type, same target ID, same decision_recorded_at
    assert dec_a["analysis_run_id"] == dec_b["analysis_run_id"]
    assert dec_a["target_type"] == dec_b["target_type"]
    assert dec_a["target_id"] == dec_b["target_id"]
    assert dec_a["decision_recorded_at"] == dec_b["decision_recorded_at"]
    assert dec_a["event_id"] != dec_b["event_id"]
    assert dec_a["teacher_decision"] != dec_b["teacher_decision"]

    # 3. Ingest into SQLite with foreign keys enforced
    db = AnalyticalDatabase(":memory:")
    db.initialize_schema()

    batch_results = db.load_events(standard_batch)
    for r in batch_results:
        assert r.outcome == IngestionOutcome.ACCEPTED

    res_a = db.ingest_single_event(dec_a)
    res_b = db.ingest_single_event(dec_b)
    assert res_a.outcome == IngestionOutcome.ACCEPTED
    assert res_b.outcome == IngestionOutcome.ACCEPTED

    # 4. Verify both historical actions survive in SQLite teacher_decisions table
    conn = db.get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT COUNT(*) AS c FROM teacher_decisions WHERE target_id = ?;",
        (dec_a["target_id"],),
    )
    assert cur.fetchone()[0] == 2

    # 5. Verify current projection selects deterministic winner using lexical event_id tie-breaking
    expected_winner = dec_a if dec_a["event_id"] > dec_b["event_id"] else dec_b
    current_decisions = db.get_current_teacher_decisions()
    target_row = next(r for r in current_decisions if r["target_id"] == dec_a["target_id"])

    assert target_row["teacher_decision"] == expected_winner["teacher_decision"]
    assert target_row["last_event_id"] == expected_winner["event_id"]
    db.close()
