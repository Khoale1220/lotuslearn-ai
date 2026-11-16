from dataclasses import replace

from lotuslearn_pipeline.data_quality_evaluation import (
    QualityEvaluationStatus,
    evaluate_dataset_quality,
)
from lotuslearn_pipeline.data_quality_evaluation_history import (
    quality_evaluation_fingerprint,
    quality_evaluation_payload,
    reconciliation_fingerprint,
)


def make_decision():
    return evaluate_dataset_quality(
        [
            {"id": "a", "score": 10},
        ],
        [
            {"id": "a", "score": 10},
        ],
        key_fields=("id",),
        tracked_fields=("id", "score"),
        min_history=20,
    )


def test_quality_evaluation_fingerprint_is_deterministic():
    decision = make_decision()

    assert quality_evaluation_fingerprint(decision) == quality_evaluation_fingerprint(decision)

    assert len(quality_evaluation_fingerprint(decision)) == 64


def test_reconciliation_fingerprint_is_deterministic():
    decision = make_decision()

    assert reconciliation_fingerprint(decision) == reconciliation_fingerprint(decision)

    assert len(reconciliation_fingerprint(decision)) == 64


def test_payload_is_versioned_and_json_safe():
    payload = quality_evaluation_payload(make_decision())

    assert payload["schema_version"] == "1.0"

    decision = payload["decision"]

    assert decision["status"] == "PASS"
    assert decision["analytics_ready"] is False

    assert decision["reconciliation"]["status"] == "PASS"


def test_decision_change_changes_fingerprint():
    decision = make_decision()

    changed = replace(
        decision,
        status=QualityEvaluationStatus.REVIEW,
        reasons=("synthetic_review",),
    )

    assert quality_evaluation_fingerprint(decision) != quality_evaluation_fingerprint(changed)

    assert reconciliation_fingerprint(decision) == reconciliation_fingerprint(changed)
