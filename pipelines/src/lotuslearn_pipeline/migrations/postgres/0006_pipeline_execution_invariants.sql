-- OPS-01A.4: Database-enforced execution lifecycle integrity.
-- Additive migration. Do not modify previously applied migrations.

-- Successful runs cannot contain failed events.
ALTER TABLE pipeline_executions
ADD CONSTRAINT pipeline_execution_success_failed_zero
CHECK (
    status <> 'SUCCEEDED'
    OR failed_count = 0
);

-- An execution heartbeat cannot predate its start.
ALTER TABLE pipeline_executions
ADD CONSTRAINT pipeline_execution_heartbeat_after_start
CHECK (
    heartbeat_at >= started_at
);

-- Cross-row-version invariants require a trigger.
-- SQLSTATE 23514 provides a consistent CheckViolation contract.
CREATE FUNCTION enforce_pipeline_execution_update_invariants()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
    -- Completed executions are immutable.
    IF OLD.status IN ('SUCCEEDED', 'FAILED') THEN
        IF NEW IS DISTINCT FROM OLD THEN
            RAISE EXCEPTION USING
                ERRCODE = '23514',
                MESSAGE = 'TERMINAL_EXECUTION_IMMUTABLE',
                CONSTRAINT = 'pipeline_execution_terminal_immutable';
        END IF;

        RETURN NEW;
    END IF;

    -- Operational identity and start time are immutable.
    IF NEW.execution_id IS DISTINCT FROM OLD.execution_id
       OR NEW.batch_id IS DISTINCT FROM OLD.batch_id
       OR NEW.attempt_number IS DISTINCT FROM OLD.attempt_number
       OR NEW.started_at IS DISTINCT FROM OLD.started_at
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'EXECUTION_IDENTITY_IMMUTABLE',
            CONSTRAINT = 'pipeline_execution_identity_immutable';
    END IF;

    -- Compare against the PREVIOUS row, not only started_at.
    IF NEW.heartbeat_at < OLD.heartbeat_at THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'HEARTBEAT_TIMESTAMP_REGRESSION',
            CONSTRAINT = 'pipeline_execution_heartbeat_monotonic';
    END IF;

    RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_pipeline_execution_update_invariants
BEFORE UPDATE ON pipeline_executions
FOR EACH ROW
EXECUTE FUNCTION enforce_pipeline_execution_update_invariants();
