#!/usr/bin/env python3
"""CLI utility to execute deterministic metric reconciliation between LotusLearn ingestion
pipeline metrics and dbt marts.

Usage:
    python scripts/reconcile_dbt_metrics.py [--db DATABASE_URL]
"""

import argparse
import os
import sys
import psycopg
from psycopg.rows import dict_row

from lotuslearn_pipeline.dbt_reconciliation import reconcile_metrics


def run_reconciliation(database_url: str) -> bool:
    print(f"Connecting to database for dbt reconciliation: {database_url.split('@')[-1]}")
    try:
        with psycopg.connect(database_url, row_factory=dict_row) as conn:
            with conn.cursor() as cur:
                # 1. Authoritative runs
                cur.execute("SELECT COUNT(*) AS c FROM analysis_runs")
                auth_runs = cur.fetchone()["c"]

                # 2. Authoritative student appearances
                cur.execute("SELECT COUNT(*) AS c FROM v_run_scoped_students")
                auth_students = cur.fetchone()["c"]

                # 3. Authoritative cluster count and prevalence
                cur.execute("SELECT COUNT(*) AS c FROM misconception_clusters")
                auth_clusters = cur.fetchone()["c"]

                cur.execute("""
                    SELECT analysis_run_id, cluster_id, prevalence_rate
                    FROM v_cohort_prevalence
                """)
                auth_prev = {}
                for row in cur.fetchall():
                    key = (row["analysis_run_id"], row["cluster_id"])
                    auth_prev[str(key)] = float(row["prevalence_rate"]) if row["prevalence_rate"] is not None else None

                # 4. Authoritative educator modification rate
                cur.execute("SELECT educator_modification_rate FROM v_educator_modification_rate")
                mod_row = cur.fetchone()
                auth_mod = float(mod_row["educator_modification_rate"]) if mod_row and mod_row["educator_modification_rate"] is not None else None

                # 5. Authoritative historical decisions count
                cur.execute("SELECT COUNT(*) AS c FROM teacher_decisions")
                auth_decisions = cur.fetchone()["c"]

                # Check if marts exist
                cur.execute("""
                    SELECT table_schema, table_name
                    FROM information_schema.tables
                    WHERE table_name IN ('fct_analysis_runs', 'fct_misconception_clusters', 'fct_teacher_decisions')
                """)
                found_tables = {row["table_name"]: row["table_schema"] for row in cur.fetchall()}
                if "fct_analysis_runs" not in found_tables:
                    print("ERROR: dbt mart tables not found in database. Run 'dbt build' first.")
                    return False

                marts_schema = found_tables["fct_analysis_runs"]

                # Mart runs & students
                cur.execute(f"SELECT COUNT(*) AS c, SUM(distinct_students_count) AS s FROM {marts_schema}.fct_analysis_runs")
                r = cur.fetchone()
                mart_runs = r["c"]
                mart_students = r["s"] or 0

                # Mart clusters & prevalence
                cur.execute(f"SELECT COUNT(*) AS c FROM {marts_schema}.fct_misconception_clusters")
                mart_clusters = cur.fetchone()["c"]

                cur.execute(f"""
                    SELECT analysis_run_id, cluster_id, prevalence_rate
                    FROM {marts_schema}.fct_misconception_clusters
                """)
                mart_prev = {}
                for row in cur.fetchall():
                    key = (row["analysis_run_id"], row["cluster_id"])
                    mart_prev[str(key)] = float(row["prevalence_rate"]) if row["prevalence_rate"] is not None else None

                # Mart modification rate
                cur.execute(f"""
                    SELECT
                        CASE
                            WHEN SUM(total_decisions_reviewed) > 0 THEN
                                ROUND(
                                    CAST(CAST(SUM(count_decisions_edited) + SUM(count_decisions_dismissed) AS REAL) /
                                         CAST(SUM(total_decisions_reviewed) AS REAL) AS NUMERIC),
                                    4
                                )
                            ELSE NULL
                        END AS educator_modification_rate
                    FROM {marts_schema}.fct_analysis_runs
                """)
                m_row = cur.fetchone()
                mart_mod = float(m_row["educator_modification_rate"]) if m_row and m_row["educator_modification_rate"] is not None else None

                # Mart decisions count
                cur.execute(f"SELECT COUNT(*) AS c FROM {marts_schema}.fct_teacher_decisions")
                mart_decisions = cur.fetchone()["c"]

                authoritative = {
                    "total_analysis_runs": auth_runs,
                    "student_appearances": auth_students,
                    "total_clusters": auth_clusters,
                    "educator_modification_rate": auth_mod,
                    "historical_decisions_count": auth_decisions,
                    "cluster_prevalence": auth_prev,
                }

                mart_metrics = {
                    "total_analysis_runs": mart_runs,
                    "student_appearances": mart_students,
                    "total_clusters": mart_clusters,
                    "educator_modification_rate": mart_mod,
                    "historical_decisions_count": mart_decisions,
                    "cluster_prevalence": mart_prev,
                }

                report = reconcile_metrics(authoritative, mart_metrics)
                print(report.summary())
                if not report.is_reconciled:
                    for d in report.discrepancies:
                        print(f"  - {d.metric_name}: Authoritative={d.authoritative_value} vs Mart={d.dbt_mart_value} ({d.details})")
                    return False
                return True
    except Exception as e:
        print(f"ERROR: Database reconciliation failed: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Reconcile authoritative pipeline metrics with dbt marts")
    parser.add_argument(
        "--db",
        default=os.environ.get("LOTUSLEARN_DATABASE_URL") or os.environ.get("LOTUSLEARN_TEST_DATABASE_URL"),
        help="PostgreSQL connection string",
    )
    args = parser.parse_args()

    if not args.db:
        print("ERROR: No database URL provided. Set LOTUSLEARN_DATABASE_URL or pass --db.")
        sys.exit(1)

    success = run_reconciliation(args.db)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
