from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "observer_service_parity.json"

REPO_ROOT = Path(__file__).resolve().parents[2]
PIPELINE_SRC = REPO_ROOT / "pipelines" / "src"


def _load_fixture() -> dict[str, Any]:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def _subprocess_env() -> dict[str, str]:
    env = os.environ.copy()

    existing = env.get("PYTHONPATH")

    env["PYTHONPATH"] = f"{PIPELINE_SRC}{os.pathsep}{existing}" if existing else str(PIPELINE_SRC)

    return env


def _run_cli(payload: dict[str, Any]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            sys.executable,
            "-m",
            "lotuslearn_pipeline.observer_cli",
        ],
        cwd=REPO_ROOT,
        env=_subprocess_env(),
        input=json.dumps(payload),
        text=True,
        capture_output=True,
        check=False,
    )


def test_observer_cli_matches_golden_contract() -> None:
    case = _load_fixture()["cases"][0]

    process = _run_cli(
        {
            "context": case["input"]["context"],
            "submissions": case["input"]["submissions"],
            "providerResult": case["provider_result"],
        }
    )

    assert process.returncode == 0, process.stderr
    assert process.stderr == ""

    actual = json.loads(process.stdout)

    assert actual == case["expected"]


def test_observer_cli_fails_closed_without_provider_result() -> None:
    case = _load_fixture()["cases"][0]

    process = _run_cli(
        {
            "context": case["input"]["context"],
            "submissions": case["input"]["submissions"],
        }
    )

    assert process.returncode == 2
    assert process.stdout == ""
    assert "provider_result must be an object" in process.stderr


def test_observer_cli_rejects_malformed_json() -> None:
    process = subprocess.run(
        [
            sys.executable,
            "-m",
            "lotuslearn_pipeline.observer_cli",
        ],
        cwd=REPO_ROOT,
        env=_subprocess_env(),
        input="{not-valid-json",
        text=True,
        capture_output=True,
        check=False,
    )

    assert process.returncode == 2
    assert process.stdout == ""
    assert "observer CLI request failed:" in process.stderr
