import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  produceAnalyticalEvents,
  computeEventId,
  assertZeroPII,
  AnalyticalEvent,
} from './analyticalEventProducer';
import { ClassAnalysisResult } from '../../src/types';

describe('Analytical Event Producer (DE-01)', () => {
  const mockAnalysisResult: ClassAnalysisResult = {
    id: 'run-test-20261026-001',
    timestamp: '2026-10-26T10:00:00.000Z',
    context: {
      subject: 'English Language Arts',
      gradeLevel: 'Grade 10',
      lessonTitle: 'Diagnostic: Present Perfect vs Past Simple',
      learningObjective: 'Diagnose finished-time markers with present perfect',
      expectedAnswerRubric: 'Identify appropriate usage of since, for, yesterday',
    },
    classSnapshot: {
      totalSubmissions: 5,
      misconceptionCount: 2,
      strongestConcept: 'Basic sentence structure',
      highestPriorityNeed: 'Finished time markers',
      overallRecommendation: 'Targeted small group practice',
    },
    studentObservations: [
      {
        studentId: 'Student 01',
        demonstratedUnderstanding: ['Simple past'],
        misconceptions: ['Present perfect with finished time markers'],
        supportingEvidence: [],
        rubricAlignment: 'Partial',
        confidence: 0.95,
        recommendedSupportLevel: 'guided_practice',
      },
      {
        studentId: 'Student 02',
        demonstratedUnderstanding: ['Present perfect'],
        misconceptions: [],
        supportingEvidence: [],
        rubricAlignment: 'Mastery',
        confidence: 0.98,
        recommendedSupportLevel: 'extension',
      },
    ],
    misconceptionClusters: [
      {
        clusterId: 'cluster-time-markers',
        misconceptionTitle: 'Finished-Time Markers with Present Perfect',
        explanation: 'Students conflate finished time adverbs with indefinite past experiential aspect.',
        affectedStudentIds: ['Student 01', 'Student 03'],
        studentCount: 2,
        percentageAffected: 40,
        evidenceExamples: [],
        teachingPriority: 'urgent',
        confidence: 0.92,
        recommendedInstructionalResponse: 'Timeline sorting exercise',
        teacherDecision: 'accepted',
        decisionRecordedAt: '2026-10-26T10:15:00.000Z',
      },
    ],
    instructionalGroups: [
      {
        groupId: 'group-guided-practice',
        groupName: 'Targeted Review: Time Markers',
        studentIds: ['Student 01', 'Student 03'],
        commonLearningNeed: 'Distinguishing finished vs unfinished time markers',
        evidenceSummary: 'Frequent usage of yesterday with have seen',
        suggestedActivity: 'Adverb sorting drill',
        teacherInstructions: 'Guide students to notice time adverbials before selecting auxiliary verbs',
        exampleQuestion: 'Which sentence correctly uses yesterday?',
        estimatedDuration: '15 min',
        successCriterion: '100% correct placement on exit ticket',
      },
    ],
    nextLessonPlan: {
      totalDuration: '25 min',
      targetObjective: 'Eliminate finished time markers with present perfect',
      phases: [],
    },
    interventions: [
      {
        interventionId: 'int-timeline-drill',
        clusterId: 'cluster-time-markers',
        targetMisconceptionTitle: 'Finished-Time Markers with Present Perfect',
        title: 'Time Anchor Timeline Drill',
        supportTier: 'Guided Practice',
        rationale: 'Addresses specific temporal confusion',
        suggestedActivity: 'Timeline card sorting',
        teacherScript: 'Notice the word yesterday. Is yesterday finished or unfinished?',
        exampleQuestion: 'I ___ visited my grandmother yesterday.',
        exitTicketQuestion: 'Write one sentence with since and one with yesterday.',
        teacherDecision: 'accepted',
        decisionRecordedAt: '2026-10-26T10:20:00.000Z',
      },
    ],
    verification: {
      overallStatus: 'verified',
      evidenceCoverageStatus: 'verified',
      objectiveAlignmentStatus: 'verified',
      unsupportedClaimsStatus: 'none_detected',
      pedagogicalPlausibility: 'sound',
      explanation: 'All citations verified against source text.',
      groundedCheckDetails: [],
      deterministicChecks: {
        coveragePassed: true,
        clusterMathPassed: true,
        groupPartitionPassed: true,
        quotesGroundedCount: 6,
        quotesFlaggedCount: 0,
      },
    },
    executionMetadata: {
      executionMode: 'demo_resilience',
      primaryModel: 'gemini-2.5-flash-lite',
      modelsUsed: ['gemini-2.5-flash-lite'],
      totalDurationMs: 1420,
      stageDurationsMs: {},
      submissionCount: 5,
      deterministicAuditPassed: true,
      runId: 'run-test-20261026-001',
      datasetFingerprint: 'a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890',
    },
  };

  it('produces deterministic event stream across multiple invocations', () => {
    const events1 = produceAnalyticalEvents(mockAnalysisResult);
    const events2 = produceAnalyticalEvents(mockAnalysisResult);

    assert.strictEqual(events1.length, events2.length);
    assert.deepStrictEqual(events1, events2);

    for (let i = 0; i < events1.length; i++) {
      assert.strictEqual(events1[i].event_id, events2[i].event_id);
      if (events1[i].event_type === 'DECISION_RECORDED') {
        assert.notStrictEqual(events1[i].occurred_at, mockAnalysisResult.timestamp);
      } else {
        assert.strictEqual(events1[i].occurred_at, mockAnalysisResult.timestamp);
      }
    }
  });

  it('emits all 5 core analytical event types with truthful, non-fabricated fields', () => {
    const events = produceAnalyticalEvents(mockAnalysisResult);
    const eventTypes = events.map((e) => e.event_type);

    assert.ok(eventTypes.includes('ANALYSIS_INGESTED'));
    assert.ok(eventTypes.includes('FINDING_IDENTIFIED'));
    assert.ok(eventTypes.includes('GROUP_FORMED'));
    assert.ok(eventTypes.includes('VERIFICATION_AUDITED'));
    assert.ok(eventTypes.includes('DECISION_RECORDED'));

    const ingested = events.find((e) => e.event_type === 'ANALYSIS_INGESTED')!;
    assert.strictEqual(ingested.schema_version, '1.0.0');
    assert.strictEqual(ingested.analysis_run_id, 'run-test-20261026-001');
    assert.strictEqual(ingested.provenance, 'source');
    assert.strictEqual(
      ingested.dataset_fingerprint,
      'a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890'
    );
    assert.strictEqual(ingested.submission_count, 5);
    assert.strictEqual(ingested.subject, 'English Language Arts');
    assert.strictEqual(ingested.grade_level, 'Grade 10');

    const finding = events.find((e) => e.event_type === 'FINDING_IDENTIFIED')!;
    assert.strictEqual(finding.finding_id, 'cluster-time-markers');
    assert.strictEqual(finding.provenance, 'gemini');
    assert.strictEqual(finding.teaching_priority, 'urgent');
    assert.deepStrictEqual(finding.affected_student_ids, ['Student 01', 'Student 03']);

    const group = events.find((e) => e.event_type === 'GROUP_FORMED')!;
    assert.strictEqual(group.group_id, 'group-guided-practice');
    assert.strictEqual(group.student_count, 2);
    assert.strictEqual(group.suggested_activity, 'Adverb sorting drill');

    const audit = events.find((e) => e.event_type === 'VERIFICATION_AUDITED')!;
    assert.strictEqual(audit.overall_status, 'verified');
    assert.strictEqual(audit.coverage_passed, true);
    assert.strictEqual(audit.cluster_math_passed, true);
    assert.strictEqual(audit.group_partition_passed, true);

    const decisions = events.filter((e) => e.event_type === 'DECISION_RECORDED') as any[];
    assert.strictEqual(decisions.length, 2); // 1 for cluster, 1 for intervention
    assert.strictEqual(decisions[0].provenance, 'human');
    assert.strictEqual(decisions[0].teacher_decision, 'accepted');
    // Human decision timestamp MUST NOT inherit analysis run timestamp
    assert.strictEqual(decisions[0].occurred_at, '2026-10-26T10:15:00.000Z');
    assert.strictEqual(decisions[0].decision_recorded_at, '2026-10-26T10:15:00.000Z');
    assert.notStrictEqual(decisions[0].occurred_at, mockAnalysisResult.timestamp);

    assert.strictEqual(decisions[1].occurred_at, '2026-10-26T10:20:00.000Z');
  });

  it('rejects event generation when subject or gradeLevel is missing from context', () => {
    const invalidResult = JSON.parse(JSON.stringify(mockAnalysisResult));
    delete invalidResult.context.subject;

    assert.throws(
      () => produceAnalyticalEvents(invalidResult),
      /missing subject in analysis context/
    );

    const invalidGradeResult = JSON.parse(JSON.stringify(mockAnalysisResult));
    invalidGradeResult.context.gradeLevel = '';
    assert.throws(
      () => produceAnalyticalEvents(invalidGradeResult),
      /missing grade_level in analysis context/
    );
  });

  it('rejects event generation when submission count is missing or zero', () => {
    const invalidResult = JSON.parse(JSON.stringify(mockAnalysisResult));
    delete invalidResult.classSnapshot.totalSubmissions;
    invalidResult.studentObservations = [];

    assert.throws(
      () => produceAnalyticalEvents(invalidResult),
      /missing or invalid submission_count/
    );
  });

  it('rejects cluster without explicit teachingPriority', () => {
    const invalidResult = JSON.parse(JSON.stringify(mockAnalysisResult));
    delete invalidResult.misconceptionClusters[0].teachingPriority;

    assert.throws(
      () => produceAnalyticalEvents(invalidResult),
      /missing teachingPriority/
    );
  });

  it('fails closed when verification checks are missing or malformed', () => {
    const invalidResult = JSON.parse(JSON.stringify(mockAnalysisResult));
    delete invalidResult.verification.deterministicChecks.coveragePassed;

    assert.throws(
      () => produceAnalyticalEvents(invalidResult),
      /missing mandatory deterministic check booleans/
    );
  });

  it('omits VERIFICATION_AUDITED truthfully when verification is not performed', () => {
    const unverifiedResult = JSON.parse(JSON.stringify(mockAnalysisResult));
    delete unverifiedResult.verification;

    const events = produceAnalyticalEvents(unverifiedResult);
    const hasVerification = events.some((e) => e.event_type === 'VERIFICATION_AUDITED');
    assert.strictEqual(hasVerification, false);
  });

  it('never emits DECISION_RECORDED for pending recommendation state', () => {
    const pendingResult = JSON.parse(JSON.stringify(mockAnalysisResult));
    pendingResult.misconceptionClusters[0].teacherDecision = 'pending';
    pendingResult.interventions[0].teacherDecision = 'pending';

    const events = produceAnalyticalEvents(pendingResult);
    const decisions = events.filter((e) => e.event_type === 'DECISION_RECORDED');
    assert.strictEqual(decisions.length, 0);
  });

  it('omits DECISION_RECORDED for legacy items lacking authentic decisionRecordedAt', () => {
    const legacyResult = JSON.parse(JSON.stringify(mockAnalysisResult));
    // Accepted but without authentic recorded timestamp
    delete legacyResult.misconceptionClusters[0].decisionRecordedAt;
    delete legacyResult.interventions[0].decisionRecordedAt;

    const events = produceAnalyticalEvents(legacyResult);
    const decisions = events.filter((e) => e.event_type === 'DECISION_RECORDED');
    assert.strictEqual(decisions.length, 0);
  });

  it('produces distinct event IDs for distinct decision actions across time', () => {
    const action1Result = JSON.parse(JSON.stringify(mockAnalysisResult));
    action1Result.misconceptionClusters[0].decisionRecordedAt = '2026-10-26T10:15:00.000Z';

    const action2Result = JSON.parse(JSON.stringify(mockAnalysisResult));
    action2Result.misconceptionClusters[0].decisionRecordedAt = '2026-10-26T10:25:00.000Z';

    const events1 = produceAnalyticalEvents(action1Result);
    const events2 = produceAnalyticalEvents(action2Result);

    const dec1 = events1.find((e) => e.event_type === 'DECISION_RECORDED')!;
    const dec2 = events2.find((e) => e.event_type === 'DECISION_RECORDED')!;

    assert.notStrictEqual(dec1.event_id, dec2.event_id);
  });

  it('fails closed when personal email or phone number is present in analytical event', () => {
    const validEvent = produceAnalyticalEvents(mockAnalysisResult)[0];

    // Clean event passes zero-PII validation
    assert.doesNotThrow(() => assertZeroPII(validEvent));

    // Event with leaked email must throw
    const leakedEmailEvent: AnalyticalEvent = {
      ...validEvent,
      subject: 'Class with teacher@school.edu in subject',
    } as any;
    assert.throws(
      () => assertZeroPII(leakedEmailEvent),
      /rejected: contains detected email address/
    );

    // Event with leaked phone must throw
    const leakedPhoneEvent: AnalyticalEvent = {
      ...validEvent,
      subject: 'Class phone 415-555-1212',
    } as any;
    assert.throws(
      () => assertZeroPII(leakedPhoneEvent),
      /rejected: contains detected phone number/
    );

    // Event with raw student text must throw
    const leakedTextEvent: any = {
      ...validEvent,
      studentText: 'I have went yesterday to the market',
    };
    assert.throws(
      () => assertZeroPII(leakedTextEvent),
      /rejected: contains forbidden field 'studentText'/
    );
  });

  it('produces identical 64-char hex event IDs for identical business keys', () => {
    const id1 = computeEventId('ANALYSIS_INGESTED', 'run-123', 'fingerprint-abc');
    const id2 = computeEventId('ANALYSIS_INGESTED', 'run-123', 'fingerprint-abc');
    const id3 = computeEventId('ANALYSIS_INGESTED', 'run-123', 'fingerprint-different');

    assert.strictEqual(id1, id2);
    assert.strictEqual(id1.length, 64);
    assert.match(id1, /^[0-9a-f]{64}$/);
    assert.notStrictEqual(id1, id3);
  });
});
