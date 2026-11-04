# ADR 004: PostgreSQL Concurrency, Migration Integrity, and Failure Recovery

## Context
Following milestone DE-02A, LotusLearn introduced PostgreSQL 18 as a durable analytical storage backend alongside SQLite. Under real-world operation, concurrent analytical pipelines, distributed web workers, container restarts, and retried batch deliveries submit simultaneous events. Without strict database-level concurrency arbitration and deterministic schema evolution, race conditions can corrupt relational projections, orphan child entities, duplicate teacher decisions, or cause migration deadlock.

## Risks
1. Concurrent Replay Races: Multiple workers receiving identical events concurrently could cause unhandled constraint crashes.
2. Concurrent Run Definition Mismatch: Conflicting duration or mode metadata on the same run ID could overwrite analytical provenance.
3. Teacher History Erasure: Educator overrides sharing the same target and timestamp could collapse or lose auditability.
4. Migration Execution Races: Simultaneous worker startup running schema DDL could deadlock or record duplicate migration versions.
5. Migration Drift: Modifying historical migration SQL text could introduce silent schema divergence across environments.
6. Retry Storms: Indiscriminate retrying of permanent constraint or business validation failures would overload database resources.
7. Partial Transaction State: Process crashes during intermediate projection writes could leave inconsistent child state.
8. Privacy Leakage: Raw student submissions or analytical payloads logged during operational errors would breach Zero-PII invariants.

## Decision
We implement a robust, database-native concurrency, migration, and retry architecture governed by explicit relational invariants:

1. Concurrency Semantics:
   - Event identity is governed by database uniqueness on analytical_events(event_id).
   - Atomic PostgreSQL INSERT ... ON CONFLICT (event_id) DO NOTHING RETURNING event_id acts as the final arbiter under race conditions.
   - For identical event payloads, the winning worker receives ACCEPTED, while losing workers receive DUPLICATE.
   - For differing payloads with identical event IDs, the race resolves to IDENTITY_CONFLICT_PAYLOAD_MISMATCH (CONFLICT).
   - Analysis run conflicts are arbitrated transactionally using ON CONFLICT (run_id) DO UPDATE RETURNING, comparing all stored immutable run metadata. Any mismatch raises AnalysisRunConflictError and rolls back completely.
   - Advisory locking is used only for migration coordination, never for normal event ingestion.

2. Migration Integrity:
   - Migrations are tracked in schema_migrations with version, name, SHA-256 checksum, and applied_at timestamp.
   - Execution is serialized using a 64-bit transaction-level PostgreSQL advisory lock (pg_advisory_xact_lock(0x4C4F5455534D4947)).
   - Applied migrations are strictly immutable. Any modification to packaged SQL raises MigrationDriftError.
   - Any applied version missing from packaged files raises MigrationFileMissingError.
   - Legacy rows missing checksums are adopted deterministically on first upgrade without re-running DDL.

3. Complete Teacher History and Deterministic Current State:
   - Historical teacher decisions are identified by immutable event_id referencing analytical_events(event_id) with ON DELETE CASCADE.
   - Multiple teacher actions on the same target at the identical timestamp both persist historically without collapsing.
   - The current_teacher_decisions projection is strictly derived: newer decision_recorded_at wins, with deterministic event_id lexical tie-breaking for equal timestamps. Late-arriving older decisions never regress current state.

4. Bounded Transient Retry Policy:
   - Only PostgreSQL SQLSTATE 40001 (serialization_failure) and 40P01 (deadlock_detected) are retried.
   - Permanent errors (unique constraint violations, foreign key violations, check constraint violations, validation errors, application conflicts) fail immediately without retry.
   - Retries repeat the entire logical transaction from the beginning, bounded to 3 attempts with exponential backoff and jitter.
   - Transaction retries are internal and never inflate logical attempted counts.

5. Processing and Delivery Guarantees:
   - Processing is replay-safe and at-least-once compatible.
   - Exactly-once distributed delivery is not claimed.

## Trade-offs
- Database Native Arbitration vs Distributed Coordinator: Relying on PostgreSQL transactional uniqueness and advisory locks avoids operational dependencies (ZooKeeper, Redis, Kafka, Celery) at the cost of requiring PostgreSQL-specific SQL syntax.
- Bounded Retries: Limiting retries to transient concurrency codes prevents retry storms while requiring upstream callers to handle terminal conflicts.

## Evidence
- Concurrency Suite: 8 synchronized workers contending on identical events produce exactly 1 ACCEPTED and 7 DUPLICATE with 0 REJECTED and 1 row in analytical_events.
- Migration Upgrade: Upgrade from 0001 to 0002 preserves legacy runs, clusters, groups, analytical events, and backfills teacher decision history without orphan rows or data loss.
- Advisory Lock Proof: 4 concurrent migration threads execute safely with zero duplicate key errors and exactly 1 application of DDL.
- Fault Rollback Proof: Injected crashes at intermediate write seams roll back completely with zero orphaned records.
- Parity Validation: Dual-database test suite verifies SQLite and PostgreSQL produce identical ingestion outcomes, current teacher projections, and analytical metrics.
