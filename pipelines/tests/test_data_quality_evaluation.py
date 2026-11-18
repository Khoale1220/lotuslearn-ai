from __future__ import annotations

import pandas as pd
import pytest

import lotuslearn_pipeline.data_quality_evaluation as evaluation_module
from lotuslearn_pipeline.data_quality_anomaly import (
    DetectorComparison,
    IsolationForestCandidateScore,
)
from lotuslearn_pipeline.data_quality_evaluation import (
    QualityEvaluationStatus,
    evaluate_dataset_quality,
    evaluate_reconciliation_quality,
)
from lotuslearn_pipeline.data_quality_reconciliation import (
    DataQualityStatus,
    reconcile_datasets,
)

FEATURES = (
    "row_count_delta",
    "missing_key_count",
)


def make_report(
    *,
    source_score: int = 10,
    target_score: int = 10,
):
    return reconcile_datasets(
        [
            {
                "id": "a",
                "score": source_score,
            }
        ],
        [
            {
                "id": "a",
                "score": target_score,
            }
        ],
        key_fields=("id",),
        tracked_fields=(
            "id",
            "score",
        ),
    )


def make_comparison(
    *,
    ml_anomaly: bool,
    robust_anomaly: bool,
) -> DetectorComparison:
    decision = -0.25 if ml_anomaly else 0.25

    return DetectorComparison(
        isolation_forest=(
            IsolationForestCandidateScore(
                history_size=3,
                feature_columns=FEATURES,
                decision_function=decision,
                anomaly_score=-decision,
                prediction=(-1 if ml_anomaly else 1),
                is_anomaly=ml_anomaly,
            )
        ),
        robust_is_anomaly=robust_anomaly,
        robust_anomaly_metrics=(("row_count_delta",) if robust_anomaly else ()),
        detectors_agree=(ml_anomaly == robust_anomaly),
    )


def test_reconciliation_status_contract_is_not_mutated():
    assert {item.value for item in DataQualityStatus} == {
        "PASS",
        "FAIL",
    }

    assert {item.value for item in QualityEvaluationStatus} == {
        "PASS",
        "REVIEW",
        "ALERT",
    }


def test_warmup_preserves_deterministic_pass(
    monkeypatch,
):
    def unexpected_detector(*args, **kwargs):
        raise AssertionError("detector must not run during warmup")

    monkeypatch.setattr(
        evaluation_module,
        "compare_candidate_detectors",
        unexpected_detector,
    )

    report = make_report()

    decision = evaluate_reconciliation_quality(
        (),
        report,
        feature_columns=FEATURES,
        min_history=3,
    )

    assert report.status is DataQualityStatus.PASS

    assert decision.status is QualityEvaluationStatus.PASS

    assert not decision.analytics_ready
    assert decision.detector_comparison is None

    assert decision.reasons == ("analytics_warmup",)


def test_deterministic_failure_is_alert_during_warmup():
    report = make_report(
        source_score=10,
        target_score=99,
    )

    assert report.status is DataQualityStatus.FAIL

    decision = evaluate_reconciliation_quality(
        (),
        report,
        feature_columns=FEATURES,
        min_history=3,
    )

    assert decision.status is QualityEvaluationStatus.ALERT

    assert "deterministic_reconciliation_failed" in decision.reasons


@pytest.mark.parametrize(
    (
        "ml_anomaly",
        "robust_anomaly",
        "expected_status",
        "expected_reason",
    ),
    [
        (
            False,
            False,
            QualityEvaluationStatus.PASS,
            "no_anomaly_detected",
        ),
        (
            True,
            False,
            QualityEvaluationStatus.REVIEW,
            "detector_disagreement",
        ),
        (
            False,
            True,
            QualityEvaluationStatus.REVIEW,
            "detector_disagreement",
        ),
        (
            True,
            True,
            QualityEvaluationStatus.ALERT,
            "robust_and_ml_anomaly",
        ),
    ],
)
def test_analytical_disposition_matrix(
    monkeypatch,
    ml_anomaly,
    robust_anomaly,
    expected_status,
    expected_reason,
):
    comparison = make_comparison(
        ml_anomaly=ml_anomaly,
        robust_anomaly=robust_anomaly,
    )

    monkeypatch.setattr(
        evaluation_module,
        "compare_candidate_detectors",
        lambda *args, **kwargs: comparison,
    )

    history = tuple(make_report() for _ in range(3))

    decision = evaluate_reconciliation_quality(
        history,
        make_report(),
        feature_columns=FEATURES,
        min_history=3,
    )

    assert decision.analytics_ready

    assert decision.detector_comparison is comparison

    assert decision.status is expected_status

    assert expected_reason in decision.reasons


def test_deterministic_failure_has_alert_precedence(
    monkeypatch,
):
    comparison = make_comparison(
        ml_anomaly=False,
        robust_anomaly=False,
    )

    monkeypatch.setattr(
        evaluation_module,
        "compare_candidate_detectors",
        lambda *args, **kwargs: comparison,
    )

    history = tuple(make_report() for _ in range(3))

    decision = evaluate_reconciliation_quality(
        history,
        make_report(
            source_score=10,
            target_score=99,
        ),
        feature_columns=FEATURES,
        min_history=3,
    )

    assert decision.status is QualityEvaluationStatus.ALERT

    assert "deterministic_reconciliation_failed" in decision.reasons


def test_orchestration_builds_history_and_candidate_frames(
    monkeypatch,
):
    captured: dict[
        str,
        pd.DataFrame,
    ] = {}

    comparison = make_comparison(
        ml_anomaly=False,
        robust_anomaly=False,
    )

    def capture_detector(
        history_frame,
        candidate_frame,
        **kwargs,
    ):
        captured["history"] = history_frame.copy()

        captured["candidate"] = candidate_frame.copy()

        assert kwargs["feature_columns"] == FEATURES

        return comparison

    monkeypatch.setattr(
        evaluation_module,
        "compare_candidate_detectors",
        capture_detector,
    )

    history = tuple(make_report() for _ in range(3))

    decision = evaluate_reconciliation_quality(
        history,
        make_report(),
        feature_columns=FEATURES,
        min_history=3,
    )

    assert len(captured["history"]) == 3

    assert len(captured["candidate"]) == 1

    for column in FEATURES:
        assert column in captured["history"].columns
        assert column in captured["candidate"].columns

    assert decision.status is QualityEvaluationStatus.PASS


def test_dataset_wrapper_executes_real_reconciliation():
    decision = evaluate_dataset_quality(
        [
            {
                "id": "a",
                "score": 10,
            }
        ],
        [
            {
                "id": "a",
                "score": 99,
            }
        ],
        key_fields=("id",),
        tracked_fields=(
            "id",
            "score",
        ),
        feature_columns=FEATURES,
        min_history=3,
    )

    assert decision.reconciliation.status is DataQualityStatus.FAIL

    assert decision.status is QualityEvaluationStatus.ALERT


@pytest.mark.parametrize(
    (
        "kwargs",
        "error",
    ),
    [
        (
            {
                "feature_columns": (),
            },
            ValueError,
        ),
        (
            {
                "feature_columns": (
                    "row_count_delta",
                    "row_count_delta",
                ),
            },
            ValueError,
        ),
        (
            {
                "min_history": 1,
            },
            ValueError,
        ),
        (
            {
                "robust_threshold": 0.0,
            },
            ValueError,
        ),
        (
            {
                "n_estimators": 0,
            },
            ValueError,
        ),
        (
            {
                "contamination": 0.75,
            },
            ValueError,
        ),
    ],
)
def test_invalid_evaluation_configuration_fails_closed(
    kwargs,
    error,
):
    parameters = {
        "feature_columns": FEATURES,
        "min_history": 3,
        "robust_threshold": 3.5,
        "n_estimators": 64,
        "contamination": "auto",
        "random_state": 42,
    }

    parameters.update(kwargs)

    with pytest.raises(error):
        evaluate_reconciliation_quality(
            (),
            make_report(),
            **parameters,
        )
