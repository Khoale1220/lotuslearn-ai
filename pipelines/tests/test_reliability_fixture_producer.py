"""Tests for Python reliability-fixture production."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import lotuslearn_pipeline.reliability_fixture_producer as producer
from lotuslearn_pipeline.reliability_fixture_producer import (
    generate_reliability_suite,
    render_reliability_fixture,
)

FIXTURE = Path(__file__).parent / "fixtures" / "reliability_events.json"


def test_python_producer_is_byte_identical_to_fixture() -> None:
    assert render_reliability_fixture() == FIXTURE.read_text(encoding="utf-8")


def test_python_producer_is_deterministic() -> None:
    expected = render_reliability_fixture()

    for _ in range(100):
        assert render_reliability_fixture() == expected


def test_python_producer_returns_fresh_objects() -> None:
    first = generate_reliability_suite()
    second = generate_reliability_suite()

    assert first == second
    assert first is not second

    first["standardBatch"][0]["subject"] = "mutated"

    assert second["standardBatch"][0]["subject"] == "Mathematics"


def test_privacy_gate_applied_at_legacy_boundary(
    monkeypatch,
) -> None:
    validated: list[str] = []

    def record_validation(
        event: dict[str, object],
    ) -> None:
        validated.append(str(event["event_id"]))

    monkeypatch.setattr(
        producer,
        "assert_zero_pii",
        record_validation,
    )

    suite = producer.generate_reliability_suite()

    assert len(validated) == 9

    expected_ids = [str(event["event_id"]) for event in suite["standardBatch"]]

    expected_ids.extend(
        [
            str(suite["equalTimestampDecisions"]["decisionA"]["event_id"]),
            str(suite["equalTimestampDecisions"]["decisionB"]["event_id"]),
        ]
    )

    assert validated == expected_ids


def test_replay_pair_uses_distinct_mapping_instances() -> None:
    suite = generate_reliability_suite()

    pair = suite["replayPair"]

    assert pair["original"] == pair["replay"]
    assert pair["original"] is not pair["replay"]


def test_payload_conflict_isolated_from_original() -> None:
    suite = generate_reliability_suite()

    pair = suite["payloadConflictPair"]

    assert pair["original"]["event_id"] == pair["conflicting"]["event_id"]

    assert pair["original"]["subject"] == "Mathematics"
    assert pair["conflicting"]["subject"] == "Algebra I Honors"

    assert pair["original"] is not pair["conflicting"]


def test_module_cli_is_byte_identical_to_fixture() -> None:
    completed = subprocess.run(
        [
            sys.executable,
            "-m",
            "lotuslearn_pipeline.reliability_fixture_producer",
        ],
        check=True,
        capture_output=True,
        text=True,
    )

    assert completed.stderr == ""

    assert completed.stdout == FIXTURE.read_text(encoding="utf-8")


def test_serialized_output_is_valid_json() -> None:
    rendered = render_reliability_fixture()

    assert json.loads(rendered) == generate_reliability_suite()
