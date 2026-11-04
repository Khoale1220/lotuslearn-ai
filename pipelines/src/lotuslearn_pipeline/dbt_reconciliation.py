"""Deterministic metric reconciliation between LotusLearn ingestion metrics and dbt marts.

Verifies mathematical and semantic equivalence between raw/view SQL metrics (metrics.sql)
and transformed dbt dimensional marts (fct_analysis_runs, fct_misconception_clusters,
fct_teacher_decisions, mart_learning_analytics).
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List


@dataclass
class MetricDiscrepancy:
    metric_name: str
    authoritative_value: Any
    dbt_mart_value: Any
    details: str = ""


@dataclass
class DbtReconciliationReport:
    is_reconciled: bool
    total_metrics_evaluated: int
    discrepancies: List[MetricDiscrepancy] = field(default_factory=list)
    reconciled_metrics: Dict[str, Any] = field(default_factory=dict)

    def summary(self) -> str:
        if self.is_reconciled:
            return (
                f"RECONCILIATION_PASS: All {self.total_metrics_evaluated} metrics evaluated "
                f"matched with zero divergence."
            )
        return (
            f"RECONCILIATION_FAIL: {len(self.discrepancies)} of {self.total_metrics_evaluated} "
            f"metrics exhibited divergence: {[d.metric_name for d in self.discrepancies]}"
        )


def reconcile_metrics(
    authoritative_metrics: Dict[str, Any],
    dbt_mart_metrics: Dict[str, Any],
    tolerance: float = 0.0001,
) -> DbtReconciliationReport:
    """Compares authoritative metrics dictionary against dbt mart output metrics.

    Zero divergence is required for counts and keys; floating-point prevalence and
    rates must match within 4 decimal places (tolerance).
    """
    discrepancies: List[MetricDiscrepancy] = []
    evaluated = 0
    reconciled: Dict[str, Any] = {}

    # 1. Total Analysis Runs
    evaluated += 1
    auth_runs = authoritative_metrics.get("total_analysis_runs", 0)
    mart_runs = dbt_mart_metrics.get("total_analysis_runs", 0)
    if auth_runs != mart_runs:
        discrepancies.append(
            MetricDiscrepancy(
                "total_analysis_runs", auth_runs, mart_runs, "Run count mismatch"
            )
        )
    else:
        reconciled["total_analysis_runs"] = auth_runs

    # 2. Total Student Appearances
    evaluated += 1
    auth_students = authoritative_metrics.get("student_appearances", 0)
    mart_students = dbt_mart_metrics.get("student_appearances", 0)
    if auth_students != mart_students:
        discrepancies.append(
            MetricDiscrepancy(
                "student_appearances", auth_students, mart_students, "Student count mismatch"
            )
        )
    else:
        reconciled["student_appearances"] = auth_students

    # 3. Misconception Clusters Count
    evaluated += 1
    auth_clusters = authoritative_metrics.get("total_clusters", 0)
    mart_clusters = dbt_mart_metrics.get("total_clusters", 0)
    if auth_clusters != mart_clusters:
        discrepancies.append(
            MetricDiscrepancy(
                "total_clusters", auth_clusters, mart_clusters, "Cluster count mismatch"
            )
        )
    else:
        reconciled["total_clusters"] = auth_clusters

    # 4. Global Educator Modification Rate
    evaluated += 1
    auth_mod = authoritative_metrics.get("educator_modification_rate")
    mart_mod = dbt_mart_metrics.get("educator_modification_rate")
    if auth_mod is None and mart_mod is None:
        reconciled["educator_modification_rate"] = None
    elif auth_mod is None or mart_mod is None:
        discrepancies.append(
            MetricDiscrepancy(
                "educator_modification_rate",
                auth_mod,
                mart_mod,
                "One rate is None while other is present",
            )
        )
    elif abs(float(auth_mod) - float(mart_mod)) > tolerance:
        discrepancies.append(
            MetricDiscrepancy(
                "educator_modification_rate",
                auth_mod,
                mart_mod,
                "Rate difference exceeds tolerance",
            )
        )
    else:
        reconciled["educator_modification_rate"] = auth_mod

    # 5. Teacher Decision Historical Event Count
    evaluated += 1
    auth_decisions = authoritative_metrics.get("historical_decisions_count", 0)
    mart_decisions = dbt_mart_metrics.get("historical_decisions_count", 0)
    if auth_decisions != mart_decisions:
        discrepancies.append(
            MetricDiscrepancy(
                "historical_decisions_count",
                auth_decisions,
                mart_decisions,
                "Historical decision event count mismatch",
            )
        )
    else:
        reconciled["historical_decisions_count"] = auth_decisions

    # 6. Cluster-level Prevalence Equivalence
    auth_prev = authoritative_metrics.get("cluster_prevalence", {})
    mart_prev = dbt_mart_metrics.get("cluster_prevalence", {})
    all_cluster_keys = set(auth_prev.keys()) | set(mart_prev.keys())
    for c_key in sorted(all_cluster_keys):
        evaluated += 1
        a_val = auth_prev.get(c_key)
        m_val = mart_prev.get(c_key)
        if a_val is None or m_val is None:
            discrepancies.append(
                MetricDiscrepancy(
                    f"prevalence_{c_key}",
                    a_val,
                    m_val,
                    f"Cluster {c_key} missing in one source",
                )
            )
        elif abs(float(a_val) - float(m_val)) > tolerance:
            discrepancies.append(
                MetricDiscrepancy(
                    f"prevalence_{c_key}",
                    a_val,
                    m_val,
                    f"Prevalence divergence on cluster {c_key}",
                )
            )
        else:
            reconciled[f"prevalence_{c_key}"] = a_val

    is_reconciled = len(discrepancies) == 0
    return DbtReconciliationReport(
        is_reconciled=is_reconciled,
        total_metrics_evaluated=evaluated,
        discrepancies=discrepancies,
        reconciled_metrics=reconciled,
    )
