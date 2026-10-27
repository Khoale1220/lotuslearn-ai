"""Canonical JSON schema loading and contract validation using importlib.resources."""

import json
from importlib import resources
from pathlib import Path
from typing import Any, Dict, Optional

import jsonschema
from jsonschema.validators import Draft202012Validator


def load_canonical_schema(custom_path: Optional[Path] = None) -> Dict[str, Any]:
    """
    Loads canonical JSON Schema Draft 2020-12 for analytical events.
    Prioritizes packaged resource via importlib.resources, with fallback to file path.
    """
    if custom_path is not None:
        if not custom_path.exists():
            raise FileNotFoundError(f"Schema not found at {custom_path}")
        with open(custom_path, "r", encoding="utf-8") as f:
            schema = json.load(f)
    else:
        try:
            pkg_res = resources.files("lotuslearn_pipeline.resources")
            res = pkg_res.joinpath("analytical_event.schema.json")
            with res.open("r", encoding="utf-8") as f:
                schema = json.load(f)
        except Exception:
            # Fallback for dev repo root relative path
            repo_root = Path(__file__).resolve().parent.parent.parent.parent
            fallback = repo_root / "contracts" / "analytical_event.schema.json"
            if not fallback.exists():
                raise FileNotFoundError("Could not locate analytical_event.schema.json")
            with open(fallback, "r", encoding="utf-8") as f:
                schema = json.load(f)

    # Validate schema itself against meta-schema Draft 2020-12
    Draft202012Validator.check_schema(schema)
    return schema


def get_schema_validator(custom_path: Optional[Path] = None) -> Draft202012Validator:
    """Returns Draft202012Validator configured with format checker (e.g. date-time validation)."""
    schema = load_canonical_schema(custom_path)
    format_checker = jsonschema.FormatChecker()
    return Draft202012Validator(schema, format_checker=format_checker)
