{{ config(materialized='view') }}

-- Grain: one row per distinct student appearance within an analysis run
-- Enforces run-scoped learner identity: composite of analysis_run_id and student_id
WITH combined_appearances AS (
    SELECT DISTINCT
        analysis_run_id,
        student_id,
        run_scoped_student_key
    FROM {{ ref('stg_student_findings') }}

    UNION

    SELECT DISTINCT
        analysis_run_id,
        student_id,
        run_scoped_student_key
    FROM {{ ref('stg_group_memberships') }}
)

SELECT
    run_scoped_student_key,
    analysis_run_id,
    student_id
FROM combined_appearances
