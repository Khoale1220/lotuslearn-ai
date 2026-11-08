-- Test: prevalence rate integrity and denominator invariants.
--
-- A valid prevalence rate is only defined when the denominator is positive.
-- Zero denominators must produce NULL, while positive denominators must yield
-- a rate between 0 and 1 that matches the rounded affected_student_count /
-- submission_count calculation used by the model.
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
    submission_count < 0
    OR affected_student_count < 0
    OR (submission_count > 0 AND affected_student_count > submission_count)
    OR (submission_count = 0 AND prevalence_rate IS NOT NULL)
    OR (submission_count > 0 AND prevalence_rate IS NULL)
    OR (
        prevalence_rate IS NOT NULL
        AND (
            prevalence_rate < 0.0
            OR prevalence_rate > 1.0
            OR ABS(prevalence_rate - (affected_student_count::NUMERIC / submission_count::NUMERIC)) > 0.00005
        )
    )