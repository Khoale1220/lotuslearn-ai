-- DE04 C11: bounded backfill orchestration control plane.
--
-- Existing migrations remain immutable.
--
-- A backfill request owns deterministic historical slots. The slot
-- lifecycle is intentionally separate from pipeline_executions:
-- execution_id is planned when work is leased and is linked to the
-- existing durable execution ledger after the worker starts.
--
-- No business payload or student data is persisted here.

CREATE TABLE pipeline_backfills (
    backfill_id UUID PRIMARY KEY,

    pipeline_key TEXT NOT NULL
        CHECK (
            length(btrim(pipeline_key)) > 0
            AND length(pipeline_key) <= 200
        ),

    request_key TEXT NOT NULL UNIQUE
        CHECK (
            length(btrim(request_key)) > 0
            AND length(request_key) <= 200
        ),

    window_start TIMESTAMPTZ NOT NULL,
    window_end TIMESTAMPTZ NOT NULL,

    interval_seconds INTEGER NOT NULL
        CHECK (interval_seconds > 0),

    reprocess_behavior TEXT NOT NULL
        CHECK (
            reprocess_behavior IN (
                'none',
                'failed',
                'completed'
            )
        ),

    max_active_runs INTEGER NOT NULL
        CHECK (
            max_active_runs > 0
            AND max_active_runs <= 100
        ),

    run_backwards BOOLEAN NOT NULL
        DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT statement_timestamp(),

    CONSTRAINT pipeline_backfills_window_check
        CHECK (window_end > window_start)
);

CREATE INDEX
    idx_pipeline_backfills_pipeline_created
ON pipeline_backfills (
    pipeline_key,
    created_at DESC,
    backfill_id
);

CREATE TABLE pipeline_backfill_slots (
    backfill_id UUID NOT NULL,

    ordinal INTEGER NOT NULL
        CHECK (ordinal >= 0),

    slot_start TIMESTAMPTZ NOT NULL,
    slot_end TIMESTAMPTZ NOT NULL,

    prior_status TEXT
        CHECK (
            prior_status IS NULL
            OR prior_status IN (
                'PENDING',
                'CLAIMED',
                'SUCCEEDED',
                'FAILED'
            )
        ),

    decision TEXT NOT NULL
        CHECK (
            decision IN (
                'CREATE_MISSING',
                'REPROCESS_FAILED',
                'REPROCESS_COMPLETED',
                'SKIP_EXISTING',
                'SKIP_ACTIVE'
            )
        ),

    status TEXT NOT NULL
        CHECK (
            status IN (
                'PENDING',
                'SKIPPED',
                'CLAIMED',
                'SUCCEEDED',
                'FAILED'
            )
        ),

    attempt_number INTEGER NOT NULL
        DEFAULT 0
        CHECK (attempt_number >= 0),

    batch_id UUID,
    execution_id UUID,

    worker_id TEXT
        CHECK (
            worker_id IS NULL
            OR (
                length(btrim(worker_id)) > 0
                AND length(worker_id) <= 200
            )
        ),

    claimed_at TIMESTAMPTZ,
    lease_expires_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,

    CONSTRAINT pipeline_backfill_slots_pk
        PRIMARY KEY (
            backfill_id,
            slot_start
        ),

    CONSTRAINT pipeline_backfill_slots_ordinal_unique
        UNIQUE (
            backfill_id,
            ordinal
        ),

    CONSTRAINT pipeline_backfill_slots_request_fk
        FOREIGN KEY (backfill_id)
        REFERENCES pipeline_backfills(backfill_id)
        ON DELETE RESTRICT,

    CONSTRAINT pipeline_backfill_slots_window_check
        CHECK (slot_end > slot_start),

    CONSTRAINT pipeline_backfill_slots_state_shape
        CHECK (
            (
                status IN ('PENDING', 'SKIPPED')
                AND batch_id IS NULL
                AND execution_id IS NULL
                AND worker_id IS NULL
                AND claimed_at IS NULL
                AND lease_expires_at IS NULL
                AND finished_at IS NULL
            )
            OR
            (
                status = 'CLAIMED'
                AND attempt_number > 0
                AND batch_id IS NOT NULL
                AND execution_id IS NOT NULL
                AND worker_id IS NOT NULL
                AND claimed_at IS NOT NULL
                AND lease_expires_at IS NOT NULL
                AND lease_expires_at > claimed_at
                AND finished_at IS NULL
            )
            OR
            (
                status IN ('SUCCEEDED', 'FAILED')
                AND attempt_number > 0
                AND batch_id IS NOT NULL
                AND execution_id IS NOT NULL
                AND worker_id IS NOT NULL
                AND claimed_at IS NOT NULL
                AND lease_expires_at IS NOT NULL
                AND finished_at IS NOT NULL
            )
        )
);

CREATE INDEX
    idx_pipeline_backfill_slots_pending
ON pipeline_backfill_slots (
    backfill_id,
    slot_start,
    ordinal
)
WHERE status = 'PENDING';

CREATE INDEX
    idx_pipeline_backfill_slots_claimed
ON pipeline_backfill_slots (
    backfill_id,
    lease_expires_at,
    slot_start
)
WHERE status = 'CLAIMED';

CREATE INDEX
    idx_pipeline_backfill_slots_history
ON pipeline_backfill_slots (
    slot_start,
    slot_end,
    status,
    backfill_id
);
