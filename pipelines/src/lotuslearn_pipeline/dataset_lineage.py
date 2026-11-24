"""Explicit execution-scoped dataset lineage evidence.

The module deliberately models exact input -> output dataset edges rather than
assuming that every input contributes to every output for an execution.

It stores operational metadata only. Dataset contents and student payloads are
never persisted here.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from psycopg import Connection
from psycopg.rows import dict_row

MAX_DATASET_IDENTITY_LENGTH = 2048


class DatasetLineageWriteOutcome(str, Enum):
    """Outcome of idempotently recording one lineage edge."""

    INSERTED = "INSERTED"
    EXISTING = "EXISTING"


@dataclass(frozen=True)
class DatasetRef:
    """Stable dataset identity represented by namespace and name."""

    namespace: str
    name: str

    def __post_init__(self) -> None:
        for field_name in ("namespace", "name"):
            value = getattr(self, field_name)

            if not isinstance(value, str):
                raise TypeError(f"{field_name} must be a string")

            normalized = value.strip()

            if not normalized:
                raise ValueError(f"{field_name} must not be empty")

            if "\x00" in normalized:
                raise ValueError(f"{field_name} must not contain NUL")

            if len(normalized) > MAX_DATASET_IDENTITY_LENGTH:
                raise ValueError(f"{field_name} exceeds {MAX_DATASET_IDENTITY_LENGTH} characters")

            object.__setattr__(self, field_name, normalized)


@dataclass(frozen=True)
class DatasetLineageEdge:
    """One immutable dataset dependency observed for an execution."""

    execution_id: UUID
    input_dataset: DatasetRef
    output_dataset: DatasetRef
    recorded_at: datetime


@dataclass(frozen=True)
class DatasetLineageWriteResult:
    """Result of idempotently persisting an explicit lineage edge."""

    outcome: DatasetLineageWriteOutcome
    edge: DatasetLineageEdge


def _uuid(value: UUID | str) -> UUID:
    if isinstance(value, UUID):
        return value

    if not isinstance(value, str):
        raise TypeError("execution_id must be a UUID or UUID string")

    try:
        return UUID(value)
    except ValueError:
        raise ValueError("execution_id must be a valid UUID") from None


def _edge_from_row(row: dict[str, Any]) -> DatasetLineageEdge:
    return DatasetLineageEdge(
        execution_id=_uuid(row["execution_id"]),
        input_dataset=DatasetRef(
            namespace=row["input_namespace"],
            name=row["input_name"],
        ),
        output_dataset=DatasetRef(
            namespace=row["output_namespace"],
            name=row["output_name"],
        ),
        recorded_at=row["recorded_at"],
    )


def persist_dataset_lineage_edge(
    conn: Connection[Any],
    *,
    execution_id: UUID | str,
    input_dataset: DatasetRef,
    output_dataset: DatasetRef,
) -> DatasetLineageWriteResult:
    """Idempotently persist one exact input-to-output lineage edge."""

    execution_uuid = _uuid(execution_id)

    if not isinstance(input_dataset, DatasetRef):
        raise TypeError("input_dataset must be a DatasetRef")

    if not isinstance(output_dataset, DatasetRef):
        raise TypeError("output_dataset must be a DatasetRef")

    params = (
        execution_uuid,
        input_dataset.namespace,
        input_dataset.name,
        output_dataset.namespace,
        output_dataset.name,
    )

    with conn.cursor(row_factory=dict_row) as cursor:
        cursor.execute(
            """
            INSERT INTO pipeline_execution_dataset_lineage (
                execution_id,
                input_namespace,
                input_name,
                output_namespace,
                output_name
            )
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING
            RETURNING
                execution_id,
                input_namespace,
                input_name,
                output_namespace,
                output_name,
                recorded_at
            """,
            params,
        )

        row = cursor.fetchone()

        if row is not None:
            return DatasetLineageWriteResult(
                outcome=DatasetLineageWriteOutcome.INSERTED,
                edge=_edge_from_row(row),
            )

        cursor.execute(
            """
            SELECT
                execution_id,
                input_namespace,
                input_name,
                output_namespace,
                output_name,
                recorded_at
            FROM pipeline_execution_dataset_lineage
            WHERE execution_id = %s
              AND input_namespace = %s
              AND input_name = %s
              AND output_namespace = %s
              AND output_name = %s
            """,
            params,
        )

        existing = cursor.fetchone()

    if existing is None:
        raise RuntimeError("dataset lineage insertion was suppressed but no edge exists")

    return DatasetLineageWriteResult(
        outcome=DatasetLineageWriteOutcome.EXISTING,
        edge=_edge_from_row(existing),
    )


def list_dataset_lineage_for_execution(
    conn: Connection[Any],
    *,
    execution_id: UUID | str,
    limit: int = 1000,
) -> tuple[DatasetLineageEdge, ...]:
    """Return bounded deterministic lineage evidence for one execution."""

    execution_uuid = _uuid(execution_id)

    if isinstance(limit, bool) or not isinstance(limit, int):
        raise TypeError("limit must be an integer")

    if limit < 1 or limit > 1000:
        raise ValueError("limit must be between 1 and 1000")

    with conn.cursor(row_factory=dict_row) as cursor:
        cursor.execute(
            """
            SELECT
                execution_id,
                input_namespace,
                input_name,
                output_namespace,
                output_name,
                recorded_at
            FROM pipeline_execution_dataset_lineage
            WHERE execution_id = %s
            ORDER BY
                output_namespace ASC,
                output_name ASC,
                input_namespace ASC,
                input_name ASC
            LIMIT %s
            """,
            (
                execution_uuid,
                limit,
            ),
        )

        rows = cursor.fetchall()

    return tuple(_edge_from_row(row) for row in rows)
