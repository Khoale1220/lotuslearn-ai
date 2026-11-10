-- OPS-01A.9: Enforce temporal ordering at the database boundary.
-- Additive migration. Do not modify migrations 0001-0006.
--
-- Required invariant:
-- started_at <= heartbeat_at <= finished_at
-- The final comparison applies only after completion.
--
-- Migration 0006 already enforces heartbeat_at >= started_at.
-- This migration enforces finished_at >= heartbeat_at.

ALTER TABLE pipeline_executions
ADD CONSTRAINT pipeline_execution_finish_after_heartbeat
CHECK (
    finished_at IS NULL
    OR finished_at >= heartbeat_at
)
NOT VALID;

-- Validate existing data before marking this migration successful.
-- Invalid historical rows must cause the migration to fail.

ALTER TABLE pipeline_executions
VALIDATE CONSTRAINT pipeline_execution_finish_after_heartbeat;
