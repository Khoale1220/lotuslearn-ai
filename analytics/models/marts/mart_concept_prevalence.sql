{{ config(
    materialized='table',
    contract={'enforced': true}
) }}

-- Grain: one row per misconception cluster within an analysis run
SELECT
    CAST(analysis_run_id AS TEXT) AS analysis_run_id,
    CAST(cluster_id AS TEXT) AS cluster_id,
    CAST(concept AS TEXT) AS concept,
    CAST(teaching_priority AS TEXT) AS teaching_priority,
    CAST(affected_student_count AS INTEGER) AS affected_student_count,
    CAST(submission_count AS INTEGER) AS submission_count,
    CAST(prevalence_rate AS NUMERIC) AS prevalence_rate
FROM {{ ref('int_concept_prevalence') }}
