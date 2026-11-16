CREATE TABLE data_quality_reconciliation_runs (
    reconciliation_id uuid PRIMARY KEY,

    execution_id uuid
        REFERENCES pipeline_executions(execution_id)
        ON DELETE RESTRICT,

    batch_id uuid,

    key_fields jsonb NOT NULL
        CHECK (jsonb_typeof(key_fields) = 'array'),

    status text NOT NULL
        CHECK (status IN ('PASS', 'FAIL')),

    source_row_count bigint NOT NULL
        CHECK (source_row_count >= 0),

    target_row_count bigint NOT NULL
        CHECK (target_row_count >= 0),

    source_distinct_key_count bigint NOT NULL
        CHECK (
            source_distinct_key_count >= 0
            AND source_distinct_key_count <= source_row_count
        ),

    target_distinct_key_count bigint NOT NULL
        CHECK (
            target_distinct_key_count >= 0
            AND target_distinct_key_count <= target_row_count
        ),

    source_duplicate_key_count bigint NOT NULL
        CHECK (
            source_duplicate_key_count >= 0
            AND source_duplicate_key_count <= source_row_count
        ),

    target_duplicate_key_count bigint NOT NULL
        CHECK (
            target_duplicate_key_count >= 0
            AND target_duplicate_key_count <= target_row_count
        ),

    source_digest text NOT NULL
        CHECK (source_digest ~ '^[0-9a-f]{64}$'),

    target_digest text NOT NULL
        CHECK (target_digest ~ '^[0-9a-f]{64}$'),

    missing_key_count bigint NOT NULL
        CHECK (missing_key_count >= 0),

    extra_key_count bigint NOT NULL
        CHECK (extra_key_count >= 0),

    evidence_checksum text NOT NULL
        CHECK (evidence_checksum ~ '^[0-9a-f]{64}$'),

    created_at timestamptz NOT NULL
        DEFAULT statement_timestamp()
);

CREATE TABLE data_quality_reconciliation_metrics (
    reconciliation_id uuid NOT NULL
        REFERENCES data_quality_reconciliation_runs(reconciliation_id)
        ON DELETE CASCADE,

    metric_name text NOT NULL
        CHECK (length(btrim(metric_name)) > 0),

    source_value jsonb NOT NULL,
    target_value jsonb NOT NULL,

    delta double precision,

    status text NOT NULL
        CHECK (status IN ('PASS', 'FAIL')),

    PRIMARY KEY (
        reconciliation_id,
        metric_name
    )
);

CREATE TABLE data_quality_reconciliation_key_differences (
    reconciliation_id uuid NOT NULL
        REFERENCES data_quality_reconciliation_runs(reconciliation_id)
        ON DELETE CASCADE,

    direction text NOT NULL
        CHECK (
            direction IN (
                'MISSING_FROM_TARGET',
                'EXTRA_IN_TARGET'
            )
        ),

    key_token text NOT NULL
        CHECK (length(key_token) > 0),

    occurrence_count bigint NOT NULL
        CHECK (occurrence_count > 0),

    PRIMARY KEY (
        reconciliation_id,
        direction,
        key_token
    )
);

CREATE INDEX ix_data_quality_reconciliation_runs_execution
    ON data_quality_reconciliation_runs (
        execution_id,
        created_at DESC
    )
    WHERE execution_id IS NOT NULL;

CREATE INDEX ix_data_quality_reconciliation_runs_batch
    ON data_quality_reconciliation_runs (
        batch_id,
        created_at DESC
    )
    WHERE batch_id IS NOT NULL;

CREATE INDEX ix_data_quality_reconciliation_runs_created_at
    ON data_quality_reconciliation_runs (
        created_at DESC,
        reconciliation_id DESC
    );

CREATE INDEX ix_data_quality_reconciliation_runs_checksum
    ON data_quality_reconciliation_runs (
        evidence_checksum
    );
