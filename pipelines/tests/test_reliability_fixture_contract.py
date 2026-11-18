"""Golden characterization contract for reliability fixture ownership migration."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from lotuslearn_pipeline.analytical_event_id import (
    compute_event_id,
)

FIXTURE = (
    Path(__file__).parent
    / "fixtures"
    / "reliability_events.json"
)

EMAIL_PATTERN = re.compile(
    r"\b[a-zA-Z0-9._%+-]+@"
    r"[a-zA-Z0-9.-]+\."
    r"[a-zA-Z]{2,}\b"
)

PHONE_PATTERN = re.compile(
    r"\b(?:\+?1[-.\s]?)?"
    r"(?:\(\d{3}\)|\d{3})"
    r"[-.\s]\d{3}"
    r"[-.\s]\d{4}\b"
)

FORBIDDEN_KEYS = {
    "studentText",
    "student_text",
    "rawText",
    "raw_text",
    "imageBase64",
    "image_base64",
    "apiKey",
    "api_key",
}


def _load() -> dict[str, Any]:
    return json.loads(
        FIXTURE.read_text(
            encoding="utf-8"
        )
    )


def _events(value: Any) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []

    if isinstance(value, dict):
        required = {
            "event_id",
            "event_type",
            "analysis_run_id",
        }

        if required.issubset(value):
            found.append(value)

        for child in value.values():
            found.extend(
                _events(child)
            )

    elif isinstance(value, list):
        for child in value:
            found.extend(
                _events(child)
            )

    return found


def _assert_fixture_zero_pii(
    value: Any,
    key_name: str = "root",
) -> None:
    if isinstance(value, dict):
        assert not (
            FORBIDDEN_KEYS
            & set(value)
        )

        for key, child in value.items():
            _assert_fixture_zero_pii(
                child,
                key,
            )

    elif isinstance(value, list):
        for child in value:
            _assert_fixture_zero_pii(
                child,
                key_name,
            )

    elif isinstance(value, str):
        if key_name in {
            "event_id",
            "dataset_fingerprint",
            "occurred_at",
        }:
            return

        assert EMAIL_PATTERN.search(value) is None
        assert PHONE_PATTERN.search(value) is None


def test_top_level_contract_is_frozen() -> None:
    payload = _load()

    assert list(payload) == [
        "standardBatch",
        "replayPair",
        "payloadConflictPair",
        "analysisRunConflictPair",
        "equalTimestampDecisions",
    ]

    assert len(
        payload["standardBatch"]
    ) == 7


def test_standard_batch_order_is_frozen() -> None:
    payload = _load()

    assert [
        event["event_type"]
        for event
        in payload["standardBatch"]
    ] == [
        "ANALYSIS_INGESTED",
        "FINDING_IDENTIFIED",
        "FINDING_IDENTIFIED",
        "GROUP_FORMED",
        "VERIFICATION_AUDITED",
        "DECISION_RECORDED",
        "DECISION_RECORDED",
    ]


def test_standard_batch_event_ids() -> None:
    payload = _load()
    events = payload["standardBatch"]

    contracts = [
        (
            "ANALYSIS_INGESTED",
            "run-de02b-rel-001",
            "metadata",
        ),
        (
            "FINDING_IDENTIFIED",
            "run-de02b-rel-001",
            "cluster-fractions",
        ),
        (
            "FINDING_IDENTIFIED",
            "run-de02b-rel-001",
            "cluster-decimals",
        ),
        (
            "GROUP_FORMED",
            "run-de02b-rel-001",
            "group-fractions-lab",
        ),
        (
            "VERIFICATION_AUDITED",
            "run-de02b-rel-001",
            "audit",
        ),
        (
            "DECISION_RECORDED",
            "run-de02b-rel-001",
            "action-group-fractions-1100",
        ),
        (
            "DECISION_RECORDED",
            "run-de02b-rel-001",
            "action-group-fractions-1230",
        ),
    ]

    for event, contract in zip(
        events,
        contracts,
        strict=True,
    ):
        event_type, run_id, business_key = contract

        assert (
            event["event_id"]
            == compute_event_id(
                event_type,
                run_id,
                business_key,
            )
        )


def test_replay_pair_is_exact_replay() -> None:
    pair = _load()["replayPair"]

    assert (
        pair["original"]
        == pair["replay"]
    )


def test_payload_conflict_contract() -> None:
    pair = _load()[
        "payloadConflictPair"
    ]

    original = pair["original"]
    conflicting = pair["conflicting"]

    assert (
        original["event_id"]
        == conflicting["event_id"]
    )

    differing = {
        key
        for key in original
        if original[key]
        != conflicting[key]
    }

    assert differing == {
        "subject",
    }

    assert (
        original["subject"]
        == "Mathematics"
    )

    assert (
        conflicting["subject"]
        == "Algebra I Honors"
    )


def test_analysis_run_conflict_contract() -> None:
    pair = _load()[
        "analysisRunConflictPair"
    ]

    run_a = pair["runA"]
    run_b = pair["runB"]

    assert (
        run_a["analysis_run_id"]
        == run_b["analysis_run_id"]
        == "run-de02b-conflict-002"
    )

    assert (
        run_a["event_id"]
        == compute_event_id(
            "ANALYSIS_INGESTED",
            "run-de02b-conflict-002",
            "metadata-a",
        )
    )

    assert (
        run_b["event_id"]
        == compute_event_id(
            "ANALYSIS_INGESTED",
            "run-de02b-conflict-002",
            "metadata-b",
        )
    )

    assert (
        run_a["event_id"]
        != run_b["event_id"]
    )

    assert (
        run_a["total_duration_ms"]
        == 1200
    )

    assert (
        run_b["total_duration_ms"]
        == 9999
    )

    assert (
        run_a["execution_mode"]
        == "live_gemini"
    )

    assert (
        run_b["execution_mode"]
        == "demo_resilience"
    )


def test_equal_timestamp_decision_contract() -> None:
    pair = _load()[
        "equalTimestampDecisions"
    ]

    decision_a = pair["decisionA"]
    decision_b = pair["decisionB"]

    assert (
        decision_a["occurred_at"]
        == decision_b["occurred_at"]
        == "2026-10-26T12:00:00Z"
    )

    assert (
        decision_a["decision_recorded_at"]
        == decision_b["decision_recorded_at"]
    )

    assert (
        decision_a["target_id"]
        == decision_b["target_id"]
        == "cluster-fractions"
    )

    assert (
        decision_a["event_id"]
        == compute_event_id(
            "DECISION_RECORDED",
            "run-de02b-rel-001",
            "action-cluster-fractions-1200-a",
        )
    )

    assert (
        decision_b["event_id"]
        == compute_event_id(
            "DECISION_RECORDED",
            "run-de02b-rel-001",
            "action-cluster-fractions-1200-b",
        )
    )

    assert (
        decision_a["event_id"]
        != decision_b["event_id"]
    )


def test_all_events_preserve_zero_pii_contract() -> None:
    payload = _load()

    events = _events(payload)

    assert events

    for event in events:
        _assert_fixture_zero_pii(event)

        for key in (
            "affected_student_ids",
            "student_ids",
        ):
            if key not in event:
                continue

            assert all(
                isinstance(student_id, str)
                and student_id.strip()
                for student_id
                in event[key]
            )


def test_all_event_ids_are_lowercase_sha256() -> None:
    pattern = re.compile(
        r"^[0-9a-f]{64}$"
    )

    for event in _events(_load()):
        assert pattern.fullmatch(
            event["event_id"]
        )


def test_python_json_serialization_is_byte_exact() -> None:
    payload = _load()

    rendered = json.dumps(
        payload,
        indent=2,
        ensure_ascii=False,
    )

    assert (
        rendered
        == FIXTURE.read_text(
            encoding="utf-8"
        )
    )
