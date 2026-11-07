# ADR 005: Analytical Transformation and Data Quality Layer

## Status
Accepted

## Context
Following milestone DE-02B, LotusLearn established a durable, transactional operational event pipeline on PostgreSQL 18 with enforced foreign keys, JSONB event envelopes, advisory-lock migration controls, bounded retry recovery (SQLSTATE 40001/40P01), and dual-backend SQLite/PostgreSQL parity.

However, operational schemas (`analysis_runs`, `analytical_events`, `teacher_decisions`, `current_teacher_decisions`, `ingestion_audit_log`) are designed for transactional atomicity, idempotent replay, and fast ingestion. Consuming operational tables directly for reporting, cohort analytics, and future educational data science introduces key architectural risks:
1. Operational tables contain low-level envelopes, internal retries, and technical audit artifacts.
2. In-place metric calculations across operational projections can drift between reporting queries.
3. Learner pseudonyms ('Student 01') are run-scoped; naive joins across runs without `analysis_run_id` risk cross-cohort identity collisions.
4. Operational projections (`current_teacher_decisions`) require independent verification against the immutable historical event stream (`teacher_decisions`) to prove projection integrity.

## Decision
Implement a governed, modular analytical transformation layer in a dedicated top-level project (`analytics/`) using dbt Core v1.12 and the PostgreSQL adapter (`dbt-postgres` v1.11).

Key decisions:
1. **Isolated Architecture Boundary**:
   - TypeScript produces deterministic domain events.
   - Python ingests, validates Draft 2020-12 schemas, and writes operational truth.
   - PostgreSQL stores operational data in the `public` schema. Operational tables are strictly read-only sources for dbt.
   - dbt reads from `lotuslearn_operational` and writes transformed models exclusively into dedicated analytical namespaces (`staging`, `intermediate`, `analytics`).
2. **Layer Responsibilities**:
   - **Staging (`models/staging/`)**: Views selecting explicit columns, normalizing data types, standardizing ISO-8601 timestamps to `TIMESTAMPTZ`, and preserving source grain without business aggregation or manufactured defaults.
   - **Intermediate (`models/intermediate/`)**: Views encapsulating reusable business logic:
     - `int_teacher_decision_ranked`: Independently derives the current educator review state from immutable `stg_teacher_decisions` using window function ranking (`ORDER BY decision_recorded_at DESC, event_id DESC`) with deterministic tie-breaking.
     - `int_student_appearances`: Extracts distinct run-scoped learner appearances, generating composite keys (`analysis_run_id || '_' || student_id`).
     - `int_concept_prevalence`: Computes prevalence rates with explicit numerator (`affected_student_count`) and denominator (`submission_count`), safely guarding against zero division.
     - `int_ingestion_reconciliation`: Reconciles multiple transaction attempts and retries into a single logical outcome per `event_id`.
   - **Marts (`models/marts/`)**: Governed tables serving analytical consumers:
     - `dim_analysis_run`: Stable run-level dimension.
     - `fct_teacher_decisions`: Immutable stream of historical educator actions.
     - `fct_student_findings`: Run-scoped student observations within diagnosed clusters.
     - `fct_ingestion_attempts`: Logical ingestion attempts with retry totals.
     - `mart_run_quality`: Run-level rollups including submission count, cluster count, student appearances, educator modification rate ($R_{\text{mod}}$), and fail-closed verification status.
     - `mart_concept_prevalence`: Misconception cluster prevalence mart.
3. **Explicit Model Grains**:
   - `dim_analysis_run`: One row per analysis run.
   - `fct_teacher_decisions`: One row per immutable teacher decision event.
   - `fct_student_findings`: One row per student finding within a misconception cluster within an analysis run.
   - `fct_ingestion_attempts`: One row per unique event identifier.
   - `mart_run_quality`: One row per analysis run.
   - `mart_concept_prevalence`: One row per misconception cluster within an analysis run.
4. **Data-Quality & Projection Verification Strategy**:
   - **Operational Projection Verification**: A singular test (`assert_teacher_decision_projection_parity.sql`) performs a full outer join between dbt-derived current state (`int_teacher_decision_ranked`) and the operational projection (`stg_current_teacher_decisions`), failing if any decision or event ID differs.
   - **Run-Scoped Identity Enforcement**: Test `assert_run_scoped_student_identity_never_crosses_runs.sql` verifies that no student pseudonym crosses runs without an explicit `analysis_run_id` prefix.
   - **Bounded Value Assertions**: Test `assert_prevalence_rate_valid_range.sql` guarantees prevalence rates stay strictly in $[0.0, 1.0]$.
   - **Ingestion Reconciliation Balance**: Test `assert_ingestion_reconciliation_balance.sql` confirms every accepted logical attempt exists in `stg_analytical_events`.
   - **Generic Tests**: `unique`, `not_null`, `relationships`, and `accepted_values` enforced across all sources, staging, and mart models.
   - **Unit Tests**: Five deterministic dbt unit tests verifying tie-breaking window logic, run-scoped identity isolation, zero denominator handling, retry reconciliation, and educator modification rates.
5. **Enforced Model Contracts**:
   - All public marts (`dim_analysis_run`, `fct_teacher_decisions`, `fct_student_findings`, `fct_ingestion_attempts`, `mart_run_quality`, `mart_concept_prevalence`) enforce strict schema contracts (`contract: { enforced: true }`), locking column names and PostgreSQL data types.
6. **Metric Ownership & Parity**:
   - Operational SQL queries (`pipelines/src/lotuslearn_pipeline/sql/metrics.sql`) remain reference integrity checks for ingestion smoke testing.
   - dbt analytical marts become the authoritative analytical consumption layer.
   - Automated parity tests assert bit-for-bit equivalence between operational metric queries and dbt mart aggregations for overlapping metrics (`total_accepted_events`, `total_analysis_runs`, `student_appearances`, `educator_modification_rate`).

## Technology Choice
- **dbt-core v1.12 / dbt-postgres v1.11**: Selected because dbt Core v1.12 represents the active, stable release line supporting native model contracts, SQL unit testing, and full PostgreSQL compatibility.
- **Why dbt v2 is Deferred**: dbt v2 does not currently support a certified `dbt-postgres` adapter; adopting dbt v2 prematurely would break PostgreSQL support or force unsupported alpha adapters.
- **Dependency Isolation**: All analytics dependencies are maintained in `analytics/requirements.txt` (`dbt-core==1.12.6`, `dbt-postgres==1.11.0`) and kept completely separate from the operational ingestion package (`pipelines/pyproject.toml`).

## Deferred Work
- **Incremental Materialization (DE-03B)**: Staging and intermediate models are views; marts are materialized as tables. Incremental logic is deferred until production volume warrants stateful partition processing.
- **Source Freshness SLA (DE-03B)**: Formal freshness testing is deferred until scheduled streaming or cron ingestion schedules are deployed with verified operational SLA timestamps.
- **Longitudinal Learner Tracking**: Any multi-cohort learner dimension or longitudinal retention mart remains blocked pending a district-managed cryptographic identity service.
