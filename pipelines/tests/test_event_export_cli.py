from __future__ import annotations

import io
import json
import sys
from pathlib import Path

from lotuslearn_pipeline.event_export_cli import main

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "analytical_event_producer_parity.json"


def _fixture() -> dict:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def test_stdout_contract(
    monkeypatch,
    capsys,
):
    fixture = _fixture()

    monkeypatch.setattr(
        sys,
        "stdin",
        io.StringIO(json.dumps(fixture["analysis_result"])),
    )

    result = main(
        [
            "--input",
            "-",
            "--output",
            "-",
        ]
    )

    captured = capsys.readouterr()

    assert result == 0
    assert captured.err == ""
    assert not captured.out.endswith("\n")
    assert json.loads(captured.out) == fixture["expected_events"]


def test_file_output_contract(
    tmp_path,
    capsys,
):
    fixture = _fixture()

    input_path = tmp_path / "analysis.json"
    output_path = tmp_path / "events.json"

    input_path.write_text(
        json.dumps(fixture["analysis_result"]),
        encoding="utf-8",
    )

    result = main(
        [
            "--input",
            str(input_path),
            "--output",
            str(output_path),
        ]
    )

    captured = capsys.readouterr()

    assert result == 0
    assert captured.err == ""

    assert captured.out == (
        f"Exported {len(fixture['expected_events'])} analytical events to {output_path}\n"
    )

    assert json.loads(output_path.read_text(encoding="utf-8")) == fixture["expected_events"]
