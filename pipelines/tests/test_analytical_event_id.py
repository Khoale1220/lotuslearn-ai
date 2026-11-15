"""Cross-language golden contract for analytical event IDs."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from lotuslearn_pipeline.analytical_event_id import (
    compute_event_id,
)

FIXTURE = Path(__file__).parent / "fixtures" / "event_id_vectors.json"


def _load_vectors() -> list[dict[str, str]]:
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))

    assert data["schema_version"] == 1
    assert len(data["vectors"]) == 8

    return data["vectors"]


@pytest.mark.parametrize(
    "vector",
    _load_vectors(),
    ids=[f"typescript-vector-{i}" for i in range(1, 9)],
)
def test_typescript_golden_vector(
    vector: dict[str, str],
) -> None:
    actual = compute_event_id(
        vector["event_type"],
        vector["run_id"],
        vector["target_id"],
    )

    assert actual == vector["event_id"]
    assert len(actual) == 64
    assert actual == actual.lower()


def test_deterministic_across_repeated_calls() -> None:
    values = (
        "ANALYSIS_INGESTED",
        "run-123",
        "fingerprint-abc",
    )

    first = compute_event_id(*values)

    for _ in range(100):
        assert compute_event_id(*values) == first


def test_canonical_hash_contract() -> None:
    payload = b"ANALYSIS_INGESTED:run-123:fingerprint-abc"

    expected = hashlib.sha256(payload).hexdigest()

    assert (
        compute_event_id(
            "ANALYSIS_INGESTED",
            "run-123",
            "fingerprint-abc",
        )
        == expected
    )


def test_utf8_unicode_parity() -> None:
    actual = compute_event_id(
        "GROUP_FORMED",
        "lan-chay",
        "Tiếng Việt 日本語",
    )

    payload = ("GROUP_FORMED:lan-chay:Tiếng Việt 日本語").encode("utf-8")

    assert actual == hashlib.sha256(payload).hexdigest()


def test_empty_strings_follow_typescript() -> None:
    expected = hashlib.sha256(b"::").hexdigest()

    assert compute_event_id("", "", "") == expected


def test_input_order_is_significant() -> None:
    first = compute_event_id(
        "GROUP_FORMED",
        "run-123",
        "cluster-1",
    )

    second = compute_event_id(
        "GROUP_FORMED",
        "cluster-1",
        "run-123",
    )

    assert first != second


@pytest.mark.parametrize(
    "values",
    [
        (None, "run", "target"),
        ("ANALYSIS_INGESTED", None, "target"),
        ("ANALYSIS_INGESTED", "run", None),
        ("ANALYSIS_INGESTED", 123, "target"),
        ("ANALYSIS_INGESTED", "run", b"target"),
    ],
)
def test_non_string_inputs_rejected(values: tuple) -> None:
    with pytest.raises(TypeError):
        compute_event_id(*values)
