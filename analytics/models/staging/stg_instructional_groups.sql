{{ config(materialized='view') }}

-- Grain: one row per instructional group within an analysis run
SELECT
    CAST(analysis_run_id AS TEXT) AS analysis_run_id,
    CAST(group_id AS TEXT) AS group_id,
    CAST(group_name AS TEXT) AS group_name,
    CAST(student_count AS INTEGER) AS student_count,
    CAST(suggested_activity AS TEXT) AS suggested_activity,
    CAST(estimated_duration AS TEXT) AS estimated_duration
FROM {{ source('lotuslearn_operational', 'instructional_groups') }}
