# ADR 005: dbt Analytical Transformation and Data Quality Layer

## Context

In milestones DE-01 through DE-02B, LotusLearn established an immutable analytical event contract (JSON Schema Draft 2020-12), transactional PostgreSQL 18 relational persistence, dual-engine parity with SQLite, advisory-locked schema migrations, bounded transient retries, and complete historical auditability for educator decisions.

While the Python ingestion pipeline guarantees transactional durability and ingestion quality gates, downstream analytical consumption (educator dashboards, pedagogical research, learning analytics) requires governed data modeling, dimensional facts, lineage tracking, and automated data quality assertions. Exposing raw transactional tables directly to analytical consumers introduces tight coupling, schema evolution fragility, and operational overhead.

## Decision

Introduce dbt Core (v1.8) with the PostgreSQL adapter as the dedicated analytical transformation and data-quality layer in the `analytics/` workspace.

The end-to-end data architecture is structured as:
```text
TypeScript Event Producer
  -> JSON Schema Draft 2020-12 Validation Gate
  -> Python Ingestion Pipeline (ACID Transactions & Quality Gates)
  -> PostgreSQL 18 Durable Storage (public schema raw tables)
  -> dbt Staging Layer (analytics_staging schema views)
  -> dbt Intermediate Layer (analytics_intermediate business transforms)
  -> dbt Analytical Marts (analytics_marts dimensional tables)
  -> Automated Data Quality Tests (134+ schema tests & singular SQL assertions)
  -> Lineage Documentation & Deterministic Metric Reconciliation
```

### 1. Separation of Responsibilities

- **Python Ingestion Pipeline (`pipelines/`)**:
  - Validates inbound event payloads against JSON Schema.
  - Arbitrates concurrent event replay and payload conflicts.
  - Manages transactional boundaries and PostgreSQL advisory lock migrations.
  - Preserves immutable historical event ledger (`analytical_events`, `teacher_decisions`).
  - Maintains dual-engine parity between PostgreSQL and SQLite.

- **dbt Transformation Layer (`analytics/`)**:
  - Operates downstream of durable persistence.
  - Normalizes and casts raw relational data into governed staging views.
  - Implements business logic transforms (prevalence arithmetic, teacher decision tie-breaking, modification rates).
  - Materializes dimensional fact models (`fct_analysis_runs`, `fct_misconception_clusters`, `fct_teacher_decisions`, `mart_learning_analytics`).
  - Enforces automated data quality assertions and documents dependency lineage.

### 2. Engine Scope: PostgreSQL Only for dbt

dbt operates strictly against PostgreSQL 18. PostgreSQL is the authoritative production analytical target. SQLite remains an in-memory development, hermetic testing, and parity validation backend for the Python ingestion pipeline. We explicitly reject forcing dbt onto SQLite via non-standard third-party community adapters, as doing so would introduce synthetic SQL dialect compromises without production utility.

### 3. Run-Scoped Student Identity & Longitudinal Boundary

Student pseudonyms (e.g., "Student 01") represent transient per-run appearances. In adherence to Zero-PII discipline:
- The composite key `(analysis_run_id, student_id)` is enforced across all intermediate and dimensional models.
- Emitting longitudinal student mastery tracking or cross-run student profiles is strictly prohibited in DE-03.
- Longitudinal student identity remains deferred to a future milestone requiring a district-managed cryptographic salted roster hash and blinded linkage service.

### 4. Data Quality Strategy

The analytics layer enforces three tiers of automated data-quality verification:
1. **Source & Column Schema Tests (134+ tests)**:
   - `unique` and `not_null` on primary keys (`analysis_run_id`, `event_id`, composite keys).
   - `accepted_values` on statuses (`verified`, `needs_review`), priorities (`immediate`, `guided_group`), and decisions (`accepted`, `edited`, `dismissed`).
   - `relationships` foreign key tests between marts and staging models.
2. **Singular Invariant Tests (`analytics/tests/`)**:
   - `assert_prevalence_rate_bounded`: Proves prevalence rates remain strictly within [0.0, 1.0].
   - `assert_group_membership_counts_match`: Proves declared group sizes equal distinct assigned student pseudonyms.
   - `assert_teacher_decision_totals_match`: Proves accepted + edited + dismissed equals total reviewed decisions.
   - `assert_zero_pii_in_marts`: Proves zero unmasked email or phone patterns leak into analytical mart explanations.
   - `assert_teacher_decision_history_preserved`: Proves complete preservation of historical teacher decision events without deduplication collapse.
3. **Deterministic Metric Reconciliation**:
   - Compares authoritative metrics calculated by raw/view SQL (`metrics.sql`) against dbt marts, asserting zero mathematical divergence across runs, clusters, prevalence, and modification rates.

## Consequences & Trade-offs

- **Dependencies**: Adds `dbt-core>=1.8,<1.10` and `dbt-postgres>=1.8,<1.10` to pipeline development dependencies.
- **Environment Isolation**: Staging and mart models reside in dedicated schemas (`analytics_staging`, `analytics_intermediate`, `analytics_marts`), cleanly isolating analytical artifacts from transactional tables in `public`.
- **CI Pipeline**: Extends GitHub Actions CI to execute `dbt parse`, `dbt build`, `dbt docs generate`, and metric reconciliation against the PostgreSQL 18 service container, with manifest artifacts uploaded.
