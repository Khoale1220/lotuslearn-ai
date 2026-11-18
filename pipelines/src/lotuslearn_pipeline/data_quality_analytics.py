"""Pandas and NumPy analytics for data-quality reconciliation evidence.

The deterministic reconciliation domain remains independent from dataframe
dependencies. This module consumes completed reconciliation reports and turns
them into analytical feature frames and historical robust-deviation evidence.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence

import numpy as np
import pandas as pd

from lotuslearn_pipeline.data_quality_reconciliation import (
    DataQualityStatus,
    DatasetReconciliationReport,
)

FEATURE_COLUMNS = (
    "source_row_count",
    "target_row_count",
    "row_count_delta",
    "row_count_abs_delta",
    "source_distinct_key_count",
    "target_distinct_key_count",
    "distinct_key_delta",
    "source_duplicate_key_count",
    "target_duplicate_key_count",
    "duplicate_key_delta",
    "missing_key_count",
    "extra_key_count",
    "key_difference_count",
    "failed_metric_count",
    "digest_match",
    "status_fail",
)

DEFAULT_BASELINE_FEATURES = (
    "row_count_delta",
    "row_count_abs_delta",
    "duplicate_key_delta",
    "missing_key_count",
    "extra_key_count",
    "key_difference_count",
    "failed_metric_count",
)

_MAD_NORMALIZATION = 0.6744897501960817
_IQR_NORMALIZATION = 1.3489795003921634


def reconciliation_feature_frame(
    reports: Iterable[DatasetReconciliationReport],
    *,
    labels: Sequence[str] | None = None,
) -> pd.DataFrame:
    """Convert reconciliation reports into a deterministic numeric feature frame.

    The output is deliberately ML-friendly while retaining direct operational
    meaning. One report becomes exactly one row.

    ``digest_match`` and ``status_fail`` are represented as integer indicators
    so downstream statistical and machine-learning layers do not need to
    reinterpret enum or boolean objects.
    """

    materialized = tuple(reports)

    if labels is not None and len(labels) != len(materialized):
        raise ValueError("labels must have exactly one value per report")

    rows: list[dict[str, object]] = []

    for index, report in enumerate(materialized):
        if not isinstance(report, DatasetReconciliationReport):
            raise TypeError("reports must contain DatasetReconciliationReport instances")

        missing_key_count = sum(difference.count for difference in report.missing_from_target)
        extra_key_count = sum(difference.count for difference in report.extra_in_target)

        row: dict[str, object] = {
            "report_index": index,
            "source_row_count": report.source.row_count,
            "target_row_count": report.target.row_count,
            "row_count_delta": (report.target.row_count - report.source.row_count),
            "row_count_abs_delta": abs(report.target.row_count - report.source.row_count),
            "source_distinct_key_count": (report.source.distinct_key_count),
            "target_distinct_key_count": (report.target.distinct_key_count),
            "distinct_key_delta": (
                report.target.distinct_key_count - report.source.distinct_key_count
            ),
            "source_duplicate_key_count": (report.source.duplicate_key_count),
            "target_duplicate_key_count": (report.target.duplicate_key_count),
            "duplicate_key_delta": (
                report.target.duplicate_key_count - report.source.duplicate_key_count
            ),
            "missing_key_count": missing_key_count,
            "extra_key_count": extra_key_count,
            "key_difference_count": (missing_key_count + extra_key_count),
            "failed_metric_count": len(report.failed_metrics),
            "digest_match": int(report.source.digest == report.target.digest),
            "status_fail": int(report.status is DataQualityStatus.FAIL),
        }

        if labels is not None:
            row["label"] = labels[index]

        rows.append(row)

    columns = ["report_index"]

    if labels is not None:
        columns.append("label")

    columns.extend(FEATURE_COLUMNS)

    return pd.DataFrame.from_records(
        rows,
        columns=columns,
    )


def _normalize_metric_columns(
    frame: pd.DataFrame,
    metric_columns: Sequence[str],
) -> tuple[str, ...]:
    if isinstance(metric_columns, (str, bytes)):
        raise TypeError("metric_columns must be a sequence of column names")

    normalized = tuple(metric_columns)

    if not normalized:
        raise ValueError("metric_columns must contain at least one column")

    if any(not isinstance(column, str) or not column for column in normalized):
        raise ValueError("metric_columns must contain non-empty strings")

    if len(set(normalized)) != len(normalized):
        raise ValueError("metric_columns must not contain duplicates")

    missing = [column for column in normalized if column not in frame.columns]

    if missing:
        raise KeyError("Missing analytics columns: " + ", ".join(missing))

    non_numeric = [
        column for column in normalized if not pd.api.types.is_numeric_dtype(frame[column])
    ]

    if non_numeric:
        raise TypeError("Analytics columns must be numeric: " + ", ".join(non_numeric))

    return normalized


def numeric_baseline_summary(
    frame: pd.DataFrame,
    *,
    metric_columns: Sequence[str] = DEFAULT_BASELINE_FEATURES,
) -> pd.DataFrame:
    """Summarize numeric reconciliation history with robust statistics.

    NaN and infinite observations are excluded from each metric's historical
    baseline rather than silently poisoning the complete baseline.
    """

    normalized = _normalize_metric_columns(
        frame,
        metric_columns,
    )

    rows: list[dict[str, object]] = []

    for metric in normalized:
        values = frame[metric].to_numpy(
            dtype=np.float64,
            copy=True,
        )
        finite = values[np.isfinite(values)]

        if finite.size == 0:
            rows.append(
                {
                    "metric": metric,
                    "count": 0,
                    "mean": np.nan,
                    "std": np.nan,
                    "median": np.nan,
                    "q1": np.nan,
                    "q3": np.nan,
                    "iqr": np.nan,
                    "mad": np.nan,
                    "minimum": np.nan,
                    "maximum": np.nan,
                }
            )
            continue

        median = float(np.median(finite))
        q1, q3 = np.percentile(
            finite,
            [25.0, 75.0],
            method="linear",
        )

        mad = float(np.median(np.abs(finite - median)))

        rows.append(
            {
                "metric": metric,
                "count": int(finite.size),
                "mean": float(np.mean(finite)),
                "std": float(np.std(finite, ddof=0)),
                "median": median,
                "q1": float(q1),
                "q3": float(q3),
                "iqr": float(q3 - q1),
                "mad": mad,
                "minimum": float(np.min(finite)),
                "maximum": float(np.max(finite)),
            }
        )

    return pd.DataFrame.from_records(rows)


def _robust_scale(
    history: np.ndarray,
    *,
    center: float,
) -> float:
    mad = float(np.median(np.abs(history - center)))

    if mad > 0.0:
        return mad / _MAD_NORMALIZATION

    q1, q3 = np.percentile(
        history,
        [25.0, 75.0],
        method="linear",
    )
    iqr = float(q3 - q1)

    if iqr > 0.0:
        return iqr / _IQR_NORMALIZATION

    return 0.0


def expanding_robust_deviation(
    frame: pd.DataFrame,
    *,
    metric_columns: Sequence[str] = DEFAULT_BASELINE_FEATURES,
    min_history: int = 5,
    threshold: float = 3.5,
) -> pd.DataFrame:
    """Score each observation against history available before that row.

    This is an expanding-window calculation. The current observation and all
    future observations are excluded from its baseline, preventing analytical
    look-ahead leakage.

    Median absolute deviation is the primary scale estimator. IQR is used as
    a deterministic fallback when MAD collapses to zero.
    """

    if isinstance(min_history, bool) or not isinstance(
        min_history,
        int,
    ):
        raise TypeError("min_history must be an integer")

    if min_history < 1:
        raise ValueError("min_history must be at least 1")

    if isinstance(threshold, bool) or not isinstance(
        threshold,
        (int, float),
    ):
        raise TypeError("threshold must be numeric")

    threshold_value = float(threshold)

    if not np.isfinite(threshold_value) or threshold_value <= 0.0:
        raise ValueError("threshold must be finite and greater than zero")

    normalized = _normalize_metric_columns(
        frame,
        metric_columns,
    )

    records: list[dict[str, object]] = []

    for metric in normalized:
        values = frame[metric].to_numpy(
            dtype=np.float64,
            copy=True,
        )

        for position, value in enumerate(values):
            historical = values[:position]
            historical = historical[np.isfinite(historical)]

            record: dict[str, object] = {
                "row_position": position,
                "metric": metric,
                "value": float(value),
                "baseline_count": int(historical.size),
                "baseline_median": np.nan,
                "robust_scale": np.nan,
                "robust_z_score": np.nan,
                "is_anomaly": False,
            }

            if not np.isfinite(value) or historical.size < min_history:
                records.append(record)
                continue

            center = float(np.median(historical))
            scale = _robust_scale(
                historical,
                center=center,
            )

            if scale == 0.0:
                if value == center:
                    score = 0.0
                else:
                    score = math_copysign_inf(value - center)
            else:
                score = float((value - center) / scale)

            record.update(
                {
                    "baseline_median": center,
                    "robust_scale": scale,
                    "robust_z_score": score,
                    "is_anomaly": bool(abs(score) >= threshold_value),
                }
            )

            records.append(record)

    return pd.DataFrame.from_records(records)


def math_copysign_inf(value: float) -> float:
    """Return signed infinity without introducing another dependency."""

    return float(
        np.copysign(
            np.inf,
            value,
        )
    )


__all__ = [
    "DEFAULT_BASELINE_FEATURES",
    "FEATURE_COLUMNS",
    "expanding_robust_deviation",
    "numeric_baseline_summary",
    "reconciliation_feature_frame",
]
