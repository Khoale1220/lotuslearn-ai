-- Test: prevalence rate bounded interval
--
-- Prevalence must remain within the inclusive range from 0.0 to 1.0
-- whenever a value is defined.
--
-- NULL is valid when the submission denominator is zero.
--
-- Zero returned rows means the prevalence contract holds.

SELECT
    analysis_run_id,
    cluster_id,
    affected_student_count,
    submission_count,
    prevalence_rate
FROM {{ ref('mart_concept_prevalence') }}
WHERE
    prevalence_rate IS NOT NULL
    AND (
        prevalence_rate < 0.0
        OR prevalence_rate > 1.0
    )