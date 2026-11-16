"""Fail-closed metadata extraction and governance decision CLI.

This is a policy execution component, not an independently
trusted CI boundary. CI must provide trusted baseline inputs.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit

from .metadata import (
    MetadataSnapshot,
    extract_metadata_snapshot,
    validate_metadata_snapshot,
)
from .metadata_drift import compare_metadata_snapshots
from .metadata_policy import evaluate_metadata_governance

MAX_INPUT_BYTES = 32 * 1024 * 1024
EXIT_CODES = {"PASS": 0, "BLOCK": 2, "REVIEW": 3}
SHA_PATTERN = re.compile(r"[0-9a-fA-F]{40}\Z")


class GateError(ValueError):
    """A controlled integrity failure that must not pass."""


def _validate(snapshot: MetadataSnapshot) -> None:
    if not snapshot.assets:
        raise GateError("empty metadata assets")

    result = validate_metadata_snapshot(snapshot)

    if getattr(result, "errors", None):
        raise GateError("invalid metadata")

    known = [
        getattr(result, key)
        for key in ("is_valid", "valid", "passed")
        if hasattr(result, key)
    ]

    if known:
        if not all(value is True for value in known):
            raise GateError("invalid metadata")
    elif not hasattr(result, "errors"):
        raise GateError("unknown validator result")

    checksum = snapshot.compute_checksum()

    if (
        not snapshot.content_checksum
        or checksum != snapshot.content_checksum
    ):
        raise GateError("metadata checksum mismatch")


def _load_snapshot(path: Path) -> MetadataSnapshot:
    if path.is_symlink() or not path.is_file():
        raise GateError("snapshot missing or unsafe")

    size = path.stat().st_size
    if not 0 < size <= MAX_INPUT_BYTES:
        raise GateError("snapshot size invalid")

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (UnicodeError, json.JSONDecodeError) as error:
        raise GateError("invalid snapshot JSON") from error

    if not isinstance(payload, dict):
        raise GateError("snapshot must be a JSON object")

    snapshot = MetadataSnapshot.from_dict(payload)
    _validate(snapshot)
    return snapshot


def _write_new_json(path: Path, data: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

    # Exclusive creation refuses overwriting existing files.
    descriptor = os.open(
        path,
        os.O_WRONLY | os.O_CREAT | os.O_EXCL,
        0o600,
    )

    with os.fdopen(descriptor, "w", encoding="utf-8") as target:
        json.dump(
            data,
            target,
            indent=2,
            sort_keys=True,
            ensure_ascii=True,
        )
        target.write("\n")


def _decision_name(value: object) -> str:
    raw = getattr(value, "value", value)
    result = str(raw).upper()

    if result not in EXIT_CODES:
        raise GateError("unknown governance decision")

    return result


def _check_sha(value: str) -> str:
    if not SHA_PATTERN.fullmatch(value):
        raise GateError("invalid commit identifier")

    return value.lower()


def _run_compare(args: argparse.Namespace) -> int:
    baseline_path = Path(args.baseline)
    candidate_path = Path(args.candidate)

    if baseline_path.resolve() == candidate_path.resolve():
        raise GateError("baseline and candidate must be separate inputs")

    baseline_sha = _check_sha(args.baseline_commit)
    candidate_sha = _check_sha(args.candidate_commit)

    baseline = _load_snapshot(baseline_path)
    candidate = _load_snapshot(candidate_path)

    if (
        getattr(baseline, "repository_commit", None) != baseline_sha
        or getattr(candidate, "repository_commit", None) != candidate_sha
    ):
        raise GateError("snapshot commit provenance mismatch")

    diff = compare_metadata_snapshots(baseline, candidate)
    decision = evaluate_metadata_governance(diff)
    status = _decision_name(decision.status)

    # Publish counts and digests, never raw metadata contents.
    evidence: dict[str, object] = {
        "schema_version": "1.0",
        "status": status,
        "baseline_commit": baseline_sha,
        "candidate_commit": candidate_sha,
        "baseline_checksum": baseline.content_checksum,
        "candidate_checksum": candidate.content_checksum,
        "comparison_id": diff.comparison_id,
        "change_count": len(diff.changes),
        "directly_changed_asset_count": len(
            diff.directly_changed_assets
        ),
        "downstream_impacted_asset_count": len(
            diff.downstream_impacted_assets
        ),
    }

    _write_new_json(Path(args.evidence), evidence)

    print(
        f"Metadata governance: {status}; "
        f"changes={len(diff.changes)}"
    )

    return EXIT_CODES[status]


def _run_extract(args: argparse.Namespace) -> int:
    url = os.environ.get(args.database_env, "")
    parsed = urlsplit(url)

    database = unquote(parsed.path.lstrip("/"))

    if (
        parsed.scheme not in ("postgresql", "postgres")
        or database != args.expected_database
    ):
        raise GateError("missing or unapproved test database")

    manifest = Path(args.manifest)

    if manifest.is_symlink() or not manifest.is_file():
        raise GateError("dbt manifest missing")

    snapshot = extract_metadata_snapshot(
        database_url=url,
        manifest_path=manifest,
        repo_root=Path(args.repo_root),
    )

    _validate(snapshot)
    _write_new_json(Path(args.output), snapshot.to_dict())

    print(
        f"Metadata snapshot extracted; "
        f"assets={len(snapshot.assets)}"
    )

    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="LotusLearn metadata governance"
    )

    commands = parser.add_subparsers(
        dest="command",
        required=True,
    )

    extract = commands.add_parser(
        "extract",
        help="Extract PostgreSQL and dbt metadata",
    )
    extract.add_argument("--manifest", required=True)
    extract.add_argument("--output", required=True)
    extract.add_argument(
        "--database-env",
        default="LOTUSLEARN_TEST_DATABASE_URL",
    )
    extract.add_argument(
        "--expected-database",
        default="lotuslearn_test",
    )
    extract.add_argument("--repo-root", default=".")

    compare = commands.add_parser(
        "compare",
        help="Evaluate two validated metadata snapshots",
    )
    compare.add_argument("--baseline", required=True)
    compare.add_argument("--candidate", required=True)
    compare.add_argument("--baseline-commit", required=True)
    compare.add_argument("--candidate-commit", required=True)
    compare.add_argument("--evidence", required=True)

    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    try:
        if args.command == "extract":
            return _run_extract(args)

        return _run_compare(args)

    except Exception as error:
        # Do not echo exception messages. They may contain SQL,
        # credentials, or other sensitive information.
        print(
            "Metadata governance: INTEGRITY ERROR "
            f"[{type(error).__name__}]",
            file=sys.stderr,
        )
        return 4


if __name__ == "__main__":
    raise SystemExit(main())
