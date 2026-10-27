"""Command-line interface for LotusLearn DE-01.1 analytical pipeline."""

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, List

from lotuslearn_pipeline.models import IngestionOutcome
from lotuslearn_pipeline.storage import AnalyticalDatabase


def load_events_from_file(file_path: Path) -> List[Dict[str, Any]]:
    """Loads events from a JSON array or newline-delimited JSON (NDJSON) file."""
    if not file_path.exists():
        raise FileNotFoundError(f"Input file not found: {file_path}")

    text = file_path.read_text(encoding="utf-8").strip()
    if not text:
        return []

    if text.startswith("["):
        data = json.loads(text)
        if not isinstance(data, list):
            raise ValueError("Expected JSON array of events")
        return data
    else:
        events = []
        for line in text.splitlines():
            line = line.strip()
            if line:
                events.append(json.loads(line))
        return events


def main(argv: List[str] = None) -> int:
    parser = argparse.ArgumentParser(
        description="LotusLearn DE-01.1 Analytical Ingestion & Metrics Pipeline"
    )
    parser.add_argument(
        "--input",
        "-i",
        type=Path,
        help="Path to JSON or NDJSON file containing candidate analytical events",
    )
    parser.add_argument(
        "--db",
        "-d",
        type=str,
        default="lotuslearn_analytics.db",
        help="Path to SQLite database file (default: lotuslearn_analytics.db)",
    )
    parser.add_argument(
        "--metrics",
        action="store_true",
        help="Compute and display learning analytics metrics after ingestion",
    )
    parser.add_argument(
        "--exit-on-rejection",
        action="store_true",
        help="Exit with error code 1 if any event fails validation or produces conflict",
    )

    args = parser.parse_args(argv)

    db = AnalyticalDatabase(db_path=args.db)
    db.initialize_schema()

    if args.input:
        events = load_events_from_file(args.input)
        print(f"Loaded {len(events)} candidate events from {args.input}")

        results = db.load_events(events)

        accepted_count = sum(1 for r in results if r.outcome == IngestionOutcome.ACCEPTED)
        duplicate_count = sum(1 for r in results if r.outcome == IngestionOutcome.DUPLICATE)
        conflict_count = sum(1 for r in results if r.outcome == IngestionOutcome.CONFLICT)
        rejected_count = sum(1 for r in results if r.outcome == IngestionOutcome.REJECTED)

        print("\n--- Ingestion Audit Summary ---")
        print(f"Total processed: {len(results)}")
        print(f"Accepted:        {accepted_count}")
        print(f"Duplicates:      {duplicate_count}")
        print(f"Conflicts:       {conflict_count}")
        print(f"Rejected:        {rejected_count}")

        if rejected_count > 0 or conflict_count > 0:
            print("\nIssues detail:")
            for r in results:
                if r.outcome in (IngestionOutcome.REJECTED, IngestionOutcome.CONFLICT):
                    print(f"  Event {r.event_id} [{r.outcome.value}]: {r.rejection_reason}")

        if args.exit_on_rejection and (rejected_count > 0 or conflict_count > 0):
            db.close()
            return 1

    if args.metrics:
        metrics = db.compute_metrics()
        print("\n--- Educational Learning Analytics Metrics ---")
        print(f"Total accepted events:            {metrics.total_accepted_events}")
        print(f"Run-scoped student appearances:   {metrics.run_scoped_student_appearances_count}")
        print(f"Distinct pseudonymous students:   {metrics.distinct_students_count}")
        mod_rate = (
            f"{metrics.educator_modification_rate:.4f}"
            if metrics.educator_modification_rate is not None
            else "N/A"
        )
        print(f"Educator modification rate:       {mod_rate}")

        if metrics.prevalence_by_cluster:
            print("\nMisconception Prevalence Rates:")
            for c in metrics.prevalence_by_cluster:
                prev = f"{c['prevalence_rate'] * 100:.1f}%"
                print(
                    f"  - [{c['teaching_priority'].upper()}] {c['concept']}: "
                    f"{c['affected_students']}/{c['total_students']} ({prev})"
                )

    db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
