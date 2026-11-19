from __future__ import annotations

import argparse
import json
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BASELINE = ROOT / ".github" / "typescript-ratchet-baseline.json"


@dataclass(frozen=True)
class Inventory:
    files: tuple[str, ...]
    total_loc: int
    non_test_files: tuple[str, ...]
    non_test_loc: int

    def as_dict(self) -> dict[str, object]:
        return {
            "files": list(self.files),
            "file_count": len(self.files),
            "total_loc": self.total_loc,
            "non_test_files": list(self.non_test_files),
            "non_test_file_count": len(self.non_test_files),
            "non_test_loc": self.non_test_loc,
        }


def is_typescript(path: str) -> bool:
    lowered = path.lower()
    return lowered.endswith(".ts") or lowered.endswith(".tsx")


def is_test_file(path: str) -> bool:
    normalized = path.replace("\\", "/").lower()

    filename = normalized.rsplit("/", 1)[-1]

    return (
        ".test.ts" in filename
        or ".test.tsx" in filename
        or ".spec.ts" in filename
        or ".spec.tsx" in filename
        or "/__tests__/" in f"/{normalized}"
        or normalized.startswith("tests/")
    )


def count_loc(path: Path) -> int:
    text = path.read_text(encoding="utf-8", errors="replace")
    return len(text.splitlines())


def git_tracked_files() -> list[str]:
    result = subprocess.run(
        ["git", "ls-files"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )

    return [
        line.strip()
        for line in result.stdout.splitlines()
        if line.strip()
    ]


def build_inventory(paths: Iterable[str] | None = None) -> Inventory:
    tracked = list(paths) if paths is not None else git_tracked_files()

    ts_files = sorted(
        path
        for path in tracked
        if is_typescript(path)
    )

    non_test_files = sorted(
        path
        for path in ts_files
        if not is_test_file(path)
    )

    total_loc = sum(
        count_loc(ROOT / path)
        for path in ts_files
    )

    non_test_loc = sum(
        count_loc(ROOT / path)
        for path in non_test_files
    )

    return Inventory(
        files=tuple(ts_files),
        total_loc=total_loc,
        non_test_files=tuple(non_test_files),
        non_test_loc=non_test_loc,
    )


def evaluate(
    baseline: dict[str, object],
    current: Inventory,
) -> list[str]:
    violations: list[str] = []

    baseline_files = set(
        str(path)
        for path in baseline["files"]
    )

    current_files = set(current.files)

    new_files = sorted(current_files - baseline_files)

    if new_files:
        violations.append(
            "new TypeScript files are forbidden: "
            + ", ".join(new_files)
        )

    baseline_file_count = int(baseline["file_count"])
    baseline_total_loc = int(baseline["total_loc"])
    baseline_non_test_count = int(baseline["non_test_file_count"])
    baseline_non_test_loc = int(baseline["non_test_loc"])

    if len(current.files) > baseline_file_count:
        violations.append(
            f"TypeScript file count increased: "
            f"{len(current.files)} > {baseline_file_count}"
        )

    if current.total_loc > baseline_total_loc:
        violations.append(
            f"TypeScript LOC increased: "
            f"{current.total_loc} > {baseline_total_loc}"
        )

    if len(current.non_test_files) > baseline_non_test_count:
        violations.append(
            f"non-test TypeScript file count increased: "
            f"{len(current.non_test_files)} > "
            f"{baseline_non_test_count}"
        )

    if current.non_test_loc > baseline_non_test_loc:
        violations.append(
            f"non-test TypeScript LOC increased: "
            f"{current.non_test_loc} > "
            f"{baseline_non_test_loc}"
        )

    return violations


def load_baseline(path: Path) -> dict[str, object]:
    payload = json.loads(path.read_text(encoding="utf-8"))

    if payload.get("schema_version") != 1:
        raise RuntimeError("unsupported ratchet baseline schema")

    if payload.get("policy") != "legacy-only":
        raise RuntimeError("unexpected TypeScript policy")

    required = {
        "files",
        "file_count",
        "total_loc",
        "non_test_file_count",
        "non_test_loc",
    }

    missing = required - payload.keys()

    if missing:
        raise RuntimeError(
            "baseline missing fields: "
            + ", ".join(sorted(missing))
        )

    return payload


def write_baseline(
    path: Path,
    inventory: Inventory,
    source_head: str,
) -> None:
    payload = {
        "schema_version": 1,
        "policy": "legacy-only",
        "source_head": source_head,
        "rule": {
            "new_typescript_files_allowed": False,
            "typescript_growth_allowed": False,
            "goal": "tracked TypeScript and TSX converge monotonically to zero",
        },
        **inventory.as_dict(),
    }

    path.parent.mkdir(parents=True, exist_ok=True)

    path.write_text(
        json.dumps(
            payload,
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Enforce the LotusLearn TypeScript exit ratchet."
        )
    )

    parser.add_argument(
        "--baseline",
        type=Path,
        default=DEFAULT_BASELINE,
    )

    parser.add_argument(
        "--write-baseline",
        action="store_true",
    )

    parser.add_argument(
        "--source-head",
        default="",
    )

    return parser.parse_args()


def main() -> int:
    args = parse_args()
    baseline_path = args.baseline

    if not baseline_path.is_absolute():
        baseline_path = ROOT / baseline_path

    inventory = build_inventory()

    if args.write_baseline:
        if not args.source_head:
            print(
                "ERROR: --source-head is required "
                "with --write-baseline",
                file=sys.stderr,
            )
            return 2

        write_baseline(
            baseline_path,
            inventory,
            args.source_head,
        )

        print("TYPESCRIPT_RATCHET_BASELINE=WRITTEN")
        print(f"BASELINE_TS_FILES={len(inventory.files)}")
        print(f"BASELINE_TS_LOC={inventory.total_loc}")
        print(
            "BASELINE_NON_TEST_TS_FILES="
            f"{len(inventory.non_test_files)}"
        )
        print(
            "BASELINE_NON_TEST_TS_LOC="
            f"{inventory.non_test_loc}"
        )

        return 0

    if not baseline_path.exists():
        print(
            f"ERROR: missing baseline: {baseline_path}",
            file=sys.stderr,
        )
        return 2

    baseline = load_baseline(baseline_path)

    violations = evaluate(
        baseline,
        inventory,
    )

    print(
        f"CURRENT_TS_FILES={len(inventory.files)}"
    )
    print(
        f"CURRENT_TS_LOC={inventory.total_loc}"
    )
    print(
        "CURRENT_NON_TEST_TS_FILES="
        f"{len(inventory.non_test_files)}"
    )
    print(
        "CURRENT_NON_TEST_TS_LOC="
        f"{inventory.non_test_loc}"
    )

    if violations:
        print("TYPESCRIPT_EXIT_RATCHET=FAIL")

        for violation in violations:
            print(
                f"VIOLATION={violation}",
                file=sys.stderr,
            )

        return 1

    print("NEW_TYPESCRIPT_FILES=0")
    print("TYPESCRIPT_GROWTH=0")
    print("TYPESCRIPT_EXIT_RATCHET=PASS")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
