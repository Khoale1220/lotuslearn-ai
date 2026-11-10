-- OPS-01A: Durable pipeline execution ledger.
-- Execution identity is separate from educational analysis_run_id.
-- No event payload, raw input, or exception text is persisted.

CREATE TABLE pipeline_executions (
    execution_id UUID PRIMARY KEY,
    batch_id UUID NOT NULL,
    attempt_number INTEGER NOT NULL
        CHECK (attempt_number > 0),

    status TEXT NOT NULL DEFAULT 'RUNNING'
        CHECK (status IN ('RUNNING', 'SUCCEEDED', 'FAILED')),

    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMPTZ,

    total_attempted BIGINT CHECK (total_attempted >= 0),
    accepted_count BIGINT CHECK (accepted_count >= 0),
    duplicate_count BIGINT CHECK (duplicate_count >= 0),
    conflict_count BIGINT CHECK (conflict_count >= 0),
    rejected_count BIGINT CHECK (rejected_count >= 0),
    failed_count BIGINT CHECK (failed_count >= 0),
    internal_retry_count BIGINT CHECK (internal_retry_count >= 0),

    error_code TEXT
        CHECK (
            error_code IS NULL
            OR error_code ~ '^[A-Z][A-Z0-9_]{0,63}$'
        ),

    CONSTRAINT pipeline_execution_unique_attempt
        UNIQUE (batch_id, attempt_number),

    CONSTRAINT pipeline_execution_clock_check
        CHECK (
            finished_at IS NULL
            OR finished_at >= started_at
        ),

    CONSTRAINT pipeline_execution_state_check
        CHECK (
            (
                status = 'RUNNING'
                AND finished_at IS NULL
                AND error_code IS NULL
            )
            OR (
                status = 'SUCCEEDED'
                AND finished_at IS NOT NULL
                AND error_code IS NULL
            )
            OR (
                status = 'FAILED'
                AND finished_at IS NOT NULL
                AND error_code IS NOT NULL
            )
        ),

    CONSTRAINT pipeline_execution_accounting_check
        CHECK (
            (
                total_attempted IS NULL
                AND accepted_count IS NULL
                AND duplicate_count IS NULL
                AND conflict_count IS NULL
                AND rejected_count IS NULL
                AND failed_count IS NULL
                AND internal_retry_count IS NULL
            )
            OR (
                total_attempted IS NOT NULL
                AND accepted_count IS NOT NULL
                AND duplicate_count IS NOT NULL
                AND conflict_count IS NOT NULL
                AND rejected_count IS NOT NULL
                AND failed_count IS NOT NULL
                AND internal_retry_count IS NOT NULL
                AND total_attempted =
                    accepted_count
                    + duplicate_count
                    + conflict_count
                    + rejected_count
                    + failed_count
            )
        ),

    CONSTRAINT pipeline_execution_success_check
        CHECK (
            status <> 'SUCCEEDED'
            OR total_attempted IS NOT NULL
        )
);

CREATE INDEX idx_pipeline_executions_running
    ON pipeline_executions (heartbeat_at, execution_id)
    WHERE status = 'RUNNING';

CREATE INDEX idx_pipeline_executions_recent
    ON pipeline_executions (started_at DESC, execution_id);
