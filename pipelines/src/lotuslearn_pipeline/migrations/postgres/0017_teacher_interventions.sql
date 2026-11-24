CREATE TABLE IF NOT EXISTS teacher_interventions (
    intervention_key UUID PRIMARY KEY,
    student_key TEXT NOT NULL
        CHECK (length(btrim(student_key)) > 0),
    action_type TEXT NOT NULL
        CHECK (length(btrim(action_type)) > 0),
    analysis_key TEXT NULL
        CHECK (
            analysis_key IS NULL
            OR length(btrim(analysis_key)) > 0
        ),
    created_at TIMESTAMPTZ NOT NULL,
    provenance JSONB NOT NULL
        CHECK (jsonb_typeof(provenance) = 'object'),
    persisted_at TIMESTAMPTZ NOT NULL
        DEFAULT statement_timestamp()
);

CREATE INDEX IF NOT EXISTS
    idx_teacher_interventions_student_created
ON teacher_interventions (
    student_key,
    created_at DESC,
    intervention_key
);

CREATE INDEX IF NOT EXISTS
    idx_teacher_interventions_analysis_created
ON teacher_interventions (
    analysis_key,
    created_at DESC,
    intervention_key
)
WHERE analysis_key IS NOT NULL;

COMMENT ON TABLE teacher_interventions IS
    'Append-only persistence for canonical teacher intervention commands.';

COMMENT ON COLUMN teacher_interventions.intervention_key IS
    'Application-owned UUID. PostgreSQL must never generate this identity.';

COMMENT ON COLUMN teacher_interventions.provenance IS
    'Sanitized canonical provenance only. Raw student submissions are forbidden.';