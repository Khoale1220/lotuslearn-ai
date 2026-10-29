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
