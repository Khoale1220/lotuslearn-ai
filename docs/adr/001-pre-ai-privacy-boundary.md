# ADR 001: Pre-AI Privacy Sanitization Boundary

## Context

Educational assessment involves student artifacts containing personal identifiers (names, emails, phone numbers, and student identities). Sending raw student identifiers to external generative AI models presents compliance and privacy risks.

## Decision

Sanitize all student artifacts strictly before data reaches any AI model. In production, utilize Google Cloud Sensitive Data Protection (REST API v2) with education-focused infoTypes (`PERSON_NAME`, `EMAIL_ADDRESS`, `PHONE_NUMBER`), and normalize all roster keys to deterministic pseudonyms (`Student 01`, `Student 02`...). If sanitization fails, times out, or encounters unexpected responses, the pipeline aborts immediately (fail closed).

## Consequences

- Prevents student PII from entering model prompts or inference training sets.
- Adds an upfront network latency step to the pipeline (~200ms to 800ms).
- Requires a local deterministic provider for offline test suites and developer environments without active GCP credentials.
