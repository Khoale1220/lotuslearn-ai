from __future__ import annotations

import inspect
import os
from pathlib import Path
from urllib.parse import urlparse
from uuid import uuid4

import psycopg
import pytest

import lotuslearn_pipeline.teacher_interventions as repository_module
from lotuslearn_pipeline.teacher_interventions import (
    canonicalize_teacher_intervention,
    load_teacher_intervention,
    persist_teacher_intervention,
)


PIPELINES_ROOT = Path(__file__).resolve().parents[1]

MIGRATION_PATH = (
    PIPELINES_ROOT
    / "src"
    / "lotuslearn_pipeline"
    / "migrations"
    / "postgres"
    / "0017_teacher_interventions.sql"
)


def _safe_test_url() -> str:
    for name in (
        "LOTUSLEARN_POSTGRES_TEST_URL",
        "POSTGRES_TEST_URL",
        "LOTUSLEARN_DATABASE_URL",
    ):
        value = os.environ.get(name)

        if value:
            parsed = urlparse(value)

            if parsed.hostname not in {
                "127.0.0.1",
                "localhost",
                "::1",
            }:
                raise RuntimeError(
                    "Refusing PostgreSQL teacher-intervention "
                    "test outside loopback"
                )

            if parsed.path != "/lotuslearn_test":
                raise RuntimeError(
                    "Refusing PostgreSQL teacher-intervention "
                    "test outside lotuslearn_test"
                )

            return value

    raise RuntimeError(
        "Dedicated safe PostgreSQL test URL is not configured"
    )


def _apply_migration(connection: psycopg.Connection) -> None:
    migration = MIGRATION_PATH.read_text(
        encoding="utf-8"
    )

    for fragment in migration.split(";"):
        statement = fragment.strip()

        if statement:
            connection.execute(statement)


@pytest.fixture(scope="module")
def database_url() -> str:
    return _safe_test_url()


@pytest.fixture(scope="module", autouse=True)
def installed_schema(database_url: str) -> None:
    with psycopg.connect(
        database_url,
        autocommit=True,
    ) as connection:
        _apply_migration(connection)

        # Migration must be replay-safe.
        _apply_migration(connection)


def _command(
    *,
    intervention_key: str | None = None,
    student_key: str = "student-demo-001",
    action_type: str = "reteach",
    analysis_key: str | None = "analysis-demo-001",
) -> dict[str, object]:
    return {
        "interventionKey": (
            intervention_key
            if intervention_key is not None
            else str(uuid4())
        ),
        "studentKey": student_key,
        "actionType": action_type,
        "analysisKey": analysis_key,
        "createdAt": "2026-11-23T08:00:00Z",
        "provenance": {
            "source": "classroom-world",
            "policy": "teacher-confirmed",
        },
    }


def test_migration_installs_append_only_identity_contract(
    database_url: str,
) -> None:
    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    column_name,
                    data_type,
                    is_nullable,
                    column_default
                FROM information_schema.columns
                WHERE
                    table_schema = 'public'
                    AND table_name = 'teacher_interventions'
                ORDER BY ordinal_position
                """
            )

            rows = cursor.fetchall()

    columns = {
        row[0]: {
            "type": row[1],
            "nullable": row[2],
            "default": row[3],
        }
        for row in rows
    }

    assert set(columns) == {
        "intervention_key",
        "student_key",
        "action_type",
        "analysis_key",
        "created_at",
        "provenance",
        "persisted_at",
    }

    assert columns["intervention_key"]["type"] == "uuid"
    assert columns["intervention_key"]["nullable"] == "NO"

    # App owns identity. PostgreSQL must not generate UUIDs.
    assert columns["intervention_key"]["default"] is None

    assert (
        columns["persisted_at"]["default"]
        is not None
    )


def test_persist_round_trip_and_identical_replay_is_idempotent(
    database_url: str,
) -> None:
    command = _command()

    connection = psycopg.connect(database_url)

    try:
        with connection.cursor() as cursor:
            first, first_created = (
                persist_teacher_intervention(
                    cursor,
                    command,
                )
            )

            second, second_created = (
                persist_teacher_intervention(
                    cursor,
                    command,
                )
            )

            loaded = load_teacher_intervention(
                cursor,
                command["interventionKey"],
            )

        assert first_created is True
        assert second_created is False
        assert first == second
        assert loaded == first

        assert first["interventionKey"] == (
            command["interventionKey"]
        )
        assert first["studentKey"] == "student-demo-001"
        assert first["actionType"] == "reteach"
        assert first["analysisKey"] == "analysis-demo-001"

    finally:
        connection.rollback()
        connection.close()


def test_conflicting_identity_replay_fails_closed(
    database_url: str,
) -> None:
    intervention_key = str(uuid4())

    first = _command(
        intervention_key=intervention_key,
        action_type="reteach",
    )

    conflicting = _command(
        intervention_key=intervention_key,
        action_type="conference",
    )

    connection = psycopg.connect(database_url)

    try:
        with connection.cursor() as cursor:
            persisted, created = (
                persist_teacher_intervention(
                    cursor,
                    first,
                )
            )

            assert created is True
            assert persisted["actionType"] == "reteach"

            with pytest.raises(
                ValueError,
                match="different canonical payload",
            ):
                persist_teacher_intervention(
                    cursor,
                    conflicting,
                )

    finally:
        connection.rollback()
        connection.close()


def test_unknown_and_privacy_fields_are_rejected_before_write() -> None:
    command = _command()

    command["studentName"] = "forbidden"

    with pytest.raises(
        ValueError,
        match="unsupported intervention fields",
    ):
        canonicalize_teacher_intervention(command)

    missing_identity = _command()
    del missing_identity["interventionKey"]

    with pytest.raises(
        ValueError,
        match="missing intervention fields",
    ):
        canonicalize_teacher_intervention(
            missing_identity
        )


def test_created_at_requires_timezone() -> None:
    command = _command()
    command["createdAt"] = "2026-11-23T08:00:00"

    with pytest.raises(
        ValueError,
        match="include a timezone",
    ):
        canonicalize_teacher_intervention(command)


def test_unknown_identity_load_returns_none(
    database_url: str,
) -> None:
    connection = psycopg.connect(database_url)

    try:
        with connection.cursor() as cursor:
            assert (
                load_teacher_intervention(
                    cursor,
                    str(uuid4()),
                )
                is None
            )
    finally:
        connection.rollback()
        connection.close()


def test_repository_does_not_own_postgres_connection() -> None:
    source = inspect.getsource(repository_module)

    assert "psycopg.connect" not in source
    assert "connect(" not in source


def test_persistence_surface_contains_no_raw_student_fields() -> None:
    repository_source = inspect.getsource(
        repository_module
    ).lower()

    migration_source = MIGRATION_PATH.read_text(
        encoding="utf-8"
    ).lower()

    combined = repository_source + migration_source

    for forbidden in (
        "rawsubmission",
        "raw_submissions",
        "studentname",
        "student_name",
        "email",
    ):
        assert forbidden not in combined