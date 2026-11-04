-- LotusLearn PostgreSQL Schema Upgrade (0002_reliability_hardening)
-- Upgrades schema_migrations metadata, redesigns teacher_decisions historical event identity,
-- adds data-quality invariants and access path indexes.

-- 1. Upgrade schema_migrations tracking table
ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum TEXT;

-- 2. Redesign historical teacher_decisions to use analytical event identity
-- Add event_id column referencing analytical_events
ALTER TABLE teacher_decisions ADD COLUMN IF NOT EXISTS event_id TEXT;

-- Drop legacy composite primary key if present
ALTER TABLE teacher_decisions DROP CONSTRAINT IF EXISTS teacher_decisions_pkey;

-- Populate existing event_id rows from analytical_events if any legacy rows exist
UPDATE teacher_decisions td
SET event_id = ae.event_id
FROM analytical_events ae
WHERE td.event_id IS NULL
  AND ae.analysis_run_id = td.analysis_run_id
  AND ae.event_type = 'DECISION_RECORDED'
  AND (ae.payload_json->>'target_id') = td.target_id
  AND (
      COALESCE((ae.payload_json->>'decision_recorded_at')::timestamptz, ae.occurred_at) = td.recorded_at
      OR ae.occurred_at = td.recorded_at
  );

-- Fail clearly if any legacy history row cannot be deterministically mapped
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM teacher_decisions WHERE event_id IS NULL) THEN
        RAISE EXCEPTION 'MIGRATION_FAILED: Unmapped legacy teacher decisions found with missing event_id.';
    END IF;
END $$;

-- Set event_id NOT NULL and apply foreign key + primary key constraint
ALTER TABLE teacher_decisions ALTER COLUMN event_id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'teacher_decisions_event_id_fkey'
    ) THEN
        ALTER TABLE teacher_decisions
            ADD CONSTRAINT teacher_decisions_event_id_fkey
            FOREIGN KEY (event_id)
            REFERENCES analytical_events(event_id)
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'teacher_decisions_pkey'
    ) THEN
        ALTER TABLE teacher_decisions ADD CONSTRAINT teacher_decisions_pkey PRIMARY KEY (event_id);
    END IF;
END $$;

-- 3. Data-Quality Invariant Constraints
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_analysis_runs_duration'
    ) THEN
        ALTER TABLE analysis_runs
            ADD CONSTRAINT chk_analysis_runs_duration
            CHECK (total_duration_ms IS NULL OR total_duration_ms >= 0);
    END IF;
END $$;

-- 4. Justified Access Path Indexes
CREATE INDEX IF NOT EXISTS idx_analytical_events_run_type
    ON analytical_events (analysis_run_id, event_type);

CREATE INDEX IF NOT EXISTS idx_teacher_decisions_run_target
    ON teacher_decisions (analysis_run_id, target_type, target_id, recorded_at);

CREATE INDEX IF NOT EXISTS idx_current_teacher_decisions_target
    ON current_teacher_decisions (analysis_run_id, target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_audit_event_processed
    ON ingestion_audit_log (event_id, processed_at);
