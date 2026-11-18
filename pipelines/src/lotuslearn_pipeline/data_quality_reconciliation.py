"""Deterministic source-to-target data quality reconciliation.

This module is intentionally separate from ``reconciliation.py``.

``reconciliation.py`` reconciles operational batch execution outcomes.
This module reconciles dataset contents and produces deterministic quality
evidence suitable for later persistence, statistical baselines, and anomaly
detection.

No database, dataframe, or machine-learning dependency belongs in this layer.
"""

from __future__ import annotations

import hashlib
import json
import math
from collections import Counter
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from datetime import date, datetime, time
from decimal import Decimal
from enum import Enum
from typing import Any
from uuid import UUID


class DataQualityStatus(str, Enum):
    """Outcome of a deterministic dataset reconciliation."""

    PASS = "PASS"
    FAIL = "FAIL"


MetricValue = int | float | str


@dataclass(frozen=True, slots=True)
class FieldNullProfile:
    """Null statistics for one tracked field."""

    field_name: str
    null_count: int
    null_rate: float


@dataclass(frozen=True, slots=True)
class DatasetProfile:
    """Deterministic profile of one dataset snapshot."""

    row_count: int
    distinct_key_count: int
    duplicate_key_count: int
    field_nulls: tuple[FieldNullProfile, ...]
    digest: str

    def field(self, field_name: str) -> FieldNullProfile:
        """Return null statistics for a tracked field."""

        for profile in self.field_nulls:
            if profile.field_name == field_name:
                return profile

        raise KeyError(field_name)


@dataclass(frozen=True, slots=True)
class MetricComparison:
    """Exact source-to-target comparison for one quality metric."""

    name: str
    source_value: MetricValue
    target_value: MetricValue
    delta: int | float | None
    status: DataQualityStatus


@dataclass(frozen=True, slots=True)
class KeyDifference:
    """Multiplicity-aware key discrepancy."""

    key: str
    count: int


@dataclass(frozen=True, slots=True)
class DatasetReconciliationReport:
    """Complete deterministic evidence for one source/target comparison."""

    source: DatasetProfile
    target: DatasetProfile
    metrics: tuple[MetricComparison, ...]
    missing_from_target: tuple[KeyDifference, ...]
    extra_in_target: tuple[KeyDifference, ...]
    status: DataQualityStatus

    @property
    def failed_metrics(self) -> tuple[MetricComparison, ...]:
        """Return only metrics that failed exact reconciliation."""

        return tuple(metric for metric in self.metrics if metric.status is DataQualityStatus.FAIL)

    def metric(self, name: str) -> MetricComparison:
        """Return a metric by its stable identifier."""

        for metric in self.metrics:
            if metric.name == name:
                return metric

        raise KeyError(name)


def _normalize_field_names(
    fields: Sequence[str],
    *,
    label: str,
    require_nonempty: bool,
) -> tuple[str, ...]:
    if isinstance(fields, (str, bytes)):
        raise TypeError(f"{label} must be a sequence of field names")

    normalized = tuple(fields)

    if require_nonempty and not normalized:
        raise ValueError(f"{label} must contain at least one field")

    if any(not isinstance(field, str) or not field for field in normalized):
        raise ValueError(f"{label} must contain non-empty strings")

    if len(set(normalized)) != len(normalized):
        raise ValueError(f"{label} must not contain duplicate field names")

    return normalized


def _materialize_rows(
    rows: Iterable[Mapping[str, Any]],
) -> tuple[dict[str, Any], ...]:
    materialized: list[dict[str, Any]] = []

    for index, row in enumerate(rows):
        if not isinstance(row, Mapping):
            raise TypeError(f"Row {index} must be a mapping")

        if any(not isinstance(field, str) or not field for field in row):
            raise TypeError(f"Row {index} contains an invalid field name")

        materialized.append(dict(row))

    return tuple(materialized)


def _canonicalize(value: Any) -> Any:
    if isinstance(value, Enum):
        return {
            "__lotuslearn_type__": "enum",
            "value": _canonicalize(value.value),
        }

    if value is None or isinstance(value, (bool, int, str)):
        return value

    if isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError("Non-finite floating-point values are not supported")
        return value

    if isinstance(value, Decimal):
        if not value.is_finite():
            raise ValueError("Non-finite Decimal values are not supported")
        return {
            "__lotuslearn_type__": "decimal",
            "value": str(value.normalize()),
        }

    if isinstance(value, datetime):
        return {
            "__lotuslearn_type__": "datetime",
            "value": value.isoformat(),
        }

    if isinstance(value, date):
        return {
            "__lotuslearn_type__": "date",
            "value": value.isoformat(),
        }

    if isinstance(value, time):
        return {
            "__lotuslearn_type__": "time",
            "value": value.isoformat(),
        }

    if isinstance(value, UUID):
        return {
            "__lotuslearn_type__": "uuid",
            "value": str(value),
        }

    if isinstance(value, bytes):
        return {
            "__lotuslearn_type__": "bytes",
            "value": value.hex(),
        }

    if isinstance(value, Mapping):
        if any(not isinstance(key, str) for key in value):
            raise TypeError("Nested mapping keys must be strings")

        return {key: _canonicalize(value[key]) for key in sorted(value)}

    if isinstance(value, (list, tuple)):
        return [_canonicalize(item) for item in value]

    if isinstance(value, (set, frozenset)):
        normalized = [_canonicalize(item) for item in value]
        normalized.sort(
            key=lambda item: json.dumps(
                item,
                ensure_ascii=False,
                separators=(",", ":"),
                sort_keys=True,
            )
        )
        return {
            "__lotuslearn_type__": "set",
            "value": normalized,
        }

    raise TypeError(f"Unsupported data-quality reconciliation value type: {type(value).__name__}")


def _canonical_json(value: Any) -> str:
    return json.dumps(
        _canonicalize(value),
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def _dataset_digest(rows: Sequence[Mapping[str, Any]]) -> str:
    """Build an order-independent, multiplicity-preserving dataset digest."""

    payloads = sorted(_canonical_json(row) for row in rows)

    digest = hashlib.sha256()

    for payload in payloads:
        encoded = payload.encode("utf-8")

        # Length-prefixing prevents ambiguous concatenation boundaries.
        digest.update(len(encoded).to_bytes(8, byteorder="big"))
        digest.update(encoded)

    return digest.hexdigest()


def _key_token(
    row: Mapping[str, Any],
    *,
    key_fields: tuple[str, ...],
    row_index: int,
) -> str:
    missing = [field for field in key_fields if field not in row]

    if missing:
        fields = ", ".join(missing)
        raise ValueError(f"Row {row_index} is missing reconciliation key fields: {fields}")

    return _canonical_json([row[field] for field in key_fields])


def _resolve_tracked_fields(
    source_rows: Sequence[Mapping[str, Any]],
    target_rows: Sequence[Mapping[str, Any]],
    tracked_fields: Sequence[str] | None,
) -> tuple[str, ...]:
    if tracked_fields is not None:
        return _normalize_field_names(
            tracked_fields,
            label="tracked_fields",
            require_nonempty=False,
        )

    discovered = {field for row in (*source_rows, *target_rows) for field in row}

    return tuple(sorted(discovered))


def _profile_materialized(
    rows: Sequence[Mapping[str, Any]],
    *,
    key_fields: tuple[str, ...],
    tracked_fields: tuple[str, ...],
) -> tuple[DatasetProfile, Counter[str]]:
    key_counts: Counter[str] = Counter(
        _key_token(
            row,
            key_fields=key_fields,
            row_index=index,
        )
        for index, row in enumerate(rows)
    )

    row_count = len(rows)
    distinct_key_count = len(key_counts)

    field_nulls: list[FieldNullProfile] = []

    for field in tracked_fields:
        null_count = sum(1 for row in rows if field not in row or row[field] is None)

        null_rate = null_count / row_count if row_count else 0.0

        field_nulls.append(
            FieldNullProfile(
                field_name=field,
                null_count=null_count,
                null_rate=null_rate,
            )
        )

    return (
        DatasetProfile(
            row_count=row_count,
            distinct_key_count=distinct_key_count,
            duplicate_key_count=row_count - distinct_key_count,
            field_nulls=tuple(field_nulls),
            digest=_dataset_digest(rows),
        ),
        key_counts,
    )


def profile_dataset(
    rows: Iterable[Mapping[str, Any]],
    *,
    key_fields: Sequence[str],
    tracked_fields: Sequence[str] | None = None,
) -> DatasetProfile:
    """Build deterministic quality evidence for one dataset."""

    normalized_keys = _normalize_field_names(
        key_fields,
        label="key_fields",
        require_nonempty=True,
    )

    materialized = _materialize_rows(rows)

    normalized_tracked = _resolve_tracked_fields(
        materialized,
        (),
        tracked_fields,
    )

    profile, _ = _profile_materialized(
        materialized,
        key_fields=normalized_keys,
        tracked_fields=normalized_tracked,
    )

    return profile


def _comparison(
    name: str,
    source_value: MetricValue,
    target_value: MetricValue,
) -> MetricComparison:
    status = DataQualityStatus.PASS if source_value == target_value else DataQualityStatus.FAIL

    delta: int | float | None = None

    source_numeric = isinstance(source_value, (int, float)) and not isinstance(source_value, bool)
    target_numeric = isinstance(target_value, (int, float)) and not isinstance(target_value, bool)

    if source_numeric and target_numeric:
        delta = target_value - source_value

    return MetricComparison(
        name=name,
        source_value=source_value,
        target_value=target_value,
        delta=delta,
        status=status,
    )


def _key_differences(
    left: Counter[str],
    right: Counter[str],
) -> tuple[KeyDifference, ...]:
    difference = left - right

    return tuple(
        KeyDifference(
            key=key,
            count=count,
        )
        for key, count in sorted(difference.items())
    )


def reconcile_datasets(
    source_rows: Iterable[Mapping[str, Any]],
    target_rows: Iterable[Mapping[str, Any]],
    *,
    key_fields: Sequence[str],
    tracked_fields: Sequence[str] | None = None,
) -> DatasetReconciliationReport:
    """Reconcile source and target datasets with deterministic evidence.

    Properties:

    - input iterables are materialized exactly once;
    - dataset row order does not affect reconciliation;
    - duplicate-key multiplicity is preserved;
    - missing tracked fields are treated as null values;
    - key differences are multiplicity-aware;
    - digest detects value drift even when aggregate counts match.
    """

    normalized_keys = _normalize_field_names(
        key_fields,
        label="key_fields",
        require_nonempty=True,
    )

    source_materialized = _materialize_rows(source_rows)
    target_materialized = _materialize_rows(target_rows)

    normalized_tracked = _resolve_tracked_fields(
        source_materialized,
        target_materialized,
        tracked_fields,
    )

    source, source_keys = _profile_materialized(
        source_materialized,
        key_fields=normalized_keys,
        tracked_fields=normalized_tracked,
    )
    target, target_keys = _profile_materialized(
        target_materialized,
        key_fields=normalized_keys,
        tracked_fields=normalized_tracked,
    )

    missing_from_target = _key_differences(
        source_keys,
        target_keys,
    )
    extra_in_target = _key_differences(
        target_keys,
        source_keys,
    )

    metrics: list[MetricComparison] = [
        _comparison(
            "row_count",
            source.row_count,
            target.row_count,
        ),
        _comparison(
            "distinct_key_count",
            source.distinct_key_count,
            target.distinct_key_count,
        ),
        _comparison(
            "duplicate_key_count",
            source.duplicate_key_count,
            target.duplicate_key_count,
        ),
    ]

    for source_field, target_field in zip(
        source.field_nulls,
        target.field_nulls,
        strict=True,
    ):
        field = source_field.field_name

        metrics.extend(
            [
                _comparison(
                    f"field.{field}.null_count",
                    source_field.null_count,
                    target_field.null_count,
                ),
                _comparison(
                    f"field.{field}.null_rate",
                    source_field.null_rate,
                    target_field.null_rate,
                ),
            ]
        )

    metrics.append(
        _comparison(
            "digest",
            source.digest,
            target.digest,
        )
    )

    failed = any(metric.status is DataQualityStatus.FAIL for metric in metrics)

    status = (
        DataQualityStatus.FAIL
        if failed or missing_from_target or extra_in_target
        else DataQualityStatus.PASS
    )

    return DatasetReconciliationReport(
        source=source,
        target=target,
        metrics=tuple(metrics),
        missing_from_target=missing_from_target,
        extra_in_target=extra_in_target,
        status=status,
    )


__all__ = [
    "DataQualityStatus",
    "DatasetProfile",
    "DatasetReconciliationReport",
    "FieldNullProfile",
    "KeyDifference",
    "MetricComparison",
    "profile_dataset",
    "reconcile_datasets",
]
