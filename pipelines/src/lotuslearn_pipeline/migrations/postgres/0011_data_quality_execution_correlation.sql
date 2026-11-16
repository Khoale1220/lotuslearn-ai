-- Correlate immutable data-quality evaluation evidence with the
-- pipeline execution that produced it.
--
-- execution_id is nullable for backward compatibility with evidence
-- persisted before runtime correlation existed. New runtime-integrated
-- writes may provide execution_id and receive database-enforced lineage.
--
-- evaluation_key remains the logical idempotency identity.
-- execution_id is operational lineage and must not replace it.

ALTER TABLE data_quality_evaluation_history
    ADD COLUMN execution_id UUID;

ALTER TABLE data_quality_evaluation_history
    ADD CONSTRAINT data_quality_evaluation_history_execution_fk
    FOREIGN KEY (execution_id)
    REFERENCES pipeline_executions(execution_id)
    ON DELETE RESTRICT;

CREATE INDEX data_quality_evaluation_history_execution_idx
    ON data_quality_evaluation_history (execution_id)
    WHERE execution_id IS NOT NULL;
