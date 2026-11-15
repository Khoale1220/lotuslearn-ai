# OPS-01H Monitoring Reliability

This change adds **isolated verification**, not production paging.

## Safety scope

- `monitoring/alertmanager/alertmanager.yml` is unchanged and still routes to `local-noop`.
- The smoke test uses a temporary Docker Compose project, synthetic alert labels, a temporary webhook receiver, and an ephemeral loopback port.
- It does not use production credentials, production databases, or external services.
- The script runs `docker compose down -v --remove-orphans` in a `finally` block.

## Verification matrix

1. Exporter: fresh 200 -> database/collector failure 503 with no cached metrics or secrets -> fresh 200 after recovery.
2. Exporter: two concurrent collectors saturate capacity; the third gets 503; all slots become usable after release.
3. Alertmanager: a synthetic alert is delivered as `firing`, then a matching resolved update is delivered as `resolved` to an isolated webhook.
4. GitHub CI: repeats unit and isolated delivery smoke tests on pull requests.

## Run

```bash
$HOME/.venvs/lotuslearn-py312/bin/python -m pytest -q pipelines/tests/test_execution_exporter.py pipelines/tests/test_execution_exporter_recovery.py
python3 monitoring/smoke_alert_delivery.py
```

## Production activation blockers

- Configure an **approved** Alertmanager receiver and credentials through secret management, not in Git.
- Verify real Prometheus rule FIRING and RESOLVED transitions, receiver delivery, acknowledgment/escalation and the on-call owner.
- Test database/network outage and recovery against a dedicated non-production environment.
- Measure recovery time and alert latency; do not claim production paging is active while `local-noop` remains.
