from __future__ import annotations

import json
import os
import sys
from datetime import datetime
from typing import Any
from uuid import UUID

import psycopg

from lotuslearn_pipeline.teacher_interventions import (
    persist_teacher_intervention,
)


MAX_INPUT_BYTES = 64 * 1024


def _json_default(value: Any) -> Any:
    if isinstance(value, datetime):
        rendered = value.isoformat()

        if rendered.endswith("+00:00"):
            return rendered[:-6] + "Z"

        return rendered

    if isinstance(value, UUID):
        return str(value)

    raise TypeError(
        f"value of type {type(value).__name__} "
        "is not JSON serializable"
    )


def _emit(payload: dict[str, Any]) -> None:
    sys.stdout.write(
        json.dumps(
            payload,
            default=_json_default,
            separators=(",", ":"),
            ensure_ascii=False,
        )
    )
    sys.stdout.write("\n")
    sys.stdout.flush()


def _read_payload() -> dict[str, Any]:
    raw = sys.stdin.read(MAX_INPUT_BYTES + 1)

    if len(raw.encode("utf-8")) > MAX_INPUT_BYTES:
        raise ValueError(
            "request payload exceeds size limit"
        )

    if not raw.strip():
        raise ValueError(
            "request payload is empty"
        )

    payload = json.loads(raw)

    if not isinstance(payload, dict):
        raise ValueError(
            "request payload must be an object"
        )

    return payload


def _normalize_repository_result(
    result: Any,
) -> tuple[dict[str, Any], bool]:
    if (
        isinstance(result, tuple)
        and len(result) == 2
    ):
        first, second = result

        if isinstance(first, bool):
            created = first
            intervention = second
        else:
            intervention = first
            created = second

        if not isinstance(intervention, dict):
            raise RuntimeError(
                "repository returned invalid intervention"
            )

        return intervention, bool(created)

    if isinstance(result, dict):
        if (
            "intervention" in result
            and "created" in result
        ):
            intervention = result["intervention"]
            created = result["created"]

            if not isinstance(intervention, dict):
                raise RuntimeError(
                    "repository returned invalid intervention"
                )

            return intervention, bool(created)

    raise RuntimeError(
        "repository returned unsupported result"
    )


def main() -> int:
    database_url = os.environ.get(
        "LOTUSLEARN_DATABASE_URL"
    )

    if not database_url:
        _emit(
            {
                "ok": False,
                "error": {
                    "code": "PERSISTENCE_NOT_CONFIGURED",
                    "message": (
                        "teacher intervention persistence "
                        "is unavailable"
                    ),
                },
            }
        )
        return 78

    try:
        payload = _read_payload()

        with psycopg.connect(
            database_url
        ) as connection:
            with connection.cursor() as cursor:
                raw_result = persist_teacher_intervention(
                    cursor,
                    payload,
                )

        intervention, created = (
            _normalize_repository_result(
                raw_result
            )
        )

        _emit(
            {
                "ok": True,
                "created": created,
                "intervention": intervention,
            }
        )

        return 0

    except Exception as exc:
        message = str(exc)

        if (
            "already exists with a different"
            in message.lower()
            or "conflicting replay"
            in message.lower()
        ):
            _emit(
                {
                    "ok": False,
                    "error": {
                        "code": "INTERVENTION_CONFLICT",
                        "message": (
                            "intervention identity already "
                            "exists with different content"
                        ),
                    },
                }
            )
            return 17

        if isinstance(exc, (ValueError, json.JSONDecodeError)):
            _emit(
                {
                    "ok": False,
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": message,
                    },
                }
            )
            return 2

        _emit(
            {
                "ok": False,
                "error": {
                    "code": "PERSISTENCE_ERROR",
                    "message": (
                        "teacher intervention persistence failed"
                    ),
                },
            }
        )

        return 70


if __name__ == "__main__":
    raise SystemExit(main())