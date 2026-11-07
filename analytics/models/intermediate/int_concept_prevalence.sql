{{ config(materialized='view') }}

-- Grain: one row per misconception cluster within an analysis run
-- Documented prevalence calculation: affected_student_count / submission_count
SELECT
    c.analysis_run_id,
    c.cluster_id,
    c.concept,
    c.teaching_priority,
    c.affected_student_count,
    r.submission_count,
    CASE
        WHEN r.submission_count > 0 THEN
            ROUND(
                CAST(CAST(c.affected_student_count AS NUMERIC) / CAST(r.submission_count AS NUMERIC) AS NUMERIC),
                4
            )
        ELSE NULL
    END AS prevalence_rate
FROM {{ ref('stg_misconception_clusters') }} c
INNER JOIN {{ ref('stg_analysis_runs') }} r
    ON c.analysis_run_id = r.run_id
