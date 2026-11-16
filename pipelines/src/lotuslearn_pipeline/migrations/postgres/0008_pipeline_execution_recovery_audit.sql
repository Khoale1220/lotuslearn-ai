CREATE TABLE pipeline_execution_recoveries (
    recovery_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    execution_id uuid NOT NULL
        REFERENCES pipeline_executions(execution_id)
        ON DELETE RESTRICT,

    batch_id uuid NOT NULL,

    attempt_number integer NOT NULL
        CHECK (attempt_number > 0),

    observed_started_at timestamptz NOT NULL,
    observed_heartbeat_at timestamptz NOT NULL,

    recovered_at timestamptz NOT NULL,

    previous_status text NOT NULL
        CHECK (previous_status = 'RUNNING'),

    recovery_status text NOT NULL
        CHECK (recovery_status = 'FAILED'),

    actor text NOT NULL
        CHECK (length(btrim(actor)) > 0),

    reason text NOT NULL
        CHECK (length(btrim(reason)) > 0),

    CONSTRAINT uq_pipeline_execution_recovery_execution
        UNIQUE (execution_id),

    CONSTRAINT ck_pipeline_execution_recovery_temporal_order
        CHECK (
            observed_heartbeat_at >= observed_started_at
            AND recovered_at >= observed_heartbeat_at
        )
);

CREATE INDEX ix_pipeline_execution_recoveries_batch
    ON pipeline_execution_recoveries (
        batch_id,
        attempt_number
    );

CREATE INDEX ix_pipeline_execution_recoveries_recovered_at
    ON pipeline_execution_recoveries (
        recovered_at DESC,
        recovery_id DESC
    );
