"""Deterministic tests for safe backfill semantics."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from lotuslearn_pipeline.backfill import (
    BackfillDecision,
    BackfillSlotStatus,
    ReprocessBehavior,
    build_backfill_windows,
    decide_reprocessing,
    derive_execution_identity,
)

START = datetime(
    2026,
    1,
    1,
    tzinfo=timezone.utc,
)


def test_build_backfill_windows_are_half_open_and_bounded():
    windows = build_backfill_windows(
        window_start=START,
        window_end=START + timedelta(hours=5),
        interval=timedelta(hours=2),
    )

    assert len(windows) == 3

    assert windows[0].slot_start == START
    assert windows[0].slot_end == (START + timedelta(hours=2))

    assert windows[1].slot_start == (START + timedelta(hours=2))
    assert windows[1].slot_end == (START + timedelta(hours=4))

    assert windows[2].slot_start == (START + timedelta(hours=4))
    assert windows[2].slot_end == (START + timedelta(hours=5))


def test_max_slots_fails_closed():
    with pytest.raises(ValueError):
        build_backfill_windows(
            window_start=START,
            window_end=START + timedelta(hours=4),
            interval=timedelta(hours=1),
            max_slots=3,
        )


def test_naive_timestamps_are_rejected():
    with pytest.raises(ValueError):
        build_backfill_windows(
            window_start=datetime(2026, 1, 1),
            window_end=datetime(2026, 1, 2),
            interval=timedelta(hours=1),
        )


@pytest.mark.parametrize(
    (
        "previous",
        "behavior",
        "expected",
    ),
    (
        (
            None,
            ReprocessBehavior.NONE,
            BackfillDecision.CREATE_MISSING,
        ),
        (
            BackfillSlotStatus.PENDING,
            ReprocessBehavior.COMPLETED,
            BackfillDecision.SKIP_ACTIVE,
        ),
        (
            BackfillSlotStatus.CLAIMED,
            ReprocessBehavior.COMPLETED,
            BackfillDecision.SKIP_ACTIVE,
        ),
        (
            BackfillSlotStatus.SUCCEEDED,
            ReprocessBehavior.NONE,
            BackfillDecision.SKIP_EXISTING,
        ),
        (
            BackfillSlotStatus.FAILED,
            ReprocessBehavior.NONE,
            BackfillDecision.SKIP_EXISTING,
        ),
        (
            BackfillSlotStatus.FAILED,
            ReprocessBehavior.FAILED,
            BackfillDecision.REPROCESS_FAILED,
        ),
        (
            BackfillSlotStatus.SUCCEEDED,
            ReprocessBehavior.FAILED,
            BackfillDecision.SKIP_EXISTING,
        ),
        (
            BackfillSlotStatus.SUCCEEDED,
            ReprocessBehavior.COMPLETED,
            BackfillDecision.REPROCESS_COMPLETED,
        ),
        (
            BackfillSlotStatus.FAILED,
            ReprocessBehavior.COMPLETED,
            BackfillDecision.REPROCESS_COMPLETED,
        ),
    ),
)
def test_explicit_reprocessing_semantics(
    previous,
    behavior,
    expected,
):
    assert (
        decide_reprocessing(
            previous,
            behavior,
        )
        is expected
    )


def test_execution_identity_is_deterministic_per_attempt():
    backfill_id = uuid4()

    batch_1, execution_1 = derive_execution_identity(
        backfill_id=backfill_id,
        slot_start=START,
        attempt_number=1,
    )

    batch_1_again, execution_1_again = derive_execution_identity(
        backfill_id=backfill_id,
        slot_start=START,
        attempt_number=1,
    )

    batch_2, execution_2 = derive_execution_identity(
        backfill_id=backfill_id,
        slot_start=START,
        attempt_number=2,
    )

    assert batch_1 == batch_1_again
    assert execution_1 == execution_1_again

    assert batch_1 == batch_2
    assert execution_1 != execution_2


@pytest.mark.parametrize(
    "attempt",
    (
        0,
        -1,
        True,
    ),
)
def test_invalid_attempt_number_fails_closed(
    attempt,
):
    with pytest.raises((TypeError, ValueError)):
        derive_execution_identity(
            backfill_id=uuid4(),
            slot_start=START,
            attempt_number=attempt,
        )
