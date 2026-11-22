-- DE04 C10: bounded terminal execution SLO window access path.
--
-- C10 evaluates terminal pipeline executions over rolling finished_at
-- windows. This additive partial B-tree index keeps that read model
-- bounded to terminal rows while preserving execution_id as a stable
-- secondary key.
--
-- Existing migrations are immutable. This migration is additive only.

CREATE INDEX idx_pipeline_executions_terminal_finished_at
    ON pipeline_executions (
        finished_at DESC,
        execution_id
    )
    WHERE status IN ('SUCCEEDED', 'FAILED')
      AND finished_at IS NOT NULL;
