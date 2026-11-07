{{ config(materialized='view') }}

-- Grain: one student finding within a misconception cluster within an analysis run
SELECT
    CAST(analysis_run_id AS TEXT) AS analysis_run_id,
    CAST(cluster_id AS TEXT) AS cluster_id,
    CAST(student_id AS TEXT) AS student_id,
    -- Deterministic run-scoped learner key to strictly prevent cross-run identity leaks
    CAST(analysis_run_id || '_' || student_id AS TEXT) AS run_scoped_student_key
FROM {{ source('lotuslearn_operational', 'student_findings') }}
