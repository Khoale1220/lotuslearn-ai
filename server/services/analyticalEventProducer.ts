import crypto from 'node:crypto';
import { ClassAnalysisResult } from '../../src/types';

export type AnalyticalEventType =
  | 'ANALYSIS_INGESTED'
  | 'FINDING_IDENTIFIED'
  | 'GROUP_FORMED'
  | 'VERIFICATION_AUDITED'
  | 'DECISION_RECORDED';

export type AnalyticalProvenance =
  | 'source'
  | 'gemini'
  | 'deterministic_code'
  | 'gemini_verifier'
  | 'human';

export interface BaseAnalyticalEnvelope {
  schema_version: '1.0.0';
  event_id: string;
  event_type: AnalyticalEventType;
  occurred_at: string;
  analysis_run_id: string;
  provenance: AnalyticalProvenance;
}

export interface AnalysisIngestedEvent extends BaseAnalyticalEnvelope {
  event_type: 'ANALYSIS_INGESTED';
  dataset_fingerprint: string;
  submission_count: number;
  subject: string;
  grade_level: string;
  total_duration_ms?: number;
  execution_mode?: 'live_gemini' | 'demo_resilience';
}

export interface FindingIdentifiedEvent extends BaseAnalyticalEnvelope {
  event_type: 'FINDING_IDENTIFIED';
  finding_id: string;
  concept: string;
  teaching_priority: 'urgent' | 'high' | 'moderate';
  affected_student_count: number;
  affected_student_ids: string[];
  percentage_affected?: number;
  explanation?: string;
}

export interface GroupFormedEvent extends BaseAnalyticalEnvelope {
  event_type: 'GROUP_FORMED';
  group_id: string;
  group_name: string;
  student_count: number;
  student_ids: string[];
  suggested_activity: string;
  estimated_duration?: string;
}

export interface VerificationAuditedEvent extends BaseAnalyticalEnvelope {
  event_type: 'VERIFICATION_AUDITED';
  overall_status: 'verified' | 'partially_verified' | 'needs_review';
  coverage_passed: boolean;
  cluster_math_passed: boolean;
  group_partition_passed: boolean;
  quotes_grounded_count: number;
  quotes_flagged_count: number;
}

export interface DecisionRecordedEvent extends BaseAnalyticalEnvelope {
  event_type: 'DECISION_RECORDED';
  target_type: 'misconception_cluster' | 'differentiated_intervention';
  target_id: string;
  teacher_decision: 'accepted' | 'edited' | 'dismissed';
  decision_recorded_at: string;
  notes?: string;
}

export type AnalyticalEvent =
  | AnalysisIngestedEvent
  | FindingIdentifiedEvent
  | GroupFormedEvent
  | VerificationAuditedEvent
  | DecisionRecordedEvent;

/**
 * Computes a deterministic SHA-256 event ID.
 * Business key ensures exact deduplication and replay safety.
 */
export function computeEventId(
  eventType: AnalyticalEventType,
  analysisRunId: string,
  businessKey: string
): string {
  return crypto
    .createHash('sha256')
    .update(`${eventType}:${analysisRunId}:${businessKey}`, 'utf8')
    .digest('hex');
}

/**
 * Defense-in-depth zero-PII validation.
 * Verifies that no student text, raw names, emails, phone numbers, or credentials
 * enter analytical event streams.
 */
export function assertZeroPII(event: AnalyticalEvent): void {
  const emailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/i;
  const phoneRegex = /\b(?:\+?1[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]\d{3}[-.\s]\d{4}\b/;

  // Check all string fields in event for PII
  function scanValue(val: unknown, keyName: string): void {
    if (typeof val === 'string') {
      // Do not scan deterministic hex hashes or timestamps for phone numbers
      if (keyName === 'event_id' || keyName === 'dataset_fingerprint' || keyName === 'occurred_at') {
        return;
      }

      if (emailRegex.test(val)) {
        throw new Error('Analytical event rejected: contains detected email address.');
      }
      if (phoneRegex.test(val)) {
        throw new Error('Analytical event rejected: contains detected phone number.');
      }
    } else if (Array.isArray(val)) {
      for (const item of val) {
        scanValue(item, keyName);
      }
    } else if (val && typeof val === 'object') {
      for (const [k, v] of Object.entries(val)) {
        scanValue(v, k);
      }
    }
  }

  scanValue(event, 'root');

  // Ensure forbidden raw fields are not present
  const serialized = JSON.stringify(event);
  const forbiddenKeys = [
    'studentText',
    'student_text',
    'rawText',
    'raw_text',
    'imageBase64',
    'image_base64',
    'apiKey',
    'api_key',
  ];

  for (const key of forbiddenKeys) {
    if (serialized.includes(`"${key}"`)) {
      throw new Error(`Analytical event rejected: contains forbidden field '${key}'.`);
    }
  }

  // Validate student IDs in affected lists conform to pseudonymous format
  if ('affected_student_ids' in event && Array.isArray(event.affected_student_ids)) {
    for (const sid of event.affected_student_ids) {
      if (typeof sid !== 'string' || sid.trim().length === 0) {
        throw new Error('Analytical event rejected: invalid student ID format.');
      }
    }
  }

  if ('student_ids' in event && Array.isArray(event.student_ids)) {
    for (const sid of event.student_ids) {
      if (typeof sid !== 'string' || sid.trim().length === 0) {
        throw new Error('Analytical event rejected: invalid student ID format.');
      }
    }
  }
}

/**
 * Produces canonical, deterministic analytical events from a ClassAnalysisResult.
 * Ensures:
 * 1. Zero raw student PII enters event payloads.
 * 2. Deterministic SHA-256 event IDs.
 * 3. Occurred_at timestamp strictly inherited from domain analysis result (NEVER Date.now()).
 * 4. Stable ordering and normalized schemas matching JSON Schema Draft 2020-12.
 */
export function produceAnalyticalEvents(
  result: ClassAnalysisResult
): AnalyticalEvent[] {
  if (!result || !result.id) {
    throw new Error('Invalid analysis result: missing id.');
  }

  if (!result.timestamp) {
    throw new Error('Invalid analysis result: missing timestamp.');
  }

  if (!result.context?.subject || !result.context.subject.trim()) {
    throw new Error('Analytical event rejected: missing subject in analysis context.');
  }

  if (!result.context?.gradeLevel || !result.context.gradeLevel.trim()) {
    throw new Error('Analytical event rejected: missing grade_level in analysis context.');
  }

  const submissionCount =
    result.classSnapshot?.totalSubmissions ??
    (result.studentObservations && result.studentObservations.length > 0
      ? result.studentObservations.length
      : undefined);

  if (typeof submissionCount !== 'number' || submissionCount < 1) {
    throw new Error('Analytical event rejected: missing or invalid submission_count.');
  }

  const events: AnalyticalEvent[] = [];
  const runId = result.id;
  const occurredAt = result.timestamp;

  // 1. ANALYSIS_INGESTED event
  const datasetFingerprint =
    result.executionMetadata?.datasetFingerprint ||
    crypto
      .createHash('sha256')
      .update(
        (result.studentObservations || [])
          .map(
            (o) =>
              `${o.studentId}:${o.demonstratedUnderstanding?.slice().sort().join(',') || ''}:${(o.misconceptions || []).slice().sort().join(',')}`
          )
          .sort()
          .join(';')
      )
      .digest('hex');

  const ingestedEvent: AnalysisIngestedEvent = {
    schema_version: '1.0.0',
    event_id: computeEventId('ANALYSIS_INGESTED', runId, datasetFingerprint),
    event_type: 'ANALYSIS_INGESTED',
    occurred_at: occurredAt,
    analysis_run_id: runId,
    provenance: 'source',
    dataset_fingerprint: datasetFingerprint,
    submission_count: submissionCount,
    subject: result.context.subject,
    grade_level: result.context.gradeLevel,
    total_duration_ms: result.executionMetadata?.totalDurationMs,
    execution_mode: result.executionMetadata?.executionMode,
  };
  assertZeroPII(ingestedEvent);
  events.push(ingestedEvent);

  // 2. FINDING_IDENTIFIED events (one per misconception cluster)
  if (Array.isArray(result.misconceptionClusters)) {
    const sortedClusters = [...result.misconceptionClusters].sort((a, b) =>
      a.clusterId.localeCompare(b.clusterId)
    );

    for (const cluster of sortedClusters) {
      if (!cluster.teachingPriority) {
        throw new Error(
          `Analytical event rejected: cluster ${cluster.clusterId} is missing teachingPriority.`
        );
      }

      const studentIds = [...(cluster.affectedStudentIds || [])].sort();
      const findingEvent: FindingIdentifiedEvent = {
        schema_version: '1.0.0',
        event_id: computeEventId('FINDING_IDENTIFIED', runId, cluster.clusterId),
        event_type: 'FINDING_IDENTIFIED',
        occurred_at: occurredAt,
        analysis_run_id: runId,
        provenance: 'gemini',
        finding_id: cluster.clusterId,
        concept: cluster.misconceptionTitle,
        teaching_priority: cluster.teachingPriority,
        affected_student_count: cluster.studentCount || studentIds.length,
        affected_student_ids: studentIds,
        percentage_affected: cluster.percentageAffected,
        explanation: cluster.explanation,
      };
      assertZeroPII(findingEvent);
      events.push(findingEvent);

      // Human educator decisions:
      // Real human decision must be accepted, edited, or dismissed. Never pending.
      // Must have authentic decisionRecordedAt; never inherit analysis timestamp.
      // Legacy records without decisionRecordedAt must not receive a fabricated timestamp.
      const clusterDecision = cluster.teacherDecision || cluster.status;
      if (
        clusterDecision &&
        clusterDecision !== 'pending' &&
        ['accepted', 'edited', 'dismissed'].includes(clusterDecision) &&
        cluster.decisionRecordedAt
      ) {
        const decisionEvent: DecisionRecordedEvent = {
          schema_version: '1.0.0',
          event_id: computeEventId(
            'DECISION_RECORDED',
            runId,
            `cluster:${cluster.clusterId}:${clusterDecision}:${cluster.decisionRecordedAt}`
          ),
          event_type: 'DECISION_RECORDED',
          occurred_at: cluster.decisionRecordedAt,
          analysis_run_id: runId,
          provenance: 'human',
          target_type: 'misconception_cluster',
          target_id: cluster.clusterId,
          teacher_decision: clusterDecision as 'accepted' | 'edited' | 'dismissed',
          decision_recorded_at: cluster.decisionRecordedAt,
        };
        assertZeroPII(decisionEvent);
        events.push(decisionEvent);
      }
    }
  }

  // 3. GROUP_FORMED events (one per instructional group)
  if (Array.isArray(result.instructionalGroups)) {
    const sortedGroups = [...result.instructionalGroups].sort((a, b) =>
      a.groupId.localeCompare(b.groupId)
    );

    for (const group of sortedGroups) {
      if (!group.suggestedActivity || !group.suggestedActivity.trim()) {
        throw new Error(
          `Analytical event rejected: group ${group.groupId} is missing suggestedActivity.`
        );
      }

      const groupStudentIds = [...(group.studentIds || [])].sort();
      const groupEvent: GroupFormedEvent = {
        schema_version: '1.0.0',
        event_id: computeEventId('GROUP_FORMED', runId, group.groupId),
        event_type: 'GROUP_FORMED',
        occurred_at: occurredAt,
        analysis_run_id: runId,
        provenance: 'gemini',
        group_id: group.groupId,
        group_name: group.groupName,
        student_count: groupStudentIds.length,
        student_ids: groupStudentIds,
        suggested_activity: group.suggestedActivity,
        estimated_duration: group.estimatedDuration,
      };
      assertZeroPII(groupEvent);
      events.push(groupEvent);
    }
  }

  // 4. VERIFICATION_AUDITED event
  // Missing verification must NEVER become successful verification.
  // Missing status does not become verified.
  // Missing check booleans do not default to true.
  if (result.verification) {
    const checks = result.verification.deterministicChecks;
    if (
      !checks ||
      typeof checks.coveragePassed !== 'boolean' ||
      typeof checks.clusterMathPassed !== 'boolean' ||
      typeof checks.groupPartitionPassed !== 'boolean'
    ) {
      throw new Error(
        'Analytical event rejected: verification event missing mandatory deterministic check booleans.'
      );
    }
    const status = result.verification.overallStatus;
    if (!status || !['verified', 'partially_verified', 'needs_review'].includes(status)) {
      throw new Error(
        `Analytical event rejected: verification overallStatus is invalid or missing ('${status}').`
      );
    }

    const verificationEvent: VerificationAuditedEvent = {
      schema_version: '1.0.0',
      event_id: computeEventId('VERIFICATION_AUDITED', runId, 'audit'),
      event_type: 'VERIFICATION_AUDITED',
      occurred_at: occurredAt,
      analysis_run_id: runId,
      provenance: 'deterministic_code',
      overall_status: status as 'verified' | 'partially_verified' | 'needs_review',
      coverage_passed: checks.coveragePassed,
      cluster_math_passed: checks.clusterMathPassed,
      group_partition_passed: checks.groupPartitionPassed,
      quotes_grounded_count: checks.quotesGroundedCount ?? 0,
      quotes_flagged_count: checks.quotesFlaggedCount ?? 0,
    };
    assertZeroPII(verificationEvent);
    events.push(verificationEvent);
  }

  // 5. DECISION_RECORDED events for interventions if present
  if (Array.isArray(result.interventions)) {
    const sortedInterventions = [...result.interventions].sort((a, b) =>
      a.interventionId.localeCompare(b.interventionId)
    );

    for (const intervention of sortedInterventions) {
      const decision = intervention.teacherDecision || intervention.status;
      if (
        decision &&
        decision !== 'pending' &&
        ['accepted', 'edited', 'dismissed'].includes(decision) &&
        intervention.decisionRecordedAt
      ) {
        const decisionEvent: DecisionRecordedEvent = {
          schema_version: '1.0.0',
          event_id: computeEventId(
            'DECISION_RECORDED',
            runId,
            `intervention:${intervention.interventionId}:${decision}:${intervention.decisionRecordedAt}`
          ),
          event_type: 'DECISION_RECORDED',
          occurred_at: intervention.decisionRecordedAt,
          analysis_run_id: runId,
          provenance: 'human',
          target_type: 'differentiated_intervention',
          target_id: intervention.interventionId,
          teacher_decision: decision as 'accepted' | 'edited' | 'dismissed',
          decision_recorded_at: intervention.decisionRecordedAt,
        };
        assertZeroPII(decisionEvent);
        events.push(decisionEvent);
      }
    }
  }

  return events;
}
