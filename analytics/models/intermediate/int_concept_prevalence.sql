{{ config(materialized='view') }}

-- Grain: one misconception cluster within one analysis run.
--
-- Prevalence uses submission_count as the denominator.
-- A zero denominator produces NULL instead of zero because prevalence is
-- undefined when no submissions exist.

SELECT
    clusters.analysis_run_id,
    clusters.cluster_id,
    clusters.concept,
    clusters.teaching_priority,
    clusters.affected_student_count,
    runs.submission_count,

    CASE
        WHEN runs.submission_count > 0 THEN
            CAST(
                ROUND(
                    clusters.affected_student_count::NUMERIC
                    / runs.submission_count::NUMERIC,
                    4
                )
                AS NUMERIC(12, 4)
            )

        ELSE CAST(NULL AS NUMERIC(12, 4))
    END AS prevalence_rate

FROM {{ ref('stg_misconception_clusters') }} AS clusters

INNER JOIN {{ ref('stg_analysis_runs') }} AS runs
    ON runs.run_id = clusters.analysis_run_id