# LotusLearn DE-02B: PMP Delivery & Risk Closure Record

## Milestone Overview
- Milestone: DE-02B (Concurrency, Migration Integrity, and Multi-Language Reliability)
- Platform Role: Senior Data Engineer / Senior Software Engineer / Delivery Lead
- Core Tech Stack: PostgreSQL 18, Psycopg 3, SQLite 3, Python 3.11, TypeScript 5.8, Node 22, GitHub Actions YAML

## Risk Register & Closure Matrix

### R1: Concurrent Replay Race (Severity: P0)
- Risk: Multiple concurrent worker threads attempting to ingest the exact same analytical event simultaneously could cause race condition crashes, duplicate entries, or inconsistent audit state.
- Control: PostgreSQL atomic INSERT ... ON CONFLICT (event_id) DO NOTHING RETURNING event_id. Winner writes projections and audit row; losers receive DUPLICATE outcome.
- Evidence: pipelines/tests/test_concurrency.py::test_concurrent_identical_event_ingestion verifies 8 workers synchronized via threading.Barrier produce exactly 1 ACCEPTED, 7 DUPLICATE, 0 REJECTED, and 1 database row.
- Status: CLOSED

### R2: Concurrent Run-Definition Race (Severity: P0)
- Risk: Concurrent threads attempting to ingest differing immutable metadata (duration, execution mode) for the same analysis_run_id could corrupt run provenance.
- Control: Atomic run conflict detection via ON CONFLICT (run_id) DO UPDATE RETURNING to lock and compare all immutable fields. Mismatch raises AnalysisRunConflictError and rolls back the entire transaction.
- Evidence: pipelines/tests/test_concurrency.py::test_concurrent_analysis_run_conflict_arbitration proves exactly 1 winner persists and the second receives ANALYSIS_RUN_CONFLICT with zero orphan child state.
- Status: CLOSED

### R3: Teacher Decision History Loss (Severity: P0)
- Risk: Educator actions on the same target at the identical timestamp could collapse through UPSERT or lose historical auditability.
- Control: Historical teacher_decisions table uses event_id TEXT PRIMARY KEY with foreign key to analytical_events(event_id) ON DELETE CASCADE. Current state is maintained as a derived projection with deterministic tie-breaking.
- Evidence: pipelines/tests/test_parity.py::test_parity_reliability_fixtures verifies multiple equal-timestamp actions persist in history while projecting deterministic current state across SQLite and PostgreSQL.
- Status: CLOSED

### R4: Migration Startup Race (Severity: P1)
- Risk: Simultaneous application startup across multiple container instances could run migration DDL concurrently, causing catalog lock deadlocks or duplicate migration execution.
- Control: Transaction-level PostgreSQL advisory lock (pg_advisory_xact_lock(0x4C4F5455534D4947)) held for the full duration of migration checks, DDL execution, and metadata recording.
- Evidence: pipelines/tests/test_concurrency.py::test_concurrent_schema_migrations_under_advisory_lock executes 4 simultaneous migration runners via threading.Barrier with zero errors, applying migrations exactly once.
- Status: CLOSED

### R5: Migration Drift & Tampering (Severity: P1)
- Risk: Modifying historical migration SQL after deployment could cause silent schema drift across environments.
- Control: Deterministic SHA-256 checksum recorded in schema_migrations. The runner re-verifies stored checksums against packaged migration files on every initialization.
- Evidence: pipelines/tests/test_migrations.py::test_migration_drift_detection verifies tampered SQL raises MigrationDriftError immediately.
- Status: CLOSED

### R6: Indiscriminate Retry Storms (Severity: P1)
- Risk: Retrying permanent database errors (syntax errors, check constraint violations, unique constraint failures, validation rejections) would overwhelm database connection limits.
- Control: Bounded retry subsystem retries only transient SQLSTATE codes 40001 (serialization_failure) and 40P01 (deadlock_detected), bounded to 3 attempts with exponential backoff and jitter.
- Evidence: pipelines/tests/test_retry_and_faults.py verifies immediate rejection of non-transient errors (UniqueViolation, AnalysisRunConflictError) and bounded retry for transient codes.
- Status: CLOSED

### R7: Partial Transactional State on Failure (Severity: P0)
- Risk: Process crash or error during intermediate projection writes could leave partial relational state (run written but findings missing, or cluster written without student links).
- Control: Atomic transaction boundaries enclosing both the envelope and all derived relational projections. Injected failures trigger complete rollback.
- Evidence: pipelines/tests/test_retry_and_faults.py::test_fault_injection_rollback_after_run_insert and test_fault_injection_rollback_after_projection_insert verify complete atomicity under injected crashes.
- Status: CLOSED

### R8: Cross-Database Semantic Drift (Severity: P1)
- Risk: SQLite and PostgreSQL backends diverging in validation rules, conflict semantics, teacher decision tie-breaking, or analytical metric calculations.
- Control: Shared domain models, canonical event payloads, identical JSON Schema validation contracts, and dual-database parity test suite.
- Evidence: pipelines/tests/test_parity.py::test_complete_backend_parity and test_parity_reliability_fixtures verify 100% metric and outcome parity.
- Status: CLOSED

### R9: Operational Privacy & PII Leakage (Severity: P0)
- Risk: Raw student submissions, names, or unmasked reasoning text leaking into PostgreSQL error logs or operational output.
- Control: Pre-transaction Zero-PII contract validation, sanitized operational logging omitting event payloads and credentials.
- Evidence: AnalyticalEventValidator rejects non-pseudonymized payloads; postgres.py logs only metadata (event_id, event_type, duration_ms, retry_count).
- Status: CLOSED

### R10: Architecture & Scope Creep (Severity: P2)
- Risk: Premature introduction of complex distributed infrastructure (Kafka, Airflow, Celery, dbt, Redis, ORMs) before core data platform invariants are proven.
- Control: Strict architectural boundaries adhering to native Python standard library concurrency, Psycopg 3, and database constraints without external orchestration services.
- Status: CLOSED
