"""Live Python composition root for the Observer stage.

This module owns orchestration only:

Observer provider request -> Gemini execution -> canonical Observer service.

Prompt construction remains in observer_provider.
Gemini transport/retry policy remains in gemini_execution.
Canonical transformation/validation remains in observer_service.
"""

from __future__ import annotations

from typing import Any, Mapping, Sequence

from lotuslearn_pipeline.gemini_execution import generate_observer_content
from lotuslearn_pipeline.observer_provider import build_observer_provider_request
from lotuslearn_pipeline.observer_service import ObserverResult, observe_submissions


def generate_observer_provider_result(
    context: Mapping[str, Any],
    submissions: Sequence[Mapping[str, Any]],
) -> Mapping[str, Any]:
    """Execute the live Observer provider through the Python Gemini boundary."""

    request = build_observer_provider_request(context, submissions)

    return generate_observer_content(
        contents=request.contents,
        config={
            "response_mime_type": request.response_mime_type,
            "response_schema": request.response_schema,
            "system_instruction": request.system_instruction,
        },
    )


def observe_submissions_live(
    context: Mapping[str, Any],
    submissions: Sequence[Mapping[str, Any]],
) -> ObserverResult:
    """Run the canonical Observer service with the live Python provider."""

    return observe_submissions(
        context,
        submissions,
        provider=generate_observer_provider_result,
    )
