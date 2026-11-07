{{ config(materialized='view') }}

-- Grain: one student membership within an instructional group within an analysis run
SELECT
    CAST(analysis_run_id AS TEXT) AS analysis_run_id,
    CAST(group_id AS TEXT) AS group_id,
    CAST(student_id AS TEXT) AS student_id,
    -- Deterministic run-scoped learner key to strictly prevent cross-run identity leaks
    CAST(analysis_run_id || '_' || student_id AS TEXT) AS run_scoped_student_key
FROM {{ source('lotuslearn_operational', 'group_memberships') }}
