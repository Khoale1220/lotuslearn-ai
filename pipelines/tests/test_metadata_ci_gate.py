"""Tests for metadata governance CLI enforcement."""

import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from lotuslearn_pipeline import metadata_ci_gate as gate


def compare_args(tmp_path):
    return [
        "compare",
        "--baseline",
        str(tmp_path / "baseline.json"),
        "--candidate",
        str(tmp_path / "candidate.json"),
        "--baseline-commit",
        "a" * 40,
        "--candidate-commit",
        "b" * 40,
        "--evidence",
        str(tmp_path / "evidence.json"),
    ]


@pytest.mark.parametrize(
    ("status", "expected"),
    [("PASS", 0), ("REVIEW", 3), ("BLOCK", 2)],
)
def test_decision_exit_code(tmp_path, monkeypatch, status, expected):
    monkeypatch.setattr(
        gate,
        "_load_snapshot",
        lambda path: SimpleNamespace(
            repository_commit=("a" * 40 if Path(path).name == "baseline.json" else "b" * 40),
            content_checksum=("baseline" if Path(path).name == "baseline.json" else "candidate"),
        ),
    )

    diff = SimpleNamespace(
        comparison_id="test-comparison",
        changes=("change",),
        directly_changed_assets=("private_asset",),
        downstream_impacted_assets=("private_mart",),
    )

    monkeypatch.setattr(
        gate,
        "compare_metadata_snapshots",
        lambda *_: diff,
    )

    monkeypatch.setattr(
        gate,
        "evaluate_metadata_governance",
        lambda *_: SimpleNamespace(status=status),
    )

    result = gate.main(compare_args(tmp_path))

    assert result == expected

    evidence = json.loads((tmp_path / "evidence.json").read_text())

    assert evidence["status"] == status
    assert evidence["change_count"] == 1
    assert "private_mart" not in json.dumps(evidence)


def test_same_snapshot_path_is_rejected(tmp_path):
    args = compare_args(tmp_path)
    args[4] = args[2]

    assert gate.main(args) == 4
    assert not (tmp_path / "evidence.json").exists()


def test_invalid_json_fails_closed(tmp_path):
    (tmp_path / "baseline.json").write_text("{invalid")
    (tmp_path / "candidate.json").write_text("{}")

    assert gate.main(compare_args(tmp_path)) == 4
    assert not (tmp_path / "evidence.json").exists()


def test_missing_database_url_fails_closed(tmp_path, monkeypatch):
    monkeypatch.delenv(
        "LOTUSLEARN_TEST_DATABASE_URL",
        raising=False,
    )

    manifest = tmp_path / "manifest.json"
    manifest.write_text("{}")

    output = tmp_path / "snapshot.json"

    result = gate.main(
        [
            "extract",
            "--manifest",
            str(manifest),
            "--output",
            str(output),
        ]
    )

    assert result == 4
    assert not output.exists()


def test_exception_does_not_leak_secret(tmp_path, monkeypatch, capsys):
    def fail(_path):
        raise RuntimeError("password=secret-student-name")

    monkeypatch.setattr(gate, "_load_snapshot", fail)

    result = gate.main(compare_args(tmp_path))

    captured = capsys.readouterr()

    assert result == 4
    assert "secret-student-name" not in (captured.out + captured.err)


@pytest.mark.parametrize("embedded", [None, "c" * 40])
def test_snapshot_commit_provenance_fails_closed(tmp_path, monkeypatch, embedded):
    monkeypatch.setattr(
        gate,
        "_load_snapshot",
        lambda path: SimpleNamespace(
            repository_commit=embedded,
            content_checksum="test-checksum",
        ),
    )

    assert gate.main(compare_args(tmp_path)) == 4
    assert not (tmp_path / "evidence.json").exists()


def test_safe_integrity_error_code_classifies_known_snapshot_failure():
    from lotuslearn_pipeline.metadata_ci_gate import (
        _safe_integrity_error_code,
    )

    error = RuntimeError("Content checksum mismatch in serialized metadata snapshot")

    assert _safe_integrity_error_code(error) == "snapshot_checksum_mismatch"


def test_safe_integrity_error_code_does_not_expose_unknown_message():
    from lotuslearn_pipeline.metadata_ci_gate import (
        _safe_integrity_error_code,
    )

    secret = "postgresql://admin:super-secret-password@db.internal/production"

    code = _safe_integrity_error_code(RuntimeError(secret))

    assert code == "unclassified_integrity_failure"
    assert "super-secret-password" not in code
    assert "postgresql" not in code
    assert "db.internal" not in code
