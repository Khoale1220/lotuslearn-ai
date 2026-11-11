"""Bounded, low-cardinality Prometheus execution-health metrics."""

from lotuslearn_pipeline.execution_health import ExecutionHealthState


def render_prometheus(report: dict[str, object]) -> str:
    """Render an existing read-only report without row identifiers."""
    states = tuple(item.value for item in ExecutionHealthState)
    counts = report.get("counts")
    sampled = report.get("running_sampled")
    limit = report.get("sample_limit")
    reached = report.get("sample_limit_reached")
    threshold = report.get("stale_after_seconds")
    status = report.get("status")

    if not isinstance(counts, dict) or set(counts) != set(states):
        raise ValueError("Invalid health count categories")

    if any(type(counts[state]) is not int or counts[state] < 0 for state in states):
        raise ValueError("Invalid health counts")

    if type(sampled) is not int or sampled < 0:
        raise ValueError("Invalid health sample size")

    if type(limit) is not int or not 1 <= limit <= 1000:
        raise ValueError("Invalid health sample limit")

    if type(reached) is not bool or reached != (sampled == limit):
        raise ValueError("Invalid sample completeness flag")

    if sampled > limit or sum(counts.values()) != sampled:
        raise ValueError("Inconsistent health counts")

    if type(threshold) is not int or threshold <= 0:
        raise ValueError("Invalid stale heartbeat threshold")

    alert = (
        counts[ExecutionHealthState.SUSPECTED_STALE.value] > 0
        or counts[ExecutionHealthState.FUTURE_HEARTBEAT.value] > 0
    )

    expected = "INCOMPLETE_SAMPLE" if reached else "ALERT" if alert else "OK"

    if status != expected:
        raise ValueError("Invalid health status")

    lines = [
        "# HELP lotuslearn_execution_health_running_sampled Sampled running executions.",
        "# TYPE lotuslearn_execution_health_running_sampled gauge",
        f"lotuslearn_execution_health_running_sampled {sampled}",
        "# HELP lotuslearn_execution_health_state Running executions by health state.",
        "# TYPE lotuslearn_execution_health_state gauge",
    ]

    for state in states:
        lines.append(f'lotuslearn_execution_health_state{{state="{state}"}} {counts[state]}')

    lines.extend(
        [
            "# HELP lotuslearn_execution_health_sample_limit Configured sample cap.",
            "# TYPE lotuslearn_execution_health_sample_limit gauge",
            f"lotuslearn_execution_health_sample_limit {limit}",
            "# HELP lotuslearn_execution_health_sample_limit_reached One means incomplete sample.",
            "# TYPE lotuslearn_execution_health_sample_limit_reached gauge",
            f"lotuslearn_execution_health_sample_limit_reached {int(reached)}",
            "# HELP lotuslearn_execution_health_stale_after_seconds Stale heartbeat threshold.",
            "# TYPE lotuslearn_execution_health_stale_after_seconds gauge",
            f"lotuslearn_execution_health_stale_after_seconds {threshold}",
            "# HELP lotuslearn_execution_health_check_status Current check outcome.",
            "# TYPE lotuslearn_execution_health_check_status gauge",
        ]
    )

    for name in ("OK", "ALERT", "INCOMPLETE_SAMPLE"):
        lines.append(
            f'lotuslearn_execution_health_check_status{{status="{name}"}} {int(status == name)}'
        )

    return "\n".join(lines) + "\n"
