import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CONTRACT_PATH = REPO_ROOT / "contracts" / "stage3-diagnosis-contract.v1.json"


def load_contract() -> dict:
    with CONTRACT_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def test_stage3_contract_v1_is_python_consumable() -> None:
    contract = load_contract()

    assert contract["contractVersion"] == "stage3-diagnosis.v1"
    assert contract["stage"]["number"] == 3
    assert contract["stage"]["ownershipTarget"] == "python"


def test_stage3_request_envelope_is_locked() -> None:
    contract = load_contract()

    assert contract["request"]["transport"] == "json-stdio"
    assert contract["request"]["fields"] == [
        "context",
        "observations",
    ]
    assert contract["request"]["required"] == [
        "context",
        "observations",
    ]


def test_stage3_response_envelope_is_locked() -> None:
    contract = load_contract()

    expected = [
        "classSnapshot",
        "misconceptionClusters",
        "modelUsed",
        "durationMs",
        "telemetry",
    ]

    assert contract["response"]["transport"] == "json-stdio"
    assert contract["response"]["fields"] == expected
    assert contract["response"]["required"] == expected


def test_stage3_fail_closed_semantics_are_locked() -> None:
    contract = load_contract()
    error = contract["error"]

    assert error["behavior"] == "fail_closed"
    assert error["preserveExistingPipelineClassification"] is True
    assert error["invalidJsonIsFailure"] is True
    assert error["nonZeroProcessExitIsFailure"] is True
    assert error["missingRequiredResponseFieldIsFailure"] is True


def test_stage3_telemetry_contract_is_locked() -> None:
    contract = load_contract()

    assert contract["telemetry"]["preserveExistingSemantics"] is True
    assert contract["telemetry"]["responseFields"] == [
        "modelUsed",
        "durationMs",
        "telemetry",
    ]


def test_stage3_authority_files_exist() -> None:
    contract = load_contract()

    for relative_path in contract["authorities"].values():
        assert (REPO_ROOT / relative_path).is_file(), relative_path


def test_mig03_scope_remains_narrow() -> None:
    contract = load_contract()
    invariants = contract["invariants"]

    assert "No Stage 4, Stage 5, Stage 6 ownership migration in MIG03" in invariants
    assert "No frontend ownership migration in MIG03" in invariants
    assert "No database ownership migration in MIG03" in invariants
