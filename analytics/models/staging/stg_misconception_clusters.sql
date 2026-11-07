{{ config(materialized='view') }}

-- Grain: one row per misconception cluster within an analysis run
SELECT
    CAST(analysis_run_id AS TEXT) AS analysis_run_id,
    CAST(cluster_id AS TEXT) AS cluster_id,
    CAST(concept AS TEXT) AS concept,
    CAST(teaching_priority AS TEXT) AS teaching_priority,
    CAST(affected_student_count AS INTEGER) AS affected_student_count,
    CAST(percentage_affected AS DOUBLE PRECISION) AS percentage_affected,
    CAST(explanation AS TEXT) AS explanation
FROM {{ source('lotuslearn_operational', 'misconception_clusters') }}
