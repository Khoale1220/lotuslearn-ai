-- Authoritative SQL Metric Definitions for LotusLearn

-- Query 1: Total accepted events count
SELECT COUNT(*) AS total_accepted_events
FROM analytical_events;

-- Query 2: Run-scoped student appearances count across cohorts
SELECT COUNT(*) AS student_appearances
FROM v_run_scoped_students;

-- Query 3: Total diagnostic analysis runs
SELECT COUNT(*) AS total_analysis_runs
FROM analysis_runs;

-- Query 4: Concept findings rollup
SELECT
    concept,
    teaching_priority,
    cluster_count,
    total_affected_instances
FROM v_concept_findings;

-- Query 5: Misconception clusters with prevalence rates
SELECT
    analysis_run_id,
    cluster_id,
    concept,
    teaching_priority,
    affected_students,
    total_students,
    prevalence_rate
FROM v_cohort_prevalence
ORDER BY prevalence_rate DESC, teaching_priority ASC;

-- Query 6: Global Educator Modification Rate (R_mod)
SELECT
    COALESCE(SUM(count_accepted), 0) AS total_accepted,
    COALESCE(SUM(count_edited), 0) AS total_edited,
    COALESCE(SUM(count_dismissed), 0) AS total_dismissed,
    COALESCE(SUM(total_reviewed), 0) AS total_reviewed,
    CASE
        WHEN SUM(total_reviewed) > 0 THEN
            ROUND(
                CAST(SUM(count_edited) + SUM(count_dismissed) AS REAL) /
                CAST(SUM(total_reviewed) AS REAL),
                4
            )
        ELSE NULL
    END AS educator_modification_rate
FROM v_educator_modification_rate;
