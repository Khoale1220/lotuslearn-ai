"""Cross-language test ensuring TypeScript output satisfies Python validator."""

import json
import subprocess
from pathlib import Path

from pipelines.db import AnalyticalDatabase
from pipelines.ingestion import AnalyticalEventValidator, validate_event_batch
from pipelines.models import IngestionOutcome

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

    # Validate against JSON schema and zero-PII gate
    validator = AnalyticalEventValidator()
    results, accepted = validate_event_batch(events, validator=validator)

    assert len(results) == len(events)
    assert len(accepted) == len(events)
    for r in results:
        err_msg = f"Event {r.event_id} was not accepted: {r.rejection_reason}"
        assert r.outcome == IngestionOutcome.ACCEPTED, err_msg

    # Load into SQLite database with foreign keys enabled
    db = AnalyticalDatabase(":memory:")
    db.initialize_schema()
    db.record_audit_log(results)
    db.load_events(accepted)

    metrics = db.compute_metrics()
    assert metrics.total_accepted_events == len(events)
    assert metrics.distinct_students_count == 12
    assert len(metrics.prevalence_by_cluster) >= 3
    db.close()
