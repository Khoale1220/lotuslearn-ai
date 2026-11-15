/**
 * MIG-01B: Deterministic cross-language event ID fixtures.
 * TypeScript remains the source of truth during migration.
 */

import { computeEventId } from "../server/services/analyticalEventProducer";

const inputs = [
  {
    event_type: "ANALYSIS_INGESTED",
    run_id: "run-123",
    target_id: "fingerprint-abc",
  },
  {
    event_type: "ANALYSIS_INGESTED",
    run_id: "run-123",
    target_id: "fingerprint-abc",
  },
  {
    event_type: "FINDING_IDENTIFIED",
    run_id: "run-123",
    target_id: "cluster-1",
  },
  {
    event_type: "GROUP_FORMED",
    run_id: "run-123",
    target_id: "group-1",
  },
  {
    event_type: "VERIFICATION_AUDITED",
    run_id: "run-123",
    target_id: "audit",
  },
  {
    event_type: "DECISION_RECORDED",
    run_id: "run-123",
    target_id: "action-1",
  },
  {
    event_type: "ANALYSIS_INGESTED",
    run_id: "run-124",
    target_id: "fingerprint-abc",
  },
  {
    event_type: "ANALYSIS_INGESTED",
    run_id: "run-123",
    target_id: "fingerprint-different",
  },
] as const;

const vectors = inputs.map((item) => ({
  ...item,
  event_id: computeEventId(
    item.event_type,
    item.run_id,
    item.target_id,
  ),
}));

process.stdout.write(
  JSON.stringify(
    {
      schema_version: 1,
      source: "server/services/analyticalEventProducer.ts",
      vectors,
    },
    null,
    2,
  ) + "\n",
);
