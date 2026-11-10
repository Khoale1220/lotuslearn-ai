"""Ingestion gate and zero-PII validation for LotusLearn analytical events."""

import hashlib
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from lotuslearn_pipeline.contracts import get_schema_validator
from lotuslearn_pipeline.models import IngestionOutcome, IngestionResult

EMAIL_REGEX = re.compile(r"\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b")

# Matches US numbers (+1-xxx-xxx-xxxx, (xxx) xxx-xxxx), VN numbers (+84/0 followed by 9-10 digits),
# and general E.164-style international phone numbers with spaces/dashes.
PHONE_REGEX = re.compile(
    r"(?:"
    r"\b(?:\+?1[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]\d{3}[-.\s]\d{4}\b|"
    r"\b(?:\+?84|0)(?:3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])[-.\s]?\d{3}[-.\s]?\d{4}\b|"
    r"\b(?:\+?84|0)2[0-9][-.\s]?\d{4}[-.\s]?\d{4}\b|"
    r"\b\+\d{1,3}[-.\s]?(?:\(\d{1,4}\)|\d{1,4})[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b"
    r")"
)

HEX_64_REGEX = re.compile(r"^[0-9a-f]{64}$")

ALLOWED_EVENT_TYPES = frozenset({
    "ANALYSIS_INGESTED",
    "FINDING_IDENTIFIED",
    "GROUP_FORMED",
    "VERIFICATION_AUDITED",
    "DECISION_RECORDED",
})

SUPPORTED_SCHEMA_VERSIONS = frozenset({"1.0.0"})

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


def sanitize_event_id(raw_event_id: Any) -> str:
    """
    Ensure event_id is safe to persist in audit logs and diagnostics.

    If raw_event_id is a valid canonical 64-hex SHA-256 digest, it is returned as-is.
    If it is missing, non-string, or malformed/untrusted, it is transformed into a
    deterministic, non-reversible synthetic identifier to prevent PII leakage.
    """
    if isinstance(raw_event_id, str) and HEX_64_REGEX.fullmatch(raw_event_id):
        return raw_event_id
    if raw_event_id is None or raw_event_id == "":
        return "missing_id"
    digest = hashlib.sha256(str(raw_event_id).encode("utf-8")).hexdigest()
    return f"unvalidated_{digest[:16]}"


def sanitize_event_type(raw_event_type: Any) -> Optional[str]:
    """Ensure event_type is one of the strictly allowed canonical domain event types."""
    if isinstance(raw_event_type, str) and raw_event_type in ALLOWED_EVENT_TYPES:
        return raw_event_type
    return None


class AnalyticalEventValidator:
    """Validates analytical events against canonical JSON Schema Draft 2020-12 and privacy gates."""

    def __init__(self, schema_path: Optional[Path] = None):
        self._validator = get_schema_validator(schema_path)

    def validate_schema(self, event_dict: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate structure and formats (including date-time) against Draft 2020-12 schema."""
        schema_version = event_dict.get("schema_version")
        if schema_version not in SUPPORTED_SCHEMA_VERSIONS:
            safe_reason = (
                f"UNSUPPORTED_SCHEMA_VERSION: version '{schema_version}' is not supported "
                f"(supported: {', '.join(sorted(SUPPORTED_SCHEMA_VERSIONS))})"
            )
            return False, safe_reason

        errors = list(self._validator.iter_errors(event_dict))
        if not errors:
            return True, None

        first_err = errors[0]
        if first_err.context:
            format_sub = [sub for sub in first_err.context if sub.validator == "format"]
            if format_sub:
                first_err = format_sub[0]
            else:
                non_prop = [
                    sub for sub in first_err.context if sub.validator != "unevaluatedProperties"
                ]
                first_err = non_prop[0] if non_prop else first_err.context[0]

        path = ".".join(str(p) for p in first_err.absolute_path) or "root"
        rule = first_err.validator or "contract"
        safe_reason = f"SCHEMA_VALIDATION_FAILED: path '{path}' violated rule '{rule}'"
        return False, safe_reason

    def validate_privacy(self, event_dict: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """
        Enforce fail-closed zero-PII check.
        Never echo or log candidate PII text in error diagnostics.
        """
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

        exempt_keys = {"dataset_fingerprint", "occurred_at", "decision_recorded_at"}

        def scan_strings(node: Any, parent_key: str = "") -> Optional[str]:
            if isinstance(node, str):
                if parent_key in exempt_keys:
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
                event_type=None,
            )

        raw_event_id = event_dict.get("event_id")
        raw_event_type = event_dict.get("event_type")
        safe_event_id = sanitize_event_id(raw_event_id)
        safe_event_type = sanitize_event_type(raw_event_type)

        # 1. Privacy Gate
        is_privacy_ok, privacy_reason = self.validate_privacy(event_dict)
        if not is_privacy_ok:
            return IngestionResult(
                event_id=safe_event_id,
                outcome=IngestionOutcome.REJECTED,
                rejection_reason=privacy_reason,
                event_type=safe_event_type,
            )

        # 2. Schema Gate
        is_schema_ok, schema_reason = self.validate_schema(event_dict)
        if not is_schema_ok:
            return IngestionResult(
                event_id=safe_event_id,
                outcome=IngestionOutcome.REJECTED,
                rejection_reason=schema_reason,
                event_type=safe_event_type,
            )

        # 3. Batch In-Memory Deduplication Check (if provided)
        canonical_event_id = str(raw_event_id)
        canonical_event_type = str(raw_event_type)

        if seen_event_ids is not None and canonical_event_id in seen_event_ids:
            return IngestionResult(
                event_id=canonical_event_id,
                outcome=IngestionOutcome.DUPLICATE,
                rejection_reason="DUPLICATE_EVENT_ID: duplicate event within batch",
                event_type=canonical_event_type,
            )

        return IngestionResult(
            event_id=canonical_event_id,
            outcome=IngestionOutcome.ACCEPTED,
            event_type=canonical_event_type,
        )


def validate_event_batch(
    events: List[Dict[str, Any]],
    existing_ids: Optional[Set[str]] = None,
    validator: Optional[AnalyticalEventValidator] = None,
) -> Tuple[List[IngestionResult], List[Dict[str, Any]]]:
    """Validates a batch of candidate events."""
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
