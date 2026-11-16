"""Orchestrated data-quality evaluation.

Deterministic reconciliation remains the authoritative source of truth.

Statistical and machine-learning anomaly detection add bounded analytical
evidence without replacing reconciliation semantics. The evaluation layer
therefore owns its own PASS / REVIEW / ALERT status instead of extending or
mutating ``DataQualityStatus``.
"""

from __future__ import annotations

import math
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from enum import Enum

from lotuslearn_pipeline.data_quality_analytics import (
    DEFAULT_BASELINE_FEATURES,
    reconciliation_feature_frame,
)
from lotuslearn_pipeline.data_quality_anomaly import (
    Contamination,
    DetectorComparison,
    compare_candidate_detectors,
)
from lotuslearn_pipeline.data_quality_reconciliation import (
    DataQualityStatus,
    DatasetReconciliationReport,
    reconcile_datasets,
)


class QualityEvaluationStatus(str, Enum):
    """Operational disposition for combined data-quality evidence."""

    PASS = "PASS"
    REVIEW = "REVIEW"
    ALERT = "ALERT"


@dataclass(frozen=True)
class QualityEvaluationDecision:
    """Combined deterministic, statistical, and ML quality evidence."""

    status: QualityEvaluationStatus
    reconciliation: DatasetReconciliationReport
    history_size: int
    analytics_ready: bool
    feature_columns: tuple[str, ...]
    detector_comparison: DetectorComparison | None
    reasons: tuple[str, ...]


def _validate_evaluation_configuration(
    *,
    feature_columns: tuple[str, ...],
    min_history: int,
    robust_threshold: float,
    n_estimators: int,
    contamination: Contamination,
    random_state: int,
) -> None:
    if not feature_columns:
        raise ValueError("feature_columns must contain at least one column")

    if any(not isinstance(column, str) or not column for column in feature_columns):
        raise ValueError("feature_columns must contain non-empty strings")

    if len(set(feature_columns)) != len(feature_columns):
        raise ValueError("feature_columns must not contain duplicates")

    if isinstance(min_history, bool) or not isinstance(
        min_history,
        int,
    ):
        raise TypeError("min_history must be an integer")

    if min_history < 2:
        raise ValueError("min_history must be at least 2")

    if isinstance(robust_threshold, bool) or not isinstance(
        robust_threshold,
        (int, float),
    ):
        raise TypeError("robust_threshold must be numeric")

    robust_threshold_value = float(robust_threshold)

    if not math.isfinite(robust_threshold_value) or robust_threshold_value <= 0.0:
        raise ValueError("robust_threshold must be finite and positive")

    if isinstance(n_estimators, bool) or not isinstance(
        n_estimators,
        int,
    ):
        raise TypeError("n_estimators must be an integer")

    if n_estimators < 1:
        raise ValueError("n_estimators must be at least 1")

    if contamination != "auto":
        if isinstance(contamination, bool) or not isinstance(
            contamination,
            (int, float),
        ):
            raise TypeError("contamination must be 'auto' or numeric")

        contamination_value = float(contamination)

        if (
            not math.isfinite(contamination_value)
            or contamination_value <= 0.0
            or contamination_value > 0.5
        ):
            raise ValueError("numeric contamination must be in (0, 0.5]")

    if isinstance(random_state, bool) or not isinstance(
        random_state,
        int,
    ):
        raise TypeError("random_state must be an integer")


def _resolve_evaluation(
    reconciliation: DatasetReconciliationReport,
    detector_comparison: DetectorComparison | None,
) -> tuple[
    QualityEvaluationStatus,
    tuple[str, ...],
]:
    reasons: list[str] = []

    deterministic_failed = reconciliation.status is DataQualityStatus.FAIL

    if deterministic_failed:
        reasons.append("deterministic_reconciliation_failed")

    if detector_comparison is None:
        reasons.append("analytics_warmup")

        if deterministic_failed:
            return (
                QualityEvaluationStatus.ALERT,
                tuple(reasons),
            )

        return (
            QualityEvaluationStatus.PASS,
            tuple(reasons),
        )

    ml_anomaly = detector_comparison.isolation_forest.is_anomaly

    robust_anomaly = detector_comparison.robust_is_anomaly

    if ml_anomaly and robust_anomaly:
        reasons.append("robust_and_ml_anomaly")
        analytical_status = QualityEvaluationStatus.ALERT
    elif ml_anomaly != robust_anomaly:
        reasons.append("detector_disagreement")
        analytical_status = QualityEvaluationStatus.REVIEW
    else:
        reasons.append("no_anomaly_detected")
        analytical_status = QualityEvaluationStatus.PASS

    if deterministic_failed:
        return (
            QualityEvaluationStatus.ALERT,
            tuple(reasons),
        )

    return (
        analytical_status,
        tuple(reasons),
    )


def evaluate_reconciliation_quality(
    history_reports: Sequence[DatasetReconciliationReport],
    candidate_report: DatasetReconciliationReport,
    *,
    feature_columns: tuple[str, ...] = DEFAULT_BASELINE_FEATURES,
    min_history: int = 20,
    robust_threshold: float = 3.5,
    n_estimators: int = 256,
    contamination: Contamination = "auto",
    random_state: int = 42,
) -> QualityEvaluationDecision:
    """Evaluate one reconciliation report against historical evidence.

    Reconciliation remains authoritative:

    * deterministic reconciliation failure always produces ALERT;
    * when history is still warming up, deterministic PASS remains PASS;
    * agreement between robust and ML anomaly detectors produces ALERT;
    * detector disagreement produces REVIEW;
    * agreement on no anomaly produces PASS.

    The candidate report is never included in the history used to fit the
    Isolation Forest model.
    """

    columns = tuple(feature_columns)

    _validate_evaluation_configuration(
        feature_columns=columns,
        min_history=min_history,
        robust_threshold=robust_threshold,
        n_estimators=n_estimators,
        contamination=contamination,
        random_state=random_state,
    )

    history = tuple(history_reports)

    analytics_ready = len(history) >= min_history

    comparison: DetectorComparison | None = None

    if analytics_ready:
        history_frame = reconciliation_feature_frame(history)

        candidate_frame = reconciliation_feature_frame((candidate_report,))

        comparison = compare_candidate_detectors(
            history_frame,
            candidate_frame,
            feature_columns=columns,
            min_history=min_history,
            robust_threshold=robust_threshold,
            n_estimators=n_estimators,
            contamination=contamination,
            random_state=random_state,
        )

    status, reasons = _resolve_evaluation(
        candidate_report,
        comparison,
    )

    return QualityEvaluationDecision(
        status=status,
        reconciliation=candidate_report,
        history_size=len(history),
        analytics_ready=analytics_ready,
        feature_columns=columns,
        detector_comparison=comparison,
        reasons=reasons,
    )


def evaluate_dataset_quality(
    source_rows: Sequence[Mapping[str, object]],
    target_rows: Sequence[Mapping[str, object]],
    *,
    key_fields: Sequence[str],
    history_reports: Sequence[DatasetReconciliationReport] = (),
    tracked_fields: Sequence[str] | None = None,
    feature_columns: tuple[str, ...] = DEFAULT_BASELINE_FEATURES,
    min_history: int = 20,
    robust_threshold: float = 3.5,
    n_estimators: int = 256,
    contamination: Contamination = "auto",
    random_state: int = 42,
) -> QualityEvaluationDecision:
    """Reconcile two datasets and evaluate the resulting quality evidence."""

    reconciliation = reconcile_datasets(
        source_rows,
        target_rows,
        key_fields=key_fields,
        tracked_fields=tracked_fields,
    )

    return evaluate_reconciliation_quality(
        history_reports,
        reconciliation,
        feature_columns=feature_columns,
        min_history=min_history,
        robust_threshold=robust_threshold,
        n_estimators=n_estimators,
        contamination=contamination,
        random_state=random_state,
    )


__all__ = [
    "QualityEvaluationDecision",
    "QualityEvaluationStatus",
    "evaluate_dataset_quality",
    "evaluate_reconciliation_quality",
]
