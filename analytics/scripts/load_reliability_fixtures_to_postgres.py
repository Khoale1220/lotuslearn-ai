"""
Loads the canonical TypeScript reliability fixtures into PostgreSQL 18 via
the authoritative Python ingestion pipeline for end-to-end transformation testing.
"""

import json
import os
import sys
from pathlib import Path

from lotuslearn_pipeline.postgres import PostgresAnalyticalDatabase


def load_reliability_fixtures(database_url: str) -> None:
    repo_root = Path(__file__).resolve().parent.parent.parent
    fixture_path = repo_root / "pipelines" / "tests" / "fixtures" / "reliability_events.json"

    if not fixture_path.exists():
        print(f"ERROR: Reliability fixture file not found at {fixture_path}", file=sys.stderr)
        sys.exit(1)

    with open(fixture_path, encoding="utf-8") as f:
        fixtures = json.load(f)

    db = PostgresAnalyticalDatabase(connection_url=database_url)
    db.initialize_schema()

    print("Ingesting standardBatch...")
    batch_res = db.load_events(fixtures["standardBatch"])
    print(f"Loaded {len(batch_res)} standard batch events.")

    print("Ingesting replayPair...")
    db.ingest_single_event(fixtures["replayPair"]["replay"])

    print("Ingesting payloadConflictPair...")
    db.ingest_single_event(fixtures["payloadConflictPair"]["conflicting"])

    print("Ingesting equalTimestampDecisions...")
    db.ingest_single_event(fixtures["equalTimestampDecisions"]["decisionA"])
    db.ingest_single_event(fixtures["equalTimestampDecisions"]["decisionB"])

    db.close()
    print("SUCCESS: Reliability fixture suite successfully loaded into PostgreSQL 18 operational tables.")


if __name__ == "__main__":
    url = (
        os.environ.get("LOTUSLEARN_TEST_DATABASE_URL")
        or os.environ.get("LOTUSLEARN_DATABASE_URL")
    )
    if not url:
        raise RuntimeError(
            "No PostgreSQL database configured. Set LOTUSLEARN_TEST_DATABASE_URL "
            "or LOTUSLEARN_DATABASE_URL to an explicit disposable test database."
        )
    load_reliability_fixtures(url)
