import {
  AnalysisIngestedEvent,
  FindingIdentifiedEvent,
  GroupFormedEvent,
  VerificationAuditedEvent,
  DecisionRecordedEvent,
  AnalyticalEvent,
  computeEventId,
  assertZeroPII,
} from './analyticalEventProducer';

export interface ReliabilityFixtureSuite {
  standardBatch: AnalyticalEvent[];
  replayPair: {
    original: AnalyticalEvent;
    replay: AnalyticalEvent;
  };
  payloadConflictPair: {
    original: AnalyticalEvent;
    conflicting: AnalyticalEvent;
  };
  analysisRunConflictPair: {
    runA: AnalysisIngestedEvent;
    runB: AnalysisIngestedEvent;
  };
  equalTimestampDecisions: {
    decisionA: DecisionRecordedEvent;
    decisionB: DecisionRecordedEvent;
  };
}

export function generateReliabilitySuite(): ReliabilityFixtureSuite {
  const runId = 'run-de02b-rel-001';
  const occurredAt = '2026-10-26T10:00:00Z';
  const fingerprint = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';

  const analysisRunEvent: AnalysisIngestedEvent = {
    schema_version: '1.0.0',
    event_id: computeEventId('ANALYSIS_INGESTED', runId, 'metadata'),
    event_type: 'ANALYSIS_INGESTED',
    occurred_at: occurredAt,
    analysis_run_id: runId,
    provenance: 'source',
    dataset_fingerprint: fingerprint,
    submission_count: 24,
    subject: 'Mathematics',
    grade_level: 'Grade 8',
    total_duration_ms: 1850,
    execution_mode: 'live_gemini',
  };

  const finding1: FindingIdentifiedEvent = {
    schema_version: '1.0.0',
    event_id: computeEventId('FINDING_IDENTIFIED', runId, 'cluster-fractions'),
    event_type: 'FINDING_IDENTIFIED',
    occurred_at: '2026-10-26T10:01:00Z',
    analysis_run_id: runId,
    provenance: 'gemini',
    finding_id: 'cluster-fractions',
    concept: 'Adding Fractions with Unlike Denominators',
    teaching_priority: 'urgent',
    affected_student_count: 8,
    affected_student_ids: ['stu-01', 'stu-02', 'stu-03', 'stu-04', 'stu-05', 'stu-06', 'stu-07', 'stu-08'],
    percentage_affected: 33.3,
    explanation: 'Students add numerators and denominators directly across.',
  };

  const finding2: FindingIdentifiedEvent = {
    schema_version: '1.0.0',
    event_id: computeEventId('FINDING_IDENTIFIED', runId, 'cluster-decimals'),
    event_type: 'FINDING_IDENTIFIED',
    occurred_at: '2026-10-26T10:02:00Z',
    analysis_run_id: runId,
    provenance: 'gemini',
    finding_id: 'cluster-decimals',
    concept: 'Decimal Place Alignment',
    teaching_priority: 'high',
    affected_student_count: 4,
    affected_student_ids: ['stu-09', 'stu-10', 'stu-11', 'stu-12'],
    percentage_affected: 16.7,
    explanation: 'Misaligned tenths and hundredths columns during subtraction.',
  };

  const group1: GroupFormedEvent = {
    schema_version: '1.0.0',
    event_id: computeEventId('GROUP_FORMED', runId, 'group-fractions-lab'),
    event_type: 'GROUP_FORMED',
    occurred_at: '2026-10-26T10:03:00Z',
    analysis_run_id: runId,
    provenance: 'gemini',
    group_id: 'group-fractions-lab',
    group_name: 'Visual Denominator Commonality Lab',
    student_count: 8,
    student_ids: ['stu-01', 'stu-02', 'stu-03', 'stu-04', 'stu-05', 'stu-06', 'stu-07', 'stu-08'],
    suggested_activity: 'Fraction strip folding and common multiple visualization',
    estimated_duration: '20 min',
  };

  const verification: VerificationAuditedEvent = {
    schema_version: '1.0.0',
    event_id: computeEventId('VERIFICATION_AUDITED', runId, 'audit'),
    event_type: 'VERIFICATION_AUDITED',
    occurred_at: '2026-10-26T10:04:00Z',
    analysis_run_id: runId,
    provenance: 'deterministic_code',
    overall_status: 'verified',
    coverage_passed: true,
    cluster_math_passed: true,
    group_partition_passed: true,
    quotes_grounded_count: 12,
    quotes_flagged_count: 0,
  };

  // Two distinct teacher actions sharing EXACT same target and timestamp (12:00:00Z)
  const sharedTimestamp = '2026-10-26T12:00:00Z';
  const decisionA: DecisionRecordedEvent = {
    schema_version: '1.0.0',
    event_id: computeEventId('DECISION_RECORDED', runId, 'action-cluster-fractions-1200-a'),
    event_type: 'DECISION_RECORDED',
    occurred_at: sharedTimestamp,
    decision_recorded_at: sharedTimestamp,
    analysis_run_id: runId,
    provenance: 'human',
    target_type: 'misconception_cluster',
    target_id: 'cluster-fractions',
    teacher_decision: 'accepted',
    notes: 'Teacher verified fraction diagnostic cluster (initial confirmation)',
  };

  const decisionB: DecisionRecordedEvent = {
    schema_version: '1.0.0',
    event_id: computeEventId('DECISION_RECORDED', runId, 'action-cluster-fractions-1200-b'),
    event_type: 'DECISION_RECORDED',
    occurred_at: sharedTimestamp,
    decision_recorded_at: sharedTimestamp,
    analysis_run_id: runId,
    provenance: 'human',
    target_type: 'misconception_cluster',
    target_id: 'cluster-fractions',
    teacher_decision: 'edited',
    notes: 'Teacher updated notes at identical timestamp',
  };

  // Distinct teacher decisions for standard batch
  const initialGroupDecision: DecisionRecordedEvent = {
    schema_version: '1.0.0',
    event_id: computeEventId('DECISION_RECORDED', runId, 'action-group-fractions-1100'),
    event_type: 'DECISION_RECORDED',
    occurred_at: '2026-10-26T11:00:00Z',
    decision_recorded_at: '2026-10-26T11:00:00Z',
    analysis_run_id: runId,
    provenance: 'human',
    target_type: 'differentiated_intervention',
    target_id: 'group-fractions-lab',
    teacher_decision: 'edited',
    notes: 'Teacher adjusted intervention time to 25 min',
  };

  const decisionC: DecisionRecordedEvent = {
    schema_version: '1.0.0',
    event_id: computeEventId('DECISION_RECORDED', runId, 'action-group-fractions-1230'),
    event_type: 'DECISION_RECORDED',
    occurred_at: '2026-10-26T12:30:00Z',
    decision_recorded_at: '2026-10-26T12:30:00Z',
    analysis_run_id: runId,
    provenance: 'human',
    target_type: 'differentiated_intervention',
    target_id: 'group-fractions-lab',
    teacher_decision: 'dismissed',
    notes: 'Teacher dismissed recommendation in favor of whole-class review',
  };

  const standardBatch: AnalyticalEvent[] = [
    analysisRunEvent,
    finding1,
    finding2,
    group1,
    verification,
    initialGroupDecision,
    decisionC,
  ];

  // Validate Zero-PII across all events
  for (const ev of [...standardBatch, decisionA, decisionB]) {
    assertZeroPII(ev);
  }

  // 1. Replay pair (exact identical event)
  const replayPair = {
    original: { ...analysisRunEvent },
    replay: { ...analysisRunEvent },
  };

  // 2. Payload conflict pair (same event_id, differing payload)
  const payloadConflictPair = {
    original: { ...analysisRunEvent },
    conflicting: {
      ...analysisRunEvent,
      subject: 'Algebra I Honors', // Changed payload
    },
  };

  // 3. Analysis run conflict pair (same analysis_run_id, conflicting immutable metadata)
  const conflictRunId = 'run-de02b-conflict-002';
  const runA: AnalysisIngestedEvent = {
    schema_version: '1.0.0',
    event_id: computeEventId('ANALYSIS_INGESTED', conflictRunId, 'metadata-a'),
    event_type: 'ANALYSIS_INGESTED',
    occurred_at: occurredAt,
    analysis_run_id: conflictRunId,
    provenance: 'source',
    dataset_fingerprint: fingerprint,
    submission_count: 20,
    subject: 'Mathematics',
    grade_level: 'Grade 8',
    total_duration_ms: 1200,
    execution_mode: 'live_gemini',
  };

  const runB: AnalysisIngestedEvent = {
    schema_version: '1.0.0',
    event_id: computeEventId('ANALYSIS_INGESTED', conflictRunId, 'metadata-b'),
    event_type: 'ANALYSIS_INGESTED',
    occurred_at: occurredAt,
    analysis_run_id: conflictRunId,
    provenance: 'source',
    dataset_fingerprint: fingerprint,
    submission_count: 20,
    subject: 'Mathematics',
    grade_level: 'Grade 8',
    total_duration_ms: 9999, // Conflicting duration!
    execution_mode: 'demo_resilience', // Conflicting execution mode!
  };

  return {
    standardBatch,
    replayPair,
    payloadConflictPair,
    analysisRunConflictPair: { runA, runB },
    equalTimestampDecisions: { decisionA, decisionB },
  };
}
