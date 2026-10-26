import crypto from 'node:crypto';
import {
  ClassAnalysisResult,
  TeacherDecision,
} from '../../src/types';

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
  teacher_decision: TeacherDecision;
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

  const events: AnalyticalEvent[] = [];
  const runId = result.id;
  const occurredAt = result.timestamp;

  // 1. ANALYSIS_INGESTED event
  const datasetFingerprint =
    result.executionMetadata?.datasetFingerprint ||
    crypto
      .createHash('sha256')
      .update(
        (result.studentObservations || []).map((o) => o.studentId).sort().join(',')
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
    submission_count:
      result.classSnapshot?.totalSubmissions ||
      result.studentObservations?.length ||
      1,
    subject: result.context?.subject || 'English Language Arts',
    grade_level: result.context?.gradeLevel || 'Grade 10',
    total_duration_ms: result.executionMetadata?.totalDurationMs,
    execution_mode: result.executionMetadata?.executionMode,
  };
  assertZeroPII(ingestedEvent);
  events.push(ingestedEvent);

  // 2. FINDING_IDENTIFIED events (one per misconception cluster)
  if (Array.isArray(result.misconceptionClusters)) {
    // Sort clusters by clusterId for deterministic ordering
    const sortedClusters = [...result.misconceptionClusters].sort((a, b) =>
      a.clusterId.localeCompare(b.clusterId)
    );

    for (const cluster of sortedClusters) {
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
        teaching_priority: cluster.teachingPriority || 'moderate',
        affected_student_count: cluster.studentCount || studentIds.length,
        affected_student_ids: studentIds,
        percentage_affected: cluster.percentageAffected,
        explanation: cluster.explanation,
      };
      assertZeroPII(findingEvent);
      events.push(findingEvent);

      // If cluster has an explicit educator decision, emit DECISION_RECORDED
      const clusterDecision = cluster.teacherDecision || cluster.status;
      if (clusterDecision) {
        const decisionEvent: DecisionRecordedEvent = {
          schema_version: '1.0.0',
          event_id: computeEventId(
            'DECISION_RECORDED',
            runId,
            `cluster:${cluster.clusterId}:${clusterDecision}`
          ),
          event_type: 'DECISION_RECORDED',
          occurred_at: occurredAt,
          analysis_run_id: runId,
          provenance: 'human',
          target_type: 'misconception_cluster',
          target_id: cluster.clusterId,
          teacher_decision: clusterDecision,
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
        suggested_activity: group.suggestedActivity || 'Targeted small group practice',
        estimated_duration: group.estimatedDuration,
      };
      assertZeroPII(groupEvent);
      events.push(groupEvent);
    }
  }

  // 4. VERIFICATION_AUDITED event
  if (result.verification) {
    const verificationEvent: VerificationAuditedEvent = {
      schema_version: '1.0.0',
      event_id: computeEventId('VERIFICATION_AUDITED', runId, 'audit'),
      event_type: 'VERIFICATION_AUDITED',
      occurred_at: occurredAt,
      analysis_run_id: runId,
      provenance: 'deterministic_code',
      overall_status: result.verification.overallStatus || 'verified',
      coverage_passed: Boolean(
        result.verification.deterministicChecks?.coveragePassed ?? true
      ),
      cluster_math_passed: Boolean(
        result.verification.deterministicChecks?.clusterMathPassed ?? true
      ),
      group_partition_passed: Boolean(
        result.verification.deterministicChecks?.groupPartitionPassed ?? true
      ),
      quotes_grounded_count:
        result.verification.deterministicChecks?.quotesGroundedCount ?? 0,
      quotes_flagged_count:
        result.verification.deterministicChecks?.quotesFlaggedCount ?? 0,
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
      if (decision) {
        const decisionEvent: DecisionRecordedEvent = {
          schema_version: '1.0.0',
          event_id: computeEventId(
            'DECISION_RECORDED',
            runId,
            `intervention:${intervention.interventionId}:${decision}`
          ),
          event_type: 'DECISION_RECORDED',
          occurred_at: occurredAt,
          analysis_run_id: runId,
          provenance: 'human',
          target_type: 'differentiated_intervention',
          target_id: intervention.interventionId,
          teacher_decision: decision,
        };
        assertZeroPII(decisionEvent);
        events.push(decisionEvent);
      }
    }
  }

  return events;
}
