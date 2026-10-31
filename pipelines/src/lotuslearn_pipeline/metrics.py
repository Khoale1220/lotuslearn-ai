"""Authoritative SQL metrics computation for LotusLearn analytical pipeline.

Relational SQL queries defined in sql/metrics.sql are the single metric authority.
Python only loads, executes, and maps the results.
"""

from typing import TYPE_CHECKING

from lotuslearn_pipeline.models import LearningAnalyticsMetrics
from lotuslearn_pipeline.storage import load_sql_resource

if TYPE_CHECKING:
    from lotuslearn_pipeline.storage import AnalyticalDatabase


def compute_pipeline_metrics(database: "AnalyticalDatabase") -> LearningAnalyticsMetrics:
    """Loads authoritative metrics.sql, executes each definition,
    and returns LearningAnalyticsMetrics."""
    conn = database.get_connection()
    sql_text = load_sql_resource("metrics.sql")

    # Split SQL into individual statements, ignoring whitespace and trailing semicolons
    statements = [stmt.strip() for stmt in sql_text.split(";") if stmt.strip()]

    # Query 1: Total accepted events count
    cur1 = conn.execute(statements[0])
    row1 = cur1.fetchone()
    total_accepted = row1["total_accepted_events"] if row1 else 0

    # Query 2: Run-scoped student appearances count across cohorts
    cur2 = conn.execute(statements[1])
    row2 = cur2.fetchone()
    student_appearances = row2["student_appearances"] if row2 else 0

    # Query 3: Total diagnostic analysis runs
    cur3 = conn.execute(statements[2])
    row3 = cur3.fetchone()
    total_runs = row3["total_analysis_runs"] if row3 else 0

    # Query 4: Concept findings rollup
    cur4 = conn.execute(statements[3])
    findings = [dict(row) for row in cur4.fetchall()]

    # Query 5: Misconception clusters with prevalence rates
    cur5 = conn.execute(statements[4])
    prevalence = [dict(row) for row in cur5.fetchall()]

    # Query 6: Global Educator Modification Rate (R_mod)
    cur6 = conn.execute(statements[5])
    mod_row = cur6.fetchone()
    mod_rate = mod_row["educator_modification_rate"] if mod_row else None

    return LearningAnalyticsMetrics(
        total_accepted_events=total_accepted,
        student_appearances=student_appearances,
        total_analysis_runs=total_runs,
        findings_by_concept=findings,
        prevalence_by_cluster=prevalence,
        educator_modification_rate=mod_rate,
    )
