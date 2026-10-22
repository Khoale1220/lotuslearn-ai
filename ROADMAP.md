# Roadmap

## Current

- **Privacy Gateway**: Pre-AI sanitization boundary using Google Cloud Sensitive Data Protection (REST v2) with fail-closed error handling.
- **Identity Normalization**: Roster keys mapped to deterministic pseudonymous identifiers (`Student 01`, `Student 02`...).
- **Multi-Stage Pipeline**: Modular execution for evidence observation, misconception diagnosis, instructional strategy, and semantic verification.
- **Deterministic Validation**: Code-level verification for student roster coverage, cluster arithmetic, and quotation provenance.
- **Teacher Review Authority**: Human-in-the-loop state machine (`pending`, `accepted`, `edited`, `dismissed`) for all diagnosed clusters and suggested interventions.
- **Stage-Aware Reliability**: Per-stage model routing, HTTP request timeouts, and error classification distinguishing HTTP 503 overload from HTTP 429 quota exhaustion.

## Next

- **Relational Persistence**: PostgreSQL schema with migrations (via Drizzle ORM) for classes, assignments, submissions, and analysis runs.
- **Structured Observability**: Request-level distributed tracing, latency histograms, and stage-by-stage token metrics.
- **LMS Ingestion Adapters**: Standard import formats (CSV, JSON) and direct LMS sync (Google Classroom).
- **Asynchronous Processing**: Background job queue for processing cohorts larger than 30 submissions without HTTP connection timeouts.

## Later

- **Data Warehouse Modeling**: Analytics schema tracking longitudinal student concept mastery across units and terms.
- **Curriculum Standard Mapping**: Configurable taxonomy alignment (e.g. Common Core, CEFR, state standards).
- **Multi-Teacher Workspaces**: Role-based access control and department-level aggregated misconception reporting.
