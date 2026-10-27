-- Analytical Rollup Views & Derived Transformations

DROP VIEW IF EXISTS v_cohort_prevalence;
CREATE VIEW v_cohort_prevalence AS
SELECT
    c.analysis_run_id,
    c.cluster_id,
    c.concept,
    c.teaching_priority,
    c.affected_student_count AS affected_students,
    r.submission_count AS total_students,
    ROUND(CAST(c.affected_student_count AS REAL) / CAST(r.submission_count AS REAL), 4) AS prevalence_rate
FROM misconception_clusters c
JOIN analysis_runs r ON c.analysis_run_id = r.run_id;

-- Run-scoped students composite view (analysis_run_id, student_id)
DROP VIEW IF EXISTS v_run_scoped_students;
CREATE VIEW v_run_scoped_students AS
SELECT DISTINCT analysis_run_id, student_id FROM student_findings
UNION
SELECT DISTINCT analysis_run_id, student_id FROM group_memberships;

-- Distinct student identifiers view
DROP VIEW IF EXISTS v_distinct_students;
CREATE VIEW v_distinct_students AS
SELECT DISTINCT student_id FROM student_findings
UNION
SELECT DISTINCT student_id FROM group_memberships;

-- Current teacher decision metrics (derives from current_teacher_decisions projection)
DROP VIEW IF EXISTS v_educator_decisions;
CREATE VIEW v_educator_decisions AS
SELECT
    analysis_run_id,
    COUNT(CASE WHEN teacher_decision = 'accepted' THEN 1 END) AS count_accepted,
    COUNT(CASE WHEN teacher_decision = 'edited' THEN 1 END) AS count_edited,
    COUNT(CASE WHEN teacher_decision = 'dismissed' THEN 1 END) AS count_dismissed,
    COUNT(CASE WHEN teacher_decision IN ('accepted', 'edited', 'dismissed') THEN 1 END) AS total_reviewed
FROM current_teacher_decisions
GROUP BY analysis_run_id;

DROP VIEW IF EXISTS v_educator_modification_rate;
CREATE VIEW v_educator_modification_rate AS
SELECT
    analysis_run_id,
    count_accepted,
    count_edited,
    count_dismissed,
    total_reviewed,
    CASE
        WHEN total_reviewed > 0 THEN
            ROUND(CAST(count_edited + count_dismissed AS REAL) / CAST(total_reviewed AS REAL), 4)
        ELSE NULL
    END AS modification_rate
FROM v_educator_decisions;
