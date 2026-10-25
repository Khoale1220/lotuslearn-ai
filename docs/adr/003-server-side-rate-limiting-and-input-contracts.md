# ADR 003: Server-Side Rate Limiting and Bounded API Contracts

## Context

LotusLearn AI provides public endpoints (`/api/analyze`, `/api/analyze-stream`, `/api/verify`, `/api/intervention/adjust`) that execute multi-stage generative inference routines via Gemini models. Without abuse protection, these endpoints are vulnerable to burst traffic, denial-of-service, quota exhaustion, and memory exhaustion from unbounded input payloads (e.g. arbitrarily large string fields or image blobs).

## Decision

1. **In-Memory Rate Limiting**: Implement a centralized token sliding window middleware (`server/middleware/rateLimiter.ts`) enforcing a maximum of 20 requests per minute per IP address on all expensive inference endpoints. When the limit is exceeded, return HTTP 429 with standard headers (`Retry-After`, `X-RateLimit-*`) and a structured JSON error body without secret leakage.
2. **Explicit Bounded Schemas**: Enforce strict length limits on all input fields via Zod schemas (`LearningContextSchema`, `StudentSubmissionInputSchema`, `AnalyzeRequestSchema`):
   - `learningObjective`: 3 to 1,000 characters
   - `expectedAnswerRubric`: maximum 4,000 characters
   - `teacherNotes`: maximum 2,000 characters
   - `studentText`: maximum 10,000 characters
   - `studentId`: 1 to 64 characters
   - `submissions`: 1 to 100 submissions per batch
   - `imageBase64`: maximum 7.5 MB
3. **Strict MIME Whitelisting**: Explicitly restrict image submissions to supported MIME types (`image/jpeg` and `image/png`). Reject arbitrary or unsupported types with HTTP 400.
4. **Empty Submission Rejection**: Reject work items that lack both non-empty student text and image content.

## Consequences

- Prevents resource exhaustion and denial-of-service on public portfolio deployments without requiring external infrastructure (Redis).
- Guarantees predictable memory allocation during multimodal inference.
- Rejects invalid requests early at the HTTP boundary before invoking privacy or AI pipelines.
- Preserves teacher workflow usability while preventing bot spam and cost overruns.
