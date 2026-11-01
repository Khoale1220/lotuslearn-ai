-- LotusLearn PostgreSQL Schema (0001_initial)
-- Native PostgreSQL 18 relational schema, strict foreign keys, deterministic primary keys, zero PII storage.

CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS analysis_runs (
    run_id TEXT PRIMARY KEY,
    dataset_fingerprint TEXT NOT NULL,
    submission_count INTEGER NOT NULL CHECK (submission_count >= 1),
    subject TEXT NOT NULL,
    grade_level TEXT NOT NULL,
    total_duration_ms INTEGER,
    execution_mode TEXT,
    occurred_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS analytical_events (
    event_id TEXT PRIMARY KEY,
    schema_version TEXT NOT NULL,
    event_type TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    analysis_run_id TEXT NOT NULL REFERENCES analysis_runs(run_id) ON DELETE CASCADE,
    provenance TEXT NOT NULL,
    payload_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_run_id ON analytical_events(analysis_run_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON analytical_events(event_type);

CREATE TABLE IF NOT EXISTS misconception_clusters (
    analysis_run_id TEXT NOT NULL REFERENCES analysis_runs(run_id) ON DELETE CASCADE,
    cluster_id TEXT NOT NULL,
    concept TEXT NOT NULL,
    teaching_priority TEXT NOT NULL,
    affected_student_count INTEGER NOT NULL CHECK (affected_student_count >= 1),
    percentage_affected DOUBLE PRECISION,
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
    overall_status TEXT NOT NULL CHECK (overall_status IN ('verified', 'partially_verified', 'needs_review')),
    coverage_passed BOOLEAN NOT NULL,
    cluster_math_passed BOOLEAN NOT NULL,
    group_partition_passed BOOLEAN NOT NULL,
    quotes_grounded_count INTEGER NOT NULL DEFAULT 0,
    quotes_flagged_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS teacher_decisions (
    analysis_run_id TEXT NOT NULL REFERENCES analysis_runs(run_id) ON DELETE CASCADE,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    teacher_decision TEXT NOT NULL CHECK (teacher_decision IN ('accepted', 'edited', 'dismissed')),
    notes TEXT,
    recorded_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (analysis_run_id, target_type, target_id, recorded_at)
);

CREATE TABLE IF NOT EXISTS current_teacher_decisions (
    analysis_run_id TEXT NOT NULL REFERENCES analysis_runs(run_id) ON DELETE CASCADE,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    teacher_decision TEXT NOT NULL CHECK (teacher_decision IN ('accepted', 'edited', 'dismissed')),
    notes TEXT,
    updated_at TIMESTAMPTZ NOT NULL,
    last_event_id TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (analysis_run_id, target_type, target_id)
);

CREATE TABLE IF NOT EXISTS ingestion_audit_log (
    attempt_id BIGSERIAL PRIMARY KEY,
    event_id TEXT NOT NULL,
    event_type TEXT,
    outcome TEXT NOT NULL CHECK (outcome IN ('accepted', 'duplicate', 'conflict', 'rejected')),
    rejection_reason TEXT,
    processed_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_event_id ON ingestion_audit_log(event_id);

-- Analytical Views
CREATE OR REPLACE VIEW v_cohort_prevalence AS
SELECT
    c.analysis_run_id,
    c.cluster_id,
    c.concept,
    c.teaching_priority,
    c.affected_student_count AS affected_students,
    r.submission_count AS total_students,
    ROUND(
        CAST(CAST(c.affected_student_count AS REAL) / CAST(r.submission_count AS REAL) AS NUMERIC),
        4
    ) AS prevalence_rate
FROM misconception_clusters c
JOIN analysis_runs r ON c.analysis_run_id = r.run_id;

CREATE OR REPLACE VIEW v_run_scoped_students AS
SELECT DISTINCT analysis_run_id, student_id FROM student_findings
UNION
SELECT DISTINCT analysis_run_id, student_id FROM group_memberships;

CREATE OR REPLACE VIEW v_concept_findings AS
SELECT
    concept,
    teaching_priority,
    COUNT(*)::INTEGER AS cluster_count,
    SUM(affected_student_count)::BIGINT AS total_affected_instances
FROM misconception_clusters
GROUP BY concept, teaching_priority
ORDER BY total_affected_instances DESC;

CREATE OR REPLACE VIEW v_educator_decisions AS
SELECT
    analysis_run_id,
    COUNT(CASE WHEN teacher_decision = 'accepted' THEN 1 END)::INTEGER AS count_accepted,
    COUNT(CASE WHEN teacher_decision = 'edited' THEN 1 END)::INTEGER AS count_edited,
    COUNT(CASE WHEN teacher_decision = 'dismissed' THEN 1 END)::INTEGER AS count_dismissed,
    COUNT(CASE WHEN teacher_decision IN ('accepted', 'edited', 'dismissed') THEN 1 END)::INTEGER AS total_reviewed
FROM current_teacher_decisions
GROUP BY analysis_run_id;

CREATE OR REPLACE VIEW v_educator_modification_rate AS
SELECT
    analysis_run_id,
    count_accepted,
    count_edited,
    count_dismissed,
    total_reviewed,
    CASE
        WHEN total_reviewed > 0 THEN
            ROUND(
                CAST(CAST(count_edited + count_dismissed AS REAL) / CAST(total_reviewed AS REAL) AS NUMERIC),
                4
            )
        ELSE NULL
    END AS educator_modification_rate,
    CASE
        WHEN total_reviewed > 0 THEN
            ROUND(
                CAST(CAST(count_edited + count_dismissed AS REAL) / CAST(total_reviewed AS REAL) AS NUMERIC),
                4
            )
        ELSE NULL
    END AS modification_rate
FROM v_educator_decisions;
