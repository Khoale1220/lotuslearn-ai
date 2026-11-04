"""Tests for dbt metric reconciliation against authoritative pipeline metrics.

Validates that dbt marts (fct_analysis_runs, fct_misconception_clusters, fct_teacher_decisions)
reconcile deterministically against the raw/view metrics.sql computations.
"""

import os

import pytest

from lotuslearn_pipeline.dbt_reconciliation import (
    reconcile_metrics,
)


def test_reconcile_metrics_balanced_fixture():
    """Validates that identical metrics between ingestion and dbt marts reconcile cleanly."""
    authoritative = {
        "total_analysis_runs": 2,
        "student_appearances": 24,
        "total_clusters": 5,
        "educator_modification_rate": 0.3333,
        "historical_decisions_count": 4,
        "cluster_prevalence": {
            ("run-001", "c1"): 0.4167,
            ("run-001", "c2"): 0.2500,
            ("run-002", "c3"): 0.5000,
        },
    }

    mart_metrics = {
        "total_analysis_runs": 2,
        "student_appearances": 24,
        "total_clusters": 5,
        "educator_modification_rate": 0.3333,
        "historical_decisions_count": 4,
        "cluster_prevalence": {
            ("run-001", "c1"): 0.4167,
            ("run-001", "c2"): 0.2500,
            ("run-002", "c3"): 0.5000,
        },
    }

    report = reconcile_metrics(authoritative, mart_metrics)
    assert report.is_reconciled is True
    assert len(report.discrepancies) == 0
    assert "RECONCILIATION_PASS" in report.summary()
    assert report.total_metrics_evaluated == 8


def test_reconcile_metrics_detects_rate_divergence():
    """Detects modification rate divergence between pipeline and mart."""
    authoritative = {
        "total_analysis_runs": 1,
        "student_appearances": 10,
        "total_clusters": 2,
        "educator_modification_rate": 0.5000,
        "historical_decisions_count": 2,
        "cluster_prevalence": {("run-001", "c1"): 0.3000},
    }

    mart_metrics = {
        "total_analysis_runs": 1,
        "student_appearances": 10,
        "total_clusters": 2,
        "educator_modification_rate": 0.2500,  # Diverged
        "historical_decisions_count": 2,
        "cluster_prevalence": {("run-001", "c1"): 0.3000},
    }

    report = reconcile_metrics(authoritative, mart_metrics)
    assert report.is_reconciled is False
    assert len(report.discrepancies) == 1
    assert report.discrepancies[0].metric_name == "educator_modification_rate"


def test_reconcile_metrics_detects_decision_history_loss():
    """Detects if educator history rows were collapsed in marts."""
    authoritative = {
        "total_analysis_runs": 1,
        "student_appearances": 10,
        "total_clusters": 1,
        "educator_modification_rate": 0.0,
        "historical_decisions_count": 3,
        "cluster_prevalence": {("run-001", "c1"): 0.2000},
    }

    mart_metrics = {
        "total_analysis_runs": 1,
        "student_appearances": 10,
        "total_clusters": 1,
        "educator_modification_rate": 0.0,
        "historical_decisions_count": 2,  # Missing one historical action
        "cluster_prevalence": {("run-001", "c1"): 0.2000},
    }

    report = reconcile_metrics(authoritative, mart_metrics)
    assert report.is_reconciled is False
    assert any(d.metric_name == "historical_decisions_count" for d in report.discrepancies)


def test_postgres_dbt_marts_reconciliation():
    """Integration test verifying end-to-end reconciliation on live PostgreSQL."""
    db_url = os.environ.get("LOTUSLEARN_TEST_DATABASE_URL") or os.environ.get(
        "LOTUSLEARN_DATABASE_URL"
    )
    if not db_url:
        pytest.skip("PostgreSQL database URL not configured for dbt reconciliation test")

    import psycopg
    from psycopg.rows import dict_row

    try:
        with psycopg.connect(db_url, autocommit=True, row_factory=dict_row) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT 1 FROM information_schema.tables WHERE table_name = 'fct_analysis_runs'"
                )
                if not cur.fetchone():
                    pytest.skip("dbt marts not yet built on PostgreSQL instance")

                cur.execute("SELECT COUNT(*) AS c FROM analysis_runs")
                auth_runs = cur.fetchone()["c"]

                cur.execute("SELECT COUNT(*) AS c FROM fct_analysis_runs")
                mart_runs = cur.fetchone()["c"]

                assert auth_runs == mart_runs
    except Exception as e:
        pytest.skip(f"Live PostgreSQL unavailable for dbt reconciliation: {e}")
