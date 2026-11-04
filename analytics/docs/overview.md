{% docs __overview__ %}

# LotusLearn Analytical Platform

Welcome to the **LotusLearn Data Quality and Analytics Engineering** documentation.

LotusLearn ingests formative educational diagnostic events produced by the AI analysis pipeline, enforces JSON Schema Draft 2020-12 validation and Zero-PII invariants, persists them transactionally into PostgreSQL 18, and transforms raw relational events into analytical marts using **dbt Core**.

## Architectural Layers

1. **Sources (`public` schema)**:
   - `analysis_runs`: Run metadata, submission counts, duration, and fingerprint.
   - `analytical_events`: Immutable event ledger with JSONB envelope.
   - `misconception_clusters`: Detected student misconception groups and teaching priority.
   - `student_findings`: Run-scoped student IDs mapped to clusters.
   - `instructional_groups`: Synthesized instructional support groups and suggested activities.
   - `group_memberships`: Run-scoped student IDs allocated to groups.
   - `verifications`: Coverage, arithmetic validation, and quote grounding audit results.
   - `teacher_decisions`: Immutable historical stream of teacher actions (`event_id` keyed).
   - `current_teacher_decisions`: Current state projection with deterministic tie-breaking.
   - `ingestion_audit_log`: Processing outcomes (`accepted`, `duplicate`, `conflict`, `rejected`).

2. **Staging (`analytics_staging` schema)**:
   - Cleaned, typed, normalized 1:1 representations of source tables with explicit schema contracts.

3. **Intermediate (`analytics_intermediate` schema)**:
   - `int_run_scoped_students`: Run-scoped student appearances uniquely keyed by `(analysis_run_id, student_id)`.
   - `int_cluster_prevalence`: Calculated prevalence arithmetic (`affected_student_count / submission_count`).
   - `int_educator_decision_current`: Current teacher state with deterministic tie-breaking (`decision_recorded_at desc, event_id desc`).
   - `int_educator_decision_metrics`: Aggregated decision counts and Educator Modification Rate ($R_{\text{mod}}$).
   - `int_run_quality`: Run verification status, quality flags, and ingestion audit counts.

4. **Analytical Marts (`analytics_marts` schema)**:
   - `fct_analysis_runs`: Grain `analysis_run_id` combining run metadata, student totals, cluster counts, verification badges, and decision summaries.
   - `fct_misconception_clusters`: Grain `(analysis_run_id, cluster_id)` with prevalence rates and educator review status.
   - `fct_teacher_decisions`: Grain `event_id` preserving the complete audit stream of educator overrides.
   - `mart_learning_analytics`: Consumption mart joining run outcomes, cluster priority distributions, verification trust, and human-in-the-loop metrics.

## Invariant Guarantees
- **Zero-PII**: No raw student names, emails, phone numbers, or freeform PII are stored or emitted into marts.
- **Run-Scoped Pseudonymity**: Student identifiers represent transient per-run pseudonyms, never linked across runs without a future district cryptographic identity service.
- **Deterministic Metrics**: Mart outputs reconcile deterministically with authoritative ingestion queries.

{% enddocs %}
