# LotusLearn AI

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
└───────────────────────────────┘
```

## Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Vite
- **Backend**: Node.js, Express, tsx
- **AI & Reasoning**: Google Gen AI SDK (`@google/genai`), Gemini 3.8 Flash, Gemini 3.6 Flash, Gemini 3.5 Flash-Lite
- **Privacy & Sanitization**: Google Cloud Sensitive Data Protection (REST v2) with deterministic local provider
- **Validation**: Zod schema validation

## Local development

```bash
# Clone the repository
git clone <repo-url>
cd lotuslearn-ai

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Start development server (serves frontend on port 3000 and mounts Express backend)
npm run dev
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

- **`deterministic`**: Fast, hermetic privacy filter for local development, AI Studio preview, automated test suites, and offline demonstrations. Does not require GCP credentials or cloud network connectivity. Strips known student identifiers (names, emails, phones) and produces safe synthetic visual redactions.
- **`google`**: Production-grade Google Cloud Sensitive Data Protection (DLP v2 REST API). Authenticates automatically via Google Application Default Credentials (ADC) attached to the deployed cloud workload or developer workstation. Production mode strictly enforces this provider and will fail closed on startup if not configured.

## Testing

```bash
# Typecheck
npm run typecheck

# Lint
npm run lint

# Run automated tests
npm test

# Build production bundle
npm run build
```

## Privacy model

- **Pre-inference boundary**: Sanitization occurs strictly before data reaches any AI model.
- **Fail-closed contract**: If the privacy provider fails, times out, or returns an error, the pipeline aborts immediately without sending unredacted data to model endpoints.
- **Identity minimization**: Real student names are normalized to deterministic pseudonymous identifiers (`Student 01`, `Student 02`...).
- **Restrained persistence**: Unredacted student submissions and raw PII are never persisted to long-term storage or exposed in server logs.

## Project status

- Working 6-stage assessment and intervention pipeline with live Gemini integration and deterministic code auditing.
- Interactive demonstration mode with pre-validated sample classroom submissions.
- Strict error handling with stage-aware timeouts, exponential backoff, and circuit breakers.

## Roadmap

See [ROADMAP.md](ROADMAP.md) for current progress and planned engineering milestones.
