-- Test: Run-scoped learner identity integrity
-- Asserts that run_scoped_student_key strictly follows analysis_run_id || '_' || student_id
-- and prevents un-scoped student_id collisions. Returns failing rows.

SELECT
    analysis_run_id,
    student_id,
    run_scoped_student_key
FROM {{ ref('fct_student_findings') }}
WHERE
    run_scoped_student_key != (analysis_run_id || '_' || student_id)
    OR analysis_run_id IS NULL
    OR student_id IS NULL
    OR TRIM(student_id) = ''
