from __future__ import annotations

from typing import Any

from lotuslearn_pipeline import observer_cli, observer_runtime


def _context() -> dict[str, Any]:
    return {
        "subject": "Mathematics",
        "gradeLevel": "8",
        "lessonTitle": "Linear equations",
        "learningObjective": "Solve a one-step linear equation.",
        "expectedAnswerRubric": "Show the operation and give the final value.",
        "teacherNotes": "",
    }


def _submissions() -> list[dict[str, Any]]:
    return [
        {
            "studentId": "Student 01",
            "workType": "text",
            "studentText": "x = 2",
        }
    ]


def test_live_provider_wires_python_contract_to_gemini_execution(
    monkeypatch,
) -> None:
    captured: dict[str, Any] = {}
    expected = {
        "text": "[]",
        "modelUsed": "stub-model",
        "durationMs": 1,
        "telemetry": {},
    }

    def fake_generate_observer_content(**kwargs: Any) -> dict[str, Any]:
        captured.update(kwargs)
        return expected

    monkeypatch.setattr(
        observer_runtime,
        "generate_observer_content",
        fake_generate_observer_content,
    )

    result = observer_runtime.generate_observer_provider_result(
        _context(),
        _submissions(),
    )

    assert result == expected
    assert captured["contents"]
    assert captured["config"]["response_mime_type"] == "application/json"
    assert captured["config"]["response_schema"]
    assert captured["config"]["system_instruction"]


def test_live_runtime_injects_provider_into_canonical_service(
    monkeypatch,
) -> None:
    sentinel = object()
    captured: dict[str, Any] = {}

    def fake_observe_submissions(
        context: Any,
        submissions: Any,
        *,
        provider: Any,
    ) -> object:
        captured["context"] = context
        captured["submissions"] = submissions
        captured["provider"] = provider
        return sentinel

    monkeypatch.setattr(
        observer_runtime,
        "observe_submissions",
        fake_observe_submissions,
    )

    result = observer_runtime.observe_submissions_live(
        _context(),
        _submissions(),
    )

    assert result is sentinel
    assert captured["context"] == _context()
    assert captured["submissions"] == _submissions()
    assert captured["provider"] is observer_runtime.generate_observer_provider_result


def test_cli_routes_missing_provider_result_to_live_python_runtime(
    monkeypatch,
) -> None:
    expected_contract = {"observer": "live-python"}
    captured: dict[str, Any] = {}

    class FakeObserverResult:
        def to_contract_dict(self) -> dict[str, Any]:
            return expected_contract

    def fake_live_observer(
        context: Any,
        submissions: Any,
    ) -> FakeObserverResult:
        captured["context"] = context
        captured["submissions"] = submissions
        return FakeObserverResult()

    monkeypatch.setattr(
        observer_runtime,
        "observe_submissions_live",
        fake_live_observer,
    )

    payload = {
        "context": _context(),
        "submissions": _submissions(),
    }

    result = observer_cli._run_request(payload)

    assert result == expected_contract
    assert captured["context"] == _context()
    assert captured["submissions"] == _submissions()
