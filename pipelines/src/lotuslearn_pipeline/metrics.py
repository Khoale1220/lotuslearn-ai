"""Authoritative SQL metrics computation for LotusLearn analytical pipeline."""

from typing import TYPE_CHECKING

from lotuslearn_pipeline.models import LearningAnalyticsMetrics

if TYPE_CHECKING:
    from lotuslearn_pipeline.storage import AnalyticalDatabase


def compute_pipeline_metrics(database: "AnalyticalDatabase") -> LearningAnalyticsMetrics:
    """Executes authoritative relational views and returns LearningAnalyticsMetrics."""
    conn = database.get_connection()

    # Query 1: Total accepted events
    cur = conn.execute("SELECT COUNT(*) FROM analytical_events")
    total_accepted = cur.fetchone()[0]

    # Query 2: Run-scoped student appearances (composite key analysis_run_id, student_id)
    cur = conn.execute("SELECT COUNT(*) FROM v_run_scoped_students")
    student_appearances = cur.fetchone()[0]

    # Query 3: Total diagnostic runs
    cur = conn.execute("SELECT COUNT(*) FROM analysis_runs")
    total_runs = cur.fetchone()[0]

    # Query 4: Concept findings rollup
    cur = conn.execute("SELECT * FROM v_concept_findings")
    findings = [dict(row) for row in cur.fetchall()]

    # Query 5: Prevalence by cluster
    cur = conn.execute(
        """
        SELECT analysis_run_id, cluster_id, concept, teaching_priority,
               affected_students, total_students, prevalence_rate
        FROM v_cohort_prevalence
        ORDER BY prevalence_rate DESC, teaching_priority ASC
        """
    )
    prevalence = [dict(row) for row in cur.fetchall()]

    # Query 6: Global Educator Modification Rate (R_mod)
    cur = conn.execute(
        """
        SELECT
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
        student_appearances=student_appearances,
        total_analysis_runs=total_runs,
        findings_by_concept=findings,
        prevalence_by_cluster=prevalence,
        educator_modification_rate=mod_rate,
    )
