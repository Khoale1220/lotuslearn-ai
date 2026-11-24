"""Contract tests for the Python event-ID vector generator."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from lotuslearn_pipeline.event_id_vector_generator import (
    build_event_id_vector_fixture,
    render_event_id_vector_fixture,
)

FIXTURE = Path(__file__).parent / "fixtures" / "event_id_vectors.json"


def test_python_generator_is_byte_identical_to_frozen_fixture() -> None:
    expected = FIXTURE.read_text(encoding="utf-8")

    assert render_event_id_vector_fixture() == expected


def test_python_generator_preserves_frozen_vector_contract() -> None:
    payload = build_event_id_vector_fixture()

    assert payload["schema_version"] == 1
    assert payload["source"] == "server/services/analyticalEventProducer.ts"

    vectors = payload["vectors"]

    assert isinstance(vectors, list)
    assert len(vectors) == 8

    assert vectors[0]["event_id"] == vectors[1]["event_id"]

    assert vectors[0]["event_id"] != vectors[6]["event_id"]

    assert vectors[0]["event_id"] != vectors[7]["event_id"]


def test_python_generator_is_deterministic() -> None:
    first = render_event_id_vector_fixture()

    for _ in range(100):
        assert render_event_id_vector_fixture() == first


def test_module_cli_stdout_is_byte_identical_to_fixture() -> None:
    completed = subprocess.run(
        [
            sys.executable,
            "-m",
            ("lotuslearn_pipeline.event_id_vector_generator"),
        ],
        check=True,
        capture_output=True,
        text=True,
    )

    assert completed.stderr == ""

    assert completed.stdout == FIXTURE.read_text(encoding="utf-8")
