from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from lotuslearn_pipeline.data_quality_analytics import (
    FEATURE_COLUMNS,
    expanding_robust_deviation,
    numeric_baseline_summary,
    reconciliation_feature_frame,
)
from lotuslearn_pipeline.data_quality_reconciliation import (
    reconcile_datasets,
)


def test_feature_frame_maps_reconciliation_evidence():
    report = reconcile_datasets(
        [
            {"id": "a", "value": 1},
            {"id": "a", "value": 2},
            {"id": "b", "value": 3},
        ],
        [
            {"id": "a", "value": 1},
            {"id": "b", "value": 3},
            {"id": "c", "value": 4},
        ],
        key_fields=("id",),
    )

    frame = reconciliation_feature_frame([report])

    assert list(frame.columns) == [
        "report_index",
        *FEATURE_COLUMNS,
    ]

    row = frame.iloc[0]

    assert row["source_row_count"] == 3
    assert row["target_row_count"] == 3
    assert row["row_count_delta"] == 0
    assert row["source_distinct_key_count"] == 2
    assert row["target_distinct_key_count"] == 3
    assert row["source_duplicate_key_count"] == 1
    assert row["target_duplicate_key_count"] == 0
    assert row["missing_key_count"] == 1
    assert row["extra_key_count"] == 1
    assert row["key_difference_count"] == 2
    assert row["failed_metric_count"] > 0
    assert row["digest_match"] == 0
    assert row["status_fail"] == 1


def test_feature_frame_preserves_report_order_and_labels():
    first = reconcile_datasets(
        [{"id": "a"}],
        [{"id": "a"}],
        key_fields=("id",),
    )
    second = reconcile_datasets(
        [{"id": "a"}],
        [],
        key_fields=("id",),
    )

    frame = reconciliation_feature_frame(
        [first, second],
        labels=("baseline", "candidate"),
    )

    assert frame["report_index"].tolist() == [0, 1]
    assert frame["label"].tolist() == [
        "baseline",
        "candidate",
    ]
    assert frame["status_fail"].tolist() == [0, 1]


def test_feature_frame_rejects_label_count_mismatch():
    report = reconcile_datasets(
        [{"id": "a"}],
        [{"id": "a"}],
        key_fields=("id",),
    )

    with pytest.raises(
        ValueError,
        match="exactly one value per report",
    ):
        reconciliation_feature_frame(
            [report],
            labels=(),
        )


def test_empty_feature_frame_has_stable_schema():
    frame = reconciliation_feature_frame([])

    assert frame.empty
    assert list(frame.columns) == [
        "report_index",
        *FEATURE_COLUMNS,
    ]


def test_numeric_baseline_summary_uses_numpy_robust_statistics():
    frame = pd.DataFrame(
        {
            "metric": [
                0.0,
                1.0,
                2.0,
                3.0,
                100.0,
            ]
        }
    )

    summary = numeric_baseline_summary(
        frame,
        metric_columns=("metric",),
    )

    row = summary.iloc[0]

    assert row["count"] == 5
    assert row["median"] == 2.0
    assert row["q1"] == 1.0
    assert row["q3"] == 3.0
    assert row["iqr"] == 2.0
    assert row["mad"] == 1.0
    assert row["minimum"] == 0.0
    assert row["maximum"] == 100.0


def test_baseline_summary_ignores_non_finite_values():
    frame = pd.DataFrame(
        {
            "metric": [
                1.0,
                2.0,
                np.nan,
                np.inf,
            ]
        }
    )

    summary = numeric_baseline_summary(
        frame,
        metric_columns=("metric",),
    )

    row = summary.iloc[0]

    assert row["count"] == 2
    assert row["mean"] == 1.5
    assert row["median"] == 1.5


def test_expanding_score_uses_only_prior_history():
    frame = pd.DataFrame(
        {
            "metric": [
                10.0,
                10.0,
                10.0,
                10.0,
                10.0,
                100.0,
            ]
        }
    )

    scores = expanding_robust_deviation(
        frame,
        metric_columns=("metric",),
        min_history=5,
        threshold=3.5,
    )

    first_scorable = scores.iloc[5]

    assert first_scorable["baseline_count"] == 5
    assert first_scorable["baseline_median"] == 10.0
    assert first_scorable["robust_scale"] == 0.0
    assert np.isinf(first_scorable["robust_z_score"])
    assert bool(first_scorable["is_anomaly"])


def test_zero_scale_equal_value_is_not_anomaly():
    frame = pd.DataFrame(
        {
            "metric": [
                10.0,
                10.0,
                10.0,
                10.0,
                10.0,
                10.0,
            ]
        }
    )

    scores = expanding_robust_deviation(
        frame,
        metric_columns=("metric",),
        min_history=5,
    )

    last = scores.iloc[-1]

    assert last["robust_scale"] == 0.0
    assert last["robust_z_score"] == 0.0
    assert not bool(last["is_anomaly"])


def test_expanding_score_does_not_score_before_minimum_history():
    frame = pd.DataFrame(
        {
            "metric": [
                1.0,
                2.0,
                3.0,
            ]
        }
    )

    scores = expanding_robust_deviation(
        frame,
        metric_columns=("metric",),
        min_history=3,
    )

    assert scores["is_anomaly"].tolist() == [
        False,
        False,
        False,
    ]
    assert scores["robust_z_score"].isna().all()


def test_analytics_reject_non_numeric_metric():
    frame = pd.DataFrame(
        {
            "metric": [
                "good",
                "bad",
            ]
        }
    )

    with pytest.raises(
        TypeError,
        match="must be numeric",
    ):
        numeric_baseline_summary(
            frame,
            metric_columns=("metric",),
        )


def test_analytics_reject_missing_metric():
    frame = pd.DataFrame({"metric": [1.0]})

    with pytest.raises(
        KeyError,
        match="Missing analytics columns",
    ):
        numeric_baseline_summary(
            frame,
            metric_columns=("missing",),
        )


@pytest.mark.parametrize(
    ("min_history", "threshold"),
    [
        (0, 3.5),
        (-1, 3.5),
        (5, 0.0),
        (5, -1.0),
        (5, float("inf")),
    ],
)
def test_expanding_score_rejects_invalid_configuration(
    min_history,
    threshold,
):
    frame = pd.DataFrame({"metric": [1.0]})

    with pytest.raises(
        ValueError,
    ):
        expanding_robust_deviation(
            frame,
            metric_columns=("metric",),
            min_history=min_history,
            threshold=threshold,
        )
