-- Test: Prevalence rate bounded interval [0.0, 1.0]
-- Returns any rows where prevalence rate is outside the valid range 0.0 to 1.0.

SELECT
    analysis_run_id,
    cluster_id,
    affected_student_count,
    submission_count,
    prevalence_rate
FROM {{ ref('mart_concept_prevalence') }}
WHERE
    prevalence_rate < 0.0
    OR prevalence_rate > 1.0
