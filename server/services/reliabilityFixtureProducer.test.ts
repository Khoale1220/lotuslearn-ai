import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateReliabilitySuite } from './reliabilityFixtureProducer';

describe('DE-02B Cross-Language Reliability Fixture Producer', () => {
  it('generates deterministic identical outputs across repeated invocations', () => {
    const suite1 = generateReliabilitySuite();
    const suite2 = generateReliabilitySuite();

    assert.deepEqual(suite1, suite2);
    assert.equal(
      JSON.stringify(suite1),
      JSON.stringify(suite2),
      'Serialized output must be bit-for-bit identical'
    );
  });

  it('produces valid 64-character SHA-256 event IDs', () => {
    const suite = generateReliabilitySuite();
    const hex64Regex = /^[0-9a-f]{64}$/;

    for (const ev of suite.standardBatch) {
      assert.match(
        ev.event_id,
        hex64Regex,
        `Event ID ${ev.event_id} must be 64-char lowercase hex`
      );
      assert.match(
        ev.occurred_at,
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/,
        'Timestamp must be ISO 8601 UTC'
      );
    }
  });

  it('preserves equal timestamp decisions for same target with unique event IDs', () => {
    const suite = generateReliabilitySuite();
    const { decisionA, decisionB } = suite.equalTimestampDecisions;

    assert.equal(decisionA.occurred_at, decisionB.occurred_at);
    assert.equal(decisionA.decision_recorded_at, decisionB.decision_recorded_at);
    assert.equal(decisionA.analysis_run_id, decisionB.analysis_run_id);
    assert.equal(decisionA.target_type, decisionB.target_type);
    assert.equal(decisionA.target_id, decisionB.target_id);
    assert.notEqual(decisionA.event_id, decisionB.event_id);
    assert.notEqual(decisionA.teacher_decision, decisionB.teacher_decision);
  });

  it('generates exact payload conflict pair with matching event_id but differing payload', () => {
    const { original, conflicting } = generateReliabilitySuite().payloadConflictPair;

    assert.equal(original.event_id, conflicting.event_id);
    assert.notEqual(JSON.stringify(original), JSON.stringify(conflicting));
  });

  it('generates analysis run conflict pair with matching analysis_run_id but differing metadata', () => {
    const { runA, runB } = generateReliabilitySuite().analysisRunConflictPair;

    assert.equal(runA.analysis_run_id, runB.analysis_run_id);
    assert.notEqual(runA.total_duration_ms, runB.total_duration_ms);
    assert.notEqual(runA.execution_mode, runB.execution_mode);
  });
});
