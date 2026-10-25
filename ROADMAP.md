# LotusLearn AI — Roadmap

## Now (Current Hardened Baseline)

- **Pre-AI Privacy Boundary**: Dual-mode privacy gateway utilizing Google Cloud Sensitive Data Protection (REST API v2 via Application Default Credentials) in production and a deterministic regex sanitizer in development/test.
- **Fail-Closed Verification**: Conservative verification model requiring all atomic checks (coverage, cluster arithmetic, group partition, and evidence validation) to pass before certifying analysis.
- **Inference Protection & Rate Limiting**: In-memory fixed-window rate limiter middleware enforcing 20 req/min limits on expensive inference endpoints (`/api/analyze`, `/api/analyze-stream`, `/api/verify`, `/api/intervention/adjust`) with HTTP 429 and standard headers.
- **Hardened API Data Contracts**: Bounded Zod schemas enforcing strict string limits (learning objective: 1,000 chars; rubric: 4,000 chars; student text: 10,000 chars; cohort: 100 submissions), rejecting empty work, and strictly restricting image MIME types to `image/jpeg` and `image/png`.
- **Restored Teacher Notes**: Full schema preservation of contextual teacher notes (`teacherNotes`, max 2,000 chars) through the API boundary into observation and diagnosis prompts.
- **Zero-PII Client Persistence**: Browser `localStorage` caches only derived, de-identified evidence; raw student text, unredacted identities, and uploaded images are permanently discarded.
- **Stage-Aware Reliability**: Tiered model routing (Gemini 3.8 Flash $\to$ 3.6 Flash $\to$ 3.5 Flash-Lite) with timeout abort controllers and model cooldown registry to survive transient provider issues.
- **Production Server & Hygiene**: Compiled production server running Node 22 with ESM static asset delivery, `/healthz` liveness check, and strictly npm package management (zero `bun.lock`).

## Next (Data Engineering & Pipeline Scaling)

- **Relational Data Persistence**: Formal PostgreSQL/Cloud SQL schema migrations (via Drizzle ORM) for persistent storage of classes, units, learning objectives, student roster mappings, and analysis runs.
- **Structured Analytics Event Stream**: Schema-validated audit events emitted at each pipeline stage (ingestion, sanitization, observation, diagnosis, strategy, verification, educator review) for data engineering pipelines.
- **Asynchronous Batch Processing**: Background queue architecture (e.g. BullMQ / Cloud Tasks) to support cohorts larger than 35 submissions without encountering HTTP client timeouts.
- **Standardized Ingestion Adapters**: Batch import modules for standard educational export formats (CSV roster imports, Google Classroom assignment submissions).
- **Offline Evaluation Suite**: Automated CI evaluation harness running weekly against frozen student test cohorts to measure precision, recall, and false-positive rates of misconception clustering.

## Later (Data Science & Longitudinal Learning Analytics)

- **Longitudinal Mastery Tracking**: Analytical data warehouse models tracking student cognitive progression and recurring misconception resolution across instructional quarters and semesters.
- **Curriculum Taxonomy Alignment**: Configurable mapping engines aligning diagnosed misconceptions to state and national standards (Common Core, NGSS, CEFR language competencies).
- **Educator Modification Rate Modeling**: Quantitative tracking of teacher edit frequency and dismissal patterns ($R_{\text{modification}}$) to continuously refine prompt grounding instructions and model routing policies.
- **District Multi-Tenant Governance**: Role-based access control (RBAC), district data retention policy enforcement, and aggregated departmental learning gap analytics.
