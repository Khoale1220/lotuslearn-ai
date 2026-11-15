"""Deterministic analytical event IDs compatible with TypeScript."""

from __future__ import annotations

import hashlib
from typing import Literal, TypeAlias

AnalyticalEventType: TypeAlias = Literal[
    "ANALYSIS_INGESTED",
    "FINDING_IDENTIFIED",
    "GROUP_FORMED",
    "VERIFICATION_AUDITED",
    "DECISION_RECORDED",
]


def compute_event_id(
    event_type: AnalyticalEventType,
    analysis_run_id: str,
    business_key: str,
) -> str:
    """Generate the exact TypeScript SHA-256 event identifier.

    Match analyticalEventProducer.ts:
    SHA256(UTF8(eventType:analysisRunId:businessKey)).

    Preserve the original delimiter and UTF-8 behavior.
    Empty strings are permitted to maintain source parity.
    """

    values = (event_type, analysis_run_id, business_key)

    if not all(isinstance(value, str) for value in values):
        raise TypeError("Event ID inputs must be strings")

    payload = f"{event_type}:{analysis_run_id}:{business_key}"

    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
