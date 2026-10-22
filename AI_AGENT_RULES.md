# LotusLearn AI — Engineering Agent Rules

1. **Read PROJECT_STATE.md First**: Always review the current phase, baseline status, and locked invariants before writing code.
2. **Preserve Locked Invariants**: Never compromise the 5 core invariants (Human Agency, Dimension Independence, Fail-Closed Verification, Stable Identity, Honest Metrics).
3. **Never Fabricate Outcomes**: Do not invent fake AI confidence scores, fake benchmarks, or unverified claims.
4. **Never Weaken Tests**: Never delete, skip, or soften assertions to get a green test suite. All tests must be rigorous and defensible.
5. **Fail Closed on Missing Evidence or Privacy**: If validation or privacy sanitization cannot be verified, abort AI processing and preserve teacher inputs.
6. **Preserve Stable IDs and Provenance**: Student IDs must remain deterministic across pipeline stages without positional fallback.
7. **Protect Demo Dataset Isolation**: Do not alter canonical demo data or the SHA-256 fingerprint (`f82100e176cd233e0b65efbf00fc7b8947e7dab66aadff9389f1f25f128bf1ce`). Custom sessions must never receive demo fallback data.
8. **No Scope Creep**: Confine changes to the active phase. Record future ideas as debts/notes, not unrequested features.
9. **Run All Quality Gates**: Confirm `npm run typecheck`, `npm test`, `npm run lint`, and `npm run build` succeed before concluding any task.
10. **Update PROJECT_STATE.md**: Keep durable project state updated upon completing any milestone or phase.
