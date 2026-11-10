-- LotusLearn immutable metadata governance decision history.

CREATE TABLE IF NOT EXISTS metadata_governance_decision_history (
    comparison_id TEXT NOT NULL
        CHECK (comparison_id ~ '^[0-9a-f]{64}$'),

    policy_id TEXT NOT NULL
        CHECK (length(policy_id) > 0),

    policy_version TEXT NOT NULL
        CHECK (length(policy_version) > 0),

    decision_id TEXT NOT NULL
        CHECK (decision_id ~ '^[0-9a-f]{64}$'),

    status TEXT NOT NULL
        CHECK (status IN ('PASS', 'REVIEW', 'BLOCK')),

    baseline_checksum TEXT NOT NULL
        CHECK (baseline_checksum ~ '^[0-9a-f]{64}$'),

    current_checksum TEXT NOT NULL
        CHECK (current_checksum ~ '^[0-9a-f]{64}$'),

    change_count INTEGER NOT NULL
        CHECK (change_count >= 0),

    breaking_change_count INTEGER NOT NULL
        CHECK (breaking_change_count >= 0),

    review_required_change_count INTEGER NOT NULL
        CHECK (review_required_change_count >= 0),

    non_breaking_change_count INTEGER NOT NULL
        CHECK (non_breaking_change_count >= 0),

    metadata_only_change_count INTEGER NOT NULL
        CHECK (metadata_only_change_count >= 0),

    directly_changed_asset_count INTEGER NOT NULL
        CHECK (directly_changed_asset_count >= 0),

    downstream_impacted_asset_count INTEGER NOT NULL
        CHECK (downstream_impacted_asset_count >= 0),

    violation_count INTEGER NOT NULL
        CHECK (violation_count >= 0),

    payload_json JSONB NOT NULL
        CHECK (jsonb_typeof(payload_json) = 'object'),

    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (
        comparison_id,
        policy_id,
        policy_version
    ),

    UNIQUE (decision_id),

    CHECK (
        change_count =
            breaking_change_count +
            review_required_change_count +
            non_breaking_change_count +
            metadata_only_change_count
    ),

    CHECK (
        violation_count =
            breaking_change_count +
            review_required_change_count
    ),

    CHECK (
        (status = 'PASS' AND violation_count = 0)
        OR
        (status IN ('REVIEW', 'BLOCK') AND violation_count > 0)
    )
);

CREATE INDEX IF NOT EXISTS metadata_governance_history_status_idx
    ON metadata_governance_decision_history (
        policy_id,
        policy_version,
        status
    );

CREATE INDEX IF NOT EXISTS metadata_governance_history_recorded_at_idx
    ON metadata_governance_decision_history (
        recorded_at DESC,
        decision_id DESC
    );

CREATE INDEX IF NOT EXISTS metadata_governance_history_comparison_idx
    ON metadata_governance_decision_history (
        comparison_id
    );

