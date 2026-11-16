from __future__ import annotations

from decimal import Decimal
from uuid import UUID

import pytest

from lotuslearn_pipeline.data_quality_reconciliation import (
    DataQualityStatus,
    profile_dataset,
    reconcile_datasets,
)


def test_identical_dataset_reconciles_independent_of_row_order():
    source = [
        {"id": "a", "score": 10, "note": None},
        {"id": "b", "score": 20, "note": "ok"},
    ]
    target = list(reversed(source))

    report = reconcile_datasets(
        source,
        target,
        key_fields=("id",),
    )

    assert report.status is DataQualityStatus.PASS
    assert report.failed_metrics == ()
    assert report.missing_from_target == ()
    assert report.extra_in_target == ()
    assert report.source.digest == report.target.digest


def test_non_key_value_drift_is_detected_when_counts_match():
    source = [{"id": "a", "score": 10}]
    target = [{"id": "a", "score": 11}]

    report = reconcile_datasets(
        source,
        target,
        key_fields=("id",),
    )

    assert report.status is DataQualityStatus.FAIL
    assert report.metric("row_count").status is DataQualityStatus.PASS
    assert report.metric("distinct_key_count").status is DataQualityStatus.PASS
    assert report.metric("digest").status is DataQualityStatus.FAIL


def test_row_count_delta_is_target_minus_source():
    report = reconcile_datasets(
        [{"id": "a"}, {"id": "b"}],
        [{"id": "a"}],
        key_fields=("id",),
    )

    metric = report.metric("row_count")

    assert metric.source_value == 2
    assert metric.target_value == 1
    assert metric.delta == -1
    assert metric.status is DataQualityStatus.FAIL


def test_duplicate_key_occurrences_are_profiled():
    source = [
        {"id": "a", "value": 1},
        {"id": "a", "value": 2},
    ]
    target = [
        {"id": "a", "value": 1},
        {"id": "b", "value": 2},
    ]

    report = reconcile_datasets(
        source,
        target,
        key_fields=("id",),
    )

    assert report.source.row_count == 2
    assert report.source.distinct_key_count == 1
    assert report.source.duplicate_key_count == 1

    assert report.target.row_count == 2
    assert report.target.distinct_key_count == 2
    assert report.target.duplicate_key_count == 0

    assert report.metric("duplicate_key_count").delta == -1


def test_missing_and_extra_keys_preserve_multiplicity():
    source = [
        {"id": "a"},
        {"id": "a"},
        {"id": "b"},
    ]
    target = [
        {"id": "a"},
        {"id": "b"},
        {"id": "b"},
    ]

    report = reconcile_datasets(
        source,
        target,
        key_fields=("id",),
    )

    assert len(report.missing_from_target) == 1
    assert report.missing_from_target[0].count == 1
    assert '"a"' in report.missing_from_target[0].key

    assert len(report.extra_in_target) == 1
    assert report.extra_in_target[0].count == 1
    assert '"b"' in report.extra_in_target[0].key

    assert report.status is DataQualityStatus.FAIL


def test_composite_keys_are_supported():
    rows = [
        {"student_id": "s1", "assessment_id": "a1", "score": 8},
        {"student_id": "s1", "assessment_id": "a2", "score": 9},
    ]

    report = reconcile_datasets(
        rows,
        list(reversed(rows)),
        key_fields=("student_id", "assessment_id"),
    )

    assert report.status is DataQualityStatus.PASS
    assert report.source.distinct_key_count == 2


def test_null_count_and_rate_are_profiled_per_field():
    source = [
        {"id": "a", "email": None},
        {"id": "b", "email": "b@example.test"},
    ]
    target = [
        {"id": "a", "email": "a@example.test"},
        {"id": "b", "email": "b@example.test"},
    ]

    report = reconcile_datasets(
        source,
        target,
        key_fields=("id",),
        tracked_fields=("id", "email"),
    )

    source_email = report.source.field("email")
    target_email = report.target.field("email")

    assert source_email.null_count == 1
    assert source_email.null_rate == 0.5
    assert target_email.null_count == 0
    assert target_email.null_rate == 0.0

    assert report.metric("field.email.null_count").delta == -1
    assert report.metric("field.email.null_rate").delta == -0.5


def test_missing_tracked_field_is_treated_as_null():
    report = reconcile_datasets(
        [{"id": "a"}],
        [{"id": "a", "grade": "A"}],
        key_fields=("id",),
    )

    assert report.source.field("grade").null_count == 1
    assert report.target.field("grade").null_count == 0


def test_empty_dataset_has_stable_zero_profile():
    profile = profile_dataset(
        [],
        key_fields=("id",),
        tracked_fields=("id", "email"),
    )

    assert profile.row_count == 0
    assert profile.distinct_key_count == 0
    assert profile.duplicate_key_count == 0
    assert profile.field("id").null_count == 0
    assert profile.field("id").null_rate == 0.0
    assert profile.field("email").null_rate == 0.0
    assert len(profile.digest) == 64


def test_generator_inputs_are_materialized_once():
    source = ({"id": str(index), "value": index} for index in range(3))
    target = ({"id": str(index), "value": index} for index in range(3))

    report = reconcile_datasets(
        source,
        target,
        key_fields=("id",),
    )

    assert report.status is DataQualityStatus.PASS
    assert report.source.row_count == 3


def test_missing_key_field_is_rejected():
    with pytest.raises(
        ValueError,
        match="missing reconciliation key fields: id",
    ):
        profile_dataset(
            [{"value": 10}],
            key_fields=("id",),
        )


def test_empty_key_contract_is_rejected():
    with pytest.raises(
        ValueError,
        match="key_fields must contain at least one field",
    ):
        reconcile_datasets(
            [{"id": "a"}],
            [{"id": "a"}],
            key_fields=(),
        )


def test_key_fields_cannot_be_passed_as_single_string():
    with pytest.raises(
        TypeError,
        match="key_fields must be a sequence",
    ):
        reconcile_datasets(
            [{"id": "a"}],
            [{"id": "a"}],
            key_fields="id",
        )


@pytest.mark.parametrize(
    "value",
    [
        float("nan"),
        float("inf"),
        float("-inf"),
        Decimal("NaN"),
    ],
)
def test_non_finite_numeric_values_are_rejected(value):
    with pytest.raises(ValueError, match="Non-finite"):
        profile_dataset(
            [{"id": "a", "value": value}],
            key_fields=("id",),
        )


def test_common_typed_values_have_deterministic_digest():
    identifier = UUID("12345678-1234-5678-1234-567812345678")

    source = [
        {
            "id": identifier,
            "amount": Decimal("10.00"),
            "payload": b"abc",
            "tags": {"beta", "alpha"},
        }
    ]

    target = [
        {
            "tags": {"alpha", "beta"},
            "payload": b"abc",
            "amount": Decimal("10.0"),
            "id": identifier,
        }
    ]

    report = reconcile_datasets(
        source,
        target,
        key_fields=("id",),
    )

    assert report.status is DataQualityStatus.PASS
    assert report.source.digest == report.target.digest
