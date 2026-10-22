# Contributing to LotusLearn AI

This document outlines the engineering standards, architecture invariants, and testing practices expected across the codebase.

---

## 1. Core Engineering Invariants

1. **Human Decision Authority**: AI recommendations (misconception clusters, intervention plans) always initialize with `teacherDecision: 'pending'`. Only explicit educator action may transition status to `accepted`, `edited`, or `dismissed`.
2. **Dimension Independence**:
   - Privacy status (`passed`, `review_required`, `failed`, `not_checked`)
   - Evidence grounding (`exact_source`, `normalized_exact_match`, `review_required`, `unsupported_citation`)
   - Technical code verification (`coveragePassed`, `clusterMathPassed`, `groupPartitionPassed`)
   - Semantic verification (`verified`, `partially_verified`, `needs_review`)
   - Educator decisions (`pending`, `accepted`, `edited`, `dismissed`)
   *These dimensions represent distinct concerns and must never be conflated.*
3. **Fail-Closed Privacy Boundary**: Student data sanitization sits strictly upstream of inference. If privacy scanning fails, times out, or encounters an unexpected response, processing must abort. Unsanitized data is never sent to model endpoints.
4. **Stable Student Identity**: Student records must use deterministic pseudonymous identifiers (`Student 01`, `Student 02`...). Positional array indexing is prohibited for identity resolution.
5. **Deterministic Calculation Over Model Generation**: Counts, percentages, identity partitions, and quote validations must be calculated deterministically in application code, never trusted to model generation.

---

## 2. Privacy & Data Protection

- **Provider Configuration**: Sensitive Data Protection operates via Google Cloud SDP REST API v2 in production, or via a deterministic local implementation during automated tests and offline development.
- **Detector Scope**: Explicit, education-focused infoTypes (`PERSON_NAME`, `EMAIL_ADDRESS`, `PHONE_NUMBER`).
- **Zero Raw PII Persistence**: Do not store unredacted student text, names, emails, or phone numbers in application databases, browser localStorage, or server logs.
- **Fail-Closed Invariant**: Never use fallbacks resembling `redactedValue || originalValue`. If redaction cannot be confirmed, fail closed.

---

## 3. Architecture & Code Boundaries

- **Frontend**: Feature-oriented components with clear separation between state, presentation, and API integration.
- **Backend**: Express API with centralized request validation (Zod), structured logging, and typed error handling.
- **Model Client**: Stage-aware model routing, per-stage timeouts, and differentiated backoff/cooldown policies.
- **API Contracts**: Incoming requests are validated at the HTTP boundary. Errors return uniform `{ error: { code, message } }` objects without leaking server stack traces.

---

## 4. Development & Testing Workflow

Before submitting a change:

1. **Typecheck**: `npm run typecheck`
2. **Lint**: `npm run lint`
3. **Automated Tests**: `npm test`
4. **Production Build**: `npm run build`

All test assertions must test behavior directly. Never skip, weaken, or mock assertions solely to make a suite pass.

---

## 5. Commit Standards

Use Conventional Commits:

- `feat(scope): ...`
- `fix(scope): ...`
- `refactor(scope): ...`
- `test(scope): ...`
- `docs(scope): ...`
- `ci: ...`
