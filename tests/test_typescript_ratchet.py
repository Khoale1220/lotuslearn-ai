from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "verify_typescript_ratchet.py"

spec = importlib.util.spec_from_file_location(
    "typescript_ratchet",
    SCRIPT,
)

if spec is None or spec.loader is None:
    raise RuntimeError("unable to load TypeScript ratchet module")

module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)


class TypeScriptRatchetTests(unittest.TestCase):
    def baseline(self) -> dict[str, object]:
        return {
            "schema_version": 1,
            "policy": "legacy-only",
            "files": [
                "server/a.ts",
                "src/b.tsx",
                "tests/c.test.ts",
            ],
            "file_count": 3,
            "total_loc": 300,
            "non_test_file_count": 2,
            "non_test_loc": 200,
        }

    def inventory(
        self,
        *,
        files: tuple[str, ...],
        total_loc: int,
        non_test_files: tuple[str, ...],
        non_test_loc: int,
    ):
        return module.Inventory(
            files=files,
            total_loc=total_loc,
            non_test_files=non_test_files,
            non_test_loc=non_test_loc,
        )

    def test_accepts_monotonic_reduction(self) -> None:
        current = self.inventory(
            files=(
                "server/a.ts",
                "tests/c.test.ts",
            ),
            total_loc=180,
            non_test_files=("server/a.ts",),
            non_test_loc=100,
        )

        self.assertEqual(
            module.evaluate(
                self.baseline(),
                current,
            ),
            [],
        )

    def test_rejects_new_typescript_file(self) -> None:
        current = self.inventory(
            files=(
                "server/a.ts",
                "src/b.tsx",
                "tests/c.test.ts",
                "server/new.ts",
            ),
            total_loc=300,
            non_test_files=(
                "server/a.ts",
                "src/b.tsx",
                "server/new.ts",
            ),
            non_test_loc=200,
        )

        violations = module.evaluate(
            self.baseline(),
            current,
        )

        self.assertTrue(
            any(
                "new TypeScript files are forbidden"
                in violation
                for violation in violations
            )
        )

    def test_rejects_total_typescript_growth(self) -> None:
        current = self.inventory(
            files=(
                "server/a.ts",
                "src/b.tsx",
                "tests/c.test.ts",
            ),
            total_loc=301,
            non_test_files=(
                "server/a.ts",
                "src/b.tsx",
            ),
            non_test_loc=200,
        )

        violations = module.evaluate(
            self.baseline(),
            current,
        )

        self.assertTrue(
            any(
                "TypeScript LOC increased"
                in violation
                for violation in violations
            )
        )

    def test_rejects_non_test_typescript_growth(self) -> None:
        current = self.inventory(
            files=(
                "server/a.ts",
                "src/b.tsx",
                "tests/c.test.ts",
            ),
            total_loc=300,
            non_test_files=(
                "server/a.ts",
                "src/b.tsx",
            ),
            non_test_loc=201,
        )

        violations = module.evaluate(
            self.baseline(),
            current,
        )

        self.assertTrue(
            any(
                "non-test TypeScript LOC increased"
                in violation
                for violation in violations
            )
        )

    def test_test_file_classifier(self) -> None:
        self.assertTrue(
            module.is_test_file(
                "server/example.test.ts"
            )
        )

        self.assertTrue(
            module.is_test_file(
                "src/example.spec.tsx"
            )
        )

        self.assertFalse(
            module.is_test_file(
                "server/example.ts"
            )
        )


if __name__ == "__main__":
    unittest.main()
