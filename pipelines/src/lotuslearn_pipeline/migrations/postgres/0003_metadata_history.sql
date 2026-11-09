-- LotusLearn immutable metadata snapshot and comparison observation history.

CREATE TABLE IF NOT EXISTS metadata_snapshot_history (
    snapshot_id TEXT PRIMARY KEY CHECK (length(snapshot_id) > 0),
    content_checksum TEXT NOT NULL
        CHECK (content_checksum ~ '^[0-9a-f]{64}$'),
    generated_at TIMESTAMPTZ NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    schema_version TEXT NOT NULL,
    extractor_version TEXT NOT NULL,
    repository_commit TEXT,
    asset_count INTEGER NOT NULL CHECK (asset_count >= 0),
    field_count INTEGER NOT NULL CHECK (field_count >= 0),
    constraint_count INTEGER NOT NULL CHECK (constraint_count >= 0),
    lineage_edge_count INTEGER NOT NULL CHECK (lineage_edge_count >= 0),
    warning_count INTEGER NOT NULL CHECK (warning_count >= 0),
    error_count INTEGER NOT NULL CHECK (error_count >= 0),
    payload_json JSONB NOT NULL
        CHECK (jsonb_typeof(payload_json) = 'object')
);

CREATE INDEX IF NOT EXISTS metadata_snapshot_history_checksum_idx
    ON metadata_snapshot_history (content_checksum);
CREATE INDEX IF NOT EXISTS metadata_snapshot_history_generated_at_idx
    ON metadata_snapshot_history (generated_at DESC, snapshot_id DESC);

CREATE TABLE IF NOT EXISTS metadata_diff_history (
    baseline_snapshot_id TEXT NOT NULL
        REFERENCES metadata_snapshot_history(snapshot_id) ON DELETE RESTRICT,
    current_snapshot_id TEXT NOT NULL
        REFERENCES metadata_snapshot_history(snapshot_id) ON DELETE RESTRICT,
    comparison_id TEXT NOT NULL
        CHECK (comparison_id ~ '^[0-9a-f]{64}$'),
    baseline_checksum TEXT NOT NULL
        CHECK (baseline_checksum ~ '^[0-9a-f]{64}$'),
    current_checksum TEXT NOT NULL
        CHECK (current_checksum ~ '^[0-9a-f]{64}$'),
    change_count INTEGER NOT NULL CHECK (change_count >= 0),
    breaking_count INTEGER NOT NULL CHECK (breaking_count >= 0),
    review_required_count INTEGER NOT NULL CHECK (review_required_count >= 0),
    non_breaking_count INTEGER NOT NULL CHECK (non_breaking_count >= 0),
    metadata_only_count INTEGER NOT NULL CHECK (metadata_only_count >= 0),
    directly_changed_asset_count INTEGER NOT NULL
        CHECK (directly_changed_asset_count >= 0),
    downstream_impacted_asset_count INTEGER NOT NULL
        CHECK (downstream_impacted_asset_count >= 0),
    payload_json JSONB NOT NULL
        CHECK (jsonb_typeof(payload_json) = 'object'),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (baseline_snapshot_id, current_snapshot_id)
);

CREATE INDEX IF NOT EXISTS metadata_diff_history_comparison_id_idx
    ON metadata_diff_history (comparison_id);
CREATE INDEX IF NOT EXISTS metadata_diff_history_current_snapshot_id_idx
    ON metadata_diff_history (current_snapshot_id);
CREATE INDEX IF NOT EXISTS metadata_diff_history_recorded_at_idx
    ON metadata_diff_history (recorded_at DESC);