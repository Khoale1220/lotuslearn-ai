# OPS-01G Monitoring Integration

## Architecture

PostgreSQL -> execution-health-exporter -> Prometheus -> Alertmanager

The exporter reuses the existing read-only health classification,
report builder, and Prometheus metric renderer.

Every scrape performs a fresh database query. Query failure returns
HTTP 503 without returning stale metrics or database exception text.

An ALERT or INCOMPLETE_SAMPLE observation remains HTTP 200 so that
Prometheus can ingest the actual health state.

The exporter port is not published to the host. Prometheus is bound
to the host loopback interface only.

## Deployment

Use the existing docker-compose.yml with the optional
docker-compose.monitoring.yml overlay.

Set LOTUSLEARN_MONITORING_DATABASE_URL in the environment. Inside
Compose, the PostgreSQL hostname is `postgres`, not `localhost`.

The monitoring database must contain the existing migrations.

Do not commit database credentials. Production environments should
use separate least-privilege database credentials and secure secrets
management.

## Alert delivery

Alertmanager currently uses local-noop. This intentionally delivers
no external notifications.

Do not describe this configuration as production paging.

Configure an approved receiver and verify actual notification
delivery, firing, recovery, and database failure before production.

## Validation

Run exporter unit tests, Prometheus configuration checks, PromQL
rule tests, Alertmanager configuration checks and Compose validation.

Inspect the Prometheus target named lotuslearn-execution-health.

The exporter has a /-/healthy liveness endpoint. It does not prove
database connectivity. Prometheus /metrics scrape status is the
database-health signal.
