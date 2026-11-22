"""Safe PostgreSQL orchestration for bounded LotusLearn backfills.

This is an operational control plane, not a second business-data pipeline.

Responsibilities:
* deterministic bounded historical windows;
* explicit none/failed/completed reprocessing semantics;
* read-only preview;
* persistent auditable requests and decisions;
* bounded concurrent work leasing;
* deterministic batch/execution identities;
* safe expired-lease recovery;
* linkage to the existing durable execution ledger.

It never stores event payloads or raw student data.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Final
from urllib.parse import urlsplit
from uuid import UUID, uuid5

import psycopg
from psycopg.rows import dict_row

MAX_BACKFILL_SLOTS: Final = 10_000
MAX_ACTIVE_RUNS: Final = 100
MAX_CLAIM_LIMIT: Final = 100
MAX_LEASE: Final = timedelta(hours=24)

BACKFILL_NAMESPACE: Final = UUID(
    "5e0f6997-9f0d-4ed0-a8d7-30ed11ad0df5"
)


class BackfillError(RuntimeError):
    """Base error for backfill orchestration."""


class BackfillConflictError(BackfillError):
    """Requested state conflicts with persisted state."""


class BackfillIntegrityError(BackfillError):
    """Persisted orchestration state is internally inconsistent."""


class ReprocessBehavior(str, Enum):
    NONE = "none"
    FAILED = "failed"
    COMPLETED = "completed"


class BackfillDecision(str, Enum):
    CREATE_MISSING = "CREATE_MISSING"
    REPROCESS_FAILED = "REPROCESS_FAILED"
    REPROCESS_COMPLETED = "REPROCESS_COMPLETED"
    SKIP_EXISTING = "SKIP_EXISTING"
    SKIP_ACTIVE = "SKIP_ACTIVE"


class BackfillSlotStatus(str, Enum):
    PENDING = "PENDING"
    SKIPPED = "SKIPPED"
    CLAIMED = "CLAIMED"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"


@dataclass(frozen=True)
class BackfillWindow:
    ordinal: int
    slot_start: datetime
    slot_end: datetime


@dataclass(frozen=True)
class BackfillPreviewSlot:
    ordinal: int
    slot_start: datetime
    slot_end: datetime
    prior_status: BackfillSlotStatus | None
    decision: BackfillDecision
    initial_status: BackfillSlotStatus


@dataclass(frozen=True)
class BackfillRequest:
    backfill_id: UUID
    pipeline_key: str
    request_key: str
    window_start: datetime
    window_end: datetime
    interval_seconds: int
    reprocess_behavior: ReprocessBehavior
    max_active_runs: int
    run_backwards: bool
    created_at: datetime


@dataclass(frozen=True)
class BackfillSlot:
    backfill_id: UUID
    ordinal: int
    slot_start: datetime
    slot_end: datetime
    prior_status: BackfillSlotStatus | None
    decision: BackfillDecision
    status: BackfillSlotStatus
    attempt_number: int
    batch_id: UUID | None
    execution_id: UUID | None
    worker_id: str | None
    claimed_at: datetime | None
    lease_expires_at: datetime | None
    finished_at: datetime | None


    fence_token: int = 0


@dataclass(frozen=True)
class BackfillCreateResult:
    created: bool
    request: BackfillRequest
    slots: tuple[BackfillSlot, ...]


@dataclass(frozen=True)
class BackfillRecoveryAction:
    slot_start: datetime
    execution_id: UUID | None
    action: str


@dataclass(frozen=True)
class BackfillSummary:
    backfill_id: UUID
    total: int
    pending: int
    skipped: int
    claimed: int
    succeeded: int
    failed: int
    complete: bool


def _database_url(value: str) -> str:
    if not isinstance(value, str):
        raise TypeError("database_url must be a string")

    normalized = value.strip()
    parsed = urlsplit(normalized)

    if (
        parsed.scheme not in {"postgresql", "postgres"}
        or not parsed.hostname
    ):
        raise ValueError(
            "Backfill orchestration requires a PostgreSQL URL"
        )

    return normalized


def _text(
    value: str,
    label: str,
    *,
    max_length: int = 200,
) -> str:
    if not isinstance(value, str):
        raise TypeError(f"{label} must be a string")

    normalized = value.strip()

    if not normalized:
        raise ValueError(f"{label} is required")

    if len(normalized) > max_length:
        raise ValueError(f"{label} is too long")

    return normalized


def _uuid(
    value: UUID | str,
    label: str,
) -> UUID:
    if isinstance(value, UUID):
        return value

    if not isinstance(value, str):
        raise ValueError(f"{label} must be a UUID")

    try:
        return UUID(value)
    except ValueError:
        raise ValueError(
            f"{label} must be a UUID"
        ) from None


def _timestamp(
    value: datetime,
    label: str,
) -> datetime:
    if not isinstance(value, datetime):
        raise TypeError(f"{label} must be datetime")

    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(
            f"{label} must be timezone-aware"
        )

    return value.astimezone(timezone.utc)


def _positive_int(
    value: int,
    label: str,
    *,
    maximum: int,
) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise TypeError(
            f"{label} must be an integer"
        )

    if value <= 0:
        raise ValueError(
            f"{label} must be positive"
        )

    if value > maximum:
        raise ValueError(
            f"{label} cannot exceed {maximum}"
        )

    return value


def _interval_seconds(value: timedelta) -> int:
    if not isinstance(value, timedelta):
        raise TypeError("interval must be timedelta")

    if value <= timedelta(0):
        raise ValueError("interval must be positive")

    if value.microseconds != 0:
        raise ValueError(
            "interval must resolve to whole seconds"
        )

    seconds = int(value.total_seconds())

    if seconds <= 0:
        raise ValueError(
            "interval must be at least one second"
        )

    return seconds


def _lease(value: timedelta) -> timedelta:
    if not isinstance(value, timedelta):
        raise TypeError("lease must be timedelta")

    if value <= timedelta(0):
        raise ValueError("lease must be positive")

    if value > MAX_LEASE:
        raise ValueError(
            "lease cannot exceed 24 hours"
        )

    return value


def _behavior(
    value: ReprocessBehavior | str,
) -> ReprocessBehavior:
    if isinstance(value, ReprocessBehavior):
        return value

    try:
        return ReprocessBehavior(value)
    except (TypeError, ValueError):
        raise ValueError(
            "reprocess_behavior must be "
            "one of: none, failed, completed"
        ) from None


def _slot_status(
    value: BackfillSlotStatus | str | None,
) -> BackfillSlotStatus | None:
    if value is None:
        return None

    if isinstance(value, BackfillSlotStatus):
        return value

    try:
        return BackfillSlotStatus(value)
    except (TypeError, ValueError):
        raise BackfillIntegrityError(
            "Unknown persisted backfill slot status"
        ) from None


def build_backfill_windows(
    *,
    window_start: datetime,
    window_end: datetime,
    interval: timedelta,
    max_slots: int = MAX_BACKFILL_SLOTS,
) -> tuple[BackfillWindow, ...]:
    """Build deterministic half-open windows: [start, end)."""

    window_start = _timestamp(
        window_start,
        "window_start",
    )
    window_end = _timestamp(
        window_end,
        "window_end",
    )

    interval_seconds = _interval_seconds(interval)

    max_slots = _positive_int(
        max_slots,
        "max_slots",
        maximum=MAX_BACKFILL_SLOTS,
    )

    if window_end <= window_start:
        raise ValueError(
            "window_end must be after window_start"
        )

    step = timedelta(
        seconds=interval_seconds
    )

    cursor = window_start
    ordinal = 0
    windows: list[BackfillWindow] = []

    while cursor < window_end:
        if len(windows) >= max_slots:
            raise ValueError(
                "backfill window exceeds max_slots"
            )

        slot_end = min(
            cursor + step,
            window_end,
        )

        windows.append(
            BackfillWindow(
                ordinal=ordinal,
                slot_start=cursor,
                slot_end=slot_end,
            )
        )

        ordinal += 1
        cursor = slot_end

    return tuple(windows)


def decide_reprocessing(
    previous_status: BackfillSlotStatus | str | None,
    reprocess_behavior: ReprocessBehavior | str,
) -> BackfillDecision:
    """Apply explicit missing/failed/completed semantics."""

    previous_status = _slot_status(
        previous_status
    )
    behavior = _behavior(
        reprocess_behavior
    )

    if previous_status is None:
        return BackfillDecision.CREATE_MISSING

    if previous_status in {
        BackfillSlotStatus.PENDING,
        BackfillSlotStatus.CLAIMED,
    }:
        return BackfillDecision.SKIP_ACTIVE

    if behavior is ReprocessBehavior.NONE:
        return BackfillDecision.SKIP_EXISTING

    if behavior is ReprocessBehavior.FAILED:
        if (
            previous_status
            is BackfillSlotStatus.FAILED
        ):
            return (
                BackfillDecision.REPROCESS_FAILED
            )

        return BackfillDecision.SKIP_EXISTING

    if previous_status in {
        BackfillSlotStatus.SUCCEEDED,
        BackfillSlotStatus.FAILED,
    }:
        return (
            BackfillDecision.REPROCESS_COMPLETED
        )

    return BackfillDecision.SKIP_EXISTING


def derive_execution_identity(
    *,
    backfill_id: UUID | str,
    slot_start: datetime,
    attempt_number: int,
) -> tuple[UUID, UUID]:
    """Build stable batch ID and attempt-specific execution ID."""

    normalized_backfill_id = _uuid(
        backfill_id,
        "backfill_id",
    )

    slot_start = _timestamp(
        slot_start,
        "slot_start",
    )

    attempt_number = _positive_int(
        attempt_number,
        "attempt_number",
        maximum=2_147_483_647,
    )

    batch_id = uuid5(
        normalized_backfill_id,
        f"slot:{slot_start.isoformat()}",
    )

    execution_id = uuid5(
        batch_id,
        f"attempt:{attempt_number}",
    )

    return batch_id, execution_id


def _request_id(
    request_key: str,
) -> UUID:
    return uuid5(
        BACKFILL_NAMESPACE,
        f"request:{request_key}",
    )


def _advisory_lock_key(
    backfill_id: UUID,
) -> int:
    value = int.from_bytes(
        backfill_id.bytes[:8],
        byteorder="big",
    )

    return (
        value
        & 0x7FFF_FFFF_FFFF_FFFF
    )


def _request_from_row(
    row: dict[str, Any],
) -> BackfillRequest:
    try:
        return BackfillRequest(
            backfill_id=_uuid(
                row["backfill_id"],
                "backfill_id",
            ),
            pipeline_key=row["pipeline_key"],
            request_key=row["request_key"],
            window_start=_timestamp(
                row["window_start"],
                "window_start",
            ),
            window_end=_timestamp(
                row["window_end"],
                "window_end",
            ),
            interval_seconds=(
                row["interval_seconds"]
            ),
            reprocess_behavior=_behavior(
                row["reprocess_behavior"]
            ),
            max_active_runs=(
                row["max_active_runs"]
            ),
            run_backwards=(
                row["run_backwards"]
            ),
            created_at=_timestamp(
                row["created_at"],
                "created_at",
            ),
        )
    except (
        KeyError,
        TypeError,
        ValueError,
    ):
        raise BackfillIntegrityError(
            "Persisted backfill request is invalid"
        ) from None


def _slot_from_row(
    row: dict[str, Any],
) -> BackfillSlot:
    try:
        prior_status = _slot_status(
            row["prior_status"]
        )

        batch_id = (
            None
            if row["batch_id"] is None
            else _uuid(
                row["batch_id"],
                "batch_id",
            )
        )

        execution_id = (
            None
            if row["execution_id"] is None
            else _uuid(
                row["execution_id"],
                "execution_id",
            )
        )

        return BackfillSlot(
            backfill_id=_uuid(
                row["backfill_id"],
                "backfill_id",
            ),
            ordinal=row["ordinal"],
            slot_start=_timestamp(
                row["slot_start"],
                "slot_start",
            ),
            slot_end=_timestamp(
                row["slot_end"],
                "slot_end",
            ),
            prior_status=prior_status,
            decision=BackfillDecision(
                row["decision"]
            ),
            status=BackfillSlotStatus(
                row["status"]
            ),
            attempt_number=(
                row["attempt_number"]
            ),
            batch_id=batch_id,
            execution_id=execution_id,
            worker_id=row["worker_id"],
            claimed_at=row["claimed_at"],
            lease_expires_at=(
                row["lease_expires_at"]
            ),
            finished_at=row["finished_at"],
            fence_token=row["fence_token"],
        )
    except (
        KeyError,
        TypeError,
        ValueError,
    ):
        raise BackfillIntegrityError(
            "Persisted backfill slot is invalid"
        ) from None


def _historical_statuses(
    conn: psycopg.Connection,
    *,
    pipeline_key: str,
    windows: tuple[BackfillWindow, ...],
) -> dict[
    tuple[datetime, datetime],
    BackfillSlotStatus,
]:
    if not windows:
        return {}

    rows = conn.execute(
        """
        SELECT DISTINCT ON (
            slot.slot_start,
            slot.slot_end
        )
            slot.slot_start,
            slot.slot_end,
            slot.status
        FROM pipeline_backfill_slots AS slot
        JOIN pipeline_backfills AS request
          ON request.backfill_id =
             slot.backfill_id
        WHERE request.pipeline_key = %s
          AND slot.slot_start >= %s
          AND slot.slot_end <= %s
          AND slot.status <> 'SKIPPED'
        ORDER BY
            slot.slot_start,
            slot.slot_end,
            request.created_at DESC,
            request.backfill_id DESC
        """,
        (
            pipeline_key,
            windows[0].slot_start,
            windows[-1].slot_end,
        ),
    ).fetchall()

    history: dict[
        tuple[datetime, datetime],
        BackfillSlotStatus,
    ] = {}

    for row in rows:
        key = (
            _timestamp(
                row["slot_start"],
                "slot_start",
            ),
            _timestamp(
                row["slot_end"],
                "slot_end",
            ),
        )

        history[key] = BackfillSlotStatus(
            row["status"]
        )

    return history


def _preview_slots(
    *,
    windows: tuple[BackfillWindow, ...],
    history: dict[
        tuple[datetime, datetime],
        BackfillSlotStatus,
    ],
    reprocess_behavior: ReprocessBehavior,
) -> tuple[BackfillPreviewSlot, ...]:
    result: list[
        BackfillPreviewSlot
    ] = []

    for window in windows:
        prior_status = history.get(
            (
                window.slot_start,
                window.slot_end,
            )
        )

        decision = decide_reprocessing(
            prior_status,
            reprocess_behavior,
        )

        if decision in {
            BackfillDecision.SKIP_EXISTING,
            BackfillDecision.SKIP_ACTIVE,
        }:
            initial_status = (
                BackfillSlotStatus.SKIPPED
            )
        else:
            initial_status = (
                BackfillSlotStatus.PENDING
            )

        result.append(
            BackfillPreviewSlot(
                ordinal=window.ordinal,
                slot_start=window.slot_start,
                slot_end=window.slot_end,
                prior_status=prior_status,
                decision=decision,
                initial_status=(
                    initial_status
                ),
            )
        )

    return tuple(result)


def preview_backfill(
    database_url: str,
    *,
    pipeline_key: str,
    window_start: datetime,
    window_end: datetime,
    interval: timedelta,
    reprocess_behavior: (
        ReprocessBehavior | str
    ) = ReprocessBehavior.NONE,
) -> tuple[BackfillPreviewSlot, ...]:
    """Read-only dry-run of backfill decisions."""

    database_url = _database_url(
        database_url
    )

    pipeline_key = _text(
        pipeline_key,
        "pipeline_key",
    )

    behavior = _behavior(
        reprocess_behavior
    )

    windows = build_backfill_windows(
        window_start=window_start,
        window_end=window_end,
        interval=interval,
    )

    with psycopg.connect(
        database_url,
        row_factory=dict_row,
    ) as conn:
        conn.execute(
            "SET TRANSACTION READ ONLY"
        )

        history = _historical_statuses(
            conn,
            pipeline_key=pipeline_key,
            windows=windows,
        )

    return _preview_slots(
        windows=windows,
        history=history,
        reprocess_behavior=behavior,
    )


def _list_slots_conn(
    conn: psycopg.Connection,
    *,
    backfill_id: UUID,
) -> tuple[BackfillSlot, ...]:
    rows = conn.execute(
        """
        SELECT *
        FROM pipeline_backfill_slots
        WHERE backfill_id = %s
        ORDER BY ordinal
        """,
        (backfill_id,),
    ).fetchall()

    return tuple(
        _slot_from_row(row)
        for row in rows
    )


def list_backfill_slots(
    database_url: str,
    *,
    backfill_id: UUID | str,
) -> tuple[BackfillSlot, ...]:
    database_url = _database_url(
        database_url
    )

    backfill_id = _uuid(
        backfill_id,
        "backfill_id",
    )

    with psycopg.connect(
        database_url,
        row_factory=dict_row,
    ) as conn:
        conn.execute(
            "SET TRANSACTION READ ONLY"
        )

        return _list_slots_conn(
            conn,
            backfill_id=backfill_id,
        )


def create_backfill(
    database_url: str,
    *,
    pipeline_key: str,
    request_key: str,
    window_start: datetime,
    window_end: datetime,
    interval: timedelta,
    reprocess_behavior: (
        ReprocessBehavior | str
    ) = ReprocessBehavior.NONE,
    max_active_runs: int = 1,
    run_backwards: bool = False,
) -> BackfillCreateResult:
    """Persist an idempotent request and auditable slot decisions."""

    database_url = _database_url(
        database_url
    )

    pipeline_key = _text(
        pipeline_key,
        "pipeline_key",
    )

    request_key = _text(
        request_key,
        "request_key",
    )

    behavior = _behavior(
        reprocess_behavior
    )

    max_active_runs = _positive_int(
        max_active_runs,
        "max_active_runs",
        maximum=MAX_ACTIVE_RUNS,
    )

    if not isinstance(
        run_backwards,
        bool,
    ):
        raise TypeError(
            "run_backwards must be bool"
        )

    normalized_start = _timestamp(
        window_start,
        "window_start",
    )

    normalized_end = _timestamp(
        window_end,
        "window_end",
    )

    interval_seconds = (
        _interval_seconds(interval)
    )

    windows = build_backfill_windows(
        window_start=normalized_start,
        window_end=normalized_end,
        interval=interval,
    )

    backfill_id = _request_id(
        request_key
    )

    with psycopg.connect(
        database_url,
        row_factory=dict_row,
    ) as conn:
        with conn.transaction():
            conn.execute(
                """
                SELECT
                    pg_advisory_xact_lock(%s)
                """,
                (
                    _advisory_lock_key(
                        backfill_id
                    ),
                ),
            )

            existing_row = conn.execute(
                """
                SELECT *
                FROM pipeline_backfills
                WHERE request_key = %s
                """,
                (request_key,),
            ).fetchone()

            if existing_row is not None:
                existing = _request_from_row(
                    existing_row
                )

                expected = (
                    pipeline_key,
                    request_key,
                    normalized_start,
                    normalized_end,
                    interval_seconds,
                    behavior,
                    max_active_runs,
                    run_backwards,
                )

                actual = (
                    existing.pipeline_key,
                    existing.request_key,
                    existing.window_start,
                    existing.window_end,
                    existing.interval_seconds,
                    existing.reprocess_behavior,
                    existing.max_active_runs,
                    existing.run_backwards,
                )

                if actual != expected:
                    raise (
                        BackfillConflictError(
                            "request_key is already "
                            "bound to a different "
                            "backfill configuration"
                        )
                    )

                return BackfillCreateResult(
                    created=False,
                    request=existing,
                    slots=_list_slots_conn(
                        conn,
                        backfill_id=(
                            existing.backfill_id
                        ),
                    ),
                )

            history = _historical_statuses(
                conn,
                pipeline_key=pipeline_key,
                windows=windows,
            )

            preview = _preview_slots(
                windows=windows,
                history=history,
                reprocess_behavior=behavior,
            )

            row = conn.execute(
                """
                INSERT INTO pipeline_backfills (
                    backfill_id,
                    pipeline_key,
                    request_key,
                    window_start,
                    window_end,
                    interval_seconds,
                    reprocess_behavior,
                    max_active_runs,
                    run_backwards
                )
                VALUES (
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s
                )
                RETURNING *
                """,
                (
                    backfill_id,
                    pipeline_key,
                    request_key,
                    normalized_start,
                    normalized_end,
                    interval_seconds,
                    behavior.value,
                    max_active_runs,
                    run_backwards,
                ),
            ).fetchone()

            if row is None:
                raise BackfillIntegrityError(
                    "Backfill request insert "
                    "returned no row"
                )

            for slot in preview:
                prior_status = (
                    None
                    if slot.prior_status is None
                    else slot.prior_status.value
                )

                conn.execute(
                    """
                    INSERT INTO
                        pipeline_backfill_slots (
                            backfill_id,
                            ordinal,
                            slot_start,
                            slot_end,
                            prior_status,
                            decision,
                            status
                        )
                    VALUES (
                        %s, %s, %s, %s,
                        %s, %s, %s
                    )
                    """,
                    (
                        backfill_id,
                        slot.ordinal,
                        slot.slot_start,
                        slot.slot_end,
                        prior_status,
                        slot.decision.value,
                        slot.initial_status.value,
                    ),
                )

            request = _request_from_row(
                row
            )

            slots = _list_slots_conn(
                conn,
                backfill_id=backfill_id,
            )

    return BackfillCreateResult(
        created=True,
        request=request,
        slots=slots,
    )


def claim_backfill_slots(
    database_url: str,
    *,
    backfill_id: UUID | str,
    worker_id: str,
    lease: timedelta,
    limit: int = 1,
) -> tuple[BackfillSlot, ...]:
    """Lease pending slots without exceeding max_active_runs."""

    database_url = _database_url(
        database_url
    )

    backfill_id = _uuid(
        backfill_id,
        "backfill_id",
    )

    worker_id = _text(
        worker_id,
        "worker_id",
    )

    lease = _lease(lease)

    limit = _positive_int(
        limit,
        "limit",
        maximum=MAX_CLAIM_LIMIT,
    )

    claimed: list[BackfillSlot] = []

    with psycopg.connect(
        database_url,
        row_factory=dict_row,
    ) as conn:
        with conn.transaction():
            request_row = conn.execute(
                """
                SELECT *
                FROM pipeline_backfills
                WHERE backfill_id = %s
                FOR UPDATE
                """,
                (backfill_id,),
            ).fetchone()

            if request_row is None:
                raise BackfillConflictError(
                    "Unknown backfill_id"
                )

            request = _request_from_row(
                request_row
            )

            active_row = conn.execute(
                """
                SELECT
                    COUNT(*)::integer
                        AS active_count
                FROM pipeline_backfill_slots
                WHERE backfill_id = %s
                  AND status = 'CLAIMED'
                """,
                (backfill_id,),
            ).fetchone()

            if active_row is None:
                raise BackfillIntegrityError(
                    "Unable to count active "
                    "backfill slots"
                )

            active_count = (
                active_row["active_count"]
            )

            capacity = min(
                (
                    request.max_active_runs
                    - active_count
                ),
                limit,
            )

            if capacity <= 0:
                return ()

            direction = (
                "DESC"
                if request.run_backwards
                else "ASC"
            )

            candidate_rows = conn.execute(
                f"""
                SELECT *
                FROM pipeline_backfill_slots
                WHERE backfill_id = %s
                  AND status = 'PENDING'
                ORDER BY
                    slot_start {direction},
                    ordinal {direction}
                FOR UPDATE SKIP LOCKED
                LIMIT %s
                """,
                (
                    backfill_id,
                    capacity,
                ),
            ).fetchall()

            for candidate in candidate_rows:
                attempt_number = (
                    candidate[
                        "attempt_number"
                    ]
                    + 1
                )

                (
                    batch_id,
                    execution_id,
                ) = derive_execution_identity(
                    backfill_id=backfill_id,
                    slot_start=(
                        candidate["slot_start"]
                    ),
                    attempt_number=(
                        attempt_number
                    ),
                )

                updated = conn.execute(
                    """
                    UPDATE
                        pipeline_backfill_slots
                    SET
                        fence_token = fence_token + 1,
                        status = 'CLAIMED',
                        attempt_number = %s,
                        batch_id = %s,
                        execution_id = %s,
                        worker_id = %s,
                        claimed_at =
                            statement_timestamp(),
                        lease_expires_at =
                            statement_timestamp()
                            + %s,
                        finished_at = NULL
                    WHERE backfill_id = %s
                      AND slot_start = %s
                      AND status = 'PENDING'
                    RETURNING *
                    """,
                    (
                        attempt_number,
                        batch_id,
                        execution_id,
                        worker_id,
                        lease,
                        backfill_id,
                        candidate["slot_start"],
                    ),
                ).fetchone()

                if updated is None:
                    raise (
                        BackfillConflictError(
                            "Backfill slot was "
                            "concurrently claimed"
                        )
                    )

                claimed.append(
                    _slot_from_row(updated)
                )

    return tuple(claimed)


def _validate_execution_link(
    slot: BackfillSlot,
    execution_row: dict[str, Any],
) -> BackfillSlotStatus:
    if (
        slot.batch_id is None
        or slot.execution_id is None
    ):
        raise BackfillIntegrityError(
            "Claimed slot is missing "
            "execution identity"
        )

    execution_id = _uuid(
        execution_row["execution_id"],
        "execution_id",
    )

    batch_id = _uuid(
        execution_row["batch_id"],
        "batch_id",
    )

    if execution_id != slot.execution_id:
        raise BackfillIntegrityError(
            "Execution identity does not "
            "match claim"
        )

    if batch_id != slot.batch_id:
        raise BackfillIntegrityError(
            "Batch identity does not "
            "match claim"
        )

    if (
        execution_row["attempt_number"]
        != slot.attempt_number
    ):
        raise BackfillIntegrityError(
            "Execution attempt does not "
            "match claim"
        )

    status = execution_row["status"]

    if status == "SUCCEEDED":
        return BackfillSlotStatus.SUCCEEDED

    if status == "FAILED":
        return BackfillSlotStatus.FAILED

    raise BackfillConflictError(
        "Execution is not terminal"
    )


def complete_backfill_slot(
    database_url: str,
    *,
    backfill_id: UUID | str,
    slot_start: datetime,
    worker_id: str,
    fence_token: int,
) -> BackfillSlot:
    """Link a claim to its terminal durable ledger execution."""

    database_url = _database_url(
        database_url
    )

    backfill_id = _uuid(
        backfill_id,
        "backfill_id",
    )

    slot_start = _timestamp(
        slot_start,
        "slot_start",
    )

    with psycopg.connect(
        database_url,
        row_factory=dict_row,
    ) as conn:
        with conn.transaction():
            row = conn.execute(
                """
                SELECT *
                FROM pipeline_backfill_slots
                WHERE backfill_id = %s
                  AND slot_start = %s
                FOR UPDATE
                """,
                (
                    backfill_id,
                    slot_start,
                ),
            ).fetchone()

            if row is None:
                raise BackfillConflictError(
                    "Unknown backfill slot"
                )

            slot = _slot_from_row(row)

            if (
                slot.status
                is not BackfillSlotStatus.CLAIMED
            ):
                raise BackfillConflictError(
                    "Backfill slot is not claimed"
                )

            if slot.execution_id is None:
                raise BackfillIntegrityError(
                    "Claimed slot has no "
                    "execution_id"
                )

            execution_row = conn.execute(
                """
                SELECT
                    execution_id,
                    batch_id,
                    attempt_number,
                    status,
                    finished_at
                FROM pipeline_executions
                WHERE execution_id = %s
                """,
                (slot.execution_id,),
            ).fetchone()

            if execution_row is None:
                raise BackfillConflictError(
                    "Claimed execution has not "
                    "started in the durable ledger"
                )

            terminal_status = (
                _validate_execution_link(
                    slot,
                    execution_row,
                )
            )

            updated = conn.execute(
                """
                UPDATE
                    pipeline_backfill_slots
                SET
                    status = %s,
                    finished_at = %s
                WHERE backfill_id = %s
                  AND slot_start = %s
                  AND status = 'CLAIMED'
                  AND worker_id = %s
                  AND fence_token = %s
                RETURNING *
                """,
                (
                    terminal_status.value,
                    execution_row["finished_at"],
                    backfill_id,
                    slot_start,
                    worker_id,
                    fence_token,
                ),
            ).fetchone()

            if updated is None:
                raise BackfillConflictError(
                    "Backfill completion "
                    "lost claim"
                )

            return _slot_from_row(
                updated
            )


def recover_expired_claims(
    database_url: str,
    *,
    backfill_id: UUID | str,
    limit: int = 100,
) -> tuple[
    BackfillRecoveryAction,
    ...,
]:
    """Recover expired claims without duplicating live executions."""

    database_url = _database_url(
        database_url
    )

    backfill_id = _uuid(
        backfill_id,
        "backfill_id",
    )

    limit = _positive_int(
        limit,
        "limit",
        maximum=MAX_CLAIM_LIMIT,
    )

    actions: list[
        BackfillRecoveryAction
    ] = []

    with psycopg.connect(
        database_url,
        row_factory=dict_row,
    ) as conn:
        with conn.transaction():
            rows = conn.execute(
                """
                SELECT *
                FROM pipeline_backfill_slots
                WHERE backfill_id = %s
                  AND status = 'CLAIMED'
                  AND lease_expires_at
                      <= statement_timestamp()
                ORDER BY
                    lease_expires_at,
                    slot_start
                FOR UPDATE SKIP LOCKED
                LIMIT %s
                """,
                (
                    backfill_id,
                    limit,
                ),
            ).fetchall()

            for row in rows:
                slot = _slot_from_row(
                    row
                )

                if slot.execution_id is None:
                    raise (
                        BackfillIntegrityError(
                            "Expired claim is "
                            "missing execution "
                            "identity"
                        )
                    )

                execution_row = conn.execute(
                    """
                    SELECT
                        execution_id,
                        batch_id,
                        attempt_number,
                        status,
                        finished_at
                    FROM pipeline_executions
                    WHERE execution_id = %s
                    """,
                    (slot.execution_id,),
                ).fetchone()

                if execution_row is None:
                    conn.execute(
                        """
                        UPDATE
                            pipeline_backfill_slots
                        SET
                            status = 'PENDING',
                            batch_id = NULL,
                            execution_id = NULL,
                            worker_id = NULL,
                            claimed_at = NULL,
                            lease_expires_at = NULL,
                            finished_at = NULL
                        WHERE backfill_id = %s
                          AND slot_start = %s
                        """,
                        (
                            backfill_id,
                            slot.slot_start,
                        ),
                    )

                    actions.append(
                        BackfillRecoveryAction(
                            slot_start=(
                                slot.slot_start
                            ),
                            execution_id=(
                                slot.execution_id
                            ),
                            action=(
                                "REQUEUED_NOT_STARTED"
                            ),
                        )
                    )

                    continue

                try:
                    terminal_status = (
                        _validate_execution_link(
                            slot,
                            execution_row,
                        )
                    )
                except BackfillConflictError:
                    actions.append(
                        BackfillRecoveryAction(
                            slot_start=(
                                slot.slot_start
                            ),
                            execution_id=(
                                slot.execution_id
                            ),
                            action=(
                                "PRESERVED_RUNNING_"
                                "EXECUTION"
                            ),
                        )
                    )

                    continue

                conn.execute(
                    """
                    UPDATE
                        pipeline_backfill_slots
                    SET
                        status = %s,
                        finished_at = %s
                    WHERE backfill_id = %s
                      AND slot_start = %s
                      AND status = 'CLAIMED'
                    """,
                    (
                        terminal_status.value,
                        execution_row[
                            "finished_at"
                        ],
                        backfill_id,
                        slot.slot_start,
                    ),
                )

                actions.append(
                    BackfillRecoveryAction(
                        slot_start=(
                            slot.slot_start
                        ),
                        execution_id=(
                            slot.execution_id
                        ),
                        action=(
                            "RECONCILED_"
                            f"{terminal_status.value}"
                        ),
                    )
                )

    return tuple(actions)


def get_backfill_summary(
    database_url: str,
    *,
    backfill_id: UUID | str,
) -> BackfillSummary:
    database_url = _database_url(
        database_url
    )

    backfill_id = _uuid(
        backfill_id,
        "backfill_id",
    )

    with psycopg.connect(
        database_url,
        row_factory=dict_row,
    ) as conn:
        conn.execute(
            "SET TRANSACTION READ ONLY"
        )

        exists = conn.execute(
            """
            SELECT 1
            FROM pipeline_backfills
            WHERE backfill_id = %s
            """,
            (backfill_id,),
        ).fetchone()

        if exists is None:
            raise BackfillConflictError(
                "Unknown backfill_id"
            )

        rows = conn.execute(
            """
            SELECT
                status,
                COUNT(*)::integer AS count
            FROM pipeline_backfill_slots
            WHERE backfill_id = %s
            GROUP BY status
            """,
            (backfill_id,),
        ).fetchall()

    counts = {
        status.value: 0
        for status in BackfillSlotStatus
    }

    for row in rows:
        counts[row["status"]] = (
            row["count"]
        )

    total = sum(
        counts.values()
    )

    pending = counts[
        BackfillSlotStatus.PENDING.value
    ]

    claimed = counts[
        BackfillSlotStatus.CLAIMED.value
    ]

    return BackfillSummary(
        backfill_id=backfill_id,
        total=total,
        pending=pending,
        skipped=counts[
            BackfillSlotStatus.SKIPPED.value
        ],
        claimed=claimed,
        succeeded=counts[
            BackfillSlotStatus.SUCCEEDED.value
        ],
        failed=counts[
            BackfillSlotStatus.FAILED.value
        ],
        complete=(
            pending == 0
            and claimed == 0
        ),
    )
