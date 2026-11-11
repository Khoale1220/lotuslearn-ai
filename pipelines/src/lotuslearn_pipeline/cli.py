"""Command-line interface for LotusLearn DE-02B analytical pipeline."""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import UUID

from lotuslearn_pipeline.models import IngestionOutcome
from lotuslearn_pipeline.reconciliation import reconcile_batch
from lotuslearn_pipeline.storage import get_database


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


def handle_migration_status(db: Any) -> int:
    """Displays migration status table for the target database."""
    from lotuslearn_pipeline.postgres import PostgresAnalyticalDatabase, get_migration_status

    if not isinstance(db, PostgresAnalyticalDatabase):
        print("Migration status is currently only applicable to PostgreSQL targets.")
        return 0

    conn = db.get_connection()
    status_list = get_migration_status(conn)
    print("\n--- PostgreSQL Migration Status ---")
    print(f"{'Version':<10} {'Name':<35} {'Applied':<10} {'Checksum Valid':<15}")
    print("-" * 72)
    for s in status_list:
        applied_str = "YES" if s["applied"] else "NO"
        valid_str = "PASS" if s["checksum_valid"] else "FAIL"
        print(f"{s['version']:<10} {s['name']:<35} {applied_str:<10} {valid_str:<15}")
    return 0


def handle_verify(db: Any) -> int:
    """Provides concise database integrity evidence for PostgreSQL or SQLite."""
    from lotuslearn_pipeline.postgres import PostgresAnalyticalDatabase, get_migration_status
    from lotuslearn_pipeline.storage import AnalyticalDatabase

    if isinstance(db, PostgresAnalyticalDatabase):
        try:
            conn = db.get_connection()
            status_list = get_migration_status(conn)
            unapplied = [s for s in status_list if not s["applied"]]
            invalid_checksums = [
                s for s in status_list if s["applied"] and not s["checksum_valid"]
            ]

            print("\n--- PostgreSQL Database Verification ---")
            print("Connectivity:                  PASS")
            print(f"Packaged Migrations Total:     {len(status_list)}")
            applied_cnt = len(status_list) - len(unapplied)
            print(f"Migrations Applied:            {applied_cnt}/{len(status_list)}")
            chk_status = "PASS" if not invalid_checksums else "FAIL"
            print(f"Checksum Integrity:            {chk_status}")

            if invalid_checksums:
                print("ERROR: Checksum mismatch detected in applied migrations:")
                for inv in invalid_checksums:
                    print(f"  - {inv['name']}: expected {inv['checksum']}")
                return 1

            if unapplied:
                print(f"WARNING: {len(unapplied)} migration(s) remain unapplied.")
                return 1

            print("Database Status:               VERIFIED (Healthy)")
            return 0
        except Exception as e:
            print(f"ERROR: PostgreSQL verification failed: {e}")
            return 1

    elif isinstance(db, AnalyticalDatabase):
        try:
            conn = db.conn
            cur = conn.cursor()
            cur.execute("PRAGMA integrity_check;")
            rows = cur.fetchall()
            status = rows[0][0] if rows else "unknown"

            print("\n--- SQLite Database Verification ---")
            print("Connectivity:                  PASS")
            print(f"Integrity Check:               {'PASS' if status == 'ok' else 'FAIL'}")

            if status != "ok":
                print(f"ERROR: SQLite PRAGMA integrity_check returned: {status}")
                return 1

            print("Database Status:               VERIFIED (Healthy)")
            return 0
        except Exception as e:
            print(f"ERROR: SQLite verification failed: {e}")
            return 1

    else:
        print("Unknown database backend.")
        return 1


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="LotusLearn DE-02B Analytical Ingestion, Migrations & Metrics Pipeline"
    )
    parser.add_argument(
        "command",
        nargs="?",
        choices=["ingest", "migrate", "migration-status", "verify"],
        help="Optional command: ingest, migrate, migration-status, verify",
    )
    parser.add_argument(
        "--command",
        dest="command_flag",
        choices=["ingest", "migrate", "migration-status", "verify"],
        help="Optional command alias: ingest, migrate, migration-status, verify",
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
        default=None,
        help=(
            "Path to SQLite database file or PostgreSQL URL "
            "(defaults to LOTUSLEARN_DATABASE_URL or :memory:)"
        ),
    )
    parser.add_argument(
        "--migrate",
        action="store_true",
        help="Run database migrations before processing",
    )
    parser.add_argument(
        "--migration-status",
        action="store_true",
        help="Display migration status and exit",
    )
    parser.add_argument(
        "--reconcile",
        action="store_true",
        help="Display batch reconciliation identity balance accounting",
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

    parser.add_argument(
        "--track-execution",
        action="store_true",
        help="Persist a uniquely identified PostgreSQL ingest attempt",
    )
    parser.add_argument("--batch-id", help="Operational batch UUID")
    parser.add_argument("--execution-id", help="Unique execution UUID")
    parser.add_argument(
        "--attempt-number", type=int, help="Positive batch attempt number"
    )
    args = parser.parse_args(argv)
    command = args.command_flag or args.command

    has_identity = any(
        value is not None
        for value in (args.batch_id, args.execution_id, args.attempt_number)
    )
    if has_identity and not args.track_execution:
        parser.error("Execution identity options require --track-execution")

    if args.track_execution:
        if command not in (None, "ingest") or args.input is None:
            parser.error("--track-execution requires ingest with --input")
        if not all(
            value is not None
            for value in (args.batch_id, args.execution_id, args.attempt_number)
        ):
            parser.error("Tracked ingest requires all three identity options")
        try:
            batch_id = UUID(args.batch_id)
            execution_id = UUID(args.execution_id)
        except ValueError:
            parser.error("--batch-id and --execution-id must be UUIDs")
        if args.attempt_number <= 0:
            parser.error("--attempt-number must be positive")

        database_url = args.db or os.environ.get(
            "LOTUSLEARN_DATABASE_URL", ""
        ).strip()
        if not database_url.startswith(("postgresql://", "postgres://")):
            parser.error("Tracked execution requires a PostgreSQL --db or URL")

    db = get_database(args.db)

    # Handle verify command
    if command == "verify":
        res = handle_verify(db)
        db.close()
        return res

    # Handle migration-status command
    if command == "migration-status" or args.migration_status:
        res = handle_migration_status(db)
        db.close()
        return res

    # Handle migrate command or flag
    if command == "migrate" or args.migrate:
        applied = db.initialize_schema()
        print(f"Applied {len(applied)} migrations: {applied}")
        if command == "migrate" and not args.input:
            db.close()
            return 0
    else:
        db.initialize_schema()

    if args.input:
        if args.track_execution:
            from lotuslearn_pipeline.execution_ledger import ExecutionConflictError
            from lotuslearn_pipeline.execution_runtime import run_tracked_batch

            try:
                tracked = run_tracked_batch(
                    db=db,
                    database_url=database_url,
                    input_path=args.input,
                    load_events=load_events_from_file,
                    batch_id=batch_id,
                    execution_id=execution_id,
                    attempt_number=args.attempt_number,
                    fail_on_rejection=args.exit_on_rejection,
                )
            except ExecutionConflictError:
                print(
                    "ERROR: Execution attempt conflict; ingestion not restarted",
                    file=sys.stderr,
                )
                db.close()
                return 1
            except Exception:
                db.close()
                raise

            results = tracked.results
            print(
                f"Loaded {tracked.report.total_attempted} candidate events "
                f"from {args.input}"
            )
        else:
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

        if args.reconcile:
            report = (
                tracked.report
                if args.track_execution
                else reconcile_batch(results)
            )
            print("\n" + report.format_summary())

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
        print(f"Run-scoped student appearances:   {metrics.student_appearances}")
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
