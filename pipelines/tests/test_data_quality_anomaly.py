from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

import lotuslearn_pipeline.data_quality_anomaly as anomaly_module
from lotuslearn_pipeline.data_quality_anomaly import (
    compare_candidate_detectors,
    score_isolation_forest_candidate,
)

FEATURES = (
    "row_count_delta",
    "missing_key_count",
)


def make_history(
    size: int = 40,
) -> pd.DataFrame:
    positions = np.arange(
        size,
        dtype=np.float64,
    )

    return pd.DataFrame(
        {
            "row_count_delta": (np.sin(positions / 3.0) * 2.0),
            "missing_key_count": (np.cos(positions / 4.0) + 2.0),
        }
    )


def make_extreme_candidate() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "row_count_delta": [100.0],
            "missing_key_count": [75.0],
        }
    )


def test_isolation_forest_scores_exactly_one_candidate():
    result = score_isolation_forest_candidate(
        make_history(),
        make_extreme_candidate(),
        feature_columns=FEATURES,
        min_history=20,
        contamination=0.05,
        random_state=42,
    )

    assert result.history_size == 40
    assert result.feature_columns == FEATURES
    assert result.prediction in (-1, 1)
    assert isinstance(
        result.decision_function,
        float,
    )
    assert result.anomaly_score == pytest.approx(-result.decision_function)


def test_extreme_candidate_is_detected_as_anomaly():
    result = score_isolation_forest_candidate(
        make_history(60),
        make_extreme_candidate(),
        feature_columns=FEATURES,
        min_history=20,
        contamination=0.05,
        random_state=42,
    )

    assert result.prediction == -1
    assert result.is_anomaly


def test_isolation_forest_is_deterministic_for_fixed_seed():
    history = make_history(60)
    candidate = make_extreme_candidate()

    first = score_isolation_forest_candidate(
        history,
        candidate,
        feature_columns=FEATURES,
        min_history=20,
        contamination=0.05,
        random_state=314159,
    )

    second = score_isolation_forest_candidate(
        history,
        candidate,
        feature_columns=FEATURES,
        min_history=20,
        contamination=0.05,
        random_state=314159,
    )

    assert first.prediction == second.prediction
    assert first.is_anomaly == second.is_anomaly
    assert first.decision_function == pytest.approx(second.decision_function)
    assert first.anomaly_score == pytest.approx(second.anomaly_score)


def test_candidate_is_not_included_in_model_fit(
    monkeypatch,
):
    captured: dict[str, object] = {}

    class RecordingIsolationForest:
        def __init__(self, **kwargs):
            captured["constructor"] = kwargs

        def fit(self, matrix):
            captured["fit_matrix"] = matrix.copy()
            return self

        def decision_function(self, matrix):
            captured["score_matrix"] = matrix.copy()
            return np.array(
                [-0.25],
                dtype=np.float64,
            )

        def predict(self, matrix):
            captured["predict_matrix"] = matrix.copy()
            return np.array(
                [-1],
                dtype=np.int64,
            )

    monkeypatch.setattr(
        anomaly_module,
        "IsolationForest",
        RecordingIsolationForest,
    )

    history = make_history(20)
    candidate = make_extreme_candidate()

    result = score_isolation_forest_candidate(
        history,
        candidate,
        feature_columns=FEATURES,
        min_history=20,
    )

    fit_matrix = captured["fit_matrix"]
    score_matrix = captured["score_matrix"]
    predict_matrix = captured["predict_matrix"]

    assert fit_matrix.shape == (20, 2)
    assert score_matrix.shape == (1, 2)
    assert predict_matrix.shape == (1, 2)

    np.testing.assert_allclose(
        fit_matrix,
        history.loc[
            :,
            list(FEATURES),
        ].to_numpy(
            dtype=np.float64,
        ),
    )

    np.testing.assert_allclose(
        score_matrix,
        candidate.loc[
            :,
            list(FEATURES),
        ].to_numpy(
            dtype=np.float64,
        ),
    )

    assert result.is_anomaly
    assert result.anomaly_score == 0.25


def test_detector_comparison_benchmarks_ml_against_robust_signal():
    result = compare_candidate_detectors(
        make_history(60),
        make_extreme_candidate(),
        feature_columns=FEATURES,
        min_history=20,
        robust_threshold=3.5,
        contamination=0.05,
        random_state=42,
    )

    assert result.isolation_forest.is_anomaly
    assert result.robust_is_anomaly
    assert result.robust_anomaly_metrics
    assert result.detectors_agree


def test_candidate_must_contain_exactly_one_row():
    with pytest.raises(
        ValueError,
        match="exactly one row",
    ):
        score_isolation_forest_candidate(
            make_history(),
            pd.DataFrame(
                {
                    "row_count_delta": [
                        1.0,
                        2.0,
                    ],
                    "missing_key_count": [
                        1.0,
                        2.0,
                    ],
                }
            ),
            feature_columns=FEATURES,
            min_history=20,
        )


def test_history_must_satisfy_minimum_size():
    with pytest.raises(
        ValueError,
        match="min_history",
    ):
        score_isolation_forest_candidate(
            make_history(5),
            make_extreme_candidate(),
            feature_columns=FEATURES,
            min_history=20,
        )


@pytest.mark.parametrize(
    "bad_value",
    [
        np.nan,
        np.inf,
        -np.inf,
    ],
)
def test_non_finite_candidate_is_rejected(
    bad_value,
):
    candidate = make_extreme_candidate()
    candidate.loc[
        0,
        "row_count_delta",
    ] = bad_value

    with pytest.raises(
        ValueError,
        match="NaN or infinite",
    ):
        score_isolation_forest_candidate(
            make_history(),
            candidate,
            feature_columns=FEATURES,
            min_history=20,
        )


def test_missing_feature_is_rejected():
    with pytest.raises(
        KeyError,
        match="Missing anomaly feature columns",
    ):
        score_isolation_forest_candidate(
            make_history(),
            make_extreme_candidate(),
            feature_columns=(
                "row_count_delta",
                "unknown_metric",
            ),
            min_history=20,
        )


@pytest.mark.parametrize(
    (
        "min_history",
        "n_estimators",
        "contamination",
    ),
    [
        (1, 100, "auto"),
        (20, 0, "auto"),
        (20, 100, 0.0),
        (20, 100, -0.1),
        (20, 100, 0.6),
        (20, 100, float("inf")),
    ],
)
def test_invalid_model_configuration_is_rejected(
    min_history,
    n_estimators,
    contamination,
):
    with pytest.raises(ValueError):
        score_isolation_forest_candidate(
            make_history(),
            make_extreme_candidate(),
            feature_columns=FEATURES,
            min_history=min_history,
            n_estimators=n_estimators,
            contamination=contamination,
        )
