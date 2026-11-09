import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Barrier

import psycopg
import pytest
from psycopg.rows import dict_row

from lotuslearn_pipeline.metadata import (
    Asset,
    Field,
    MetadataIntegrityError,
    MetadataSnapshot,
    derive_asset_id,
)
from lotuslearn_pipeline.metadata_history import (
    MetadataHistoryConflictError,
    MetadataHistoryIntegrityError,
    MetadataHistoryWriteOutcome,
    PostgresMetadataHistoryStore,
)
from lotuslearn_pipeline.postgres import apply_postgres_migrations, get_postgres_migration_files

TEST_DATABASE_URL = os.environ.get("LOTUSLEARN_TEST_DATABASE_URL", "").strip()
BASE_TIME = datetime(2026, 11, 9, 12, 0, tzinfo=timezone.utc)


def connect_test_database(*, autocommit=False):
    conn = psycopg.connect(
        TEST_DATABASE_URL, autocommit=autocommit, row_factory=dict_row
    )
    database_name = conn.execute(
        "SELECT current_database() AS database_name;"
    ).fetchone()["database_name"]
    if database_name != "lotuslearn_test":
        conn.close()
        raise RuntimeError("Refusing metadata history test access outside lotuslearn_test")
    return conn


def make_asset(name="orders"):
    asset_id = derive_asset_id("postgres", "lotuslearn_test", "public", name)
    return Asset(
        asset_id=asset_id,
        platform="postgres",
        database="lotuslearn_test",
        schema="public",
        name=name,
        asset_type="base_table",
    )


def make_snapshot(
    snapshot_id,
    *,
    generated_at=BASE_TIME,
    field_names=("id",),
    repository_commit="commit-a",
    extraction_sources=(),
):
    asset = make_asset()
    fields = [
        Field(
            asset_id=asset.asset_id,
            field_name=name,
            ordinal_position=index,
            physical_data_type="integer",
            normalized_type="integer",
            nullable=False,
        )
        for index, name in enumerate(field_names, start=1)
    ]
    return MetadataSnapshot(
        snapshot_id=snapshot_id,
        generated_at=generated_at,
        repository_commit=repository_commit,
        extraction_sources=list(extraction_sources),
        assets=[asset],
        fields=fields,
    )


def row_count(conn, table):
    return conn.execute(f"SELECT COUNT(*) AS count FROM {table};").fetchone()["count"]


@pytest.fixture
def history_store():
    if not TEST_DATABASE_URL:
        pytest.skip("Metadata history PostgreSQL tests require LOTUSLEARN_TEST_DATABASE_URL")
    try:
        conn = connect_test_database(autocommit=True)
    except Exception:
        pytest.fail("Configured LOTUSLEARN_TEST_DATABASE_URL is not reachable", pytrace=False)
    with conn:
        conn.execute("DROP SCHEMA public CASCADE;")
        conn.execute("CREATE SCHEMA public;")
        applied = apply_postgres_migrations(conn)
        assert "0003_metadata_history.sql" in applied
        assert apply_postgres_migrations(conn) == []
    return PostgresMetadataHistoryStore(TEST_DATABASE_URL)


def test_snapshot_identity_is_observation_id_not_semantic_checksum(history_store):
    first = make_snapshot(
        "observation-a", extraction_sources=["postgres:catalog-a"]
    )
    second = make_snapshot(
        "observation-b",
        generated_at=BASE_TIME + timedelta(minutes=1),
        extraction_sources=["postgres:catalog-b"],
    )
    assert first.content_checksum == second.content_checksum

    assert history_store.record_snapshot(first).outcome == MetadataHistoryWriteOutcome.INSERTED
    assert history_store.record_snapshot(second).outcome == MetadataHistoryWriteOutcome.INSERTED
    with connect_test_database() as conn:
        assert row_count(conn, "metadata_snapshot_history") == 2


def test_snapshot_replay_is_idempotent_and_does_not_change_recorded_at(history_store):
    snapshot = make_snapshot("replay-observation")
    first = history_store.record_snapshot(snapshot)
    with connect_test_database() as conn:
        first_recorded_at = conn.execute(
            "SELECT recorded_at AS recorded_at "
            "FROM metadata_snapshot_history WHERE snapshot_id = %s;",
            (snapshot.snapshot_id,),
        ).fetchone()["recorded_at"]

    second = history_store.record_snapshot(snapshot)
    with connect_test_database() as conn:
        replayed_recorded_at = conn.execute(
            "SELECT recorded_at AS recorded_at "
            "FROM metadata_snapshot_history WHERE snapshot_id = %s;",
            (snapshot.snapshot_id,),
        ).fetchone()["recorded_at"]
        assert row_count(conn, "metadata_snapshot_history") == 1

    assert first.outcome == MetadataHistoryWriteOutcome.INSERTED
    assert second.outcome == MetadataHistoryWriteOutcome.EXISTING
    assert replayed_recorded_at == first_recorded_at


def test_snapshot_identity_conflict_preserves_existing_row(history_store):
    original = make_snapshot("conflicting-observation")
    conflicting = make_snapshot("conflicting-observation", field_names=("id", "amount"))
    history_store.record_snapshot(original)

    with pytest.raises(MetadataHistoryConflictError):
        history_store.record_snapshot(conflicting)

    stored = history_store.get_snapshot(original.snapshot_id)
    assert stored.to_dict() == original.to_dict()
    with connect_test_database() as conn:
        assert row_count(conn, "metadata_snapshot_history") == 1


def test_record_comparison_persists_snapshots_and_verified_diff(history_store):
    baseline = make_snapshot("comparison-baseline")
    current = make_snapshot("comparison-current", field_names=("id", "amount"))

    written = history_store.record_comparison(baseline, current)
    replayed = history_store.record_comparison(baseline, current)

    assert written.baseline_outcome == MetadataHistoryWriteOutcome.INSERTED
    assert written.current_outcome == MetadataHistoryWriteOutcome.INSERTED
    assert written.outcome == MetadataHistoryWriteOutcome.INSERTED
    assert replayed.baseline_outcome == MetadataHistoryWriteOutcome.EXISTING
    assert replayed.current_outcome == MetadataHistoryWriteOutcome.EXISTING
    assert replayed.outcome == MetadataHistoryWriteOutcome.EXISTING
    assert history_store.get_comparison(baseline.snapshot_id, current.snapshot_id).to_dict() == (
        written.diff.to_dict()
    )
    with connect_test_database() as conn:
        assert row_count(conn, "metadata_snapshot_history") == 2
        assert row_count(conn, "metadata_diff_history") == 1


def test_same_comparison_id_allows_distinct_observation_pairs(history_store):
    baseline_a = make_snapshot("baseline-a")
    current_a = make_snapshot("current-a", field_names=("id", "amount"))
    baseline_b = make_snapshot(
        "baseline-b", generated_at=BASE_TIME + timedelta(minutes=2)
    )
    current_b = make_snapshot(
        "current-b",
        generated_at=BASE_TIME + timedelta(minutes=3),
        field_names=("id", "amount"),
    )
    first = history_store.record_comparison(baseline_a, current_a)
    second = history_store.record_comparison(baseline_b, current_b)

    assert first.diff.comparison_id == second.diff.comparison_id
    with connect_test_database() as conn:
        assert row_count(conn, "metadata_diff_history") == 2


def test_concurrent_same_snapshot_writes_create_one_row(history_store):
    snapshot = make_snapshot("concurrent-snapshot")
    with ThreadPoolExecutor(max_workers=8) as executor:
        results = list(executor.map(history_store.record_snapshot, [snapshot] * 8))

    assert sum(result.outcome == MetadataHistoryWriteOutcome.INSERTED for result in results) == 1
    assert sum(result.outcome == MetadataHistoryWriteOutcome.EXISTING for result in results) == 7
    with connect_test_database() as conn:
        assert row_count(conn, "metadata_snapshot_history") == 1


def test_concurrent_conflicting_snapshot_writes_preserve_single_winner(history_store):
    original = make_snapshot("concurrent-conflict", field_names=("id",))
    conflicting = make_snapshot("concurrent-conflict", field_names=("id", "amount"))
    barrier = Barrier(2)

    def write(snapshot):
        barrier.wait(timeout=10)
        try:
            return history_store.record_snapshot(snapshot).outcome
        except MetadataHistoryConflictError:
            return "CONFLICT"

    with ThreadPoolExecutor(max_workers=2) as executor:
        outcomes = list(executor.map(write, (original, conflicting)))

    assert outcomes.count(MetadataHistoryWriteOutcome.INSERTED) == 1
    assert outcomes.count("CONFLICT") == 1
    stored = history_store.get_snapshot(original.snapshot_id)
    assert stored.to_dict() in (original.to_dict(), conflicting.to_dict())
    with connect_test_database() as conn:
        assert row_count(conn, "metadata_snapshot_history") == 1


def test_concurrent_same_comparison_pair_creates_one_row(history_store):
    baseline = make_snapshot("concurrent-baseline")
    current = make_snapshot("concurrent-current", field_names=("id", "amount"))
    with ThreadPoolExecutor(max_workers=8) as executor:
        results = list(
            executor.map(
                lambda _: history_store.record_comparison(baseline, current), range(8)
            )
        )

    assert sum(result.outcome == MetadataHistoryWriteOutcome.INSERTED for result in results) == 1
    assert sum(result.outcome == MetadataHistoryWriteOutcome.EXISTING for result in results) == 7
    with connect_test_database() as conn:
        assert row_count(conn, "metadata_snapshot_history") == 2
        assert row_count(conn, "metadata_diff_history") == 1


def test_comparison_failure_rolls_back_both_new_snapshot_rows(history_store):
    baseline = make_snapshot("atomic-baseline")
    current = make_snapshot("atomic-current", field_names=("id", "amount"))
    with connect_test_database(autocommit=True) as conn:
        conn.execute(
            """
            CREATE FUNCTION reject_metadata_history_diff_insert() RETURNS trigger
            LANGUAGE plpgsql AS $$
            BEGIN
                RAISE EXCEPTION 'injected metadata history failure';
            END;
            $$;
            CREATE TRIGGER reject_metadata_history_diff_insert
            BEFORE INSERT ON metadata_diff_history
            FOR EACH ROW EXECUTE FUNCTION reject_metadata_history_diff_insert();
            """
        )

    try:
        with pytest.raises(psycopg.Error):
            history_store.record_comparison(baseline, current)
        with connect_test_database() as conn:
            assert row_count(conn, "metadata_snapshot_history") == 0
            assert row_count(conn, "metadata_diff_history") == 0
    finally:
        with connect_test_database(autocommit=True) as conn:
            conn.execute(
                "DROP TRIGGER IF EXISTS reject_metadata_history_diff_insert "
                "ON metadata_diff_history;"
            )
            conn.execute("DROP FUNCTION IF EXISTS reject_metadata_history_diff_insert();")


def test_snapshot_payload_corruption_fails_closed(history_store):
    snapshot = make_snapshot("corrupt-payload")
    history_store.record_snapshot(snapshot)
    with connect_test_database() as conn:
        conn.execute(
            """
            UPDATE metadata_snapshot_history
            SET payload_json = jsonb_set(payload_json, '{repository_commit}', '"changed"')
            WHERE snapshot_id = %s;
            """,
            (snapshot.snapshot_id,),
        )

    with pytest.raises(MetadataHistoryIntegrityError):
        history_store.get_snapshot(snapshot.snapshot_id)


def test_snapshot_summary_corruption_fails_closed(history_store):
    snapshot = make_snapshot("corrupt-summary")
    history_store.record_snapshot(snapshot)
    with connect_test_database() as conn:
        conn.execute(
            "UPDATE metadata_snapshot_history SET field_count = 99 WHERE snapshot_id = %s;",
            (snapshot.snapshot_id,),
        )

    with pytest.raises(MetadataHistoryIntegrityError):
        history_store.get_snapshot(snapshot.snapshot_id)


@pytest.mark.parametrize("corruption", ["payload", "summary"])
def test_comparison_corruption_fails_closed(history_store, corruption):
    baseline = make_snapshot(f"corrupt-diff-baseline-{corruption}")
    current = make_snapshot(
        f"corrupt-diff-current-{corruption}", field_names=("id", "amount")
    )
    history_store.record_comparison(baseline, current)
    with connect_test_database() as conn:
        if corruption == "payload":
            conn.execute(
                """
                UPDATE metadata_diff_history
                SET payload_json = jsonb_set(payload_json, '{comparison_id}', '"changed"')
                WHERE baseline_snapshot_id = %s AND current_snapshot_id = %s;
                """,
                (baseline.snapshot_id, current.snapshot_id),
            )
        else:
            conn.execute(
                """
                UPDATE metadata_diff_history SET change_count = change_count + 1
                WHERE baseline_snapshot_id = %s AND current_snapshot_id = %s;
                """,
                (baseline.snapshot_id, current.snapshot_id),
            )

    with pytest.raises(MetadataHistoryIntegrityError):
        history_store.get_comparison(baseline.snapshot_id, current.snapshot_id)


def test_latest_and_keyset_pagination_use_deterministic_tie_breaker(history_store):
    observations = [make_snapshot(f"tie-{suffix}") for suffix in ("a", "b", "c")]
    for snapshot in observations:
        history_store.record_snapshot(snapshot)

    assert history_store.get_latest_snapshot().snapshot_id == "tie-c"
    first_page = history_store.list_snapshots(limit=2)
    assert [item.snapshot_id for item in first_page] == ["tie-c", "tie-b"]
    second_page = history_store.list_snapshots(
        limit=2, before=(BASE_TIME, "tie-b")
    )
    assert [item.snapshot_id for item in second_page] == ["tie-a"]


def test_missing_snapshot_and_comparison_return_none(history_store):
    assert history_store.get_snapshot("missing-observation") is None
    assert history_store.get_comparison("missing-baseline", "missing-current") is None
    assert history_store.get_latest_snapshot() is None
    assert history_store.list_snapshots() == []


def test_invalid_snapshot_is_rejected_before_database_connection():
    invalid = make_snapshot("invalid-before-connection")
    invalid.fields.append(Field(invalid.assets[0].asset_id, "extra", nullable=False))
    store = PostgresMetadataHistoryStore("postgresql://invalid.invalid/unused")

    with pytest.raises(MetadataIntegrityError):
        store.record_snapshot(invalid)


def test_empty_snapshot_observation_id_is_rejected_before_database_connection():
    invalid = make_snapshot("")
    store = PostgresMetadataHistoryStore("postgresql://invalid.invalid/unused")

    with pytest.raises(MetadataIntegrityError, match="observation ID must be non-empty"):
        store.record_snapshot(invalid)


def test_database_schema_has_required_constraints_foreign_keys_and_indexes(history_store):
    with connect_test_database() as conn:
        constraint_rows = conn.execute(
            """
            SELECT conrelid::regclass::text AS table_name, contype
            FROM pg_constraint
            WHERE conrelid IN (
                'metadata_snapshot_history'::regclass,
                'metadata_diff_history'::regclass
            );
            """
        ).fetchall()
        index_rows = conn.execute(
            """
            SELECT indexname FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename IN ('metadata_snapshot_history', 'metadata_diff_history');
            """
        ).fetchall()
        migration_names = {
            migration[1] for migration in get_postgres_migration_files()
        }

    assert sum(row["contype"] == "p" for row in constraint_rows) == 2
    assert sum(row["contype"] == "f" for row in constraint_rows) == 2
    assert sum(row["contype"] == "c" for row in constraint_rows) >= 17
    indexes = {row["indexname"] for row in index_rows}
    assert {
        "metadata_snapshot_history_checksum_idx",
        "metadata_snapshot_history_generated_at_idx",
        "metadata_diff_history_comparison_id_idx",
        "metadata_diff_history_current_snapshot_id_idx",
        "metadata_diff_history_recorded_at_idx",
    }.issubset(indexes)
    assert "0003_metadata_history.sql" in migration_names
