"""No-network JSON subprocess tests for the Stage 3 diagnosis CLI."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
PIPELINE_SRC = ROOT / "pipelines" / "src"


def _run(payload: str, *, no_key: bool = False) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["PYTHONPATH"] = os.pathsep.join([str(PIPELINE_SRC), env.get("PYTHONPATH", "")])
    if no_key:
        env.pop("GEMINI_API_KEY", None)
    return subprocess.run(
        [sys.executable, "-m", "lotuslearn_pipeline.diagnosis_cli"],
        cwd=ROOT,
        env=env,
        input=payload,
        text=True,
        capture_output=True,
        check=False,
        timeout=15,
    )


def _captured_request() -> dict[str, Any]:
    provider_payload = {
        "classSnapshot": {
            "strongestConcept": "Experience",
            "highestPriorityNeed": "Time markers",
            "overallRecommendation": "Practice contrasting forms",
        },
        "misconceptionClusters": [],
    }
    return {
        "context": {"learningObjective": "Compare verb tenses"},
        "observations": [{"studentId": "S-01"}],
        "providerResult": {
            "text": json.dumps(provider_payload),
            "modelUsed": "offline-fixture",
            "durationMs": 18,
            "telemetry": {"stage": "Stage 2: Diagnosis", "latencyMs": 18},
        },
    }


def test_cli_emits_only_contract_json() -> None:
    run = _run(json.dumps(_captured_request()))
    assert run.returncode == 0, run.stderr
    assert run.stderr == ""
    result = json.loads(run.stdout)
    assert set(result) == {
        "classSnapshot", "misconceptionClusters", "modelUsed", "durationMs", "telemetry"
    }
    assert result["classSnapshot"]["totalSubmissions"] == 1
    assert result["modelUsed"] == "offline-fixture"


def test_cli_invalid_json_fails_closed() -> None:
    run = _run("{not-json")
    assert run.returncode == 2
    assert run.stdout == ""
    assert "diagnosis CLI request failed" in run.stderr


def test_cli_missing_observations_fails_closed() -> None:
    request = _captured_request()
    request.pop("observations")
    run = _run(json.dumps(request))
    assert run.returncode == 2
    assert run.stdout == ""
    assert "observations must be an array" in run.stderr


def test_cli_malformed_provider_result_fails_closed() -> None:
    request = _captured_request()
    request["providerResult"]["text"] = "{broken"
    run = _run(json.dumps(request))
    assert run.returncode == 2
    assert run.stdout == ""
    assert "malformed JSON" in run.stderr


def test_cli_missing_live_key_fails_closed() -> None:
    request = _captured_request()
    del request["providerResult"]
    run = _run(json.dumps(request), no_key=True)
    assert run.returncode == 2
    assert run.stdout == ""
    assert "GEMINI_API_KEY" in run.stderr


def test_cli_rejects_non_object_root() -> None:
    run = _run('[1, 2]')
    assert run.returncode == 2
    assert run.stdout == ""
    assert "JSON object" in run.stderr
