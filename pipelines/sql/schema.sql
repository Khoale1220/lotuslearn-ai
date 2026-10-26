-- LotusLearn Relational Schema (SQLite 3)
-- Strict foreign keys, deterministic primary keys, zero PII storage.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS analysis_runs (
    run_id TEXT PRIMARY KEY,
    dataset_fingerprint TEXT NOT NULL,
    submission_count INTEGER NOT NULL CHECK (submission_count >= 1),
    subject TEXT NOT NULL,
    grade_level TEXT NOT NULL,
    total_duration_ms INTEGER,
    execution_mode TEXT,
    occurred_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS analytical_events (
    event_id TEXT PRIMARY KEY,
    schema_version TEXT NOT NULL,
    event_type TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    analysis_run_id TEXT NOT NULL REFERENCES analysis_runs(run_id) ON DELETE CASCADE,
    provenance TEXT NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_run_id ON analytical_events(analysis_run_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON analytical_events(event_type);

CREATE TABLE IF NOT EXISTS misconception_clusters (
    analysis_run_id TEXT NOT NULL REFERENCES analysis_runs(run_id) ON DELETE CASCADE,
    cluster_id TEXT NOT NULL,
    concept TEXT NOT NULL,
    teaching_priority TEXT NOT NULL,
    affected_student_count INTEGER NOT NULL CHECK (affected_student_count >= 1),
    percentage_affected REAL,
    explanation TEXT,
    PRIMARY KEY (analysis_run_id, cluster_id)
);

CREATE TABLE IF NOT EXISTS student_findings (
    analysis_run_id TEXT NOT NULL,
    cluster_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    PRIMARY KEY (analysis_run_id, cluster_id, student_id),
    FOREIGN KEY (analysis_run_id, cluster_id)
        REFERENCES misconception_clusters(analysis_run_id, cluster_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_findings_student ON student_findings(student_id);

CREATE TABLE IF NOT EXISTS instructional_groups (
    analysis_run_id TEXT NOT NULL REFERENCES analysis_runs(run_id) ON DELETE CASCADE,
    group_id TEXT NOT NULL,
    group_name TEXT NOT NULL,
    student_count INTEGER NOT NULL CHECK (student_count >= 1),
    suggested_activity TEXT NOT NULL,
    estimated_duration TEXT,
    PRIMARY KEY (analysis_run_id, group_id)
);

CREATE TABLE IF NOT EXISTS group_memberships (
    analysis_run_id TEXT NOT NULL,
    group_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    PRIMARY KEY (analysis_run_id, group_id, student_id),
    FOREIGN KEY (analysis_run_id, group_id)
        REFERENCES instructional_groups(analysis_run_id, group_id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS verifications (
    analysis_run_id TEXT PRIMARY KEY REFERENCES analysis_runs(run_id) ON DELETE CASCADE,
    overall_status TEXT NOT NULL,
    coverage_passed INTEGER NOT NULL CHECK (coverage_passed IN (0, 1)),
    cluster_math_passed INTEGER NOT NULL CHECK (cluster_math_passed IN (0, 1)),
    group_partition_passed INTEGER NOT NULL CHECK (group_partition_passed IN (0, 1)),
    quotes_grounded_count INTEGER NOT NULL DEFAULT 0,
    quotes_flagged_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS teacher_decisions (
    analysis_run_id TEXT NOT NULL REFERENCES analysis_runs(run_id) ON DELETE CASCADE,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    teacher_decision TEXT NOT NULL CHECK (teacher_decision IN ('pending', 'accepted', 'edited', 'dismissed')),
    notes TEXT,
    recorded_at TEXT NOT NULL,
    PRIMARY KEY (analysis_run_id, target_type, target_id, teacher_decision)
);

CREATE TABLE IF NOT EXISTS ingestion_audit_log (
    event_id TEXT PRIMARY KEY,
    event_type TEXT,
    outcome TEXT NOT NULL CHECK (outcome IN ('accepted', 'duplicate', 'rejected')),
    rejection_reason TEXT,
    processed_at TEXT NOT NULL
);
