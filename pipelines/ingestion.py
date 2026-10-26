"""Ingestion gate and zero-PII validation for LotusLearn analytical events."""

import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from jsonschema.validators import Draft202012Validator

from pipelines.models import IngestionOutcome, IngestionResult

SCHEMA_PATH = Path(__file__).resolve().parent.parent / "contracts" / "analytical_event.schema.json"

EMAIL_REGEX = re.compile(r"\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b")
PHONE_REGEX = re.compile(r"\b(?:\+?1[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]\d{3}[-.\s]\d{4}\b")

FORBIDDEN_KEYS = {
    "studentText",
    "student_text",
    "rawText",
    "raw_text",
    "imageBase64",
    "image_base64",
    "apiKey",
    "api_key",
    "prompt",
}


class AnalyticalEventValidator:
    """Validates analytical events against the canonical JSON Schema and strict privacy gates."""

    def __init__(self, schema_path: Optional[Path] = None):
        target_path = schema_path or SCHEMA_PATH
        if not target_path.exists():
            raise FileNotFoundError(f"Canonical schema not found at {target_path}")

        with open(target_path, "r", encoding="utf-8") as f:
            self._schema = json.load(f)

        Draft202012Validator.check_schema(self._schema)
        self._validator = Draft202012Validator(self._schema)

    def validate_schema(self, event_dict: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate structure against Draft 2020-12 schema."""
        errors = list(self._validator.iter_errors(event_dict))
        if not errors:
            return True, None

        # Format a safe diagnostic path without echoing payload content
        first_err = errors[0]
        path = ".".join(str(p) for p in first_err.absolute_path) or "root"
        rule = first_err.validator or "contract"
        safe_reason = f"SCHEMA_VALIDATION_FAILED: path '{path}' violated rule '{rule}'"
        return False, safe_reason

    def validate_privacy(self, event_dict: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """
        Enforce fail-closed zero-PII check.
        Never echo or log candidate PII text in error diagnostics.
        """
        # Check forbidden keys recursively
        def check_forbidden_keys(node: Any) -> Optional[str]:
            if isinstance(node, dict):
                for k, v in node.items():
                    if k in FORBIDDEN_KEYS:
                        return f"FORBIDDEN_KEY_DETECTED: '{k}'"
                    sub_err = check_forbidden_keys(v)
                    if sub_err:
                        return sub_err
            elif isinstance(node, list):
                for item in node:
                    sub_err = check_forbidden_keys(item)
                    if sub_err:
                        return sub_err
            return None

        key_err = check_forbidden_keys(event_dict)
        if key_err:
            return False, key_err

        # Check for unmasked email or phone patterns in string fields (excluding hashes/dates)
        def scan_strings(node: Any, parent_key: str = "") -> Optional[str]:
            if isinstance(node, str):
                if parent_key in {"event_id", "dataset_fingerprint", "occurred_at"}:
                    return None
                if EMAIL_REGEX.search(node):
                    return "PII_EMAIL_DETECTED: unmasked email address found in payload"
                if PHONE_REGEX.search(node):
                    return "PII_PHONE_DETECTED: unmasked phone number found in payload"
            elif isinstance(node, dict):
                for k, v in node.items():
                    err = scan_strings(v, k)
                    if err:
                        return err
            elif isinstance(node, list):
                for item in node:
                    err = scan_strings(item, parent_key)
                    if err:
                        return err
            return None

        string_err = scan_strings(event_dict)
        if string_err:
            return False, string_err

        return True, None

    def validate_event(
        self,
        event_dict: Dict[str, Any],
        seen_event_ids: Optional[Set[str]] = None,
    ) -> IngestionResult:
        """Run complete validation pipeline on a single candidate event."""
        if not isinstance(event_dict, dict):
            return IngestionResult(
                event_id="unknown",
                outcome=IngestionOutcome.REJECTED,
                rejection_reason="PAYLOAD_NOT_OBJECT: expected JSON object",
            )

        event_id = str(event_dict.get("event_id", "missing_id"))
        event_type = event_dict.get("event_type")

        # 1. Privacy Gate
        is_privacy_ok, privacy_reason = self.validate_privacy(event_dict)
        if not is_privacy_ok:
            return IngestionResult(
                event_id=event_id,
                outcome=IngestionOutcome.REJECTED,
                rejection_reason=privacy_reason,
                event_type=event_type,
            )

        # 2. Schema Gate
        is_schema_ok, schema_reason = self.validate_schema(event_dict)
        if not is_schema_ok:
            return IngestionResult(
                event_id=event_id,
                outcome=IngestionOutcome.REJECTED,
                rejection_reason=schema_reason,
                event_type=event_type,
            )

        # 3. Deduplication Check
        if seen_event_ids is not None and event_id in seen_event_ids:
            return IngestionResult(
                event_id=event_id,
                outcome=IngestionOutcome.DUPLICATE,
                rejection_reason="DUPLICATE_EVENT_ID: event has already been ingested",
                event_type=event_type,
            )

        return IngestionResult(
            event_id=event_id,
            outcome=IngestionOutcome.ACCEPTED,
            event_type=event_type,
        )


def validate_event_batch(
    events: List[Dict[str, Any]],
    existing_ids: Optional[Set[str]] = None,
    validator: Optional[AnalyticalEventValidator] = None,
) -> Tuple[List[IngestionResult], List[Dict[str, Any]]]:
    """
    Validates a batch of events.
    Returns:
      - list of IngestionResults (accepted, duplicate, rejected)
      - list of accepted event dictionaries ready for relational storage
    """
    val = validator or AnalyticalEventValidator()
    seen_ids: Set[str] = set(existing_ids or ())
    results: List[IngestionResult] = []
    accepted_events: List[Dict[str, Any]] = []

    for event in events:
        res = val.validate_event(event, seen_event_ids=seen_ids)
        results.append(res)
        if res.outcome == IngestionOutcome.ACCEPTED:
            seen_ids.add(res.event_id)
            accepted_events.append(event)

    return results, accepted_events
