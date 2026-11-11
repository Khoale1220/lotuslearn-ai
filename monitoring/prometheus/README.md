# LotusLearn Execution Health Alerting

## Scope

Prometheus alert rules for the existing read-only execution-health metrics.

This change does not modify ingestion, PostgreSQL execution records,
database migrations, or execution-health classification.

## Metric source

The existing execution-health CLI supports Prometheus exposition output.

The current CLI is a one-shot command, not an HTTP metrics exporter.
Production activation requires a supported collection mechanism such
as an exporter or a correctly maintained textfile collector.

Do not expose the database connection string to Prometheus.

## Required Prometheus job

The scrape job must be named:

`lotuslearn-execution-health`

The rules intentionally filter on this job to isolate these alerts.

The rules file must be loaded through Prometheus `rule_files`.
Configure an Alertmanager receiver separately.

Do not enable production paging until the scrape target and notification
routing are verified.

## Alerts

| Alert | Severity | Condition |
| --- | --- | --- |
| LotusLearnExecutionHeartbeatStale | warning | Suspected stale heartbeat sustained for 2 minutes |
| LotusLearnExecutionFutureHeartbeat | critical | Future heartbeat sustained for 1 minute |
| LotusLearnExecutionIncompleteSample | critical | Health query reaches its sample cap |
| LotusLearnExecutionHealthMetricsAbsent | critical | No matching metric samples for 5 minutes, then 2-minute hold |

An incomplete sample does not prove that all executions are healthy.

The absence rule is intentionally fail-closed. It also fires when the
configured scrape job has never produced metrics.

These alerts are service-level and do not include execution IDs,
batch IDs, database URLs, or other high-cardinality identifiers.

## Validation

Run from this directory:

`promtool check rules execution-alerts.rules.yml`

`promtool test rules execution-alerts.test.yml`

GitHub Actions runs the same checks when alert configuration changes.

## Production prerequisites

1. Provide a reliable metrics collection endpoint or textfile collector.
2. Ensure fresh output is produced on each successful collection cycle.
3. Ensure collection failures are detectable and do not serve stale output as fresh.
4. Configure the matching Prometheus scrape job and rule_files.
5. Configure Alertmanager routing, credentials and notification destinations.
6. Verify real scrape, firing, recovery and notification delivery.

Until these prerequisites pass, this is a validated rules package,
not an active production alerting deployment.
