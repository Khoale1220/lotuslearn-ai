-- DE04 C9: explicit execution-scoped dataset lineage.
--
-- Each row represents one exact input dataset -> output dataset edge
-- observed for a pipeline execution.
--
-- Dataset identity follows the namespace + name model used by common
-- lineage systems. We intentionally persist explicit edges instead of
-- inferring a Cartesian product between all inputs and outputs.
--
-- Evidence is append-only and execution-scoped.

CREATE TABLE pipeline_execution_dataset_lineage (
    execution_id UUID NOT NULL,

    input_namespace TEXT NOT NULL
        CHECK (
            length(btrim(input_namespace)) > 0
            AND length(input_namespace) <= 2048
        ),

    input_name TEXT NOT NULL
        CHECK (
            length(btrim(input_name)) > 0
            AND length(input_name) <= 2048
        ),

    output_namespace TEXT NOT NULL
        CHECK (
            length(btrim(output_namespace)) > 0
            AND length(output_namespace) <= 2048
        ),

    output_name TEXT NOT NULL
        CHECK (
            length(btrim(output_name)) > 0
            AND length(output_name) <= 2048
        ),

    recorded_at TIMESTAMPTZ NOT NULL
        DEFAULT statement_timestamp(),

    CONSTRAINT pipeline_execution_dataset_lineage_execution_fk
        FOREIGN KEY (execution_id)
        REFERENCES pipeline_executions(execution_id)
        ON DELETE RESTRICT,

    CONSTRAINT pipeline_execution_dataset_lineage_pk
        PRIMARY KEY (
            execution_id,
            input_namespace,
            input_name,
            output_namespace,
            output_name
        )
);

CREATE INDEX pipeline_execution_dataset_lineage_input_idx
    ON pipeline_execution_dataset_lineage (
        input_namespace,
        input_name,
        execution_id
    );

CREATE INDEX pipeline_execution_dataset_lineage_output_idx
    ON pipeline_execution_dataset_lineage (
        output_namespace,
        output_name,
        execution_id
    );

CREATE OR REPLACE FUNCTION
reject_pipeline_execution_dataset_lineage_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        USING
            ERRCODE = '55000',
            MESSAGE = 'pipeline execution dataset lineage is immutable';
END;
$$;

CREATE TRIGGER trg_pipeline_execution_dataset_lineage_immutable
BEFORE UPDATE OR DELETE
ON pipeline_execution_dataset_lineage
FOR EACH ROW
EXECUTE FUNCTION
reject_pipeline_execution_dataset_lineage_mutation();