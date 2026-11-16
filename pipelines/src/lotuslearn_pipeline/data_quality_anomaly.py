"""Machine-learning anomaly detection for reconciliation evidence.

The model is deliberately isolated from deterministic reconciliation and
durable persistence.

Training uses historical observations only. A candidate observation is never
included in the training matrix used to score that same candidate.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from lotuslearn_pipeline.data_quality_analytics import (
    DEFAULT_BASELINE_FEATURES,
    expanding_robust_deviation,
)

Contamination = Literal["auto"] | float


@dataclass(frozen=True)
class IsolationForestCandidateScore:
    """ML evidence produced for one candidate reconciliation observation."""

    history_size: int
    feature_columns: tuple[str, ...]
    decision_function: float
    anomaly_score: float
    prediction: int
    is_anomaly: bool


@dataclass(frozen=True)
class DetectorComparison:
    """Comparison between ML and deterministic robust statistical evidence."""

    isolation_forest: IsolationForestCandidateScore
    robust_is_anomaly: bool
    robust_anomaly_metrics: tuple[str, ...]
    detectors_agree: bool


def _normalize_feature_columns(
    frame: pd.DataFrame,
    feature_columns: tuple[str, ...],
) -> tuple[str, ...]:
    if not feature_columns:
        raise ValueError("feature_columns must contain at least one column")

    if any(not isinstance(column, str) or not column for column in feature_columns):
        raise ValueError("feature_columns must contain non-empty strings")

    if len(set(feature_columns)) != len(feature_columns):
        raise ValueError("feature_columns must not contain duplicates")

    missing = [column for column in feature_columns if column not in frame.columns]

    if missing:
        raise KeyError("Missing anomaly feature columns: " + ", ".join(missing))

    non_numeric = [
        column for column in feature_columns if not pd.api.types.is_numeric_dtype(frame[column])
    ]

    if non_numeric:
        raise TypeError("Anomaly feature columns must be numeric: " + ", ".join(non_numeric))

    return feature_columns


def _numeric_matrix(
    frame: pd.DataFrame,
    *,
    feature_columns: tuple[str, ...],
    frame_name: str,
) -> np.ndarray:
    columns = _normalize_feature_columns(
        frame,
        feature_columns,
    )

    matrix = frame.loc[
        :,
        list(columns),
    ].to_numpy(
        dtype=np.float64,
        copy=True,
    )

    if not np.isfinite(matrix).all():
        raise ValueError(f"{frame_name} contains NaN or infinite feature values")

    return matrix


def _validate_configuration(
    *,
    min_history: int,
    n_estimators: int,
    contamination: Contamination,
    random_state: int,
) -> None:
    if isinstance(min_history, bool) or not isinstance(
        min_history,
        int,
    ):
        raise TypeError("min_history must be an integer")

    if min_history < 2:
        raise ValueError("min_history must be at least 2")

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

        value = float(contamination)

        if not np.isfinite(value) or value <= 0.0 or value > 0.5:
            raise ValueError("numeric contamination must be in (0, 0.5]")

    if isinstance(random_state, bool) or not isinstance(
        random_state,
        int,
    ):
        raise TypeError("random_state must be an integer")


def score_isolation_forest_candidate(
    history_frame: pd.DataFrame,
    candidate_frame: pd.DataFrame,
    *,
    feature_columns: tuple[str, ...] = DEFAULT_BASELINE_FEATURES,
    min_history: int = 20,
    n_estimators: int = 256,
    contamination: Contamination = "auto",
    random_state: int = 42,
) -> IsolationForestCandidateScore:
    """Fit on history only and score exactly one candidate observation.

    ``IsolationForest.decision_function`` is positive for observations judged
    more normal and negative for observations judged more anomalous.

    ``anomaly_score`` reverses that sign so larger values consistently mean
    stronger anomaly evidence for downstream consumers.
    """

    _validate_configuration(
        min_history=min_history,
        n_estimators=n_estimators,
        contamination=contamination,
        random_state=random_state,
    )

    if len(candidate_frame) != 1:
        raise ValueError("candidate_frame must contain exactly one row")

    if len(history_frame) < min_history:
        raise ValueError("history_frame does not satisfy min_history")

    columns = tuple(feature_columns)

    history_matrix = _numeric_matrix(
        history_frame,
        feature_columns=columns,
        frame_name="history_frame",
    )

    candidate_matrix = _numeric_matrix(
        candidate_frame,
        feature_columns=columns,
        frame_name="candidate_frame",
    )

    model = IsolationForest(
        n_estimators=n_estimators,
        contamination=contamination,
        random_state=random_state,
        bootstrap=False,
        n_jobs=1,
    )

    model.fit(history_matrix)

    decision = float(model.decision_function(candidate_matrix)[0])

    prediction = int(model.predict(candidate_matrix)[0])

    if prediction not in (-1, 1):
        raise RuntimeError("IsolationForest returned an unexpected prediction")

    return IsolationForestCandidateScore(
        history_size=len(history_frame),
        feature_columns=columns,
        decision_function=decision,
        anomaly_score=-decision,
        prediction=prediction,
        is_anomaly=prediction == -1,
    )


def compare_candidate_detectors(
    history_frame: pd.DataFrame,
    candidate_frame: pd.DataFrame,
    *,
    feature_columns: tuple[str, ...] = DEFAULT_BASELINE_FEATURES,
    min_history: int = 20,
    robust_threshold: float = 3.5,
    n_estimators: int = 256,
    contamination: Contamination = "auto",
    random_state: int = 42,
) -> DetectorComparison:
    """Compare Isolation Forest evidence with the DE-04C robust baseline.

    Both detectors consume the same history and candidate boundary.

    The statistical detector receives the candidate only as the final row of
    an expanding-window calculation, so its baseline still consists solely of
    observations that occurred before the candidate.
    """

    ml_score = score_isolation_forest_candidate(
        history_frame,
        candidate_frame,
        feature_columns=feature_columns,
        min_history=min_history,
        n_estimators=n_estimators,
        contamination=contamination,
        random_state=random_state,
    )

    candidate_position = len(history_frame)

    combined = pd.concat(
        [
            history_frame,
            candidate_frame,
        ],
        axis=0,
        ignore_index=True,
    )

    robust = expanding_robust_deviation(
        combined,
        metric_columns=feature_columns,
        min_history=min_history,
        threshold=robust_threshold,
    )

    candidate_robust = robust.loc[robust["row_position"] == candidate_position]

    anomaly_metrics = tuple(
        candidate_robust.loc[
            candidate_robust["is_anomaly"],
            "metric",
        ].astype(str)
    )

    robust_is_anomaly = bool(anomaly_metrics)

    return DetectorComparison(
        isolation_forest=ml_score,
        robust_is_anomaly=robust_is_anomaly,
        robust_anomaly_metrics=anomaly_metrics,
        detectors_agree=(ml_score.is_anomaly == robust_is_anomaly),
    )


__all__ = [
    "Contamination",
    "DetectorComparison",
    "IsolationForestCandidateScore",
    "compare_candidate_detectors",
    "score_isolation_forest_candidate",
]
