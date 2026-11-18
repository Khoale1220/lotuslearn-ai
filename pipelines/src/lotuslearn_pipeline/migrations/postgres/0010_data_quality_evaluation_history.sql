CREATE TABLE data_quality_evaluation_history (
    evaluation_key text PRIMARY KEY
        CHECK (length(btrim(evaluation_key)) > 0),

    decision_fingerprint text NOT NULL
        CHECK (decision_fingerprint ~ '^[0-9a-f]{64}$'),

    reconciliation_fingerprint text NOT NULL
        CHECK (reconciliation_fingerprint ~ '^[0-9a-f]{64}$'),

    evaluation_status text NOT NULL
        CHECK (
            evaluation_status IN (
                'PASS',
                'REVIEW',
                'ALERT'
            )
        ),

    reconciliation_status text NOT NULL
        CHECK (
            reconciliation_status IN (
                'PASS',
                'FAIL'
            )
        ),

    history_size integer NOT NULL
        CHECK (history_size >= 0),

    analytics_ready boolean NOT NULL,

    reasons jsonb NOT NULL
        CHECK (jsonb_typeof(reasons) = 'array'),

    feature_columns jsonb NOT NULL
        CHECK (jsonb_typeof(feature_columns) = 'array'),

    detector_evidence jsonb,

    payload jsonb NOT NULL
        CHECK (jsonb_typeof(payload) = 'object'),

    created_at timestamptz NOT NULL
        DEFAULT statement_timestamp()
);

CREATE INDEX ix_data_quality_evaluation_history_status_created
    ON data_quality_evaluation_history (
        evaluation_status,
        created_at DESC
    );

CREATE INDEX ix_data_quality_evaluation_history_reconciliation
    ON data_quality_evaluation_history (
        reconciliation_fingerprint,
        created_at DESC
    );

CREATE OR REPLACE FUNCTION reject_data_quality_evaluation_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        USING
            ERRCODE = '55000',
            MESSAGE = 'data quality evaluation history is immutable';
END;
$$;

CREATE TRIGGER trg_data_quality_evaluation_history_immutable
BEFORE UPDATE OR DELETE
ON data_quality_evaluation_history
FOR EACH ROW
EXECUTE FUNCTION reject_data_quality_evaluation_mutation();
