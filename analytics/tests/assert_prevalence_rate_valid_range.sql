-- Test: concept prevalence integrity
--
-- Grain under test:
-- mart_concept_prevalence contains one row per misconception cluster
-- within an analysis run.
--
-- Invariants:
-- 1. affected_student_count must not be negative.
-- 2. submission_count must not be negative.
-- 3. affected_student_count must not exceed submission_count.
-- 4. prevalence_rate must be NULL when submission_count is zero.
-- 5. prevalence_rate must be present when submission_count is positive.
-- 6. Non-null prevalence_rate must remain within the inclusive range [0, 1].
--
-- Zero returned rows means the prevalence contract holds.

SELECT
    analysis_run_id,
    cluster_id,
    affected_student_count,
    submission_count,
    prevalence_rate,
    CASE
        WHEN affected_student_count < 0
            THEN 'negative_affected_student_count'

        WHEN submission_count < 0
            THEN 'negative_submission_count'

        WHEN affected_student_count > submission_count
            THEN 'affected_student_count_exceeds_submission_count'

        WHEN submission_count = 0
             AND prevalence_rate IS NOT NULL
            THEN 'zero_denominator_requires_null_prevalence'

        WHEN submission_count > 0
             AND prevalence_rate IS NULL
            THEN 'positive_denominator_requires_prevalence'

        WHEN prevalence_rate < 0.0
            THEN 'prevalence_below_zero'

        WHEN prevalence_rate > 1.0
            THEN 'prevalence_above_one'

        ELSE NULL
    END AS violation_type
FROM {{ ref('mart_concept_prevalence') }}
WHERE
    affected_student_count < 0
    OR submission_count < 0
    OR affected_student_count > submission_count
    OR (
        submission_count = 0
        AND prevalence_rate IS NOT NULL
    )
    OR (
        submission_count > 0
        AND prevalence_rate IS NULL
    )
    OR prevalence_rate < 0.0
    OR prevalence_rate > 1.0
ORDER BY
    analysis_run_id,
    cluster_id;