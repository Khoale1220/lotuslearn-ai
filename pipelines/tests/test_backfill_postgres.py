"""PostgreSQL 18 integration tests for safe backfill orchestration."""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit
from uuid import uuid4

import psycopg
import pytest
from psycopg.rows import dict_row

from lotuslearn_pipeline.backfill import (
    BackfillConflictError,
    BackfillDecision,
    BackfillSlotStatus,
    ReprocessBehavior,
    claim_backfill_slots,
    complete_backfill_slot,
    create_backfill,
    get_backfill_summary,
    preview_backfill,
    recover_expired_claims,
)
from lotuslearn_pipeline.postgres import (
    apply_postgres_migrations,
    get_migration_status,
)


@pytest.fixture(scope="module")
def pg_url():
    url = os.environ.get(
        "LOTUSLEARN_TEST_DATABASE_URL"
    )

    if not url:
        pytest.skip(
            "Dedicated PostgreSQL test URL "
            "is not configured"
        )

    parsed = urlsplit(url)

    dynamic_port_text = os.environ.get(
        "LOTUSLEARN_TEST_DATABASE_DYNAMIC_PORT"
    )
    dynamic_port = (
        int(dynamic_port_text)
        if dynamic_port_text and dynamic_port_text.isdigit()
        else None
    )

    allowed_ports = {5432, 55432}
    if dynamic_port is not None:
        allowed_ports.add(dynamic_port)

    if (
        parsed.scheme not in ("postgresql", "postgres")
        or parsed.hostname not in ("127.0.0.1", "localhost")
        or parsed.port not in allowed_ports
        or parsed.path != "/lotuslearn_test"
    ):
        pytest.fail("Unsafe PostgreSQL integration test target")

    with psycopg.connect(
        url,
        autocommit=True,
        row_factory=dict_row,
    ) as conn:
        identity = conn.execute(
            """
            SELECT
                current_database()
                    AS database_name,
                current_setting(
                    'server_version_num'
                ) AS version_num
            """
        ).fetchone()

        assert identity is not None

        assert (
            identity["database_name"]
            == "lotuslearn_test"
        )

        assert (
            180000
            <= int(identity["version_num"])
            < 190000
        )

        apply_postgres_migrations(conn)

        migrations = (
            get_migration_status(conn)
        )

        assert migrations
        assert all(
            row["applied"]
            for row in migrations
        )
        assert all(
            row["match"] is True
            for row in migrations
        )

    return url


def _request_key(prefix: str) -> str:
    return (
        f"c11-{prefix}-{uuid4()}"
    )


def _pipeline_key() -> str:
    return (
        f"pipeline-{uuid4()}"
    )


def _start() -> datetime:
    return datetime(
        2026,
        1,
        1,
        tzinfo=timezone.utc,
    )


def _insert_terminal_execution(
    url,
    slot,
    status,
):
    finished_at = datetime.now(
        timezone.utc
    )

    started_at = (
        finished_at
        - timedelta(seconds=30)
    )

    heartbeat_at = (
        finished_at
        - timedelta(seconds=10)
    )

    error_code = (
        None
        if status == "SUCCEEDED"
        else "UNEXPECTED_FAILURE"
    )

    accepted_count = (
        1
        if status == "SUCCEEDED"
        else 0
    )

    failed_count = (
        0
        if status == "SUCCEEDED"
        else 1
    )

    with psycopg.connect(
        url,
        autocommit=True,
    ) as conn:
        conn.execute(
            """
            INSERT INTO pipeline_executions (
                execution_id,
                batch_id,
                attempt_number,
                status,
                started_at,
                heartbeat_at,
                finished_at,
                total_attempted,
                accepted_count,
                duplicate_count,
                conflict_count,
                rejected_count,
                failed_count,
                internal_retry_count,
                error_code
            )
            VALUES (
                %(execution_id)s,
                %(batch_id)s,
                %(attempt_number)s,
                %(status)s,
                %(started_at)s,
                %(heartbeat_at)s,
                %(finished_at)s,
                1,
                %(accepted_count)s,
                0,
                0,
                0,
                %(failed_count)s,
                0,
                %(error_code)s
            )
            """,
            {
                "execution_id": (
                    slot.execution_id
                ),
                "batch_id": (
                    slot.batch_id
                ),
                "attempt_number": (
                    slot.attempt_number
                ),
                "status": status,
                "started_at": (
                    started_at
                ),
                "heartbeat_at": (
                    heartbeat_at
                ),
                "finished_at": (
                    finished_at
                ),
                "accepted_count": (
                    accepted_count
                ),
                "failed_count": (
                    failed_count
                ),
                "error_code": (
                    error_code
                ),
            },
        )


def test_preview_is_read_only(
    pg_url,
):
    start = _start()

    with psycopg.connect(
        pg_url,
        row_factory=dict_row,
    ) as conn:
        before = conn.execute(
            """
            SELECT COUNT(*)::integer
                AS count
            FROM pipeline_backfills
            """
        ).fetchone()["count"]

    preview = preview_backfill(
        pg_url,
        pipeline_key=_pipeline_key(),
        window_start=start,
        window_end=(
            start + timedelta(days=2)
        ),
        interval=timedelta(days=1),
        reprocess_behavior=(
            ReprocessBehavior.NONE
        ),
    )

    assert len(preview) == 2
    assert all(
        slot.decision
        is BackfillDecision.CREATE_MISSING
        for slot in preview
    )

    with psycopg.connect(
        pg_url,
        row_factory=dict_row,
    ) as conn:
        after = conn.execute(
            """
            SELECT COUNT(*)::integer
                AS count
            FROM pipeline_backfills
            """
        ).fetchone()["count"]

    assert before == after


def test_create_is_idempotent_and_conflict_safe(
    pg_url,
):
    start = _start()
    request_key = _request_key(
        "idempotent"
    )

    kwargs = dict(
        pipeline_key=_pipeline_key(),
        request_key=request_key,
        window_start=start,
        window_end=(
            start + timedelta(days=2)
        ),
        interval=timedelta(days=1),
        reprocess_behavior="none",
        max_active_runs=2,
        run_backwards=False,
    )

    first = create_backfill(
        pg_url,
        **kwargs,
    )

    second = create_backfill(
        pg_url,
        **kwargs,
    )

    assert first.created is True
    assert second.created is False

    assert (
        first.request.backfill_id
        == second.request.backfill_id
    )

    assert (
        first.slots
        == second.slots
    )

    with pytest.raises(
        BackfillConflictError
    ):
        create_backfill(
            pg_url,
            **{
                **kwargs,
                "max_active_runs": 3,
            },
        )


def test_claim_respects_capacity_and_reverse_order(
    pg_url,
):
    start = _start()

    created = create_backfill(
        pg_url,
        pipeline_key=_pipeline_key(),
        request_key=_request_key(
            "claim"
        ),
        window_start=start,
        window_end=(
            start + timedelta(days=4)
        ),
        interval=timedelta(days=1),
        reprocess_behavior="none",
        max_active_runs=2,
        run_backwards=True,
    )

    claims = claim_backfill_slots(
        pg_url,
        backfill_id=(
            created.request.backfill_id
        ),
        worker_id="c11-test-worker",
        lease=timedelta(minutes=5),
        limit=100,
    )

    assert len(claims) == 2

    assert (
        claims[0].slot_start
        == start + timedelta(days=3)
    )

    assert (
        claims[1].slot_start
        == start + timedelta(days=2)
    )

    assert all(
        slot.status
        is BackfillSlotStatus.CLAIMED
        for slot in claims
    )

    second_claim = (
        claim_backfill_slots(
            pg_url,
            backfill_id=(
                created.request.backfill_id
            ),
            worker_id=(
                "c11-test-worker-2"
            ),
            lease=timedelta(minutes=5),
            limit=100,
        )
    )

    assert second_claim == ()


def test_terminal_execution_links_back_to_slot(
    pg_url,
):
    start = _start()

    created = create_backfill(
        pg_url,
        pipeline_key=_pipeline_key(),
        request_key=_request_key(
            "complete"
        ),
        window_start=start,
        window_end=(
            start + timedelta(days=1)
        ),
        interval=timedelta(days=1),
        max_active_runs=1,
    )

    claim = claim_backfill_slots(
        pg_url,
        backfill_id=(
            created.request.backfill_id
        ),
        worker_id="worker-complete",
        lease=timedelta(minutes=5),
    )[0]

    _insert_terminal_execution(
        pg_url,
        claim,
        "SUCCEEDED",
    )

    completed = (
        complete_backfill_slot(
            pg_url,
            backfill_id=(
                created.request.backfill_id
            ),
            slot_start=(
                claim.slot_start
            ),
        )
    )

    assert (
        completed.status
        is BackfillSlotStatus.SUCCEEDED
    )

    assert (
        completed.execution_id
        == claim.execution_id
    )

    summary = get_backfill_summary(
        pg_url,
        backfill_id=(
            created.request.backfill_id
        ),
    )

    assert summary.succeeded == 1
    assert summary.pending == 0
    assert summary.claimed == 0
    assert summary.complete is True


def test_expired_unstarted_claim_is_requeued(
    pg_url,
):
    start = _start()

    created = create_backfill(
        pg_url,
        pipeline_key=_pipeline_key(),
        request_key=_request_key(
            "recovery"
        ),
        window_start=start,
        window_end=(
            start + timedelta(days=1)
        ),
        interval=timedelta(days=1),
        max_active_runs=1,
    )

    claim = claim_backfill_slots(
        pg_url,
        backfill_id=(
            created.request.backfill_id
        ),
        worker_id="worker-expired",
        lease=timedelta(minutes=5),
    )[0]

    with psycopg.connect(
        pg_url,
        autocommit=True,
    ) as conn:
        conn.execute(
            """
            UPDATE pipeline_backfill_slots
            SET claimed_at =
                    statement_timestamp() - INTERVAL '2 minutes',
                lease_expires_at =
                    statement_timestamp() - INTERVAL '1 minute'
            WHERE backfill_id = %s
              AND slot_start = %s
            """,
            (
                created.request.backfill_id,
                claim.slot_start,
            ),
        )

    actions = recover_expired_claims(
        pg_url,
        backfill_id=(
            created.request.backfill_id
        ),
    )

    assert len(actions) == 1

    assert (
        actions[0].action
        == "REQUEUED_NOT_STARTED"
    )

    reclaimed = claim_backfill_slots(
        pg_url,
        backfill_id=(
            created.request.backfill_id
        ),
        worker_id="worker-reclaim",
        lease=timedelta(minutes=5),
    )

    assert len(reclaimed) == 1

    assert (
        reclaimed[0].attempt_number
        == 2
    )

    assert (
        reclaimed[0].batch_id
        == claim.batch_id
    )

    assert (
        reclaimed[0].execution_id
        != claim.execution_id
    )

def test_failed_only_reprocessing_semantics(
    pg_url,
):
    start = _start()
    pipeline_key = _pipeline_key()

    first = create_backfill(
        pg_url,
        pipeline_key=pipeline_key,
        request_key=_request_key(
            "baseline"
        ),
        window_start=start,
        window_end=(
            start + timedelta(days=2)
        ),
        interval=timedelta(days=1),
        reprocess_behavior="none",
        max_active_runs=2,
    )

    claims = claim_backfill_slots(
        pg_url,
        backfill_id=(
            first.request.backfill_id
        ),
        worker_id="baseline-worker",
        lease=timedelta(minutes=5),
        limit=2,
    )

    assert len(claims) == 2

    _insert_terminal_execution(
        pg_url,
        claims[0],
        "SUCCEEDED",
    )

    _insert_terminal_execution(
        pg_url,
        claims[1],
        "FAILED",
    )

    complete_backfill_slot(
        pg_url,
        backfill_id=(
            first.request.backfill_id
        ),
        slot_start=(
            claims[0].slot_start
        ),
    )

    complete_backfill_slot(
        pg_url,
        backfill_id=(
            first.request.backfill_id
        ),
        slot_start=(
            claims[1].slot_start
        ),
    )

    preview = preview_backfill(
        pg_url,
        pipeline_key=pipeline_key,
        window_start=start,
        window_end=(
            start + timedelta(days=2)
        ),
        interval=timedelta(days=1),
        reprocess_behavior="failed",
    )

    assert (
        preview[0].decision
        is BackfillDecision.SKIP_EXISTING
    )

    assert (
        preview[1].decision
        is BackfillDecision.REPROCESS_FAILED
    )

    second = create_backfill(
        pg_url,
        pipeline_key=pipeline_key,
        request_key=_request_key(
            "failed-only"
        ),
        window_start=start,
        window_end=(
            start + timedelta(days=2)
        ),
        interval=timedelta(days=1),
        reprocess_behavior="failed",
        max_active_runs=1,
    )

    assert (
        second.slots[0].status
        is BackfillSlotStatus.SKIPPED
    )

    assert (
        second.slots[1].status
        is BackfillSlotStatus.PENDING
    )


def test_c11_indexes_are_installed(
    pg_url,
):
    expected = {
        "idx_pipeline_backfills_pipeline_created",
        "idx_pipeline_backfill_slots_pending",
        "idx_pipeline_backfill_slots_claimed",
        "idx_pipeline_backfill_slots_history",
    }

    with psycopg.connect(
        pg_url,
        row_factory=dict_row,
    ) as conn:
        rows = conn.execute(
            """
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname =
                current_schema()
              AND indexname =
                ANY(%s::text[])
            """,
            (list(expected),),
        ).fetchall()

    actual = {
        row["indexname"]
        for row in rows
    }

    assert actual == expected
