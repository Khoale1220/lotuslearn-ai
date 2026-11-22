"""Deterministic tests for execution SLI/SLO and error-budget semantics."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest

from lotuslearn_pipeline.execution_slo import (
    ExecutionSloStatus,
    build_execution_slo_report,
)

OBSERVED_AT = datetime(
    2026,
    11,
    22,
    3,
    0,
    0,
    tzinfo=timezone.utc,
)


def test_no_data_has_explicit_no_data_semantics():
    report = build_execution_slo_report(
        observed_at=OBSERVED_AT,
        window=timedelta(days=28),
        target=Decimal("0.99"),
        total_terminal=0,
        good_count=0,
        bad_count=0,
    )

    assert report.status is ExecutionSloStatus.NO_DATA
    assert report.window_start == OBSERVED_AT - timedelta(days=28)
    assert report.error_budget_fraction == Decimal("0.01")
    assert report.success_ratio is None
    assert report.bad_ratio is None
    assert report.burn_rate is None
    assert report.budget_remaining_ratio is None
    assert report.allowed_bad_events is None
    assert report.remaining_bad_events is None


@pytest.mark.parametrize(
    (
        "good",
        "bad",
        "expected_status",
        "expected_success_ratio",
        "expected_burn_rate",
        "expected_remaining_budget",
    ),
    (
        (
            100,
            0,
            ExecutionSloStatus.WITHIN_BUDGET,
            Decimal("1"),
            Decimal("0"),
            Decimal("1"),
        ),
        (
            99,
            1,
            ExecutionSloStatus.BUDGET_EXHAUSTED,
            Decimal("0.99"),
            Decimal("1"),
            Decimal("0"),
        ),
        (
            98,
            2,
            ExecutionSloStatus.BREACHED,
            Decimal("0.98"),
            Decimal("2"),
            Decimal("0"),
        ),
    ),
)
def test_error_budget_boundary_is_exact(
    good,
    bad,
    expected_status,
    expected_success_ratio,
    expected_burn_rate,
    expected_remaining_budget,
):
    report = build_execution_slo_report(
        observed_at=OBSERVED_AT,
        window=timedelta(days=28),
        target=Decimal("0.99"),
        total_terminal=100,
        good_count=good,
        bad_count=bad,
    )

    assert report.status is expected_status
    assert report.success_ratio == expected_success_ratio
    assert report.burn_rate == expected_burn_rate
    assert report.budget_remaining_ratio == expected_remaining_budget
    assert report.allowed_bad_events == Decimal("1")

    expected_remaining_events = max(
        Decimal("0"),
        Decimal("1") - Decimal(bad),
    )
    assert report.remaining_bad_events == expected_remaining_events


def test_bad_ratio_and_burn_rate_are_derived_from_counts():
    report = build_execution_slo_report(
        observed_at=OBSERVED_AT,
        window=timedelta(days=28),
        target=Decimal("0.995"),
        total_terminal=200,
        good_count=198,
        bad_count=2,
    )

    assert report.error_budget_fraction == Decimal("0.005")
    assert report.bad_ratio == Decimal("0.01")
    assert report.burn_rate == Decimal("2")
    assert report.status is ExecutionSloStatus.BREACHED


def test_observed_at_is_normalized_to_utc():
    report = build_execution_slo_report(
        observed_at=datetime.fromisoformat("2026-11-22T10:00:00+07:00"),
        window=timedelta(days=28),
        target="0.99",
        total_terminal=1,
        good_count=1,
        bad_count=0,
    )

    assert report.observed_at == OBSERVED_AT


@pytest.mark.parametrize(
    "target",
    (
        Decimal("0"),
        Decimal("1"),
        Decimal("-0.1"),
        Decimal("1.1"),
        Decimal("NaN"),
        Decimal("Infinity"),
    ),
)
def test_invalid_targets_are_rejected(target):
    with pytest.raises(ValueError):
        build_execution_slo_report(
            observed_at=OBSERVED_AT,
            window=timedelta(days=28),
            target=target,
            total_terminal=1,
            good_count=1,
            bad_count=0,
        )


def test_boolean_target_is_rejected():
    with pytest.raises(TypeError):
        build_execution_slo_report(
            observed_at=OBSERVED_AT,
            window=timedelta(days=28),
            target=True,
            total_terminal=1,
            good_count=1,
            bad_count=0,
        )


@pytest.mark.parametrize(
    "window",
    (
        timedelta(0),
        timedelta(seconds=-1),
        timedelta(days=367),
    ),
)
def test_invalid_windows_are_rejected(window):
    with pytest.raises(ValueError):
        build_execution_slo_report(
            observed_at=OBSERVED_AT,
            window=window,
            target="0.99",
            total_terminal=1,
            good_count=1,
            bad_count=0,
        )


def test_naive_observed_at_is_rejected():
    with pytest.raises(ValueError):
        build_execution_slo_report(
            observed_at=datetime(2026, 11, 22, 3, 0, 0),
            window=timedelta(days=28),
            target="0.99",
            total_terminal=1,
            good_count=1,
            bad_count=0,
        )


@pytest.mark.parametrize(
    ("total", "good", "bad"),
    (
        (2, 1, 0),
        (2, 0, 1),
        (1, 1, 1),
    ),
)
def test_accounting_mismatch_fails_closed(total, good, bad):
    with pytest.raises(ValueError):
        build_execution_slo_report(
            observed_at=OBSERVED_AT,
            window=timedelta(days=28),
            target="0.99",
            total_terminal=total,
            good_count=good,
            bad_count=bad,
        )


@pytest.mark.parametrize(
    ("field", "value"),
    (
        ("total_terminal", -1),
        ("good_count", -1),
        ("bad_count", -1),
        ("total_terminal", True),
        ("good_count", True),
        ("bad_count", True),
    ),
)
def test_invalid_counts_fail_closed(field, value):
    args = {
        "observed_at": OBSERVED_AT,
        "window": timedelta(days=28),
        "target": "0.99",
        "total_terminal": 1,
        "good_count": 1,
        "bad_count": 0,
    }

    args[field] = value

    with pytest.raises((TypeError, ValueError)):
        build_execution_slo_report(**args)
