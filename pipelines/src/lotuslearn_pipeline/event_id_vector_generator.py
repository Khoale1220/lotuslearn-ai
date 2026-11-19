"""Generate deterministic analytical event-ID compatibility vectors."""

from __future__ import annotations

import json
import sys
from typing import Final

from lotuslearn_pipeline.analytical_event_id import (
    AnalyticalEventType,
    compute_event_id,
)

_LEGACY_SOURCE: Final = (
    "server/services/analyticalEventProducer.ts"
)

_INPUTS: Final[
    tuple[
        tuple[
            AnalyticalEventType,
            str,
            str,
        ],
        ...,
    ]
] = (
    (
        "ANALYSIS_INGESTED",
        "run-123",
        "fingerprint-abc",
    ),
    (
        "ANALYSIS_INGESTED",
        "run-123",
        "fingerprint-abc",
    ),
    (
        "FINDING_IDENTIFIED",
        "run-123",
        "cluster-1",
    ),
    (
        "GROUP_FORMED",
        "run-123",
        "group-1",
    ),
    (
        "VERIFICATION_AUDITED",
        "run-123",
        "audit",
    ),
    (
        "DECISION_RECORDED",
        "run-123",
        "action-1",
    ),
    (
        "ANALYSIS_INGESTED",
        "run-124",
        "fingerprint-abc",
    ),
    (
        "ANALYSIS_INGESTED",
        "run-123",
        "fingerprint-different",
    ),
)


def build_event_id_vector_fixture() -> dict[str, object]:
    """Build the frozen cross-language compatibility fixture."""

    vectors = []

    for event_type, run_id, target_id in _INPUTS:
        vectors.append(
            {
                "event_type": event_type,
                "run_id": run_id,
                "target_id": target_id,
                "event_id": compute_event_id(
                    event_type,
                    run_id,
                    target_id,
                ),
            }
        )

    return {
        "schema_version": 1,
        "source": _LEGACY_SOURCE,
        "vectors": vectors,
    }


def render_event_id_vector_fixture() -> str:
    """Render byte-compatible JSON with the legacy generator."""

    return (
        json.dumps(
            build_event_id_vector_fixture(),
            indent=2,
            ensure_ascii=False,
        )
        + "\n"
    )


def main() -> int:
    """Write the deterministic vector fixture to stdout."""

    sys.stdout.write(
        render_event_id_vector_fixture()
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
