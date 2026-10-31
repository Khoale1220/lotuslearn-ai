# LotusLearn

An evidence-grounded educational assessment platform that processes student work into diagnostic misconception patterns and actionable next-lesson interventions.

## What it does

LotusLearn ingests student responses (typed text or photographed handwritten worksheets), sanitizes sensitive personal information, extracts grounded evidence, groups recurring student errors into misconception clusters, and drafts differentiated lesson recommendations for educator review.

The teacher retains complete authority: all findings and suggestions start in a pending state and must be accepted, edited, or dismissed by the educator.

## Architecture

```text
Student Submissions (Text / Images)
               │
               ▼
┌───────────────────────────────┐
│     1. Privacy Gateway        │  De-identification & Identity Normalization
└──────────────┬────────────────┘
               │  Sanitized Submissions
               ▼
┌───────────────────────────────┐
│     2. Gemini Observer        │  Multimodal Evidence Extraction & OCR
└──────────────┬────────────────┘
               │  Observations & Evidence
               ▼
┌───────────────────────────────┐
│     3. Gemini Diagnosis       │  Misconception Cluster Synthesis
└──────────────┬────────────────┘
               │  Diagnostic Claims
               ▼
┌───────────────────────────────┐
│  4. Deterministic Validator   │  Roster Math, Coverage & Quote Auditing
└──────────────┬────────────────┘
               │  Audited Clusters
               ▼
┌───────────────────────────────┐
│  5. Teaching Strategist       │  Differentiated Groupings & Lesson Sequence
└──────────────┬────────────────┘
               │  Instructional Plan
               ▼
┌───────────────────────────────┐
│  6. Semantic Verifier         │  Adversarial Grounding Audit
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│     7. Teacher Review         │  Educator Decisions (Accept / Edit / Dismiss)
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│ 8. Analytical Producer (DE-01)│  Draft 2020-12 Events -> Python SQLite Pipeline
└───────────────────────────────┘
```

## Stack

- Frontend: React 19, TypeScript, Tailwind CSS, Lucide Icons, Vite
- Backend: Node.js, Express, tsx
- AI & Reasoning: Google Gen AI SDK (`@google/genai`), Gemini 3.8 Flash, Gemini 3.6 Flash, Gemini 3.5 Flash-Lite
- Privacy & Sanitization: Google Cloud Sensitive Data Protection (REST v2) with deterministic local provider
- Validation: Zod and JSON Schema Draft 2020-12
- Data Engineering (DE-01): Python 3.10+, SQLite 3 with enforced foreign keys, pytest, ruff, jsonschema

## Data Engineering Foundation (DE-01 & DE-01.1)

The DE-01.1 milestone establishes a verifiable analytical event contract, transactional idempotency, and real Python packaging for the LotusLearn analytical pipeline:

1. Canonical Analytical Contract (`contracts/analytical_event.schema.json`): Authored in JSON Schema Draft 2020-12. Specifies strictly typed event envelopes for `ANALYSIS_INGESTED`, `FINDING_IDENTIFIED`, `GROUP_FORMED`, `VERIFICATION_AUDITED`, and `DECISION_RECORDED`. Zero student text, raw names, emails, phone numbers, or credentials can enter the schema.
2. TypeScript Analytical Producer (`server/services/analyticalEventProducer.ts`): Transforms domain analysis results into deterministic, idempotent events using SHA-256 event IDs and authentic domain timestamps without fabricated defaults.
3. Python Ingestion Gate (`pipelines/src/lotuslearn_pipeline/ingestion.py`): Validates incoming event payloads against Draft 2020-12 schemas using `importlib.resources` and enforces fail-closed zero-PII checks. Categorizes records into accepted, duplicate, conflict, and rejected with safe diagnostic error codes that never echo sensitive payload text.
4. SQLite Relational Storage & Metrics (`pipelines/src/lotuslearn_pipeline/storage.py`, `metrics.py`): Enforces `PRAGMA foreign_keys = ON;` on every database connection. Loads accepted events into relational tables and calculates learning metrics via authoritative relational views.
5. Standard Wheel Packaging (`pipelines/pyproject.toml`): Distributes the pipeline as a standalone wheel package containing all JSON schemas and SQL transformations.

## Data Science Readiness & Research Questions

LotusLearn collects structured, de-identified diagnostic telemetry designed for empirical educational evaluation. The DE-01 relational schema supports three initial research questions:

1. Research Question 1: What is the empirical correlation between cluster prevalence ($P_c$) and student support tier allocation in formative diagnostic assessments?
2. Research Question 2: How accurately does the grounded citation integrity ratio ($R_{\text{grounding}}$) predict teacher acceptance versus modification ($R_{\text{mod}}$) of AI-generated instructional recommendations?
3. Research Question 3: What is the longitudinal decay rate of grammatical misconceptions (such as finished-time markers with present perfect) when targeted with code-verified differentiated interventions? [BLOCKED until a privacy-preserving stable learner identity exists]

## Local development

```bash
# Clone the repository
git clone <repo-url>
cd lotuslearn

# Install Node dependencies
npm ci

# Set up environment variables
cp .env.example .env

# Start development server (port 3000)
npm run dev
```

## Quality Gates and Verification

```bash
# Node typecheck
npm run typecheck

# Node linting
npm run lint

# Automated Node regression tests (232 tests across 47 suites)
npm test

# Production bundle build
npm run build

# Python pipeline linting (ruff)
npm run lint:python

# Python pipeline unit & integration tests (19 pytest tests)
npm run test:python

# End-to-end cross-language analytical pipeline execution
npm run pipeline:run
```

## Environment

Create a `.env` file based on `.env.example`:

| Variable | Description | Required | Default |
|---|---|---|---|
| `NODE_ENV` | Runtime environment (`development`, `test`, `production`) | No | `development` |
| `SDP_PROVIDER` | Privacy provider: `deterministic` or `google` | No | `deterministic` in dev/test, `google` in prod |
| `GEMINI_API_KEY` | Google Gemini API key for server-side inference | For live AI runs | None |
| `GOOGLE_CLOUD_PROJECT` | GCP project ID for Google Cloud SDP API calls | Required in production | None |

### Privacy provider modes

- `deterministic`: Fast, hermetic privacy filter for local development, automated test suites, and offline demonstrations. Does not require GCP credentials or cloud network connectivity. Strips student identifiers (names, emails, phones) and produces safe synthetic visual redactions.
- `google`: Production Google Cloud Sensitive Data Protection (DLP v2 REST API). Authenticates automatically via Google Application Default Credentials (ADC) attached to the deployed cloud workload or developer workstation. Production mode strictly enforces this provider and fails closed on startup if not configured.
