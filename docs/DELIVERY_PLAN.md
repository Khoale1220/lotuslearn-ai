# LotusLearn AI — Technical Delivery Plan

## 1. Domain Problem & Product Context

### The Educational Problem
In standard classroom workflows, teachers collect formative learning data through multiple fragmented modalities: exit tickets, written classwork, short diagnostic responses, and handwritten worksheets. While these artifacts contain immediate indicators of student reasoning and cognitive breakdowns, synthesizing patterns across 20–35 students per class period requires manual collation that exceeds available planning time (often 15–30 minutes between periods).

Consequently:
- Individual student misconceptions frequently go unaddressed until summative testing.
- Differentiated small-group instruction is delayed or organized intuitively without granular evidence.
- Raw student work containing personally identifiable information (PII) is at risk if submitted into unstructured consumer AI tools.

### LotusLearn AI Value Hypothesis
LotusLearn provides a verifiable, privacy-first software system that transforms raw student work into structured, evidence-grounded next-lesson plans. It enforces:
1. **Privacy Before Inference**: Zero student identifiers cross the AI inference boundary.
2. **Deterministic Code Over Generative Arithmetic**: Calculations (roster coverage, prevalence math, group partitions) are computed by deterministic code, not language model completion.
3. **Teacher In Control**: Every pedagogical artifact defaults to a pending state requiring human educator review and decision authority.

---

## 2. Work Breakdown Structure (WBS)

### Workstream 1: Reliability & System Hardening (Completed / Baseline)
- **1.1 Deployment Rate Limiting**: In-memory fixed-window rate limiter middleware (`server/middleware/rateLimiter.ts`) enforcing 20 req/min limits on expensive inference endpoints (`/api/analyze`, `/api/analyze-stream`, `/api/verify`, `/api/intervention/adjust`) with HTTP 429 and structured errors.
- **1.2 Strict Schema Bounding**: Input contract hardening on `AnalyzeRequestSchema` with explicit string bounds (objective: 3–1,000 chars; rubric: 4,000 chars; student text: 10,000 chars; student ID: 1–64 chars; cohort: 1–100 submissions) and rejection of empty submissions.
- **1.3 Multimodal Input Contract**: Strict MIME validation permitting only supported formats (`image/jpeg`, `image/png`) and bounded base64 payload sizes (7.5 MB).
- **1.4 Fail-Closed Verification UI**: Remediation of optimistic default fallbacks (`evidenceValidationPassed` strictly requires boolean `true`).
- **1.5 Zero-PII Persistent Storage**: Discarding legacy raw submissions in browser caching; persistent storage contains strictly derived, de-identified evidence.

### Workstream 2: Data Engineering Foundation & Pipeline Architecture
- **2.1 Entity Relationship Modeling**: Formal data contract definitions for educational domain entities (`LearningContext`, `SanitizedSourceEvidence`, `StudentObservation`, `MisconceptionCluster`, `InstructionalGroup`, `DifferentiatedIntervention`, `VerificationAudit`).
- **2.2 Data Lineage & Provenance**: End-to-end tracing from raw submission through identity normalization, Sensitive Data Protection sanitization, model synthesis, code validation, and teacher review state machine.
- **2.3 Structured Telemetry & Audit Logs**: Request-level operational logging capturing latency, stage durations, model fallbacks, and de-identification counts without recording student text or PII.
- **2.4 Streaming Reliability & Cohort Fingerprinting**: Resilient Server-Sent Events (SSE) streaming with per-stage progress events and reproducible dataset fingerprinting (SHA-256).

### Workstream 3: Data Science Readiness & Learning Analytics
- **3.1 Educational Metric Specifications**: Formalizing quantitative metrics for learning analytics:
  - *Cluster Prevalence Ratio*: $\frac{|S_{\text{affected}}|}{|S_{\text{total}}|}$
  - *Grounded Citation Coverage*: Ratio of verified verbatim/normalized quotes to total extracted claims.
  - *Instructional Support Tier Distribution*: Proportions across extension, concept clarification, guided practice, and error correction.
  - *Educator Modification Rate*: Human edit frequency and dismissal patterns ($R_{\text{modification}}$) as ground-truth feedback signals.
- **3.2 Offline Evaluation Harness**: Automated regression suite verifying grammar preservation and zero false-positive PII redaction across standardized test sets.
- **3.3 Gold-Standard Benchmark Datasets**: Reproducible fixture sets (e.g., Vietnam Grade 10 Present Perfect diagnostic cohort) for deterministic regression testing.

### Workstream 4: Educational Usability & Feedback Loop
- **4.1 Teacher Review Workflow**: Authoritative human-in-the-loop state machine (`pending`, `accepted`, `edited`, `dismissed`) preserving pedagogical ownership.
- **4.2 Actionable Intervention Generation**: Scaffolding adjustment interface enabling teachers to dynamically simplify, challenge, or create exit tickets from validated intervention cards.
- **4.3 Transparent AI Contribution Audit**: Detailed provenance drawers exposing which stages were processed by generative models versus deterministic validation routines.

---

## 3. Risk Register

| Risk ID | Description | Severity | Likelihood | Impact | Concrete Mitigation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **RSK-01** | Student PII leakage to model inference endpoints | Critical | Low | Severe regulatory & privacy breach | Pre-AI privacy gateway enforcing identity normalization (`Student 01`...) and Google Cloud SDP / deterministic regex scrubbing. Fail-closed on provider timeout or error. |
| **RSK-02** | Hallucinated evidence citations in diagnosis stage | High | Medium | Erodes teacher trust in AI analysis | Two-tier verification: deterministic string matching (`checkQuoteInSource`) checks quote existence against source before secondary Gemini adversarial verifier pass. |
| **RSK-03** | Generative model service interruption (503 / 504 / 429) | High | Medium | Pipeline stall during teacher prep period | Stage-aware model routing with automatic fallback chains (e.g. Gemini 3.8 Flash $\to$ 3.6 Flash $\to$ 3.5 Flash-Lite), exponential backoff with jitter, and model cooldown registry. |
| **RSK-04** | API denial-of-service or burst abuse on public demo | Medium | High | Cloud quota exhaustion and service outage | In-memory rate limiting (20 req/min per IP) returning HTTP 429, payload size restrictions (25 MB max body, 7.5 MB per image), and bounded submission arrays (1–100 items). |
| **RSK-05** | Educational false positives during PII redaction | Medium | Medium | Destroys grammatical evidence (e.g., redacting "Past Simple") | 35-case educational privacy evaluation benchmark validating 100% grammar preservation; infoTypes restricted strictly to `PERSON_NAME`, `EMAIL_ADDRESS`, `PHONE_NUMBER`. |
| **RSK-06** | Browser local storage PII retention | High | Low | Local device inspection reveals student work | Client persistence exclusively saves derived `sanitizedSubmissions`; raw text and uploaded image base64 strings are permanently excluded from `localStorage`. |

---

## 4. Quality Gates & Acceptance Criteria

Every milestone must satisfy the following explicit quality gates before promotion:

1. **Zero-PII Gateway Certification**:
   - Automated unit tests must verify that unredacted student names, emails, and phone numbers never appear in model payload representations.
   - Deterministic provider must identify as `deterministic-demo-sanitizer` and static fallback as `prevalidated-demo-fixture`.
2. **Deterministic Verification Invariance**:
   - 100% of student IDs in submission array must be validated by code in observer results.
   - Cluster prevalence arithmetic must equal exact counts of affected student IDs.
   - Instructional groups must form a complete partition without unassigned or phantom students.
3. **Fail-Closed Contract Enforcement**:
   - If verification data is missing or incomplete, aggregate trust badges must indicate review required (`isAnalysisFullyVerified === false`).
   - Image uploads missing valid MIME types (`image/jpeg`, `image/png`) must fail validation with HTTP 400.
4. **Continuous Integration & Clean Build**:
   - `npm run lint` executes with zero errors.
   - `npm run typecheck` passes with zero TypeScript diagnostic errors.
   - `npm test` passes 100% of regression test cases (211+ tests).
   - Production compiled bundle (`npm run build`) builds cleanly with zero warnings.

---

## 5. Milestone Delivery Roadmap

```text
[ M1: Hardened Baseline ] ──────> [ M2: Data Engineering Foundation ] ──────> [ M3: Learning Analytics ]
  - Rate limiting & input bounds     - Relational entity schemas & lineage       - Prevalence & mastery metrics
  - Fail-closed verification         - Structured non-PII audit logging          - Offline evaluation harness
  - Strict multimodal contracts      - Idempotent analysis event streaming       - Feature store specifications
```

- **M1 (Current)**: Reliable, hardened baseline. Strict schemas, in-memory rate limiting, dual-mode privacy gateway (Google SDP + ADC / deterministic local), fail-closed verification, and regression suite (211 tests).
- **M2 (Next)**: Formalized data layer. Migration-ready entity schemas for PostgreSQL/Cloud SQL, structured analytics event streams, and batch analysis job queuing for large cohorts.
- **M3 (Later)**: Advanced learning analytics. Longitudinal misconception tracking across instruction units, curriculum standard alignment, and educator modification rate tracking for model fine-tuning.
