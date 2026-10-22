# ADR 002: Deterministic Validation Over Model Calculation

## Context

Generative language models excel at semantic interpretation, OCR transcription, and qualitative pedagogical reasoning, but frequently make subtle arithmetic errors, drop roster entries, or hallucinate citations when summarizing cohort data.

## Decision

Use Gemini exclusively for qualitative reasoning (evidence extraction, misconception labeling, intervention scaffolding, and adversarial semantic review). Use programmatic TypeScript code for:
- Student roster coverage and partition checks.
- Misconception prevalence arithmetic (percentage affected, student counts).
- Verbatim quote presence and provenance validation against source artifacts.
- Zod schema validation on all inputs and outputs.

## Consequences

- Zero arithmetic hallucinations in reported classroom metrics.
- Citation integrity can be programmatically verified without model roundtrips.
- Increases domain validation code footprint, necessitating focused test suites for edge cases (e.g., punctuation normalization, whitespace trimming).
