# LotusLearn AI — Project Engineering State

## Current Phase: P4.0 (Completed: P4.0-SDP-COMPLETE)
Last Completed Phase: P4.0 (Google Cloud Sensitive Data Protection Privacy Gateway)

## Verified Baseline (Locked Invariants)
- TypeScript Typecheck: PASS
- Production Build: PASS
- Test Suite: 181 / 181 PASS (39 suites, 0 failures, 0 skips)
- Canonical Demo SHA-256 Fingerprint: `f82100e176cd233e0b65efbf00fc7b8947e7dab66aadff9389f1f25f128bf1ce`

## Core Locked Invariants
1. **Human Agency & Decision Authority**: Every AI artifact (cluster, intervention) initializes with `teacherDecision = 'pending'`. Only explicit educator actions change state to `accepted`, `edited`, or `dismissed`.
2. **Dimension Independence**:
   - Privacy Status (`passed` | `review_required` | `failed` | `not_checked`)
   - Evidence Grounding (`exact_source` | `normalized_exact_match` | `review_required` | `unsupported_citation`)
   - Code Verification (`coveragePassed` && `clusterMathPassed` && `groupPartitionPassed`)
   - Semantic Verifier (`verified` | `partially_verified` | `needs_review`)
   - Teacher Decisions (`pending` | `accepted` | `edited` | `dismissed`)
   *None of these dimensions may ever alias, collapse, or visually imply each other.*
3. **Fail-Closed Verification**: Missing evidence, missing audits, or failed privacy scans must strictly fail closed. Never synthesize a fake pass or fallback to raw sensitive content.
4. **Stable Student Identity**: Strict student ID contract (`Student 01`, `Student 02`...). No positional array fallback.
5. **No Hallucinated Claims or Metrics**: Honest educational UX. No fake confidence numbers, no "100% private" guarantees.

## Completed in P4.0
- **Pre-AI Privacy Boundary**: Google Cloud Sensitive Data Protection (REST v2 `content:deidentify` & `image:redact`) integrated strictly before Gemini Observer.
- **Detector Scope**: Explicit, education-focused infoTypes (`PERSON_NAME`, `EMAIL_ADDRESS`, `PHONE_NUMBER`).
- **Student Identity Minimization**: Application-level normalization to stable pseudonymous IDs.
- **Fail-Closed Contract**: Provider timeouts, auth failures, 5xx outages, and quota limits abort pipeline without sending student data to Gemini.
- **Zero-PII Logging**: Verified via regression testing that raw names, emails, and phone numbers are never logged or stored.
- **Canonical Privacy Audit**: `PrivacyAudit` object tracking `findingCount`, `findingTypeCounts`, `provider: 'google-sensitive-data-protection'`, `rawValuesRetained: false`, `failClosed: true`.
- **Honest Teacher UX**: Clear, calm privacy badges and error handling that preserves teacher inputs.

