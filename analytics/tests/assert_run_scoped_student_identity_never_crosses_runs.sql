-- Test: run-scoped learner identity integrity
--
-- Grain under test:
-- fct_student_findings may contain multiple findings for the same learner
-- within the same analysis run.
--
-- Invariants:
-- 1. Identity components must be present and non-blank.
-- 2. One run_scoped_student_key must never represent more than one
--    analysis_run_id and student_id identity pair.
-- 3. One analysis_run_id and student_id identity pair must never resolve
--    to more than one run_scoped_student_key.
--
-- The physical construction of run_scoped_student_key is intentionally not
-- asserted here. The analytical contract protects identity semantics rather
-- than a specific string-concatenation implementation.
--
-- Zero returned rows means the run-scoped identity contract holds.

WITH source_rows AS (
    SELECT
        analysis_run_id,
        student_id,
        run_scoped_student_key
    FROM {{ ref('fct_student_findings') }}
),

invalid_identity_components AS (
    SELECT
        'invalid_identity_component' AS violation_type,
        analysis_run_id,
        student_id,
        run_scoped_student_key,
        1::BIGINT AS conflicting_identity_count
    FROM source_rows
    WHERE
        analysis_run_id IS NULL
        OR TRIM(analysis_run_id) = ''
        OR student_id IS NULL
        OR TRIM(student_id) = ''
        OR run_scoped_student_key IS NULL
        OR TRIM(run_scoped_student_key) = ''
),

key_to_multiple_identities AS (
    SELECT
        'run_scoped_key_maps_to_multiple_identities' AS violation_type,
        NULL::TEXT AS analysis_run_id,
        NULL::TEXT AS student_id,
        run_scoped_student_key,
        COUNT(
            DISTINCT (analysis_run_id, student_id)
        )::BIGINT AS conflicting_identity_count
    FROM source_rows
    WHERE
        analysis_run_id IS NOT NULL
        AND TRIM(analysis_run_id) <> ''
        AND student_id IS NOT NULL
        AND TRIM(student_id) <> ''
        AND run_scoped_student_key IS NOT NULL
        AND TRIM(run_scoped_student_key) <> ''
    GROUP BY run_scoped_student_key
    HAVING COUNT(
        DISTINCT (analysis_run_id, student_id)
    ) > 1
),

identity_to_multiple_keys AS (
    SELECT
        'identity_maps_to_multiple_run_scoped_keys' AS violation_type,
        analysis_run_id,
        student_id,
        NULL::TEXT AS run_scoped_student_key,
        COUNT(
            DISTINCT run_scoped_student_key
        )::BIGINT AS conflicting_identity_count
    FROM source_rows
    WHERE
        analysis_run_id IS NOT NULL
        AND TRIM(analysis_run_id) <> ''
        AND student_id IS NOT NULL
        AND TRIM(student_id) <> ''
        AND run_scoped_student_key IS NOT NULL
        AND TRIM(run_scoped_student_key) <> ''
    GROUP BY
        analysis_run_id,
        student_id
    HAVING COUNT(
        DISTINCT run_scoped_student_key
    ) > 1
)

SELECT
    violation_type,
    analysis_run_id,
    student_id,
    run_scoped_student_key,
    conflicting_identity_count
FROM invalid_identity_components

UNION ALL

SELECT
    violation_type,
    analysis_run_id,
    student_id,
    run_scoped_student_key,
    conflicting_identity_count
FROM key_to_multiple_identities

UNION ALL

SELECT
    violation_type,
    analysis_run_id,
    student_id,
    run_scoped_student_key,
    conflicting_identity_count
FROM identity_to_multiple_keys

ORDER BY
    violation_type,
    analysis_run_id,
    student_id,
    run_scoped_student_key;