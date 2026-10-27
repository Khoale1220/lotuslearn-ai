"""Authoritative SQL metrics computation for LotusLearn analytical pipeline."""

from typing import TYPE_CHECKING

from lotuslearn_pipeline.models import LearningAnalyticsMetrics

if TYPE_CHECKING:
    from lotuslearn_pipeline.storage import AnalyticalDatabase


def compute_pipeline_metrics(database: "AnalyticalDatabase") -> LearningAnalyticsMetrics:
    """Executes authoritative relational queries and returns LearningAnalyticsMetrics."""
    conn = database.get_connection()

    # Query 1: Total accepted events
    cur = conn.execute("SELECT COUNT(*) FROM analytical_events")
    total_accepted = cur.fetchone()[0]

    # Query 2: Run-scoped student appearances (composite key analysis_run_id, student_id)
    cur = conn.execute("SELECT COUNT(*) FROM v_run_scoped_students")
    run_scoped_appearances = cur.fetchone()[0]

    # Query 3: Distinct student identifiers (pseudonymous labels across cohorts)
    cur = conn.execute("SELECT COUNT(*) FROM v_distinct_students")
    distinct_students = cur.fetchone()[0]

    # Query 4: Total diagnostic runs
    cur = conn.execute("SELECT COUNT(*) FROM analysis_runs")
    total_runs = cur.fetchone()[0]

    # Query 5: Findings by concept & priority
    cur = conn.execute(
        """
        SELECT concept, teaching_priority, COUNT(*) AS cluster_count,
               SUM(affected_student_count) AS total_affected_instances
        FROM misconception_clusters
        GROUP BY concept, teaching_priority
        ORDER BY total_affected_instances DESC
        """
    )
    findings = [dict(row) for row in cur.fetchall()]

    # Query 6: Prevalence by cluster
    cur = conn.execute(
        """
        SELECT analysis_run_id, cluster_id, concept, teaching_priority,
               affected_students, total_students, prevalence_rate
        FROM v_cohort_prevalence
        ORDER BY prevalence_rate DESC, teaching_priority ASC
        """
    )
    prevalence = [dict(row) for row in cur.fetchall()]

    # Query 7: Global Educator Modification Rate (R_mod)
    cur = conn.execute(
        """
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
        FROM v_educator_modification_rate
        """
    )
    mod_row = cur.fetchone()
    mod_rate = mod_row["educator_modification_rate"] if mod_row else None

    return LearningAnalyticsMetrics(
        total_accepted_events=total_accepted,
        run_scoped_student_appearances_count=run_scoped_appearances,
        distinct_students_count=distinct_students,
        total_analysis_runs=total_runs,
        findings_by_concept=findings,
        prevalence_by_cluster=prevalence,
        educator_modification_rate=mod_rate,
    )
