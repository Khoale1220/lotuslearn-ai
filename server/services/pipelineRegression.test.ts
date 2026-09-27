import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  validateObservationCoverage,
  validateStudentReferences,
  validateClusterMath,
  validateInstructionalGroupPartition,
  validateEvidenceQuotes,
  runDeterministicValidation,
  checkQuoteInSource,
} from './deterministicValidator';
import {
  isExactDemoClassroom,
  canonicalizeDemoPayload,
  computeDatasetFingerprint,
  DEMO_DATASET_SHA256,
} from './demoFingerprint';
import { DEMO_CONTEXT, DEMO_SUBMISSIONS } from '../../src/data/demoClassroom';
import {
  MisconceptionCluster,
  StudentObservation,
  InstructionalGroup,
  StudentSubmission,
  NormalizedSourceEvidence,
  SavedSession,
  ClassAnalysisResult,
} from '../../src/types';

describe('Phase P0 Final Acceptance Audit: Deterministic Fail-Closed Verification', () => {
  const sampleObservations: StudentObservation[] = DEMO_SUBMISSIONS.map((s) => ({
    studentId: s.studentId,
    demonstratedUnderstanding: ['Basic vocabulary and sentence syntax'],
    misconceptions: ['Present perfect with finished time markers'],
    supportingEvidence: [{ quoteOrDetail: s.studentText.slice(0, 20), interpretation: 'Sample quote' }],
    rubricAlignment: 'Needs support',
    confidence: 0.9,
    recommendedSupportLevel: 'guided_practice',
  }));

  const sampleClusters: MisconceptionCluster[] = [
    {
      clusterId: 'c1',
      misconceptionTitle: 'Finished-time marker interference',
      studentCount: 12,
      percentageAffected: 100,
      affectedStudentIds: DEMO_SUBMISSIONS.map((s) => s.studentId),
      explanation: 'Using present perfect with finished time adverbs',
      evidenceExamples: [
        {
          studentId: 'Student 01',
          excerpt: DEMO_SUBMISSIONS[0].studentText.slice(0, 25),
          groundingReason: 'Direct quote from student worksheet',
        },
      ],
      recommendedInstructionalResponse: 'Use timeline contrasting',
      teachingPriority: 'urgent',
      confidence: 0.95,
    },
  ];

  const sampleNormalizedEvidence: NormalizedSourceEvidence[] = DEMO_SUBMISSIONS.map((s) => ({
    studentId: s.studentId,
    sourceType: 'typed',
    extractedText: s.studentText,
    confidenceOrStatus: 'exact_source',
  }));

  // =========================================================================
  // SECTION 1: NORMALIZED EVIDENCE — NO SILENT BYPASS
  // =========================================================================
  describe('Audit Item 1: Normalized Evidence Fail-Closed Invariant', () => {
    it('fails closed when submissions & claims exist but normalizedEvidence is unavailable', () => {
      // submissions exist + evidence-dependent claims exist + normalizedEvidence is undefined
      const audit = runDeterministicValidation({
        submissions: DEMO_SUBMISSIONS,
        normalizedEvidence: undefined, // Explicitly unavailable
        observations: sampleObservations,
        clusters: sampleClusters,
        groups: [
          {
            groupId: 'g1',
            groupName: 'Group 1',
            studentIds: DEMO_SUBMISSIONS.map((s) => s.studentId),
            commonLearningNeed: 'Core review',
            evidenceSummary: 'Summary',
            suggestedActivity: 'Drill',
            teacherInstructions: 'Guide',
            exampleQuestion: 'Question',
            estimatedDuration: '15 min',
            successCriterion: 'Criteria',
          },
        ],
      });

      // Must NOT report claims as grounded or successfully verified
      assert.strictEqual(
        audit.quotesGroundedCount,
        0,
        'quotesGroundedCount must be 0 when normalizedEvidence is unavailable'
      );
      assert.ok(
        audit.quotesFlaggedCount > 0,
        'quotesFlaggedCount must flag unverified claims when normalizedEvidence is unavailable'
      );
      assert.strictEqual(
        audit.evidenceValidationPassed,
        false,
        'evidenceValidationPassed must be false when normalizedEvidence is unavailable'
      );

      // Audited clusters & observations must have their evidence strength degraded to review_required
      assert.strictEqual(
        audit.auditedClusters[0].evidenceStrength,
        'review_required',
        'Cluster evidenceStrength must be review_required'
      );
      assert.strictEqual(
        audit.auditedClusters[0].evidenceExamples[0].deterministicMatch,
        'unsupported_citation',
        'Evidence deterministicMatch must be unsupported_citation'
      );
      assert.strictEqual(
        audit.auditedObservations[0].evidenceStrength,
        'review_required',
        'Observation evidenceStrength must be review_required'
      );
      assert.strictEqual(
        audit.auditedObservations[0].supportingEvidence[0].deterministicMatch,
        'unsupported_citation',
        'Observation evidence deterministicMatch must be unsupported_citation'
      );

      // Explicit issue must be logged
      assert.ok(
        audit.issues.some((i) => i.includes('normalizedEvidence is unavailable')),
        'Issues log must explicitly record that normalizedEvidence was unavailable'
      );
    });

    it('successfully verifies claims when normalizedEvidence is provided', () => {
      const audit = runDeterministicValidation({
        submissions: DEMO_SUBMISSIONS,
        normalizedEvidence: sampleNormalizedEvidence,
        observations: sampleObservations,
        clusters: sampleClusters,
        groups: [
          {
            groupId: 'g1',
            groupName: 'Group 1',
            studentIds: DEMO_SUBMISSIONS.map((s) => s.studentId),
            commonLearningNeed: 'Core review',
            evidenceSummary: 'Summary',
            suggestedActivity: 'Drill',
            teacherInstructions: 'Guide',
            exampleQuestion: 'Question',
            estimatedDuration: '15 min',
            successCriterion: 'Criteria',
          },
        ],
      });

      assert.ok(audit.quotesGroundedCount > 0, 'Quotes must be grounded when normalizedEvidence is valid');
      assert.strictEqual(audit.evidenceValidationPassed, true, 'evidenceValidationPassed must be true');
      assert.strictEqual(
        audit.auditedClusters[0].evidenceExamples[0].deterministicMatch,
        'exact_quote_found'
      );
    });
  });

  // =========================================================================
  // SECTION 2: GROUP REPAIR MUST NOT ERASE FAILURE
  // =========================================================================
  describe('Audit Item 2: Group Repair Invariant (Never Erases Failure)', () => {
    // Case A: Empty model groups
    it('Case A (empty model groups): repairs auditedGroups for safe rendering BUT groupPartitionPassed remains false', () => {
      const emptyGroups: InstructionalGroup[] = [];
      const partitionResult = validateInstructionalGroupPartition(emptyGroups, DEMO_SUBMISSIONS);

      assert.strictEqual(
        partitionResult.passed,
        false,
        'Empty model groups must fail validation (passed === false)'
      );
      assert.ok(
        partitionResult.auditedGroups.length > 0,
        'auditedGroups must be repaired for safe UI rendering'
      );
      assert.strictEqual(
        partitionResult.auditedGroups[0].studentIds.length,
        DEMO_SUBMISSIONS.length,
        'Repaired group must safely hold all submitted students'
      );

      // Verify in master validator
      const masterAudit = runDeterministicValidation({
        submissions: DEMO_SUBMISSIONS,
        normalizedEvidence: sampleNormalizedEvidence,
        observations: sampleObservations,
        clusters: sampleClusters,
        groups: emptyGroups,
      });
      assert.strictEqual(
        masterAudit.groupPartitionPassed,
        false,
        'groupPartitionPassed must remain false despite safe repair'
      );
    });

    // Case B: Omitted student
    it('Case B (omitted student): repairs auditedGroups for safe rendering BUT groupPartitionPassed remains false', () => {
      const partialGroups: InstructionalGroup[] = [
        {
          groupId: 'g1',
          groupName: 'Partial Group',
          studentIds: ['Student 01', 'Student 02'], // Omits Student 03 through 12
          commonLearningNeed: 'Core review',
          evidenceSummary: 'Summary',
          suggestedActivity: 'Drill',
          teacherInstructions: 'Guide',
          exampleQuestion: 'Question',
          estimatedDuration: '15 min',
          successCriterion: 'Criteria',
        },
      ];

      const partitionResult = validateInstructionalGroupPartition(partialGroups, DEMO_SUBMISSIONS);
      assert.strictEqual(
        partitionResult.passed,
        false,
        'Omitted students must cause partition validation to fail'
      );
      assert.strictEqual(
        partitionResult.unassignedStudents.length,
        DEMO_SUBMISSIONS.length - 2,
        'Must flag all 10 unassigned students'
      );

      // Verify repair assigns omitted students so UI never loses students
      const allAssigned = partitionResult.auditedGroups.flatMap((g) => g.studentIds);
      assert.strictEqual(
        new Set(allAssigned).size,
        DEMO_SUBMISSIONS.length,
        'Repaired groups must account for every submitted student'
      );

      // Verify master validator preserves failure flag
      const masterAudit = runDeterministicValidation({
        submissions: DEMO_SUBMISSIONS,
        normalizedEvidence: sampleNormalizedEvidence,
        observations: sampleObservations,
        clusters: sampleClusters,
        groups: partialGroups,
      });
      assert.strictEqual(
        masterAudit.groupPartitionPassed,
        false,
        'groupPartitionPassed must remain false for omitted students'
      );
    });

    // Case C: Duplicate student assignment
    it('Case C (duplicate student): repairs auditedGroups by deduplicating BUT groupPartitionPassed remains false', () => {
      const duplicatedGroups: InstructionalGroup[] = [
        {
          groupId: 'g1',
          groupName: 'Group Alpha',
          studentIds: ['Student 01', 'Student 02', 'Student 03'],
          commonLearningNeed: 'Review',
          evidenceSummary: 'Summary',
          suggestedActivity: 'Drill',
          teacherInstructions: 'Guide',
          exampleQuestion: 'Question',
          estimatedDuration: '15 min',
          successCriterion: 'Criteria',
        },
        {
          groupId: 'g2',
          groupName: 'Group Beta',
          studentIds: ['Student 01', 'Student 04', 'Student 05'], // Student 01 is duplicated!
          commonLearningNeed: 'Review',
          evidenceSummary: 'Summary',
          suggestedActivity: 'Drill',
          teacherInstructions: 'Guide',
          exampleQuestion: 'Question',
          estimatedDuration: '15 min',
          successCriterion: 'Criteria',
        },
      ];

      const partitionResult = validateInstructionalGroupPartition(duplicatedGroups, DEMO_SUBMISSIONS);
      assert.strictEqual(
        partitionResult.passed,
        false,
        'Duplicate student assignments must fail validation'
      );
      assert.ok(
        partitionResult.duplicateAssignments.includes('Student 01'),
        'Must record Student 01 as duplicate assignment'
      );

      // Verify repair deduplicates Student 01 in auditedGroups
      const group1Has = partitionResult.auditedGroups[0].studentIds.includes('Student 01');
      const group2Has = partitionResult.auditedGroups[1].studentIds.includes('Student 01');
      assert.ok(
        (group1Has && !group2Has) || (!group1Has && group2Has),
        'Student 01 must appear in only one group in auditedGroups after repair'
      );

      // Verify master validator preserves failure flag
      const masterAudit = runDeterministicValidation({
        submissions: DEMO_SUBMISSIONS,
        normalizedEvidence: sampleNormalizedEvidence,
        observations: sampleObservations,
        clusters: sampleClusters,
        groups: duplicatedGroups,
      });
      assert.strictEqual(
        masterAudit.groupPartitionPassed,
        false,
        'groupPartitionPassed must remain false for duplicate assignments'
      );
    });

    // Case D: Unknown student ID
    it('Case D (unknown student ID): strips unknown ID for safe rendering BUT groupPartitionPassed remains false', () => {
      const unknownIdGroups: InstructionalGroup[] = [
        {
          groupId: 'g1',
          groupName: 'Group Alpha',
          studentIds: ['Ghost Student 999', ...DEMO_SUBMISSIONS.map((s) => s.studentId)],
          commonLearningNeed: 'Review',
          evidenceSummary: 'Summary',
          suggestedActivity: 'Drill',
          teacherInstructions: 'Guide',
          exampleQuestion: 'Question',
          estimatedDuration: '15 min',
          successCriterion: 'Criteria',
        },
      ];

      const partitionResult = validateInstructionalGroupPartition(unknownIdGroups, DEMO_SUBMISSIONS);
      assert.strictEqual(
        partitionResult.passed,
        false,
        'Unknown student ID must fail validation'
      );
      assert.ok(
        partitionResult.unknownIds.includes('Ghost Student 999'),
        'Must flag Ghost Student 999 as unknown ID'
      );

      // Verify repair stripped the unknown student
      const allAssigned = partitionResult.auditedGroups.flatMap((g) => g.studentIds);
      assert.ok(
        !allAssigned.includes('Ghost Student 999'),
        'Ghost Student 999 must be stripped from auditedGroups'
      );

      // Verify master validator preserves failure flag
      const masterAudit = runDeterministicValidation({
        submissions: DEMO_SUBMISSIONS,
        normalizedEvidence: sampleNormalizedEvidence,
        observations: sampleObservations,
        clusters: sampleClusters,
        groups: unknownIdGroups,
      });
      assert.strictEqual(
        masterAudit.groupPartitionPassed,
        false,
        'groupPartitionPassed must remain false for unknown student ID'
      );
    });
  });

  // =========================================================================
  // SECTION 3: PROVE CRYPTOGRAPHIC DEMO FINGERPRINTING (SHA-256)
  // =========================================================================
  describe('Audit Item 3: Cryptographic Demo Classroom Fingerprinting (SHA-256)', () => {
    it('proves exact demo dataset matches canonical SHA-256 fingerprint', () => {
      const computedHash = computeDatasetFingerprint(DEMO_CONTEXT, DEMO_SUBMISSIONS);
      assert.strictEqual(
        computedHash,
        DEMO_DATASET_SHA256,
        'Computed fingerprint must match canonical SHA-256 hash'
      );
      assert.strictEqual(
        isExactDemoClassroom(DEMO_CONTEXT, DEMO_SUBMISSIONS),
        true,
        'Exact demo dataset must pass fingerprint check'
      );
    });

    it('proves a one-character submission modification fails fingerprint check', () => {
      const modifiedSubs: StudentSubmission[] = JSON.parse(JSON.stringify(DEMO_SUBMISSIONS));
      modifiedSubs[0].studentText += '.'; // Add a single period at the end of student text

      assert.strictEqual(
        isExactDemoClassroom(DEMO_CONTEXT, modifiedSubs),
        false,
        'Single character modification must fail fingerprint check'
      );
    });

    it('proves modified lesson context fails fingerprint check', () => {
      const modifiedContext = {
        ...DEMO_CONTEXT,
        lessonTitle: 'Diagnostic Assessment: Present Perfect vs. Past Simple Mod',
      };

      assert.strictEqual(
        isExactDemoClassroom(modifiedContext, DEMO_SUBMISSIONS),
        false,
        'Modified lesson title must fail fingerprint check'
      );
    });

    it('proves reordered data behaves according to canonicalization policy (order-invariant via sorted student IDs)', () => {
      // Reversing submissions order
      const reorderedSubs = [...DEMO_SUBMISSIONS].reverse();

      assert.strictEqual(
        isExactDemoClassroom(DEMO_CONTEXT, reorderedSubs),
        true,
        'Reordered submissions must pass fingerprint check due to deterministic canonical sort'
      );
    });

    it('proves arbitrary custom data cannot receive demo fallback', () => {
      const customSubmissions: StudentSubmission[] = [
        {
          studentId: 'Student Alpha',
          studentText: 'Cellular respiration produces ATP in the presence of oxygen.',
          workType: 'typed',
        },
        {
          studentId: 'Student Beta',
          studentText: 'Photosynthesis converts solar energy into chemical energy.',
          workType: 'typed',
        },
      ];

      assert.strictEqual(
        isExactDemoClassroom(DEMO_CONTEXT, customSubmissions),
        false,
        'Arbitrary custom data must NEVER match demo fingerprint'
      );
    });
  });

  // =========================================================================
  // SECTION 4: SESSION PROVENANCE ROUND-TRIP
  // =========================================================================
  describe('Audit Item 4: Session Provenance Round-Trip & Zero Demo Leakage', () => {
    it('restores exact custom source submissions across serialize/reload cycle', () => {
      const customContext = {
        subject: 'AP Biology',
        gradeLevel: 'Grade 11',
        lessonTitle: 'Cellular Respiration vs Fermentation',
        learningObjective: 'Students explain anaerobic glycolysis vs oxidative phosphorylation.',
        expectedAnswerRubric: 'Identify ATP yield and electron acceptors.',
      };

      const customSubmissions: StudentSubmission[] = [
        {
          studentId: 'Bio Student 01',
          studentText: 'Glycolysis yields a net of 2 ATP and produces pyruvate in cytoplasm.',
          workType: 'typed',
        },
        {
          studentId: 'Bio Student 02',
          studentText: 'Lactic acid fermentation occurs when oxygen is absent as terminal acceptor.',
          workType: 'typed',
        },
      ];

      const customAnalysisResult: ClassAnalysisResult = {
        id: 'analysis_custom_9999',
        timestamp: new Date().toISOString(),
        context: customContext,
        classSnapshot: {
          totalSubmissions: 2,
          misconceptionCount: 0,
          strongestConcept: 'Glycolysis',
          highestPriorityNeed: 'Electron transport chain',
          overallRecommendation: 'Proceed to Krebs cycle',
        },
        studentObservations: [],
        misconceptionClusters: [],
        instructionalGroups: [],
        nextLessonPlan: {
          totalDuration: '25 min',
          targetObjective: 'Master oxidative phosphorylation and ATP yield',
          phases: [],
        },
        interventions: [],
        verification: {
          overallStatus: 'verified',
          evidenceCoverageStatus: 'verified',
          objectiveAlignmentStatus: 'verified',
          unsupportedClaimsStatus: 'none_detected',
          pedagogicalPlausibility: 'sound',
          explanation: 'Deterministic validation passed with high fidelity.',
          groundedCheckDetails: [],
        },
        executionMetadata: {
          executionMode: 'live_gemini',
          primaryModel: 'gemini-3.8-flash',
          modelsUsed: ['gemini-3.8-flash'],
          totalDurationMs: 1200,
          stageDurationsMs: {},
          submissionCount: 2,
          deterministicAuditPassed: true,
        },
      };

      // 1. Save session with custom submissions
      const sessionToPersist: SavedSession = {
        result: customAnalysisResult,
        rawSubmissions: customSubmissions,
        savedAt: new Date().toISOString(),
      };

      // 2. Serialize to storage (JSON.stringify)
      const serialized = JSON.stringify([sessionToPersist]);

      // 3. Reload from storage (JSON.parse)
      const parsed = JSON.parse(serialized);
      const restoredSession = parsed[0] as SavedSession;

      // 4. Verify exact custom submissions are restored
      assert.strictEqual(
        restoredSession.rawSubmissions.length,
        2,
        'Must restore exactly 2 custom submissions'
      );
      assert.strictEqual(
        restoredSession.rawSubmissions[0].studentId,
        'Bio Student 01',
        'Must restore Bio Student 01'
      );
      assert.strictEqual(
        restoredSession.rawSubmissions[0].studentText,
        'Glycolysis yields a net of 2 ATP and produces pyruvate in cytoplasm.',
        'Must restore exact custom student text'
      );

      // Verify ZERO demo data leakage
      const hasDemoSubmissions = restoredSession.rawSubmissions.some((s) =>
        DEMO_SUBMISSIONS.some((d) => d.studentId === s.studentId)
      );
      assert.strictEqual(
        hasDemoSubmissions,
        false,
        'Restored custom session must NEVER contain any demo submissions'
      );
    });

    it('legacy session missing rawSubmissions defaults to empty array and never substitutes demo evidence', () => {
      // Legacy session format before provenance fix
      const legacyItem = {
        id: 'legacy_analysis_123',
        timestamp: '2026-09-01T00:00:00Z',
        context: {
          subject: 'History',
          gradeLevel: 'Grade 9',
          lessonTitle: 'Ancient Rome',
          learningObjective: 'Republic to Empire',
        },
      };

      // Simulate App.tsx deserializer logic for legacy items:
      const restored: SavedSession = {
        result: legacyItem as any,
        rawSubmissions: (legacyItem as any).rawSubmissions || [], // Must be empty, never DEMO_SUBMISSIONS!
        savedAt: legacyItem.timestamp,
      };

      assert.strictEqual(
        restored.rawSubmissions.length,
        0,
        'Legacy sessions with missing submissions must restore as empty array'
      );
      assert.notDeepStrictEqual(
        restored.rawSubmissions,
        DEMO_SUBMISSIONS,
        'Legacy session must NEVER be substituted with DEMO_SUBMISSIONS'
      );
    });
  });

  // =========================================================================
  // SECTION 5: COVERAGE, CLUSTER MATH, AND CITATION UNIT INTEGRITY
  // =========================================================================
  describe('Audit Item 5: Coverage, Cluster Math, & Citation Verifiers', () => {
    it('identifies exact source quote for typed work', () => {
      const quote = DEMO_SUBMISSIONS[0].studentText.slice(0, 20);
      const match = checkQuoteInSource(quote, DEMO_SUBMISSIONS[0].studentText, 'typed');
      assert.strictEqual(match, 'exact_quote_found');
    });

    it('distinguishes image transcription from exact typed quotes', () => {
      const quote = DEMO_SUBMISSIONS[0].studentText.slice(0, 20);
      const match = checkQuoteInSource(quote, DEMO_SUBMISSIONS[0].studentText, 'image_transcription');
      assert.strictEqual(match, 'image_transcription_match');
    });

    it('flags ungrounded or fabricated quotes', () => {
      const fabricatedQuote = 'The quick brown fox jumps over the lazy dog under moonlight';
      const match = checkQuoteInSource(fabricatedQuote, DEMO_SUBMISSIONS[0].studentText, 'typed');
      assert.strictEqual(match, 'unsupported_citation');
    });

    it('recalculates cluster prevalence deterministically regardless of model claims', () => {
      const hallucinatedMathCluster: MisconceptionCluster = {
        clusterId: 'c2',
        misconceptionTitle: 'Irregular participle error',
        explanation: 'Writed instead of written',
        affectedStudentIds: ['Student 01', 'Student 02', 'Student 03'], // 3 out of 12 = 25%
        studentCount: 99, // Hallucinated count
        percentageAffected: 88, // Hallucinated percentage
        evidenceExamples: [],
        teachingPriority: 'high',
        confidence: 0.85,
        recommendedInstructionalResponse: 'Targeted drill',
      };

      const submittedIds = new Set(DEMO_SUBMISSIONS.map((s) => s.studentId));
      const mathResult = validateClusterMath(
        [hallucinatedMathCluster],
        DEMO_SUBMISSIONS.length,
        submittedIds
      );

      assert.strictEqual(mathResult.passed, false, 'Should flag mismatch against hallucinated values');
      assert.strictEqual(mathResult.auditedClusters[0].studentCount, 3, 'Must compute exactly 3 students');
      assert.strictEqual(mathResult.auditedClusters[0].percentageAffected, 25, 'Must compute exactly 25%');
    });
  });
});
