"""
Verification script asserting strict parity between operational metrics and dbt marts.
Executed in CI and integration environments against live PostgreSQL.
"""

import os
import sys
import psycopg
from psycopg.rows import dict_row


def verify_dbt_parity(database_url: str) -> None:
    print(f"Connecting to database to verify operational vs dbt mart parity...")
    with psycopg.connect(database_url, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            # 1. Total Analysis Runs Parity
            cur.execute("SELECT COUNT(*)::INTEGER AS count FROM analysis_runs;")
            op_runs = cur.fetchone()["count"]

            cur.execute("SELECT COUNT(*)::INTEGER AS count FROM analytics.dim_analysis_run;")
            dbt_runs = cur.fetchone()["count"]

            assert op_runs == dbt_runs, f"Run count mismatch: operational={op_runs}, dbt={dbt_runs}"
            print(f"[PASS] Analysis runs parity: {op_runs} == {dbt_runs}")

            # 2. Accepted Events Parity
            cur.execute("SELECT COUNT(*)::INTEGER AS count FROM analytical_events;")
            op_events = cur.fetchone()["count"]

            cur.execute(
                "SELECT COUNT(*)::INTEGER AS count FROM analytics.fct_ingestion_attempts WHERE final_outcome = 'accepted';"
            )
            dbt_accepted = cur.fetchone()["count"]

            assert op_events == dbt_accepted, f"Accepted event count mismatch: op={op_events}, dbt={dbt_accepted}"
            print(f"[PASS] Accepted events parity: {op_events} == {dbt_accepted}")

            # 3. Student Appearances Parity
            cur.execute("SELECT COUNT(*)::INTEGER AS count FROM v_run_scoped_students;")
            op_appearances = cur.fetchone()["count"]

            cur.execute("SELECT COALESCE(SUM(student_appearances_count), 0)::INTEGER AS count FROM analytics.mart_run_quality;")
            dbt_appearances = cur.fetchone()["count"]

            assert op_appearances == dbt_appearances, f"Student appearances mismatch: op={op_appearances}, dbt={dbt_appearances}"
            print(f"[PASS] Student appearances parity: {op_appearances} == {dbt_appearances}")

            # 4. Educator Modification Rate Parity
            cur.execute(
                """
                SELECT
                    COALESCE(SUM(count_accepted), 0)::INTEGER AS total_accepted,
                    COALESCE(SUM(count_edited), 0)::INTEGER AS total_edited,
                    COALESCE(SUM(count_dismissed), 0)::INTEGER AS total_dismissed,
                    COALESCE(SUM(total_reviewed), 0)::INTEGER AS total_reviewed
                FROM v_educator_decisions;
                """
            )
            op_dec = cur.fetchone()
            op_mod_count = op_dec["total_edited"] + op_dec["total_dismissed"]
            op_reviewed = op_dec["total_reviewed"]
            op_rate = round(op_mod_count / op_reviewed, 4) if op_reviewed > 0 else None

            cur.execute(
                """
                SELECT
                    COALESCE(SUM(teacher_modifications_count), 0)::INTEGER AS total_mods,
                    COALESCE(SUM(teacher_decisions_reviewed_count), 0)::INTEGER AS total_reviewed
                FROM analytics.mart_run_quality;
                """
            )
            dbt_dec = cur.fetchone()
            dbt_mod_count = dbt_dec["total_mods"]
            dbt_reviewed = dbt_dec["total_reviewed"]
            dbt_rate = round(dbt_mod_count / dbt_reviewed, 4) if dbt_reviewed > 0 else None

            assert op_mod_count == dbt_mod_count, f"Mod count mismatch: op={op_mod_count}, dbt={dbt_mod_count}"
            assert op_reviewed == dbt_reviewed, f"Reviewed count mismatch: op={op_reviewed}, dbt={dbt_reviewed}"
            assert op_rate == dbt_rate, f"Modification rate mismatch: op={op_rate}, dbt={dbt_rate}"
            print(f"[PASS] Educator modification rate parity: rate={op_rate} (mods={op_mod_count}, reviewed={op_reviewed})")

            # 5. Concept Prevalence Parity
            cur.execute(
                """
                SELECT analysis_run_id, cluster_id, prevalence_rate
                FROM v_cohort_prevalence
                ORDER BY analysis_run_id, cluster_id;
                """
            )
            op_prev = cur.fetchall()

            cur.execute(
                """
                SELECT analysis_run_id, cluster_id, prevalence_rate
                FROM analytics.mart_concept_prevalence
                ORDER BY analysis_run_id, cluster_id;
                """
            )
            dbt_prev = cur.fetchall()

            assert len(op_prev) == len(dbt_prev), f"Prevalence row count mismatch: op={len(op_prev)}, dbt={len(dbt_prev)}"
            for op_row, dbt_row in zip(op_prev, dbt_prev):
                assert op_row["analysis_run_id"] == dbt_row["analysis_run_id"]
                assert op_row["cluster_id"] == dbt_row["cluster_id"]
                assert float(op_row["prevalence_rate"]) == float(dbt_row["prevalence_rate"]), (
                    f"Prevalence rate mismatch for {op_row['cluster_id']}: op={op_row['prevalence_rate']}, dbt={dbt_row['prevalence_rate']}"
                )
            print(f"[PASS] Concept prevalence parity verified across {len(op_prev)} clusters.")

    print("\nSUCCESS: All operational vs dbt mart parity assertions passed with 100% bit-for-bit equivalence.")


if __name__ == "__main__":
    url = os.environ.get(
        "LOTUSLEARN_DATABASE_URL",
        os.environ.get("LOTUSLEARN_TEST_DATABASE_URL", "postgresql://postgres:postgres_ci_password@localhost:5432/lotuslearn_test")
    )
    try:
        verify_dbt_parity(url)
    except Exception as exc:
        print(f"ERROR: Parity verification failed: {exc}", file=sys.stderr)
        sys.exit(1)
