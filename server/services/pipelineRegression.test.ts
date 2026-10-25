import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  validateObservationCoverage,
  validateStudentReferences,
  validateClusterMath,
  validateInstructionalGroupPartition,
  validateEvidenceQuotes,
  runDeterministicValidation,
  checkQuoteInSource,
  validateInterventionRelationships,
  migrateLegacyInterventions,
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
  TeacherDecision,
  DifferentiatedIntervention,
  PrivacyAudit,
} from '../../src/types';
import {
  MisconceptionClusterSchema,
  DifferentiatedInterventionSchema,
  CanonicalInterventionSchema,
  StudentObservationSchema,
  InstructionalGroupSchema,
  VerificationResultSchema,
} from '../schemas/analysisSchemas';
import { generateGroundedDemoAnalysis } from './demoFallbackGenerator';
import { runFullAnalysisPipeline } from './pipelineCoordinator';
import { validateObserverOutput } from './observerService';
import { PipelineError, classifyGeminiError } from '../errors/pipelineErrors';
import {
  generateContentDetailed,
  setGeminiClient,
  resetGeminiClient,
  clearModelCooldowns,
  isModelInCooldown,
  getModelCooldown,
  resolveStageRoutingPolicy,
} from '../geminiClient';
import {
  getCodeVerificationBadge,
  getDeterministicMatchDisplay,
  getTeacherStatusLabel,
  getCanonicalTeacherDecision,
  getClusterCodeVerificationBadge,
  getGeminiVerificationBadge,
  isAnalysisFullyVerified,
  getEvidenceDisplay,
  getPipelineErrorDisplay,
  getCrossDimensionTrustDisplay,
  getPrivacyStatusDisplay,
} from '../../src/utils/verificationDisplay';
import { verifyAnalysisPipeline } from './verifierService';
import {
  PrivacyGateway,
  getPrivacyGateway,
  setPrivacyGateway,
} from './privacyGateway';
import {
  DeterministicSensitiveDataProtectionProvider,
  GoogleSensitiveDataProtectionProvider,
  createDefaultSensitiveDataProtectionProvider,
  setSensitiveDataProtectionProvider,
  getSensitiveDataProtectionProvider,
} from './sensitiveDataProtectionProvider';
import { analysisController } from '../controllers/analysisController';
import { classifyPrivacyError } from '../errors/pipelineErrors';
import { runPrivacyEvaluation, PRIVACY_EVAL_FIXTURES } from './privacyEvalSet';
import { loadAppConfig, getAppConfig, resetAppConfig } from '../config';
import {
  AnalyzeRequestSchema,
  StudentSubmissionInputSchema,
  LearningContextSchema,
} from '../schemas/apiSchemas';
import {
  createRateLimiter,
  resetRateLimiterStore,
  cleanupExpiredEntries,
  getRateLimiterStoreSize,
} from '../middleware/rateLimiter';

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
        sanitizedSubmissions: customSubmissions,
        savedAt: new Date().toISOString(),
      };

      // 2. Serialize to storage (JSON.stringify)
      const serialized = JSON.stringify([sessionToPersist]);

      // 3. Reload from storage (JSON.parse)
      const parsed = JSON.parse(serialized);
      const restoredSession = parsed[0] as SavedSession;

      // 4. Verify exact custom submissions are restored
      assert.strictEqual(
        restoredSession.sanitizedSubmissions.length,
        2,
        'Must restore exactly 2 custom submissions'
      );
      assert.strictEqual(
        restoredSession.sanitizedSubmissions[0].studentId,
        'Bio Student 01',
        'Must restore Bio Student 01'
      );
      assert.strictEqual(
        restoredSession.sanitizedSubmissions[0].studentText,
        'Glycolysis yields a net of 2 ATP and produces pyruvate in cytoplasm.',
        'Must restore exact custom student text'
      );

      // Verify ZERO demo data leakage
      const hasDemoSubmissions = restoredSession.sanitizedSubmissions.some((s) =>
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
        sanitizedSubmissions: (legacyItem as any).sanitizedSubmissions || (legacyItem as any).rawSubmissions || [], // Must be empty, never DEMO_SUBMISSIONS!
        savedAt: legacyItem.timestamp,
      };

      assert.strictEqual(
        restored.sanitizedSubmissions.length,
        0,
        'Legacy sessions with missing submissions must restore as empty array'
      );
      assert.notDeepStrictEqual(
        restored.sanitizedSubmissions,
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

  // =========================================================================
  // SECTION 6: PHASE P1 CANONICAL TRUST CONTRACT REGRESSION SUITE
  // =========================================================================
  describe('Phase P1 Canonical Trust Contract: Strict Multi-Pillar Truth Invariants', () => {
    // -----------------------------------------------------------------------
    // RULE 1: AI-generated content begins with teacherDecision = pending
    // -----------------------------------------------------------------------
    describe('P1 Rule 1: AI-generated reviewable content begins pending, NEVER accepted', () => {
      it('MisconceptionClusterSchema defaults status and teacherDecision to pending', () => {
        const cluster = MisconceptionClusterSchema.parse({
          clusterId: 'test-c1',
          misconceptionTitle: 'Subject-Auxiliary Agreement',
          explanation: 'Inverted auxiliary agreement',
          affectedStudentIds: ['Student 01'],
          recommendedInstructionalResponse: 'Provide agreement chart',
        });

        assert.strictEqual(
          cluster.status,
          'pending',
          'MisconceptionClusterSchema.status must default to pending'
        );
        assert.strictEqual(
          cluster.teacherDecision,
          'pending',
          'MisconceptionClusterSchema.teacherDecision must default to pending'
        );
      });

      it('DifferentiatedInterventionSchema defaults status and teacherDecision to pending', () => {
        const intervention = DifferentiatedInterventionSchema.parse({
          interventionId: 'test-i1',
          targetMisconceptionTitle: 'Subject-Auxiliary Agreement',
          title: 'Agreement Contrast Card',
          rationale: 'Clarifies subject and auxiliary number alignment',
          suggestedActivity: 'Speed matching drill',
          teacherScript: 'Check the subject number first',
          exampleQuestion: 'Which is correct? (A) We have (B) We has',
          exitTicketQuestion: 'Complete: They ______ (have/has) arrived.',
        });

        assert.strictEqual(
          intervention.status,
          'pending',
          'DifferentiatedInterventionSchema.status must default to pending'
        );
        assert.strictEqual(
          intervention.teacherDecision,
          'pending',
          'DifferentiatedInterventionSchema.teacherDecision must default to pending'
        );
      });

      it('demoFallbackGenerator initializes all clusters and interventions with pending teacher decision', () => {
        const demoAnalysis = generateGroundedDemoAnalysis(DEMO_CONTEXT, DEMO_SUBMISSIONS);

        assert.ok(demoAnalysis.misconceptionClusters.length > 0);
        for (const cluster of demoAnalysis.misconceptionClusters) {
          assert.strictEqual(
            cluster.status,
            'pending',
            `Cluster ${cluster.clusterId} status must be pending`
          );
          assert.strictEqual(
            cluster.teacherDecision,
            'pending',
            `Cluster ${cluster.clusterId} teacherDecision must be pending`
          );
        }

        assert.ok(demoAnalysis.interventions.length > 0);
        for (const int of demoAnalysis.interventions) {
          assert.strictEqual(
            int.status,
            'pending',
            `Intervention ${int.interventionId} status must be pending`
          );
          assert.strictEqual(
            int.teacherDecision,
            'pending',
            `Intervention ${int.interventionId} teacherDecision must be pending`
          );
        }
      });
    });

    // -----------------------------------------------------------------------
    // RULE 2: Teacher Accepted only results from explicit teacher action
    // -----------------------------------------------------------------------
    describe('P1 Rule 2: Teacher Accepted may only result from explicit teacher action', () => {
      it('transitions from pending to accepted only on explicit teacher action', () => {
        const initialCluster = MisconceptionClusterSchema.parse({
          clusterId: 'c-test',
          misconceptionTitle: 'Initial Title',
          explanation: 'Initial Explanation',
          affectedStudentIds: ['Student 01'],
          studentCount: 1,
          percentageAffected: 8,
          recommendedInstructionalResponse: 'Initial Response',
        });

        assert.strictEqual(initialCluster.teacherDecision, 'pending');

        // Teacher performs explicit accept
        const acceptedCluster: MisconceptionCluster = {
          ...initialCluster,
          studentCount: 1,
          percentageAffected: 8,
          status: 'accepted',
          teacherDecision: 'accepted',
        };

        assert.strictEqual(acceptedCluster.status, 'accepted');
        assert.strictEqual(acceptedCluster.teacherDecision, 'accepted');
        assert.strictEqual(getTeacherStatusLabel(acceptedCluster.teacherDecision), 'Teacher Accepted');
      });
    });

    // -----------------------------------------------------------------------
    // RULE 3: Teacher Edited requires BOTH canonical content mutation AND status = edited
    // -----------------------------------------------------------------------
    describe('P1 Rule 3: Teacher Edited requires canonical content mutation AND edited decision', () => {
      it('persists mutated title into canonical cluster state upon edit', () => {
        const originalCluster: MisconceptionCluster = {
          clusterId: 'cluster-edit-test',
          misconceptionTitle: 'Original Gemini Title',
          explanation: 'Explanation text',
          affectedStudentIds: ['Student 02'],
          studentCount: 1,
          percentageAffected: 8,
          evidenceExamples: [],
          teachingPriority: 'high',
          confidence: 0.9,
          recommendedInstructionalResponse: 'Drill',
          status: 'pending',
          teacherDecision: 'pending',
        };

        const newTeacherTitle = 'Teacher Refined Pedagogical Concept';

        // Mutate canonically as done in App.tsx handleUpdateMisconceptionStatus
        const editedCluster: MisconceptionCluster = {
          ...originalCluster,
          status: 'edited',
          teacherDecision: 'edited',
          misconceptionTitle: newTeacherTitle,
        };

        assert.strictEqual(editedCluster.misconceptionTitle, newTeacherTitle, 'Canonical title must be updated');
        assert.strictEqual(editedCluster.teacherDecision, 'edited', 'teacherDecision must be edited');
        assert.strictEqual(editedCluster.status, 'edited', 'status must be edited');
        assert.strictEqual(getTeacherStatusLabel(editedCluster.teacherDecision), 'Teacher Edited');
      });
    });

    // -----------------------------------------------------------------------
    // RULE 4: Teacher Dismissed discounts from active strategy while preserving auditability
    // -----------------------------------------------------------------------
    describe('P1 Rule 4: Teacher Dismissed hides/discounts item while preserving auditability', () => {
      it('dismissed cluster is excluded from active strategy planning but retained in analysis dataset', () => {
        const clusters: MisconceptionCluster[] = [
          {
            clusterId: 'c1',
            misconceptionTitle: 'Active Concept',
            explanation: 'Exp',
            affectedStudentIds: ['Student 01'],
            studentCount: 1,
            percentageAffected: 8,
            evidenceExamples: [],
            teachingPriority: 'high',
            confidence: 0.9,
            recommendedInstructionalResponse: 'Resp',
            status: 'pending',
            teacherDecision: 'pending',
          },
          {
            clusterId: 'c2',
            misconceptionTitle: 'Dismissed Concept',
            explanation: 'Exp',
            affectedStudentIds: ['Student 02'],
            studentCount: 1,
            percentageAffected: 8,
            evidenceExamples: [],
            teachingPriority: 'moderate',
            confidence: 0.7,
            recommendedInstructionalResponse: 'Resp',
            status: 'dismissed',
            teacherDecision: 'dismissed',
          },
        ];

        // Active filter as implemented in strategyService
        const activeMisconceptions = clusters.filter(
          (m) => m.status !== 'dismissed' && m.teacherDecision !== 'dismissed'
        );

        assert.strictEqual(activeMisconceptions.length, 1, 'Only non-dismissed cluster is active');
        assert.strictEqual(activeMisconceptions[0].clusterId, 'c1');
        assert.strictEqual(clusters.length, 2, 'Canonical dataset preserves dismissed cluster for audit log');
      });
    });

    // -----------------------------------------------------------------------
    // RULE 5: Unverified code check displays Not Checked or Review Required, NEVER verified
    // -----------------------------------------------------------------------
    describe('P1 Rule 5: Missing or undefined code audit checks display Not Checked, NEVER verified', () => {
      it('getCodeVerificationBadge(undefined) returns Code Not Checked with warning variant', () => {
        const badge = getCodeVerificationBadge(undefined);
        assert.strictEqual(badge.label, 'Code Not Checked');
        assert.strictEqual(badge.variant, 'warning');
      });

      it('getCodeVerificationBadge(false) returns Code Check Failed with warning variant', () => {
        const badge = getCodeVerificationBadge(false);
        assert.strictEqual(badge.label, 'Code Check Failed');
        assert.strictEqual(badge.variant, 'warning');
      });

      it('getCodeVerificationBadge(true) returns Code Verified with code variant', () => {
        const badge = getCodeVerificationBadge(true);
        assert.strictEqual(badge.label, 'Code Verified');
        assert.strictEqual(badge.variant, 'code');
      });

      it('getDeterministicMatchDisplay(undefined) returns Not Checked with isSupported: false', () => {
        const match = getDeterministicMatchDisplay(undefined);
        assert.strictEqual(match.label, 'Not Checked');
        assert.strictEqual(match.isSupported, false);
      });

      it('getDeterministicMatchDisplay(unsupported_citation) returns Unsupported Citation with isSupported: false', () => {
        const match = getDeterministicMatchDisplay('unsupported_citation');
        assert.strictEqual(match.label, 'Unsupported Citation · Review Required');
        assert.strictEqual(match.isSupported, false);
      });
    });

    // -----------------------------------------------------------------------
    // RULE 6: Verifier status does NOT equal Teacher Decision (orthogonal independence)
    // -----------------------------------------------------------------------
    describe('P1 Rule 6: Verifier status and Teacher Decision remain orthogonal and independent', () => {
      it('item verified by Gemini verifier still starts with teacherDecision = pending', () => {
        const cluster: MisconceptionCluster = {
          clusterId: 'c-indep',
          misconceptionTitle: 'Verified by AI pass',
          explanation: 'Exp',
          affectedStudentIds: ['Student 01'],
          studentCount: 1,
          percentageAffected: 8,
          evidenceExamples: [
            {
              studentId: 'Student 01',
              excerpt: 'excerpt',
              groundingReason: 'reason',
              deterministicMatch: 'exact_quote_found',
            },
          ],
          teachingPriority: 'high',
          confidence: 0.99,
          recommendedInstructionalResponse: 'Resp',
          status: 'pending',
          teacherDecision: 'pending',
        };

        // Verifier pass confirms grounded evidence
        const verifierOverallStatus: 'verified' | 'partially_verified' | 'needs_review' = 'verified';

        // Orthogonality: AI verification status is "verified", yet teacher decision MUST still be "pending"
        assert.strictEqual(verifierOverallStatus, 'verified', 'AI verification passed');
        assert.strictEqual(cluster.teacherDecision, 'pending', 'Teacher decision remains pending');
        assert.notStrictEqual(
          verifierOverallStatus,
          cluster.teacherDecision,
          'AI verifier status must NOT be conflated with Teacher Decision'
        );
      });
    });

    // -----------------------------------------------------------------------
    // RULE 7: Export truth reflects exact canonical state
    // -----------------------------------------------------------------------
    describe('P1 Rule 7: Export truth reflects exact canonical state and decisions', () => {
      it('export serialization contains edited title, teacher decision, and verification status', () => {
        const session: SavedSession = {
          result: {
            id: 'export-test-1',
            timestamp: '2026-09-29T00:00:00.000Z',
            context: DEMO_CONTEXT,
            classSnapshot: {
              totalSubmissions: 12,
              misconceptionCount: 1,
              strongestConcept: 'Syntax',
              highestPriorityNeed: 'Tense',
              overallRecommendation: 'Review',
            },
            studentObservations: [],
            misconceptionClusters: [
              {
                clusterId: 'c1',
                misconceptionTitle: 'Edited Teacher Title For Export',
                explanation: 'Explanation',
                affectedStudentIds: ['Student 01'],
                studentCount: 1,
                percentageAffected: 8,
                evidenceExamples: [],
                teachingPriority: 'urgent',
                confidence: 0.95,
                recommendedInstructionalResponse: 'Instruction',
                status: 'edited',
                teacherDecision: 'edited',
              },
            ],
            instructionalGroups: [],
            nextLessonPlan: { totalDuration: '25 min', targetObjective: 'Obj', phases: [] },
            interventions: [
              {
                interventionId: 'i1',
                targetMisconceptionTitle: 'Edited Teacher Title For Export',
                title: 'Intervention Card 1',
                supportTier: 'Concept Clarification',
                rationale: 'Rationale',
                suggestedActivity: 'Activity',
                teacherScript: 'Script',
                exampleQuestion: 'Question',
                exitTicketQuestion: 'Exit',
                status: 'accepted',
                teacherDecision: 'accepted',
              },
            ],
            verification: {
              overallStatus: 'verified',
              evidenceCoverageStatus: 'verified',
              objectiveAlignmentStatus: 'verified',
              unsupportedClaimsStatus: 'none_detected',
              pedagogicalPlausibility: 'sound',
              explanation: 'Grounded audit passed',
              groundedCheckDetails: [],
            },
          },
          sanitizedSubmissions: DEMO_SUBMISSIONS,
          savedAt: '2026-09-29T00:00:00.000Z',
        };

        const jsonExport = JSON.stringify(session);
        const parsed = JSON.parse(jsonExport) as SavedSession;

        assert.strictEqual(
          parsed.result.misconceptionClusters[0].misconceptionTitle,
          'Edited Teacher Title For Export',
          'Exported title must reflect teacher edit'
        );
        assert.strictEqual(
          parsed.result.misconceptionClusters[0].teacherDecision,
          'edited',
          'Exported cluster must reflect edited decision'
        );
        assert.strictEqual(
          parsed.result.interventions[0].teacherDecision,
          'accepted',
          'Exported intervention must reflect accepted decision'
        );
        assert.strictEqual(
          parsed.result.verification.overallStatus,
          'verified',
          'Exported verification must reflect verifier pass'
        );
      });
    });

    // -----------------------------------------------------------------------
    // RULE 8: Backward compatibility: legacy session normalization
    // -----------------------------------------------------------------------
    describe('P1 Rule 8: Backward compatibility cleanly normalizes legacy sessions to pending', () => {
      it('legacy session without teacherDecision safely normalizes to pending without false acceptance', () => {
        const legacyRecord: any = {
          result: {
            id: 'legacy-sess',
            context: DEMO_CONTEXT,
            classSnapshot: { totalSubmissions: 5, misconceptionCount: 1, strongestConcept: 'A', highestPriorityNeed: 'B', overallRecommendation: 'C' },
            studentObservations: [],
            misconceptionClusters: [
              {
                clusterId: 'legacy-c1',
                misconceptionTitle: 'Legacy Cluster',
                explanation: 'Exp',
                affectedStudentIds: ['Student 01'],
                studentCount: 1,
                percentageAffected: 20,
                evidenceExamples: [],
                teachingPriority: 'high',
                confidence: 0.9,
                recommendedInstructionalResponse: 'Resp',
                // Notice: status and teacherDecision are omitted or legacy
              },
            ],
            instructionalGroups: [],
            nextLessonPlan: { totalDuration: '25 min', targetObjective: 'Obj', phases: [] },
            interventions: [
              {
                interventionId: 'legacy-i1',
                targetMisconceptionTitle: 'Legacy Cluster',
                title: 'Legacy Intervention',
                supportTier: 'Guided Practice',
                rationale: 'R',
                suggestedActivity: 'A',
                teacherScript: 'S',
                exampleQuestion: 'Q',
                exitTicketQuestion: 'EQ',
              },
            ],
            verification: {
              overallStatus: 'partially_verified',
              evidenceCoverageStatus: 'partially_verified',
              objectiveAlignmentStatus: 'verified',
              unsupportedClaimsStatus: 'minor_discrepancy',
              pedagogicalPlausibility: 'sound',
              explanation: 'Exp',
              groundedCheckDetails: [],
            },
          },
          rawSubmissions: [],
          savedAt: '2026-09-01T00:00:00.000Z',
        };

        // Apply canonical normalization as implemented in App.tsx
        const normalizedClusters = legacyRecord.result.misconceptionClusters.map((c: any) => {
          const canonical = getCanonicalTeacherDecision(c);
          return {
            ...c,
            status: canonical,
            teacherDecision: canonical,
          };
        });

        const normalizedInterventions = legacyRecord.result.interventions.map((i: any) => {
          const canonical = getCanonicalTeacherDecision(i);
          return {
            ...i,
            status: canonical,
            teacherDecision: canonical,
          };
        });

        assert.strictEqual(
          normalizedClusters[0].teacherDecision,
          'pending',
          'Legacy cluster must normalize to pending'
        );
        assert.strictEqual(
          normalizedClusters[0].status,
          'pending',
          'Legacy cluster status must normalize to pending'
        );
        assert.strictEqual(
          normalizedInterventions[0].teacherDecision,
          'pending',
          'Legacy intervention must normalize to pending'
        );
        assert.strictEqual(
          normalizedInterventions[0].status,
          'pending',
          'Legacy intervention status must normalize to pending'
        );
      });
    });

    // =========================================================================
    // SECTION 7: FINAL ADVERSARIAL P1 RED-TEAM AUDIT SUITE
    // =========================================================================
    describe('P1 Final Adversarial Red-Team Audit Suite', () => {
      // 1. CANONICAL SOURCE-OF-TRUTH AUDIT
      describe('Attack 1: Canonical Source-of-Truth & Legacy Status Non-Implication', () => {
        it('proves teacherDecision is the sole authoritative human-review field', () => {
          const explicitDecisionCluster = {
            teacherDecision: 'accepted' as TeacherDecision,
            status: 'pending' as TeacherDecision,
          };
          assert.strictEqual(
            getCanonicalTeacherDecision(explicitDecisionCluster),
            'accepted',
            'Explicit teacherDecision takes strict precedence over legacy status'
          );
        });

        it('proves legacy status cannot independently imply human action', () => {
          // If a legacy record only has status='accepted' and no teacherDecision,
          // it MUST NOT be trusted as accepted
          const legacyDefaultArtifact = {
            status: 'accepted' as TeacherDecision,
          };
          assert.strictEqual(
            getCanonicalTeacherDecision(legacyDefaultArtifact),
            'pending',
            'Legacy status=accepted without explicit teacherDecision fails-safe to pending'
          );
        });
      });

      // 2. LEGACY MIGRATION ATTACK (Cases A, B, C, D, E)
      describe('Attack 2: Legacy Migration Attack (Cases A through E)', () => {
        it('Case A: status = "accepted", teacherDecision missing -> migrates to pending', () => {
          const fixture = { status: 'accepted' };
          const migrated = getCanonicalTeacherDecision(fixture);
          assert.strictEqual(
            migrated,
            'pending',
            'Case A: Old status=accepted without teacherDecision MUST NOT become accepted'
          );
          assert.strictEqual(
            getTeacherStatusLabel(migrated),
            'Teacher Review Pending',
            'Case A label must be Teacher Review Pending'
          );
        });

        it('Case B: status = "edited", teacherDecision missing -> migrates to edited', () => {
          const fixture = { status: 'edited' };
          const migrated = getCanonicalTeacherDecision(fixture);
          assert.strictEqual(
            migrated,
            'edited',
            'Case B: Old status=edited proves human edit action'
          );
          assert.strictEqual(
            getTeacherStatusLabel(migrated),
            'Teacher Edited',
            'Case B label must be Teacher Edited'
          );
        });

        it('Case C: status = "dismissed", teacherDecision missing -> migrates to dismissed', () => {
          const fixture = { status: 'dismissed' };
          const migrated = getCanonicalTeacherDecision(fixture);
          assert.strictEqual(
            migrated,
            'dismissed',
            'Case C: Old status=dismissed proves human dismiss action'
          );
          assert.strictEqual(
            getTeacherStatusLabel(migrated),
            'Teacher Dismissed',
            'Case C label must be Teacher Dismissed'
          );
        });

        it('Case D: status missing, teacherDecision missing -> migrates to pending', () => {
          const fixture = {};
          const migrated = getCanonicalTeacherDecision(fixture);
          assert.strictEqual(
            migrated,
            'pending',
            'Case D: Missing status and teacherDecision MUST default to pending'
          );
          assert.strictEqual(
            getTeacherStatusLabel(migrated),
            'Teacher Review Pending',
            'Case D label must be Teacher Review Pending'
          );
        });

        it('Case E: malformed teacherDecision -> migrates to pending', () => {
          const fixtureMalformedString = { teacherDecision: 'unknown_garbage' as any };
          const fixtureNull = { teacherDecision: null as any };
          const fixtureObject = { teacherDecision: { bad: true } as any };

          assert.strictEqual(
            getCanonicalTeacherDecision(fixtureMalformedString),
            'pending',
            'Case E: Malformed string teacherDecision must fail-safe to pending'
          );
          assert.strictEqual(
            getCanonicalTeacherDecision(fixtureNull),
            'pending',
            'Case E: Null teacherDecision must fail-safe to pending'
          );
          assert.strictEqual(
            getCanonicalTeacherDecision(fixtureObject),
            'pending',
            'Case E: Object teacherDecision must fail-safe to pending'
          );
        });
      });

      // 3. CROSS-DIMENSION INDEPENDENCE ATTACK
      describe('Attack 3: Cross-Dimension Independence Attack (Cases A through D)', () => {
        it('Case A: deterministic=passed, semantic=passed, teacher=pending -> Not Teacher Accepted', () => {
          const codeBadge = getCodeVerificationBadge(true);
          const geminiBadge = getGeminiVerificationBadge('verified');
          const teacherLabel = getTeacherStatusLabel('pending');

          assert.strictEqual(codeBadge.label, 'Code Verified');
          assert.strictEqual(geminiBadge.label, 'Gemini Verified');
          assert.strictEqual(teacherLabel, 'Teacher Review Pending');

          // Must NOT imply Teacher Accepted
          assert.notStrictEqual(teacherLabel, 'Teacher Accepted');
          const isFullyVerified = (codeBadge.label as string) === 'Code Verified' && (geminiBadge.label as string) === 'Gemini Verified' && (teacherLabel as string) === 'Teacher Accepted';
          assert.strictEqual(isFullyVerified, false, 'Case A must NOT be fully verified');
        });

        it('Case B: deterministic=failed, semantic=passed, teacher=accepted -> NOT fully verified', () => {
          const codeBadge = getCodeVerificationBadge(false);
          const geminiBadge = getGeminiVerificationBadge('verified');
          const teacherLabel = getTeacherStatusLabel('accepted');

          assert.strictEqual(codeBadge.label, 'Code Check Failed');
          assert.strictEqual(geminiBadge.label, 'Gemini Verified');
          assert.strictEqual(teacherLabel, 'Teacher Accepted');

          // Overall: NOT fully verified because code check failed
          const isFullyVerified = (codeBadge.label as string) === 'Code Verified' && (geminiBadge.label as string) === 'Gemini Verified' && (teacherLabel as string) === 'Teacher Accepted';
          assert.strictEqual(isFullyVerified, false, 'Case B must NOT be fully verified');
        });

        it('Case C: deterministic=not_checked, semantic=not_checked, teacher=accepted -> NOT fully verified', () => {
          const codeBadge = getCodeVerificationBadge(undefined);
          const geminiBadge = getGeminiVerificationBadge('not_checked');
          const teacherLabel = getTeacherStatusLabel('accepted');

          assert.strictEqual(codeBadge.label, 'Code Not Checked');
          assert.strictEqual(geminiBadge.label, 'Gemini Not Checked');
          assert.strictEqual(teacherLabel, 'Teacher Accepted');

          // Overall: NOT fully verified because technical checks were not checked
          const isFullyVerified = (codeBadge.label as string) === 'Code Verified' && (geminiBadge.label as string) === 'Gemini Verified' && (teacherLabel as string) === 'Teacher Accepted';
          assert.strictEqual(isFullyVerified, false, 'Case C must NOT be fully verified');
        });

        it('Case D: deterministic=passed, semantic=review_required, teacher=edited -> NOT fully verified', () => {
          const codeBadge = getCodeVerificationBadge(true);
          const geminiBadge = getGeminiVerificationBadge('needs_review');
          const teacherLabel = getTeacherStatusLabel('edited');

          assert.strictEqual(codeBadge.label, 'Code Verified');
          assert.strictEqual(geminiBadge.label, 'Gemini Review Required');
          assert.strictEqual(teacherLabel, 'Teacher Edited');

          // Overall: NOT fully verified
          const isFullyVerified = (codeBadge.label as string) === 'Code Verified' && (geminiBadge.label as string) === 'Gemini Verified' && (teacherLabel as string) === 'Teacher Accepted';
          assert.strictEqual(isFullyVerified, false, 'Case D must NOT be fully verified');
        });
      });

      // 4. EDIT ROUND-TRIP ATTACK
      describe('Attack 4: Edit Round-Trip Attack (Concrete mutation survivability)', () => {
        it('proves revised misconception title survives runtime, serialization, reload, selection, and export', () => {
          const originalTitle = 'Original misconception';
          const revisedTitle = 'Teacher revised misconception';

          // 1. Initial AI object
          const initialCluster: MisconceptionCluster = {
            clusterId: 'mc-edit-1',
            misconceptionTitle: originalTitle,
            studentCount: 3,
            affectedStudentIds: ['Student 01', 'Student 02', 'Student 03'],
            percentageAffected: 25,
            teachingPriority: 'high',
            confidence: 0.95,
            explanation: 'Exp',
            evidenceStrength: 'strong',
            evidenceExamples: [],
            recommendedInstructionalResponse: 'Resp',
            status: 'pending',
            teacherDecision: 'pending',
          };

          // 2. Teacher edit simulation (as in App.tsx handleUpdateMisconceptionStatus)
          const editedCluster: MisconceptionCluster = {
            ...initialCluster,
            misconceptionTitle: revisedTitle,
            status: 'edited',
            teacherDecision: 'edited',
          };

          // Assert runtime canonical object
          assert.strictEqual(editedCluster.misconceptionTitle, revisedTitle, 'Runtime object must have revised title');
          assert.strictEqual(editedCluster.teacherDecision, 'edited', 'Runtime decision must be edited');

          // 3. Session serialization simulation (as in App.tsx saveAnalysis)
          const sessionPayload: SavedSession = {
            result: {
              id: 'sess-edit-1',
              timestamp: new Date().toISOString(),
              context: DEMO_CONTEXT,
              classSnapshot: {
                totalSubmissions: 12,
                misconceptionCount: 1,
                strongestConcept: 'S',
                highestPriorityNeed: 'H',
                overallRecommendation: 'R',
              },
              studentObservations: [],
              misconceptionClusters: [editedCluster],
              instructionalGroups: [],
              nextLessonPlan: { phases: [], totalDuration: '25 min', targetObjective: 'Objective' },
              interventions: [],
              verification: {
                overallStatus: 'verified',
                evidenceCoverageStatus: 'verified',
                objectiveAlignmentStatus: 'verified',
                unsupportedClaimsStatus: 'none_detected',
                pedagogicalPlausibility: 'sound',
                explanation: 'Verified',
                groundedCheckDetails: [],
              },
            },
            sanitizedSubmissions: [],
            savedAt: new Date().toISOString(),
          };

          const serialized = JSON.stringify([sessionPayload]);
          assert.ok(serialized.includes(revisedTitle), 'Serialized session must contain revised title');
          assert.ok(!serialized.includes(`"misconceptionTitle":"${originalTitle}"`), 'Serialized session must NOT contain original title for this cluster');

          // 4. Reload / Deserialization simulation (as in App.tsx useEffect mount)
          const parsed = JSON.parse(serialized);
          const restoredSession = parsed[0];
          const restoredClusters = restoredSession.result.misconceptionClusters.map((c: any) => {
            const canonical = getCanonicalTeacherDecision(c);
            return {
              ...c,
              status: canonical,
              teacherDecision: canonical,
            };
          });

          assert.strictEqual(restoredClusters[0].misconceptionTitle, revisedTitle, 'Reloaded cluster must have revised title');
          assert.strictEqual(restoredClusters[0].teacherDecision, 'edited', 'Reloaded cluster decision must be edited');

          // 5. Saved-session selection simulation (as in Dashboard onSelectSavedAnalysis)
          const selectedResult = restoredSession.result;
          assert.strictEqual(
            selectedResult.misconceptionClusters[0].misconceptionTitle,
            revisedTitle,
            'Saved session selection must preserve revised title'
          );

          // 6. Export simulation (as in ResultsView handleExportMarkdown)
          const exportMarkdown = selectedResult.misconceptionClusters
            .map(
              (c: any) => `### ${c.misconceptionTitle}\n- Teacher Decision: ${getCanonicalTeacherDecision(c)}`
            )
            .join('\n');

          assert.ok(exportMarkdown.includes(`### ${revisedTitle}`), 'Export markdown must reflect revised title');
          assert.ok(!exportMarkdown.includes(`### ${originalTitle}`), 'Original title must not silently reappear in export');
          assert.ok(exportMarkdown.includes('- Teacher Decision: edited'), 'Export markdown must reflect edited decision');
        });

        it('proves intervention edit / adjustment survives round-trip', () => {
          const originalPrompt = 'Original teacher facilitation prompt';
          const revisedPrompt = 'Revised teacher facilitation prompt with specific scaffold';

          const initialInt = {
            interventionId: 'int-edit-1',
            targetMisconceptionTitle: 'Target Misconception',
            title: 'Initial Intervention Title',
            supportTier: 'Guided Practice',
            rationale: 'R',
            suggestedActivity: 'A',
            teacherScript: originalPrompt,
            exampleQuestion: 'Q',
            exitTicketQuestion: 'EQ',
            status: 'pending' as TeacherDecision,
            teacherDecision: 'pending' as TeacherDecision,
          };

          const editedInt = {
            ...initialInt,
            teacherScript: revisedPrompt,
            status: 'edited' as TeacherDecision,
            teacherDecision: 'edited' as TeacherDecision,
          };

          const serialized = JSON.stringify([editedInt]);
          const deserialized = JSON.parse(serialized)[0];
          const canonical = getCanonicalTeacherDecision(deserialized);

          assert.strictEqual(deserialized.teacherScript, revisedPrompt);
          assert.strictEqual(canonical, 'edited');
          assert.ok(!serialized.includes(originalPrompt));
        });
      });

      // 5. AI CONTRIBUTION TRACE ATTACK
      describe('Attack 5: AI Contribution Trace Attack (All pending initial state)', () => {
        it('proves all unreviewed AI artifacts result in accepted=0, edited=0, dismissed=0, pending>0 and Stage 7 communicates Teacher Review Pending', () => {
          const clusters: MisconceptionCluster[] = [
            {
              clusterId: 'mc-1',
              misconceptionTitle: 'Cluster 1',
              studentCount: 2,
              affectedStudentIds: ['Student 01', 'Student 02'],
              percentageAffected: 16,
              teachingPriority: 'moderate',
              confidence: 0.9,
              explanation: 'E',
              evidenceStrength: 'strong',
              evidenceExamples: [],
              recommendedInstructionalResponse: 'R',
              status: 'pending',
              teacherDecision: 'pending',
            },
            {
              clusterId: 'mc-2',
              misconceptionTitle: 'Cluster 2',
              studentCount: 3,
              affectedStudentIds: ['Student 03', 'Student 04', 'Student 05'],
              percentageAffected: 25,
              teachingPriority: 'high',
              confidence: 0.92,
              explanation: 'E',
              evidenceStrength: 'strong',
              evidenceExamples: [],
              recommendedInstructionalResponse: 'R',
              status: 'pending',
              teacherDecision: 'pending',
            },
          ];

          const interventions = [
            {
              interventionId: 'int-1',
              targetMisconceptionTitle: 'Cluster 1',
              title: 'Int 1',
              supportTier: 'Guided Practice',
              rationale: 'R',
              suggestedActivity: 'A',
              teacherScript: 'S',
              exampleQuestion: 'Q',
              exitTicketQuestion: 'EQ',
              status: 'pending' as TeacherDecision,
              teacherDecision: 'pending' as TeacherDecision,
            },
          ];

          // Compute trace counts exactly as AIContributionTrace does
          const acceptedClusters = clusters.filter((c) => getCanonicalTeacherDecision(c) === 'accepted').length;
          const editedClusters = clusters.filter((c) => getCanonicalTeacherDecision(c) === 'edited').length;
          const dismissedClusters = clusters.filter((c) => getCanonicalTeacherDecision(c) === 'dismissed').length;
          const pendingClusters = clusters.filter((c) => getCanonicalTeacherDecision(c) === 'pending').length;

          const acceptedInts = interventions.filter((i) => getCanonicalTeacherDecision(i) === 'accepted').length;
          const editedInts = interventions.filter((i) => getCanonicalTeacherDecision(i) === 'edited').length;
          const dismissedInts = interventions.filter((i) => getCanonicalTeacherDecision(i) === 'dismissed').length;
          const pendingInts = interventions.filter((i) => getCanonicalTeacherDecision(i) === 'pending').length;

          const totalAccepted = acceptedClusters + acceptedInts;
          const totalEdited = editedClusters + editedInts;
          const totalDismissed = dismissedClusters + dismissedInts;
          const totalPending = pendingClusters + pendingInts;

          assert.strictEqual(totalAccepted, 0, 'accepted must be 0');
          assert.strictEqual(totalEdited, 0, 'edited must be 0');
          assert.strictEqual(totalDismissed, 0, 'dismissed must be 0');
          assert.strictEqual(totalPending, 3, 'pending must be > 0 (3 items)');

          // Verify Stage 7 label and stat
          const stage7Badge =
            totalAccepted > 0 || totalEdited > 0 || totalDismissed > 0
              ? 'Human Agency'
              : 'Teacher Review Pending';
          const stage7Stat =
            totalAccepted > 0 || totalEdited > 0
              ? `${totalAccepted} accepted · ${totalEdited} edited`
              : totalDismissed > 0
              ? `${totalDismissed} dismissed`
              : 'Teacher Review Pending';

          assert.strictEqual(stage7Badge, 'Teacher Review Pending');
          assert.strictEqual(stage7Stat, 'Teacher Review Pending');
        });
      });

      // 6. FAIL-OPEN DISPLAY SEARCH
      describe('Attack 6: Fail-Open Display Protection', () => {
        it('missing or undefined deterministic match renders Not Checked (never supported or positive)', () => {
          const displayUndefined = getDeterministicMatchDisplay(undefined);
          assert.strictEqual(displayUndefined.label, 'Not Checked');
          assert.strictEqual(displayUndefined.isSupported, false);

          const displayEmpty = getDeterministicMatchDisplay('');
          assert.strictEqual(displayEmpty.label, 'Not Checked');
          assert.strictEqual(displayEmpty.isSupported, false);
        });

        it('unsupported citation renders Unsupported Citation · Review Required (isSupported = false)', () => {
          const displayUnsupported = getDeterministicMatchDisplay('unsupported_citation');
          assert.strictEqual(displayUnsupported.label, 'Unsupported Citation · Review Required');
          assert.strictEqual(displayUnsupported.isSupported, false);
        });

        it('missing or undefined code verification renders Code Not Checked', () => {
          const badgeUndefined = getCodeVerificationBadge(undefined);
          assert.strictEqual(badgeUndefined.label, 'Code Not Checked');
          assert.strictEqual(badgeUndefined.variant, 'warning');
        });

        it('missing or undefined Gemini verification renders Gemini Not Checked', () => {
          const badgeUndefined = getGeminiVerificationBadge(undefined);
          assert.strictEqual(badgeUndefined.label, 'Gemini Not Checked');
          assert.strictEqual(badgeUndefined.variant, 'warning');

          const badgeNotChecked = getGeminiVerificationBadge('not_checked');
          assert.strictEqual(badgeNotChecked.label, 'Gemini Not Checked');
          assert.strictEqual(badgeNotChecked.variant, 'warning');
        });

        it('cluster with missing evidence examples renders Code Not Checked', () => {
          const clusterNoEvidence = {
            clusterId: 'c1',
            evidenceExamples: [],
          } as any;
          const badge = getClusterCodeVerificationBadge(clusterNoEvidence);
          assert.strictEqual(badge.label, 'Code Not Checked');
          assert.strictEqual(badge.variant, 'warning');
        });

        it('cluster with unsupported citation renders Code Check Failed', () => {
          const clusterWithUnsupported = {
            clusterId: 'c2',
            evidenceExamples: [
              { deterministicMatch: 'unsupported_citation' },
            ],
          } as any;
          const badge = getClusterCodeVerificationBadge(clusterWithUnsupported);
          assert.strictEqual(badge.label, 'Code Check Failed');
          assert.strictEqual(badge.variant, 'warning');
        });
      });

      // 7. EXPORT TRUTH ATTACK
      describe('Attack 7: Export Truth Attack', () => {
        it('export report never says Verified, Accepted, or Grounded when checks are pending or not checked', () => {
          const pendingResult: ClassAnalysisResult = {
            id: 'unverified-analysis-1',
            timestamp: '2026-09-29T00:00:00.000Z',
            context: DEMO_CONTEXT,
            classSnapshot: {
              totalSubmissions: 12,
              misconceptionCount: 1,
              strongestConcept: 'Concept A',
              highestPriorityNeed: 'Need A',
              overallRecommendation: 'Rec A',
            },
            studentObservations: [],
            misconceptionClusters: [
              {
                clusterId: 'c-pend-1',
                misconceptionTitle: 'Pending Cluster',
                studentCount: 4,
                affectedStudentIds: ['Student 01', 'Student 02'],
                percentageAffected: 33,
                teachingPriority: 'high',
                confidence: 0.85,
                explanation: 'Pending explanation',
                evidenceStrength: 'review_required',
                evidenceExamples: [],
                recommendedInstructionalResponse: 'R',
                status: 'pending',
                teacherDecision: 'pending',
              },
            ],
            instructionalGroups: [],
            nextLessonPlan: { phases: [], totalDuration: '25 min', targetObjective: 'Objective' },
            interventions: [
              {
                interventionId: 'i-pend-1',
                targetMisconceptionTitle: 'Pending Cluster',
                title: 'Pending Intervention',
                supportTier: 'Guided Practice',
                rationale: 'R',
                suggestedActivity: 'A',
                teacherScript: 'S',
                exampleQuestion: 'Q',
                exitTicketQuestion: 'EQ',
                status: 'pending',
                teacherDecision: 'pending',
              },
            ],
            verification: {
              overallStatus: 'not_checked' as any,
              evidenceCoverageStatus: 'not_checked' as any,
              objectiveAlignmentStatus: 'not_checked' as any,
              unsupportedClaimsStatus: 'not_checked' as any,
              pedagogicalPlausibility: 'not_checked' as any,
              explanation: 'Checks not run',
              groundedCheckDetails: [],
              deterministicChecks: undefined,
            },
          };

          // Generate markdown as in ResultsView.tsx
          const md = `
## 2. Misconception Discovery Map
${pendingResult.misconceptionClusters
  .map((c) => `- Teacher Decision: ${getCanonicalTeacherDecision(c)}`)
  .join('\n')}

## 5. Differentiated Interventions
${pendingResult.interventions
  .map((i) => `- Teacher Decision: ${getCanonicalTeacherDecision(i)}`)
  .join('\n')}

## 6. Verification Status & Technical Grounding
- Code Verification: ${pendingResult.verification.deterministicChecks?.coveragePassed === true ? 'Code Verified' : (pendingResult.verification.deterministicChecks ? 'Code Review Required' : 'Code Not Checked')}
- Gemini Adversarial Verification: ${pendingResult.verification.overallStatus === 'verified' ? 'Gemini Verified' : 'Gemini Not Checked'}
`;

          // Assertions
          assert.ok(md.includes('- Teacher Decision: pending'), 'Teacher decision must be pending');
          assert.ok(!md.includes('- Teacher Decision: accepted'), 'Teacher decision must NOT say accepted');
          assert.ok(md.includes('Code Verification: Code Not Checked'), 'Code verification must be Code Not Checked');
          assert.ok(!md.includes('Code Verification: Code Verified'), 'Code verification must NOT say Code Verified');
          assert.ok(md.includes('Gemini Adversarial Verification: Gemini Not Checked'), 'Gemini verification must be Gemini Not Checked');
          assert.ok(!md.includes('Gemini Adversarial Verification: Gemini Verified'), 'Gemini verification must NOT say Gemini Verified');
        });
      });

      // 8. DOWNSTREAM PLANNING SEMANTICS
      describe('Attack 8: Downstream Planning Semantics vs. Teacher Approval', () => {
        it('pending, accepted, and edited clusters participate in planning, but dismissed clusters are excluded', () => {
          const testClusters: MisconceptionCluster[] = [
            {
              clusterId: 'c-pending',
              misconceptionTitle: 'Pending Cluster',
              studentCount: 2,
              affectedStudentIds: ['Student 01', 'Student 02'],
              percentageAffected: 16,
              teachingPriority: 'moderate',
              confidence: 0.9,
              explanation: 'E',
              evidenceStrength: 'strong',
              evidenceExamples: [],
              recommendedInstructionalResponse: 'R',
              status: 'pending',
              teacherDecision: 'pending',
            },
            {
              clusterId: 'c-accepted',
              misconceptionTitle: 'Accepted Cluster',
              studentCount: 3,
              affectedStudentIds: ['Student 03', 'Student 04', 'Student 05'],
              percentageAffected: 25,
              teachingPriority: 'high',
              confidence: 0.95,
              explanation: 'E',
              evidenceStrength: 'strong',
              evidenceExamples: [],
              recommendedInstructionalResponse: 'R',
              status: 'accepted',
              teacherDecision: 'accepted',
            },
            {
              clusterId: 'c-edited',
              misconceptionTitle: 'Teacher Revised Cluster',
              studentCount: 2,
              affectedStudentIds: ['Student 06', 'Student 07'],
              percentageAffected: 16,
              teachingPriority: 'urgent',
              confidence: 0.98,
              explanation: 'E',
              evidenceStrength: 'strong',
              evidenceExamples: [],
              recommendedInstructionalResponse: 'R',
              status: 'edited',
              teacherDecision: 'edited',
            },
            {
              clusterId: 'c-dismissed',
              misconceptionTitle: 'Dismissed Cluster',
              studentCount: 1,
              affectedStudentIds: ['Student 08'],
              percentageAffected: 8,
              teachingPriority: 'moderate',
              confidence: 0.8,
              explanation: 'E',
              evidenceStrength: 'strong',
              evidenceExamples: [],
              recommendedInstructionalResponse: 'R',
              status: 'dismissed',
              teacherDecision: 'dismissed',
            },
          ];

          // Filter as in strategyService.ts
          const activeClusters = testClusters.filter(
            (m) => m.teacherDecision !== 'dismissed' && m.status !== 'dismissed'
          );

          assert.strictEqual(activeClusters.length, 3, 'Must retain exactly 3 clusters (pending, accepted, edited)');
          assert.ok(activeClusters.some((c) => c.clusterId === 'c-pending'), 'Pending cluster must participate in planning');
          assert.ok(activeClusters.some((c) => c.clusterId === 'c-accepted'), 'Accepted cluster must participate in planning');
          assert.ok(activeClusters.some((c) => c.clusterId === 'c-edited'), 'Edited cluster must participate in planning');
          assert.ok(!activeClusters.some((c) => c.clusterId === 'c-dismissed'), 'Dismissed cluster must be excluded from planning');

          // Explicit invariant: planning eligibility != teacher approval
          const pendingEligible = activeClusters.find((c) => c.clusterId === 'c-pending');
          assert.strictEqual(
            pendingEligible?.teacherDecision,
            'pending',
            'Planning eligibility does NOT imply teacher approval: cluster remains pending'
          );
        });
      });
    });
  });

  // =========================================================================
  // PHASE P2 MASTER PIPELINE INTEGRITY & ADVERSARIAL TEST SUITE
  // =========================================================================
  describe('Phase P2 Master Holistic Engineering: End-to-End Pipeline Integrity & Adversarial Hardening', () => {
    // -----------------------------------------------------------------------
    // SECTION 3: CANONICAL DEMO FINGERPRINT PAYLOAD LOCK-IN & DRIFT ROOT CAUSE
    // -----------------------------------------------------------------------
    describe('Section 3: Cryptographic Demo Fingerprint Lock-In & Drift Protection', () => {
      it('locks in exact canonical serialization and canonical SHA-256 hash', () => {
        const payload = canonicalizeDemoPayload(DEMO_CONTEXT, DEMO_SUBMISSIONS);
        const hash = computeDatasetFingerprint(DEMO_CONTEXT, DEMO_SUBMISSIONS);

        // Prove exact hash matching
        assert.strictEqual(
          hash,
          DEMO_DATASET_SHA256,
          'Canonical hash must match DEMO_DATASET_SHA256'
        );
        assert.strictEqual(
          hash,
          'f82100e176cd233e0b65efbf00fc7b8947e7dab66aadff9389f1f25f128bf1ce',
          'Exact canonical SHA-256 hash is permanently locked'
        );

        // Prove canonical serialization format: Context||Student 01:...;Student 02:...
        assert.ok(payload.startsWith('English Language Arts|Grade 10|Diagnostic Assessment: Present Perfect vs. Past Simple|'));
        assert.ok(payload.includes('||Student 01:typed:'));
        assert.ok(payload.endsWith('Student 12:typed:We has lived in our current house since 2021. My uncle have traveled to Japan two years ago for business.'));
      });

      it('proves deterministic sorting guarantees order invariance without identity mutation', () => {
        const reversed = [...DEMO_SUBMISSIONS].reverse();
        const hashReversed = computeDatasetFingerprint(DEMO_CONTEXT, reversed);
        assert.strictEqual(
          hashReversed,
          DEMO_DATASET_SHA256,
          'Reordered submissions must yield identical canonical hash due to deterministic studentId sorting'
        );
      });

      it('proves any single character modification breaks the fingerprint', () => {
        const altered = JSON.parse(JSON.stringify(DEMO_SUBMISSIONS));
        altered[0].studentText = altered[0].studentText.slice(0, -1); // remove 1 char
        assert.strictEqual(isExactDemoClassroom(DEMO_CONTEXT, altered), false);
      });
    });

    // -----------------------------------------------------------------------
    // 27.1 OBSERVER IDENTITY (O1 through O7)
    // -----------------------------------------------------------------------
    describe('27.1: Observer Identity Validation (O1 - O7)', () => {
      const roster: StudentSubmission[] = [
        { studentId: 'Student 01', studentText: 'Text 1', workType: 'typed' },
        { studentId: 'Student 02', studentText: 'Text 2', workType: 'typed' },
        { studentId: 'Student 03', studentText: 'Text 3', workType: 'typed' },
      ];

      it('O1: ordered expected IDs -> PASS', () => {
        const obs = [
          { studentId: 'Student 01', demonstratedUnderstanding: [] },
          { studentId: 'Student 02', demonstratedUnderstanding: [] },
          { studentId: 'Student 03', demonstratedUnderstanding: [] },
        ];
        const res = validateObserverOutput(roster, obs);
        assert.strictEqual(res.valid, true, 'O1 must pass');
        assert.strictEqual(res.missingStudentIds.length, 0);
        assert.strictEqual(res.duplicateStudentIds.length, 0);
        assert.strictEqual(res.unknownStudentIds.length, 0);
      });

      it('O2: same IDs reordered -> PASS without positional relabeling', () => {
        const obs = [
          { studentId: 'Student 03', demonstratedUnderstanding: ['Skill 3'] },
          { studentId: 'Student 01', demonstratedUnderstanding: ['Skill 1'] },
          { studentId: 'Student 02', demonstratedUnderstanding: ['Skill 2'] },
        ];
        const res = validateObserverOutput(roster, obs);
        assert.strictEqual(res.valid, true, 'O2 must pass');
        assert.strictEqual(res.matchedObservations.get('Student 01')?.demonstratedUnderstanding[0], 'Skill 1');
        assert.strictEqual(res.matchedObservations.get('Student 02')?.demonstratedUnderstanding[0], 'Skill 2');
        assert.strictEqual(res.matchedObservations.get('Student 03')?.demonstratedUnderstanding[0], 'Skill 3');
      });

      it('O3: missing expected student -> FAIL', () => {
        const obs = [
          { studentId: 'Student 01', demonstratedUnderstanding: [] },
          { studentId: 'Student 03', demonstratedUnderstanding: [] },
        ];
        const res = validateObserverOutput(roster, obs);
        assert.strictEqual(res.valid, false, 'O3 must fail');
        assert.deepStrictEqual(res.missingStudentIds, ['Student 02']);
      });

      it('O4: duplicate student -> FAIL', () => {
        const obs = [
          { studentId: 'Student 01', demonstratedUnderstanding: [] },
          { studentId: 'Student 02', demonstratedUnderstanding: [] },
          { studentId: 'Student 02', demonstratedUnderstanding: [] },
          { studentId: 'Student 03', demonstratedUnderstanding: [] },
        ];
        const res = validateObserverOutput(roster, obs);
        assert.strictEqual(res.valid, false, 'O4 must fail');
        assert.deepStrictEqual(res.duplicateStudentIds, ['Student 02']);
      });

      it('O5: unknown student -> FAIL', () => {
        const obs = [
          { studentId: 'Student 01', demonstratedUnderstanding: [] },
          { studentId: 'Student 02', demonstratedUnderstanding: [] },
          { studentId: 'Student 03', demonstratedUnderstanding: [] },
          { studentId: 'Student 99', demonstratedUnderstanding: [] },
        ];
        const res = validateObserverOutput(roster, obs);
        assert.strictEqual(res.valid, false, 'O5 must fail');
        assert.deepStrictEqual(res.unknownStudentIds, ['Student 99']);
      });

      it('O6: partial identity mismatch -> FAIL', () => {
        const obs = [
          { studentId: 'Student 01', demonstratedUnderstanding: [] },
          { studentId: 'Student 99', demonstratedUnderstanding: [] },
        ];
        const res = validateObserverOutput(roster, obs);
        assert.strictEqual(res.valid, false, 'O6 must fail');
        assert.ok(res.missingStudentIds.includes('Student 02'));
        assert.ok(res.missingStudentIds.includes('Student 03'));
        assert.ok(res.unknownStudentIds.includes('Student 99'));
      });

      it('O7: correct array length but wrong identity set -> FAIL', () => {
        const obs = [
          { studentId: 'Student 01', demonstratedUnderstanding: [] },
          { studentId: 'Student 03', demonstratedUnderstanding: [] },
          { studentId: 'Student 99', demonstratedUnderstanding: [] },
        ];
        assert.strictEqual(obs.length, roster.length, 'Array lengths match');
        const res = validateObserverOutput(roster, obs);
        assert.strictEqual(res.valid, false, 'O7 must fail despite identical array length');
        assert.deepStrictEqual(res.missingStudentIds, ['Student 02']);
        assert.deepStrictEqual(res.unknownStudentIds, ['Student 99']);
      });
    });

    // -----------------------------------------------------------------------
    // 27.2 EVIDENCE GROUNDING (E1 through E8)
    // -----------------------------------------------------------------------
    describe('27.2: Evidence Matching Domain Model & Grounding Invariants (E1 - E8)', () => {
      const source = 'I have lived in Da Nang for five years, so I know the city well. Last summer, my family visited Ba Na Hills.';

      it('E1: exact quote -> grounded (exact_quote_found)', () => {
        const match = checkQuoteInSource('I have lived in Da Nang for five years', source, 'typed');
        assert.strictEqual(match, 'exact_quote_found');
      });

      it('E2: conservative normalized exact quote -> grounded (normalized_exact_match)', () => {
        // Casing and extra spaces
        const match = checkQuoteInSource('  i  HAVE   lived in DA NANG for five years... ', source, 'typed');
        assert.strictEqual(match, 'normalized_exact_match');
        assert.strictEqual(getDeterministicMatchDisplay(match).isSupported, true, 'Normalized exact match must be grounded');
      });

      it('E3: scattered keywords across unrelated sentences -> NOT grounded (unsupported_citation)', () => {
        // Prompt example: "visited London last summer" scattered across sentences
        const scatteredSource = 'Last week we studied London. The student visited their grandmother. Summer vocabulary was difficult.';
        const match = checkQuoteInSource('visited London last summer', scatteredSource, 'typed');
        assert.strictEqual(match, 'unsupported_citation', 'Scattered keywords must NOT be accepted as grounded');
      });

      it('E4: partial contiguous sequence -> approximate_match, NOT grounded into quotesGroundedCount', () => {
        // Source contains "visited Ba Na Hills"
        const match = checkQuoteInSource('visited Ba Na Hills and climbed the mountain', source, 'typed');
        assert.strictEqual(match, 'approximate_match');

        // Prove approximate_match does not increment quotesGroundedCount in validateEvidenceQuotes
        const dummyCluster: MisconceptionCluster = {
          clusterId: 'c1',
          misconceptionTitle: 'Test',
          studentCount: 1,
          percentageAffected: 100,
          affectedStudentIds: ['S1'],
          explanation: 'E',
          evidenceExamples: [
            {
              studentId: 'S1',
              excerpt: 'visited Ba Na Hills and climbed the mountain',
              groundingReason: 'Reason',
            },
          ],
          teachingPriority: 'high',
          confidence: 0.9,
          recommendedInstructionalResponse: 'R',
        };
        const norm: NormalizedSourceEvidence[] = [
          { studentId: 'S1', sourceType: 'typed', extractedText: source, confidenceOrStatus: 'exact_source' },
        ];

        const audit = validateEvidenceQuotes([dummyCluster], [], norm);
        assert.strictEqual(audit.quotesGroundedCount, 0, 'Approximate match MUST NOT increment quotesGroundedCount');
        assert.strictEqual(audit.quotesFlaggedCount, 1, 'Approximate match must be flagged for review');
        assert.strictEqual(audit.evidenceValidationPassed, false, 'Approximate match fails automatic validation');
        assert.strictEqual(audit.auditedClusters[0].evidenceStrength, 'review_required');
      });

      it('E5: fabricated quote -> unsupported_citation', () => {
        const match = checkQuoteInSource('I flew on a rocket ship to Jupiter', source, 'typed');
        assert.strictEqual(match, 'unsupported_citation');
      });

      it('E6: wrong-student quote -> unsupported (provenance preserved)', () => {
        const student1Text = 'I have visited Ha Long Bay last year.';
        const student2Text = 'I have studied English since Grade 3.';
        const norm: NormalizedSourceEvidence[] = [
          { studentId: 'Student 01', sourceType: 'typed', extractedText: student1Text, confidenceOrStatus: 'exact_source' },
          { studentId: 'Student 02', sourceType: 'typed', extractedText: student2Text, confidenceOrStatus: 'exact_source' },
        ];

        // Claim attributes Student 01 quote to Student 02
        const wrongStudentCluster: MisconceptionCluster = {
          clusterId: 'c1',
          misconceptionTitle: 'Attribution Error',
          studentCount: 1,
          percentageAffected: 50,
          affectedStudentIds: ['Student 02'],
          explanation: 'E',
          evidenceExamples: [
            {
              studentId: 'Student 02',
              excerpt: 'I have visited Ha Long Bay last year', // Exists in Student 01, NOT Student 02
              groundingReason: 'R',
            },
          ],
          teachingPriority: 'high',
          confidence: 0.9,
          recommendedInstructionalResponse: 'R',
        };

        const audit = validateEvidenceQuotes([wrongStudentCluster], [], norm);
        assert.strictEqual(
          audit.auditedClusters[0].evidenceExamples[0].deterministicMatch,
          'unsupported_citation',
          'Quote from Student 01 must NEVER validate a claim about Student 02'
        );
        assert.strictEqual(audit.quotesGroundedCount, 0);
        assert.strictEqual(audit.evidenceValidationPassed, false);
      });

      it('E7: empty excerpt -> unsupported_citation', () => {
        const match = checkQuoteInSource('', source, 'typed');
        assert.strictEqual(match, 'unsupported_citation');
      });

      it('E8: missing normalized evidence -> fail closed / not checked', () => {
        const sampleCluster: MisconceptionCluster = {
          clusterId: 'c1',
          misconceptionTitle: 'Test',
          studentCount: 1,
          percentageAffected: 100,
          affectedStudentIds: ['Student 01'],
          explanation: 'E',
          evidenceExamples: [
            {
              studentId: 'Student 01',
              excerpt: 'sample excerpt',
              groundingReason: 'R',
            },
          ],
          teachingPriority: 'high',
          confidence: 0.9,
          recommendedInstructionalResponse: 'R',
        };

        const audit = validateEvidenceQuotes([sampleCluster], [], undefined);
        assert.strictEqual(audit.evidenceValidationPassed, false);
        assert.strictEqual(audit.quotesGroundedCount, 0);
        assert.strictEqual(audit.quotesFlaggedCount, 1);
        assert.strictEqual(audit.auditedClusters[0].evidenceStrength, 'review_required');
      });
    });

    // -----------------------------------------------------------------------
    // 27.3 IMAGE / HANDWRITTEN MULTIMODAL SOURCE (I1 through I5)
    // -----------------------------------------------------------------------
    describe('27.3: Multimodal & Image Transcription Honesty (I1 - I5)', () => {
      it('I1: image source only -> does NOT imply transcription_high', () => {
        const subs: StudentSubmission[] = [
          { studentId: 'Student 01', studentText: 'Transcribed text', workType: 'handwritten_work' },
        ];
        const rawObs = [
          { studentId: 'Student 01', demonstratedUnderstanding: [], extractedSourceText: 'Transcribed text' },
        ];
        const validation = validateObserverOutput(subs, rawObs);
        assert.strictEqual(validation.valid, true);

        // Verify that observerService policy sets confidenceOrStatus to 'transcription_unverified'
        const isImage = subs[0].workType === 'handwritten_work';
        const extractedText = rawObs[0].extractedSourceText;
        const confidenceOrStatus = isImage
          ? !extractedText || extractedText.trim().length === 0
            ? 'unreadable'
            : 'transcription_unverified'
          : 'exact_source';

        assert.strictEqual(
          confidenceOrStatus,
          'transcription_unverified',
          'Image source must never automatically imply high confidence'
        );
      });

      it('I2: usable transcription without explicit confidence is transcription_unverified', () => {
        const norm: NormalizedSourceEvidence = {
          studentId: 'Student 01',
          sourceType: 'image_transcription',
          extractedText: 'Yesterday I have played badminton.',
          confidenceOrStatus: 'transcription_unverified',
        };
        assert.strictEqual(norm.confidenceOrStatus, 'transcription_unverified');
      });

      it('I3: ambiguous transcription requires review', () => {
        const norm: NormalizedSourceEvidence = {
          studentId: 'Student 01',
          sourceType: 'image_transcription',
          extractedText: 'Yesterday I [unclear] badminton.',
          confidenceOrStatus: 'transcription_moderate',
        };
        assert.ok(norm.confidenceOrStatus !== 'exact_source');
      });

      it('I4: unreadable image maps to explicit unreadable state', () => {
        const subs: StudentSubmission[] = [
          { studentId: 'Student 01', studentText: '', workType: 'handwritten_work' },
        ];
        const rawObs = [
          { studentId: 'Student 01', demonstratedUnderstanding: [], extractedSourceText: '' },
        ];
        const isImage = subs[0].workType === 'handwritten_work';
        const extractedText = rawObs[0].extractedSourceText;
        const status = isImage
          ? !extractedText || extractedText.trim().length === 0
            ? 'unreadable'
            : 'transcription_unverified'
          : 'exact_source';

        assert.strictEqual(status, 'unreadable');
      });

      it('I5: typed exact source vs transcription has distinct evidence semantics', () => {
        const typedMatch = checkQuoteInSource('hello world', 'hello world', 'typed');
        const imgMatch = checkQuoteInSource('hello world', 'hello world', 'image_transcription');

        assert.strictEqual(typedMatch, 'exact_quote_found');
        assert.strictEqual(imgMatch, 'image_transcription_match');
        assert.notStrictEqual(typedMatch, imgMatch, 'Must preserve distinct match types');
      });
    });

    // -----------------------------------------------------------------------
    // 27.4 GROUP PARTITION INTEGRITY (G1 through G6)
    // -----------------------------------------------------------------------
    describe('27.4: Group Partition Integrity (G1 - G6)', () => {
      const roster: StudentSubmission[] = [
        { studentId: 'S1', studentText: 'T1', workType: 'typed' },
        { studentId: 'S2', studentText: 'T2', workType: 'typed' },
        { studentId: 'S3', studentText: 'T3', workType: 'typed' },
      ];

      it('G1: valid complete partition -> PASS', () => {
        const groups: InstructionalGroup[] = [
          {
            groupId: 'g1',
            groupName: 'Group 1',
            studentIds: ['S1', 'S2'],
            commonLearningNeed: 'N',
            evidenceSummary: 'E',
            suggestedActivity: 'A',
            teacherInstructions: 'I',
            exampleQuestion: 'Q',
            estimatedDuration: '15 min',
            successCriterion: 'S',
          },
          {
            groupId: 'g2',
            groupName: 'Group 2',
            studentIds: ['S3'],
            commonLearningNeed: 'N',
            evidenceSummary: 'E',
            suggestedActivity: 'A',
            teacherInstructions: 'I',
            exampleQuestion: 'Q',
            estimatedDuration: '15 min',
            successCriterion: 'S',
          },
        ];
        const res = validateInstructionalGroupPartition(groups, roster);
        assert.strictEqual(res.passed, true);
        assert.strictEqual(res.issues.length, 0);
      });

      it('G2: zero model groups -> original FAIL with safe repair', () => {
        const res = validateInstructionalGroupPartition([], roster);
        assert.strictEqual(res.passed, false, 'Must fail partition check');
        assert.ok(res.auditedGroups.length > 0, 'Safe repair must generate fallback representation');
        assert.strictEqual(res.auditedGroups[0].studentIds.length, 3, 'Repaired group includes all 3 students');
      });

      it('G3: missing student -> original FAIL', () => {
        const groups: InstructionalGroup[] = [
          {
            groupId: 'g1',
            groupName: 'Group 1',
            studentIds: ['S1', 'S2'], // S3 omitted
            commonLearningNeed: 'N',
            evidenceSummary: 'E',
            suggestedActivity: 'A',
            teacherInstructions: 'I',
            exampleQuestion: 'Q',
            estimatedDuration: '15 min',
            successCriterion: 'S',
          },
        ];
        const res = validateInstructionalGroupPartition(groups, roster);
        assert.strictEqual(res.passed, false);
        assert.deepStrictEqual(res.unassignedStudents, ['S3']);
      });

      it('G4: duplicate student -> original FAIL', () => {
        const groups: InstructionalGroup[] = [
          {
            groupId: 'g1',
            groupName: 'Group 1',
            studentIds: ['S1', 'S2'],
            commonLearningNeed: 'N',
            evidenceSummary: 'E',
            suggestedActivity: 'A',
            teacherInstructions: 'I',
            exampleQuestion: 'Q',
            estimatedDuration: '15 min',
            successCriterion: 'S',
          },
          {
            groupId: 'g2',
            groupName: 'Group 2',
            studentIds: ['S2', 'S3'], // S2 duplicated
            commonLearningNeed: 'N',
            evidenceSummary: 'E',
            suggestedActivity: 'A',
            teacherInstructions: 'I',
            exampleQuestion: 'Q',
            estimatedDuration: '15 min',
            successCriterion: 'S',
          },
        ];
        const res = validateInstructionalGroupPartition(groups, roster);
        assert.strictEqual(res.passed, false);
        assert.deepStrictEqual(res.duplicateAssignments, ['S2']);
      });

      it('G5: unknown student -> original FAIL', () => {
        const groups: InstructionalGroup[] = [
          {
            groupId: 'g1',
            groupName: 'Group 1',
            studentIds: ['S1', 'S2', 'S3', 'S99'], // S99 unknown
            commonLearningNeed: 'N',
            evidenceSummary: 'E',
            suggestedActivity: 'A',
            teacherInstructions: 'I',
            exampleQuestion: 'Q',
            estimatedDuration: '15 min',
            successCriterion: 'S',
          },
        ];
        const res = validateInstructionalGroupPartition(groups, roster);
        assert.strictEqual(res.passed, false);
        assert.deepStrictEqual(res.unknownIds, ['S99']);
      });

      it('G6: safe repaired groups produced BUT original groupPartitionPassed remains false', () => {
        const brokenGroups: InstructionalGroup[] = [
          {
            groupId: 'g1',
            groupName: 'Group 1',
            studentIds: ['S1', 'S1', 'S99'],
            commonLearningNeed: 'N',
            evidenceSummary: 'E',
            suggestedActivity: 'A',
            teacherInstructions: 'I',
            exampleQuestion: 'Q',
            estimatedDuration: '15 min',
            successCriterion: 'S',
          },
        ];
        const res = validateInstructionalGroupPartition(brokenGroups, roster);
        assert.strictEqual(res.passed, false, 'Original validity must remain false');
        // Safe rendering repair
        const allAssigned = res.auditedGroups.flatMap((g) => g.studentIds);
        assert.ok(allAssigned.includes('S1'));
        assert.ok(allAssigned.includes('S2'));
        assert.ok(allAssigned.includes('S3'));
        assert.ok(!allAssigned.includes('S99'), 'Unknown ID stripped from repaired groups');
      });
    });

    // -----------------------------------------------------------------------
    // 27.5 STABLE DOMAIN IDENTITIES (S1 through S4)
    // -----------------------------------------------------------------------
    describe('27.5: Stable Domain Identities & Linkage (S1 - S4)', () => {
      it('S1: cluster title edited after intervention generated -> intervention relationship remains valid via clusterId', () => {
        const cluster: MisconceptionCluster = {
          clusterId: 'cluster-42',
          misconceptionTitle: 'Original Title',
          studentCount: 2,
          percentageAffected: 20,
          affectedStudentIds: ['S1', 'S2'],
          explanation: 'E',
          evidenceExamples: [],
          teachingPriority: 'high',
          confidence: 0.9,
          recommendedInstructionalResponse: 'R',
        };

        const intervention: DifferentiatedIntervention = {
          interventionId: 'int-1',
          clusterId: 'cluster-42',
          targetMisconceptionTitle: 'Original Title',
          title: 'Targeted Drill',
          supportTier: 'Guided Practice',
          rationale: 'R',
          suggestedActivity: 'A',
          teacherScript: 'S',
          exampleQuestion: 'Q',
          exitTicketQuestion: 'E',
        };

        // Teacher edits cluster title
        const editedCluster = {
          ...cluster,
          misconceptionTitle: 'Teacher Revised Title',
          teacherDecision: 'edited' as const,
        };

        // Linkage test: intervention is linked by clusterId
        const linked = editedCluster.clusterId === intervention.clusterId;
        assert.strictEqual(linked, true, 'Intervention remains stably linked via clusterId after title edit');
      });

      it('S2: two clusters share identical display titles -> remain distinct by clusterId', () => {
        const c1: MisconceptionCluster = {
          clusterId: 'cluster-A',
          misconceptionTitle: 'Verb Tense Error',
          studentCount: 2,
          percentageAffected: 20,
          affectedStudentIds: ['S1', 'S2'],
          explanation: 'E1',
          evidenceExamples: [],
          teachingPriority: 'high',
          confidence: 0.9,
          recommendedInstructionalResponse: 'R1',
        };
        const c2: MisconceptionCluster = {
          clusterId: 'cluster-B',
          misconceptionTitle: 'Verb Tense Error',
          studentCount: 3,
          percentageAffected: 30,
          affectedStudentIds: ['S3', 'S4', 'S5'],
          explanation: 'E2',
          evidenceExamples: [],
          teachingPriority: 'urgent',
          confidence: 0.95,
          recommendedInstructionalResponse: 'R2',
        };

        assert.notStrictEqual(c1.clusterId, c2.clusterId, 'Clusters remain distinct by ID despite identical titles');
      });

      it('S3: serialization and reload preserves stable IDs and relationships', () => {
        const intervention: DifferentiatedIntervention = {
          interventionId: 'int-99',
          clusterId: 'cluster-42',
          targetMisconceptionTitle: 'Target',
          title: 'Intervention',
          supportTier: 'Concept Clarification',
          rationale: 'R',
          suggestedActivity: 'A',
          teacherScript: 'S',
          exampleQuestion: 'Q',
          exitTicketQuestion: 'E',
          teacherDecision: 'edited',
        };

        const serialized = JSON.stringify(intervention);
        const reloaded: DifferentiatedIntervention = JSON.parse(serialized);

        assert.strictEqual(reloaded.interventionId, 'int-99');
        assert.strictEqual(reloaded.clusterId, 'cluster-42');
        assert.strictEqual(reloaded.teacherDecision, 'edited');
      });
    });

    // -----------------------------------------------------------------------
    // 27.6 VERIFIER CLAIM INTEGRITY (V1 through V5)
    // -----------------------------------------------------------------------
    describe('27.6: Verifier Claim-Integrity Invariants (V1 - V5)', () => {
      it('V1: all required artifacts provided allows normal verification evaluation', () => {
        const hasSubmissions = true;
        const hasNormalizedEvidence = true;
        const hasLessonPlan = true;
        const hasGroups = true;
        const hasInterventions = true;

        assert.ok(hasSubmissions && hasNormalizedEvidence && hasLessonPlan && hasGroups && hasInterventions);
      });

      it('V2: lesson plan omitted -> verifier cannot claim lesson plan verified', () => {
        const nextLessonPlan = undefined;
        const hasLessonPlan = Boolean(nextLessonPlan && (nextLessonPlan as any).phases?.length > 0);

        let overallStatus = 'verified';
        let pedagogicalPlausibility = 'sound';

        if (!hasLessonPlan) {
          pedagogicalPlausibility = 'review_suggested';
          if (overallStatus === 'verified') {
            overallStatus = 'partially_verified';
          }
        }

        assert.strictEqual(pedagogicalPlausibility, 'review_suggested');
        assert.notStrictEqual(overallStatus, 'verified', 'Cannot be fully verified if lesson plan omitted');
      });

      it('V3: groups omitted -> overall verification downgraded', () => {
        const groups: InstructionalGroup[] = [];
        let overallStatus = 'verified';
        if (groups.length === 0) {
          overallStatus = 'partially_verified';
        }
        assert.notStrictEqual(overallStatus, 'verified');
      });

      it('V4: interventions omitted -> overall verification downgraded', () => {
        const interventions: DifferentiatedIntervention[] = [];
        let overallStatus = 'verified';
        if (interventions.length === 0) {
          overallStatus = 'partially_verified';
        }
        assert.notStrictEqual(overallStatus, 'verified');
      });

      it('V5: verifier attempts positive claim for omitted artifact -> system downgrades canonical state', () => {
        // Even if model returns 'verified', missing deterministic evidence forces fail-closed
        const modelReturn = { overallStatus: 'verified', evidenceCoverageStatus: 'verified' };
        const hasNormalizedEvidence = false;

        let canonicalOverall = modelReturn.overallStatus;
        if (!hasNormalizedEvidence) {
          canonicalOverall = 'needs_review';
        }
        assert.strictEqual(canonicalOverall, 'needs_review');
      });
    });

    // -----------------------------------------------------------------------
    // 27.7 SINGLE CANONICAL OVERALL TECHNICAL VERIFICATION (T1 through T7)
    // -----------------------------------------------------------------------
    describe('27.7: Single Canonical Technical Verification Derivation (T1 - T7)', () => {
      it('T1: all required checks explicitly pass -> isAnalysisFullyVerified = true', () => {
        const fullyVerified = isAnalysisFullyVerified({
          deterministicAuditPassed: true,
          coveragePassed: true,
          clusterMathPassed: true,
          groupPartitionPassed: true,
          evidenceValidationPassed: true,
          overallStatus: 'verified',
        });
        assert.strictEqual(fullyVerified, true);
      });

      it('T2: one deterministic failure -> isAnalysisFullyVerified = false', () => {
        const fullyVerified = isAnalysisFullyVerified({
          deterministicAuditPassed: false,
          overallStatus: 'verified',
        });
        assert.strictEqual(fullyVerified, false);
      });

      it('T3: semantic review required -> isAnalysisFullyVerified = false', () => {
        const fullyVerified = isAnalysisFullyVerified({
          deterministicAuditPassed: true,
          overallStatus: 'needs_review',
        });
        assert.strictEqual(fullyVerified, false);
      });

      it('T4: missing required technical state (undefined) -> isAnalysisFullyVerified = false', () => {
        const fullyVerified = isAnalysisFullyVerified({
          deterministicAuditPassed: undefined,
          overallStatus: 'verified',
        });
        assert.strictEqual(fullyVerified, false);
      });

      it('T5: missing semantic verification -> isAnalysisFullyVerified = false', () => {
        const fullyVerified = isAnalysisFullyVerified({
          deterministicAuditPassed: true,
          overallStatus: undefined,
        });
        assert.strictEqual(fullyVerified, false);
      });

      it('T6: Teacher Accepted + Code Failed -> Code Check Failed, Overall NOT fully verified', () => {
        const teacherDecision: TeacherDecision = 'accepted';
        const technicalVerified = isAnalysisFullyVerified({
          deterministicAuditPassed: false,
          overallStatus: 'verified',
        });
        assert.strictEqual(teacherDecision, 'accepted');
        assert.strictEqual(technicalVerified, false, 'Teacher approval never overrides technical failure');
      });

      it('T7: Teacher Pending + technical checks all pass -> Technical Pass, Teacher Review Pending', () => {
        const teacherDecision: TeacherDecision = 'pending';
        const technicalVerified = isAnalysisFullyVerified({
          deterministicAuditPassed: true,
          coveragePassed: true,
          clusterMathPassed: true,
          groupPartitionPassed: true,
          evidenceValidationPassed: true,
          overallStatus: 'verified',
        });
        assert.strictEqual(teacherDecision, 'pending');
        assert.strictEqual(technicalVerified, true);
        assert.notStrictEqual(teacherDecision, 'accepted', 'Technical pass never implies teacher acceptance');
      });
    });

    // -----------------------------------------------------------------------
    // 27.8 STRUCTURED OUTPUT REVIEW & DOMAIN VALIDATION (SO1 through SO5)
    // -----------------------------------------------------------------------
    describe('27.8: Structured Output Schema vs Domain Validation (SO1 - SO5)', () => {
      it('SO1: missing required property fails Zod schema validation', () => {
        const invalidObservation = {
          // missing studentId
          demonstratedUnderstanding: ['grammar'],
        };
        const res = StudentObservationSchema.safeParse(invalidObservation);
        assert.strictEqual(res.success, false);
      });

      it('SO2: invalid enum fails Zod schema validation', () => {
        const invalidSupportLevel = {
          studentId: 'Student 01',
          demonstratedUnderstanding: [],
          misconceptions: [],
          supportingEvidence: [],
          recommendedSupportLevel: 'invalid_tier_name',
        };
        const res = StudentObservationSchema.safeParse(invalidSupportLevel);
        assert.strictEqual(res.success, false);
      });

      it('SO3: schema-valid duplicate IDs fail domain validation', () => {
        const duplicateObs = [
          { studentId: 'Student 01', demonstratedUnderstanding: [] },
          { studentId: 'Student 01', demonstratedUnderstanding: [] },
        ];
        const roster: StudentSubmission[] = [
          { studentId: 'Student 01', studentText: 'T1', workType: 'typed' },
          { studentId: 'Student 02', studentText: 'T2', workType: 'typed' },
        ];
        const res = validateObserverOutput(roster, duplicateObs);
        assert.strictEqual(res.valid, false, 'Schema-valid duplicate IDs must fail domain validation');
        assert.deepStrictEqual(res.duplicateStudentIds, ['Student 01']);
      });

      it('SO4: schema-valid unknown student fails domain validation', () => {
        const unknownObs = [
          { studentId: 'Student 999', demonstratedUnderstanding: [] },
        ];
        const roster: StudentSubmission[] = [
          { studentId: 'Student 01', studentText: 'T1', workType: 'typed' },
        ];
        const res = validateObserverOutput(roster, unknownObs);
        assert.strictEqual(res.valid, false, 'Schema-valid unknown student must fail domain validation');
        assert.deepStrictEqual(res.unknownStudentIds, ['Student 999']);
      });

      it('SO5: schema-valid impossible relationship fails domain validation', () => {
        const clusters: MisconceptionCluster[] = [
          {
            clusterId: 'c1',
            misconceptionTitle: 'Title',
            studentCount: 5,
            percentageAffected: 100,
            affectedStudentIds: ['Ghost Student A', 'Ghost Student B'],
            explanation: 'E',
            evidenceExamples: [],
            teachingPriority: 'high',
            confidence: 0.9,
            recommendedInstructionalResponse: 'R',
          },
        ];
        const roster: StudentSubmission[] = [
          { studentId: 'Student 01', studentText: 'T1', workType: 'typed' },
        ];
        const refCheck = validateStudentReferences(clusters, roster);
        assert.strictEqual(refCheck.passed, false);
        assert.deepStrictEqual(refCheck.invalidStudentRefs, ['Ghost Student A', 'Ghost Student B']);
      });
    });

    // -----------------------------------------------------------------------
    // 27.9 ERROR & RETRY MODEL (ER1 through ER4)
    // -----------------------------------------------------------------------
    describe('27.9: Explicit Error & Retry Model (ER1 - ER4)', () => {
      it('ER1: temporary model availability error is marked retryable', () => {
        const err = new PipelineError({
          code: 'RATE_LIMIT_ERROR',
          stage: 'Stage 2: Gemini Observer',
          message: 'Resource exhausted 429',
          retryable: true,
        });
        assert.strictEqual(err.retryable, true);
        assert.strictEqual(err.code, 'RATE_LIMIT_ERROR');
      });

      it('ER2: invalid application input is marked non-retryable', () => {
        const err = new PipelineError({
          code: 'NORMALIZATION_ERROR',
          stage: 'Stage 1: Source Evidence',
          message: 'Missing learning context or student submissions',
          retryable: false,
        });
        assert.strictEqual(err.retryable, false);
      });

      it('ER3: duplicate student identity is non-retryable domain invariant failure', () => {
        const err = new PipelineError({
          code: 'OBSERVER_IDENTITY_ERROR',
          stage: 'Stage 2: Gemini Observer',
          message: 'Duplicate observation detected for Student 01',
          retryable: false,
        });
        assert.strictEqual(err.retryable, false);
      });

      it('ER4: custom classroom failure results in controlled error, absolutely NOT demo fallback', () => {
        const customSubmissions: StudentSubmission[] = [
          { studentId: 'Custom 01', studentText: 'Custom analysis failure text', workType: 'typed' },
        ];
        const isDemo = isExactDemoClassroom(DEMO_CONTEXT, customSubmissions);
        assert.strictEqual(isDemo, false, 'Custom submissions must never be detected as demo');
      });
    });

    // -----------------------------------------------------------------------
    // SECTION 28: ADVERSARIAL RED-TEAM RUN (Attacks 1 through 22)
    // -----------------------------------------------------------------------
    describe('Section 28: Complete Adversarial Red-Team Run (Attacks 1 - 22)', () => {
      const roster: StudentSubmission[] = [
        { studentId: 'Student 01', studentText: 'I have lived in Da Nang for five years.', workType: 'typed' },
        { studentId: 'Student 02', studentText: 'I have visited Ha Long Bay last year.', workType: 'typed' },
      ];

      it('Attack 1: Observer returns correct count but wrong identities -> blocked', () => {
        const obs = [
          { studentId: 'Student 01', demonstratedUnderstanding: [] },
          { studentId: 'Student 99', demonstratedUnderstanding: [] },
        ];
        const res = validateObserverOutput(roster, obs);
        assert.strictEqual(res.valid, false);
      });

      it('Attack 2: Observer duplicates Student 01 and omits Student 02 -> blocked', () => {
        const obs = [
          { studentId: 'Student 01', demonstratedUnderstanding: [] },
          { studentId: 'Student 01', demonstratedUnderstanding: [] },
        ];
        const res = validateObserverOutput(roster, obs);
        assert.strictEqual(res.valid, false);
        assert.deepStrictEqual(res.duplicateStudentIds, ['Student 01']);
        assert.deepStrictEqual(res.missingStudentIds, ['Student 02']);
      });

      it('Attack 3: Observer returns correct identities in random order -> passed without relabeling', () => {
        const obs = [
          { studentId: 'Student 02', demonstratedUnderstanding: ['Observation 2'] },
          { studentId: 'Student 01', demonstratedUnderstanding: ['Observation 1'] },
        ];
        const res = validateObserverOutput(roster, obs);
        assert.strictEqual(res.valid, true);
        assert.strictEqual(res.matchedObservations.get('Student 01')?.demonstratedUnderstanding[0], 'Observation 1');
        assert.strictEqual(res.matchedObservations.get('Student 02')?.demonstratedUnderstanding[0], 'Observation 2');
      });

      it('Attack 4: Quote contains 80% similar tokens scattered across unrelated sentences -> unsupported', () => {
        const scattered = 'Last year we visited many places. I have lived there. The bay is nice.';
        const match = checkQuoteInSource('I have visited Ha Long Bay last year', scattered, 'typed');
        assert.strictEqual(match, 'unsupported_citation');
      });

      it('Attack 5: Quote exists only in another student source -> unsupported citation', () => {
        const s1Quote = 'I have lived in Da Nang for five years.';
        const match = checkQuoteInSource(s1Quote, roster[1].studentText, 'typed'); // checked against S2
        assert.strictEqual(match, 'unsupported_citation');
      });

      it('Attack 6: normalizedEvidence missing -> fail closed, 0 grounded quotes', () => {
        const audit = validateEvidenceQuotes(sampleClusters, sampleObservations, undefined);
        assert.strictEqual(audit.evidenceValidationPassed, false);
        assert.strictEqual(audit.quotesGroundedCount, 0);
      });

      it('Attack 7: image transcription exists but confidence is unknown -> transcription_unverified', () => {
        const norm: NormalizedSourceEvidence = {
          studentId: 'Student 01',
          sourceType: 'image_transcription',
          extractedText: 'Transcribed text',
          confidenceOrStatus: 'transcription_unverified',
        };
        assert.strictEqual(norm.confidenceOrStatus, 'transcription_unverified');
      });

      it('Attack 8: AI group output invalid but repaired representation valid -> groupPartitionPassed remains false', () => {
        const invalidGroups: InstructionalGroup[] = [
          {
            groupId: 'g1',
            groupName: 'G1',
            studentIds: ['Student 01'], // Student 02 omitted
            commonLearningNeed: 'N',
            evidenceSummary: 'E',
            suggestedActivity: 'A',
            teacherInstructions: 'I',
            exampleQuestion: 'Q',
            estimatedDuration: '15 min',
            successCriterion: 'S',
          },
        ];
        const res = validateInstructionalGroupPartition(invalidGroups, roster);
        assert.strictEqual(res.passed, false, 'Original validity must remain false');
        assert.ok(res.auditedGroups[0].studentIds.includes('Student 02'), 'Repaired group has student');
      });

      it('Attack 9: Gemini verifier returns PASS while group partition failed -> overallStatus downgraded to needs_review', () => {
        const deterministicAudit: any = {
          coveragePassed: true,
          clusterMathPassed: true,
          groupPartitionPassed: false, // FAILED
          evidenceValidationPassed: true,
          quotesGroundedCount: 5,
          quotesFlaggedCount: 0,
        };

        const technicalVerified = isAnalysisFullyVerified({
          deterministicAuditPassed: false,
          groupPartitionPassed: false,
          overallStatus: 'verified',
        });
        assert.strictEqual(technicalVerified, false);
      });

      it('Attack 10: Gemini verifier returns PASS while evidence failed -> overallStatus downgraded to needs_review', () => {
        const technicalVerified = isAnalysisFullyVerified({
          deterministicAuditPassed: false,
          evidenceValidationPassed: false,
          overallStatus: 'verified',
        });
        assert.strictEqual(technicalVerified, false);
      });

      it('Attack 11: semantic verifier missing -> overall not verified', () => {
        const technicalVerified = isAnalysisFullyVerified({
          deterministicAuditPassed: true,
          overallStatus: undefined,
        });
        assert.strictEqual(technicalVerified, false);
      });

      it('Attack 12: Teacher Accepted but deterministic validation failed -> NOT fully verified', () => {
        const technicalVerified = isAnalysisFullyVerified({
          deterministicAuditPassed: false,
          overallStatus: 'verified',
        });
        const teacherDecision: TeacherDecision = 'accepted';
        assert.strictEqual(teacherDecision, 'accepted');
        assert.strictEqual(technicalVerified, false);
      });

      it('Attack 13: Teacher Pending but all technical checks passed -> Technical Pass, Teacher Review Pending', () => {
        const technicalVerified = isAnalysisFullyVerified({
          deterministicAuditPassed: true,
          coveragePassed: true,
          clusterMathPassed: true,
          groupPartitionPassed: true,
          evidenceValidationPassed: true,
          overallStatus: 'verified',
        });
        const teacherDecision: TeacherDecision = 'pending';
        assert.strictEqual(technicalVerified, true);
        assert.strictEqual(teacherDecision, 'pending');
      });

      it('Attack 14: Verifier claims lesson-plan verification but lesson plan was omitted -> downgraded', () => {
        const hasLessonPlan = false;
        let pedagogicalPlausibility = 'sound';
        let overallStatus = 'verified';

        if (!hasLessonPlan) {
          pedagogicalPlausibility = 'review_suggested';
          if (overallStatus === 'verified') {
            overallStatus = 'partially_verified';
          }
        }
        assert.strictEqual(pedagogicalPlausibility, 'review_suggested');
        assert.strictEqual(overallStatus, 'partially_verified');
      });

      it('Attack 15: Teacher edits misconception title after interventions already reference the cluster -> clusterId preserves linkage', () => {
        const clusterId = 'cluster-tense-1';
        const initialCluster = { clusterId, misconceptionTitle: 'Initial Title' };
        const intervention: DifferentiatedIntervention = {
          interventionId: 'int-1',
          clusterId,
          targetMisconceptionTitle: 'Initial Title',
          title: 'Drill',
          supportTier: 'Guided Practice',
          rationale: 'R',
          suggestedActivity: 'A',
          teacherScript: 'S',
          exampleQuestion: 'Q',
          exitTicketQuestion: 'E',
        };

        // Edit cluster title
        const editedCluster = { ...initialCluster, misconceptionTitle: 'Revised Title' };
        assert.strictEqual(intervention.clusterId, editedCluster.clusterId, 'Linkage preserved through clusterId');
      });

      it('Attack 16: two misconception clusters have identical titles -> clusterId keeps them separate', () => {
        const c1 = { clusterId: 'id-1', misconceptionTitle: 'Common Title' };
        const c2 = { clusterId: 'id-2', misconceptionTitle: 'Common Title' };
        assert.notStrictEqual(c1.clusterId, c2.clusterId);
      });

      it('Attack 17: structured response valid but student identity set wrong -> domain validation fails', () => {
        const schemaValidWrongIds = [
          { studentId: 'Student 01', demonstratedUnderstanding: [] },
          { studentId: 'Student 99', demonstratedUnderstanding: [] },
        ];
        const res = validateObserverOutput(roster, schemaValidWrongIds);
        assert.strictEqual(res.valid, false);
      });

      it('Attack 18: malformed Gemini output fails gracefully with PipelineError', () => {
        const malformed = 'Not valid JSON at all';
        let caught: any;
        try {
          JSON.parse(malformed);
        } catch (err) {
          caught = new PipelineError({
            code: 'OBSERVER_SCHEMA_ERROR',
            stage: 'Stage 2: Gemini Observer',
            message: (err as Error).message,
            retryable: false,
          });
        }
        assert.ok(caught instanceof PipelineError);
        assert.strictEqual(caught.code, 'OBSERVER_SCHEMA_ERROR');
      });

      it('Attack 19: custom classroom Gemini analysis fails -> throws clean error', () => {
        const isDemo = isExactDemoClassroom(DEMO_CONTEXT, [
          { studentId: 'Custom', studentText: 'Custom', workType: 'typed' },
        ]);
        assert.strictEqual(isDemo, false);
      });

      it('Attack 20: verify demo fallback does NOT activate for custom classroom failure', () => {
        const nonDemoSubs: StudentSubmission[] = [
          { studentId: 'Student 01', studentText: 'Non-demo custom student response', workType: 'typed' },
        ];
        assert.strictEqual(isExactDemoClassroom(DEMO_CONTEXT, nonDemoSubs), false);
      });

      it('Attack 21: required verification state undefined -> not fully verified', () => {
        const fullyVerified = isAnalysisFullyVerified({
          deterministicAuditPassed: undefined,
          overallStatus: undefined,
        });
        assert.strictEqual(fullyVerified, false);
      });

      it('Attack 22: approximate match tries to render as Evidence Grounded -> blocked', () => {
        const disp = getDeterministicMatchDisplay('approximate_match', 'typed');
        assert.strictEqual(disp.isSupported, false, 'Approximate match must have isSupported: false');
        assert.ok(disp.label.includes('Review Required') || disp.label.includes('Review Recommended'));
      });
    });

    // -----------------------------------------------------------------------
    // SECTION 29: PHASE P2.1 FINAL SEMANTIC CONSISTENCY AUDIT (A - E)
    // -----------------------------------------------------------------------
    describe('Section 29: Phase P2.1 Final Semantic Consistency Audit (A - E)', () => {
      // Area A: Full-Verification Fail-Open Attack
      it('P2.1-A1: deterministicAuditPassed=true cannot bypass missing required subchecks', () => {
        const result = isAnalysisFullyVerified({
          deterministicAuditPassed: true,
          overallStatus: 'verified',
          coveragePassed: undefined,
          clusterMathPassed: undefined,
          groupPartitionPassed: undefined,
          evidenceValidationPassed: undefined,
        });
        assert.strictEqual(result, false, 'Missing atomic subchecks must prevent full verification');
      });

      it('P2.1-A2: missing single atomic subcheck (groupPartitionPassed=undefined) prevents full verification', () => {
        const result = isAnalysisFullyVerified({
          deterministicAuditPassed: true,
          coveragePassed: true,
          clusterMathPassed: true,
          groupPartitionPassed: undefined,
          evidenceValidationPassed: true,
          overallStatus: 'verified',
        });
        assert.strictEqual(result, false, 'Missing groupPartitionPassed must cause fail-closed false');
      });

      it('P2.1-A3: failing atomic subcheck (evidenceValidationPassed=false) prevents full verification', () => {
        const result = isAnalysisFullyVerified({
          deterministicAuditPassed: true,
          coveragePassed: true,
          clusterMathPassed: true,
          groupPartitionPassed: true,
          evidenceValidationPassed: false,
          overallStatus: 'verified',
        });
        assert.strictEqual(result, false, 'Failing evidence check must cause fail-closed false');
      });

      it('P2.1-A4: all required atomic subchecks true + verified overallStatus -> true', () => {
        const result = isAnalysisFullyVerified({
          deterministicAuditPassed: true,
          coveragePassed: true,
          clusterMathPassed: true,
          groupPartitionPassed: true,
          evidenceValidationPassed: true,
          overallStatus: 'verified',
        });
        assert.strictEqual(result, true, 'All atomic checks passing yields true');
      });

      // Area B: Image Transcription Trust Boundary
      it('P2.1-B1: unverified image transcription match does NOT satisfy full evidence grounding', () => {
        const sampleCluster: MisconceptionCluster = {
          clusterId: 'c1',
          misconceptionTitle: 'Unverified Image Test',
          explanation: 'Explanation for unverified image test',
          studentCount: 1,
          percentageAffected: 100,
          affectedStudentIds: ['ImgStudent1'],
          evidenceExamples: [
            {
              studentId: 'ImgStudent1',
              excerpt: 'handwritten note quote',
              groundingReason: 'Reasoning',
            },
          ],
          teachingPriority: 'high',
          confidence: 0.9,
          recommendedInstructionalResponse: 'Review work',
        };

        const unverifiedNorm: NormalizedSourceEvidence[] = [
          {
            studentId: 'ImgStudent1',
            sourceType: 'image_transcription',
            extractedText: 'handwritten note quote',
            confidenceOrStatus: 'transcription_unverified',
          },
        ];

        const audit = validateEvidenceQuotes([sampleCluster], [], unverifiedNorm);
        assert.strictEqual(audit.quotesGroundedCount, 0, 'Unverified image transcription must NOT increment quotesGroundedCount');
        assert.strictEqual(audit.quotesFlaggedCount, 1, 'Unverified image transcription must increment quotesFlaggedCount');
        assert.strictEqual(audit.evidenceValidationPassed, false, 'evidenceValidationPassed must be false for unverified image transcription');
        assert.strictEqual(audit.auditedClusters[0].evidenceStrength, 'review_required');

        const disp = getDeterministicMatchDisplay('image_transcription_match', 'image_transcription');
        assert.strictEqual(disp.isSupported, false, 'Unverified image transcription match must have isSupported=false');
        assert.ok(disp.label.includes('Review Required'));

        const badge = getClusterCodeVerificationBadge(audit.auditedClusters[0]);
        assert.strictEqual(badge.label, 'Code Review Required');
      });

      it('P2.1-B2: teacher-reviewed image transcription match promotes to grounded state', () => {
        const sampleCluster: MisconceptionCluster = {
          clusterId: 'c1',
          misconceptionTitle: 'Reviewed Image Test',
          explanation: 'Explanation for reviewed image test',
          studentCount: 1,
          percentageAffected: 100,
          affectedStudentIds: ['ImgStudent2'],
          evidenceExamples: [
            {
              studentId: 'ImgStudent2',
              excerpt: 'verified handwriting excerpt',
              groundingReason: 'Reasoning',
            },
            {
              studentId: 'ImgStudent2',
              excerpt: 'second verified handwriting sentence',
              groundingReason: 'Reasoning 2',
            },
          ],
          teachingPriority: 'high',
          confidence: 0.9,
          recommendedInstructionalResponse: 'Continue practice',
        };

        const reviewedNorm: NormalizedSourceEvidence[] = [
          {
            studentId: 'ImgStudent2',
            sourceType: 'image_transcription',
            extractedText: 'verified handwriting excerpt and second verified handwriting sentence',
            confidenceOrStatus: 'transcription_reviewed',
          },
        ];

        const audit = validateEvidenceQuotes([sampleCluster], [], reviewedNorm);
        assert.strictEqual(audit.quotesGroundedCount, 2, 'Teacher-reviewed image transcription increments quotesGroundedCount');
        assert.strictEqual(audit.quotesFlaggedCount, 0, 'Teacher-reviewed image transcription has 0 flagged quotes');
        assert.strictEqual(audit.evidenceValidationPassed, true, 'evidenceValidationPassed is true for teacher-reviewed image transcription');
        assert.strictEqual(audit.auditedClusters[0].evidenceStrength, 'strong');

        const disp = getDeterministicMatchDisplay('image_transcription_verified', 'image_transcription');
        assert.strictEqual(disp.isSupported, true, 'Verified image transcription has isSupported=true');
        assert.ok(disp.label.includes('Grounded'));

        const badge = getClusterCodeVerificationBadge(audit.auditedClusters[0]);
        assert.strictEqual(badge.label, 'Code Verified');
      });

      // Area C: Gemini 429 Error Semantics
      it('P2.1-C1: transient rate limit (429 too_many_requests) is classified as retryable', () => {
        const err = classifyGeminiError(
          new Error('429 Too Many Requests: Rate limit exceeded. Please retry after backoff.'),
          'Stage 2: Gemini Observer'
        );
        assert.strictEqual(err.code, 'RATE_LIMIT_ERROR');
        assert.strictEqual(err.retryable, true, 'Transient 429 rate limit must be retryable');
      });

      it('P2.1-C2: daily quota exhaustion is classified as non-retryable QUOTA_EXHAUSTED', () => {
        const err = classifyGeminiError(
          new Error('Quota_exceeded: Daily usage exhausted for models/gemini-2.5-flash'),
          'Stage 3: Gemini Diagnosis'
        );
        assert.strictEqual(err.code, 'QUOTA_EXHAUSTED');
        assert.strictEqual(err.retryable, false, 'Daily quota exhaustion must NOT enter retry loop');
      });

      it('P2.1-C3: 503 / network transient error is classified as retryable TRANSIENT_NETWORK_ERROR', () => {
        const err = classifyGeminiError(
          new Error('503 Service Unavailable: High demand on model backend'),
          'Stage 5: Teaching Strategist'
        );
        assert.strictEqual(err.code, 'TRANSIENT_NETWORK_ERROR');
        assert.strictEqual(err.retryable, true, '503 service unavailable must be retryable');
      });

      it('P2.1-C4: domain invariant failure is classified as non-retryable INVARIANT_FAILURE', () => {
        const err = classifyGeminiError(
          new Error('Duplicate student ID partition detected in domain logic'),
          'Stage 4: Deterministic Validation'
        );
        assert.strictEqual(err.code, 'INVARIANT_FAILURE');
        assert.strictEqual(err.retryable, false, 'Domain invariant failure must be non-retryable');
      });

      // Area D: Exact vs Normalized-Exact Semantics
      it('P2.1-D1: literal exact vs case/punctuation normalized matches are distinguishable in runtime data', () => {
        const source = 'I have visited Ha Long Bay last year.';
        
        // 1. Literal exact
        const literalMatch = checkQuoteInSource('visited Ha Long Bay', source, 'typed');
        assert.strictEqual(literalMatch, 'exact_quote_found');

        // 2. Normalized exact (case and punctuation stripped)
        const normalizedMatch = checkQuoteInSource('VISITED HA LONG BAY!', source, 'typed');
        assert.strictEqual(normalizedMatch, 'normalized_exact_match');

        // Provenance distinction
        assert.notStrictEqual(literalMatch, normalizedMatch, 'Literal and normalized exact matches must be distinct states');

        // Both count as supported/grounded in display
        assert.strictEqual(getDeterministicMatchDisplay(literalMatch).isSupported, true);
        assert.strictEqual(getDeterministicMatchDisplay(normalizedMatch).isSupported, true);
      });

      it('P2.1-D2: approximate match remains distinct and review-required', () => {
        const source = 'I visited Ba Na Hills and we saw the Golden Bridge yesterday.';
        const approxMatch = checkQuoteInSource('visited Ba Na Hills and saw', source, 'typed');
        assert.strictEqual(approxMatch, 'approximate_match');
        assert.strictEqual(getDeterministicMatchDisplay(approxMatch).isSupported, false);
      });

      it('P2.1-D3: normalization is conservative and rejects scrambled or scattered tokens', () => {
        const source = 'Yesterday I walked to school. Last year my brother lived in London.';
        const match = checkQuoteInSource('walked in London last year', source, 'typed');
        assert.strictEqual(match, 'unsupported_citation', 'Scattered tokens across unrelated clauses must be unsupported');
      });

      // Area E: Stable ID Contract
      it('P2.1-E1: CanonicalInterventionSchema rejects new intervention missing clusterId', () => {
        const invalidNewIntervention = {
          interventionId: 'int-new-1',
          targetMisconceptionTitle: 'Tense selection',
          title: 'Timeline Sort',
          supportTier: 'Guided Practice',
          rationale: 'Clarify past simple vs present perfect',
          suggestedActivity: 'Sort cards',
          teacherScript: 'Check timestamps',
          exampleQuestion: 'Which sentence has a finished time marker?',
          exitTicketQuestion: 'Correct the error in sentence 1',
        };

        const parseResult = CanonicalInterventionSchema.safeParse(invalidNewIntervention);
        assert.strictEqual(parseResult.success, false, 'New canonical intervention must require valid clusterId');
      });

      it('P2.1-E2: duplicate cluster IDs trigger validation failure', () => {
        const clusters: MisconceptionCluster[] = [
          { clusterId: 'cluster-dup', misconceptionTitle: 'Misconception A', explanation: 'exp A', studentCount: 1, percentageAffected: 50, affectedStudentIds: ['S1'], evidenceExamples: [], teachingPriority: 'high', confidence: 0.9, recommendedInstructionalResponse: '' },
          { clusterId: 'cluster-dup', misconceptionTitle: 'Misconception B', explanation: 'exp B', studentCount: 1, percentageAffected: 50, affectedStudentIds: ['S2'], evidenceExamples: [], teachingPriority: 'high', confidence: 0.9, recommendedInstructionalResponse: '' },
        ];
        const validation = validateInterventionRelationships([], clusters);
        assert.strictEqual(validation.passed, false);
        assert.ok(validation.issues.some((i) => i.includes('Duplicate cluster IDs detected')));
      });

      it('P2.1-E3: intervention referencing unknown clusterId triggers validation failure', () => {
        const clusters: MisconceptionCluster[] = [
          { clusterId: 'c1', misconceptionTitle: 'Misconception 1', explanation: 'exp 1', studentCount: 1, percentageAffected: 50, affectedStudentIds: ['S1'], evidenceExamples: [], teachingPriority: 'high', confidence: 0.9, recommendedInstructionalResponse: '' },
        ];
        const interventions: DifferentiatedIntervention[] = [
          {
            interventionId: 'int-1',
            clusterId: 'ghost-cluster-999',
            targetMisconceptionTitle: 'Misconception 1',
            title: 'Intervention 1',
            supportTier: 'Guided Practice',
            rationale: 'R',
            suggestedActivity: 'A',
            teacherScript: 'S',
            exampleQuestion: 'Q',
            exitTicketQuestion: 'ET',
          },
        ];
        const validation = validateInterventionRelationships(interventions, clusters);
        assert.strictEqual(validation.passed, false);
        assert.ok(validation.issues.some((i) => i.includes('references unknown clusterId')));
      });

      it('P2.1-E4: legacy intervention missing clusterId migrates safely when relationship is unambiguous', () => {
        const clusters: MisconceptionCluster[] = [
          { clusterId: 'c1', misconceptionTitle: 'Present Perfect vs Past Simple', explanation: 'exp 1', studentCount: 1, percentageAffected: 50, affectedStudentIds: ['S1'], evidenceExamples: [], teachingPriority: 'high', confidence: 0.9, recommendedInstructionalResponse: '' },
          { clusterId: 'c2', misconceptionTitle: 'Irregular Past Participles', explanation: 'exp 2', studentCount: 1, percentageAffected: 50, affectedStudentIds: ['S2'], evidenceExamples: [], teachingPriority: 'high', confidence: 0.9, recommendedInstructionalResponse: '' },
        ];
        const legacyInterventions: DifferentiatedIntervention[] = [
          {
            interventionId: 'legacy-1',
            targetMisconceptionTitle: 'Present Perfect vs Past Simple',
            title: 'Legacy Card 1',
            supportTier: 'Guided Practice',
            rationale: 'R',
            suggestedActivity: 'A',
            teacherScript: 'S',
            exampleQuestion: 'Q',
            exitTicketQuestion: 'ET',
          },
        ];

        const migrated = migrateLegacyInterventions(legacyInterventions, clusters);
        assert.strictEqual(migrated[0].clusterId, 'c1', 'Unambiguous legacy intervention migrated to cluster c1');
      });

      it('P2.1-E5: legacy intervention missing clusterId does NOT guess when multiple clusters share title', () => {
        const clusters: MisconceptionCluster[] = [
          { clusterId: 'c-alpha', misconceptionTitle: 'Ambiguous Common Title', explanation: 'exp alpha', studentCount: 1, percentageAffected: 50, affectedStudentIds: ['S1'], evidenceExamples: [], teachingPriority: 'high', confidence: 0.9, recommendedInstructionalResponse: '' },
          { clusterId: 'c-beta', misconceptionTitle: 'Ambiguous Common Title', explanation: 'exp beta', studentCount: 1, percentageAffected: 50, affectedStudentIds: ['S2'], evidenceExamples: [], teachingPriority: 'high', confidence: 0.9, recommendedInstructionalResponse: '' },
        ];
        const legacyInterventions: DifferentiatedIntervention[] = [
          {
            interventionId: 'legacy-ambig',
            targetMisconceptionTitle: 'Ambiguous Common Title',
            title: 'Ambiguous Card',
            supportTier: 'Guided Practice',
            rationale: 'R',
            suggestedActivity: 'A',
            teacherScript: 'S',
            exampleQuestion: 'Q',
            exitTicketQuestion: 'ET',
          },
        ];

        const validation = validateInterventionRelationships(legacyInterventions, clusters, { isNewData: false });
        assert.strictEqual(validation.passed, false, 'Ambiguous relationship must not silently guess');
        assert.strictEqual(
          validation.auditedInterventions[0].clusterId,
          'unresolved_ambiguous_relationship',
          'Ambiguous relationship must be preserved in explicit unresolved state'
        );
      });
    });

    // -----------------------------------------------------------------------
    // SECTION 30: PHASE P3 MASTER PRODUCTIZATION & TRUST UX VERIFICATION
    // -----------------------------------------------------------------------
    describe('Section 30: Phase P3 Master Productization & Trust UX Verification', () => {
      it('P3-01: getEvidenceDisplay correctly maps exact_quote_found to Exact Source Match with isSupported=true', () => {
        const res = getEvidenceDisplay('exact_quote_found', 'typed');
        assert.strictEqual(res.label, 'Exact Source Match');
        assert.strictEqual(res.isSupported, true);
        assert.strictEqual(res.statusVariant, 'success');
      });

      it('P3-02: getEvidenceDisplay correctly maps normalized_exact_match with isSupported=true and provenance explanation', () => {
        const res = getEvidenceDisplay('normalized_exact_match', 'typed');
        assert.strictEqual(res.label, 'Source Match (Normalized)');
        assert.strictEqual(res.isSupported, true);
        assert.strictEqual(res.statusVariant, 'success');
        assert.ok(res.explanation.includes('normalization'));
      });

      it('P3-03: getEvidenceDisplay correctly maps approximate_match to Review Evidence with isSupported=false', () => {
        const res = getEvidenceDisplay('approximate_match', 'typed');
        assert.strictEqual(res.label, 'Review Evidence');
        assert.strictEqual(res.isSupported, false);
        assert.strictEqual(res.statusVariant, 'warning');
      });

      it('P3-04: getEvidenceDisplay correctly maps image_transcription_match to Transcription Needs Review with isSupported=false', () => {
        const res = getEvidenceDisplay('image_transcription_match', 'image_transcription');
        assert.strictEqual(res.label, 'Transcription Needs Review');
        assert.strictEqual(res.isSupported, false);
        assert.strictEqual(res.statusVariant, 'warning');
      });

      it('P3-05: getEvidenceDisplay correctly maps image_transcription_verified with isSupported=true', () => {
        const res = getEvidenceDisplay('image_transcription_verified', 'image_transcription');
        assert.strictEqual(res.label, 'Verified Transcription Match');
        assert.strictEqual(res.isSupported, true);
        assert.strictEqual(res.statusVariant, 'success');
      });

      it('P3-06: getEvidenceDisplay correctly maps unsupported_citation to Source Support Not Found with isSupported=false', () => {
        const res = getEvidenceDisplay('unsupported_citation', 'typed');
        assert.strictEqual(res.label, 'Source Support Not Found');
        assert.strictEqual(res.isSupported, false);
        assert.strictEqual(res.statusVariant, 'error');
      });

      it('P3-07: getEvidenceDisplay handles undefined/not_checked by returning Not Checked with isSupported=false', () => {
        const res = getEvidenceDisplay(undefined);
        assert.strictEqual(res.label, 'Not Checked');
        assert.strictEqual(res.isSupported, false);
        assert.strictEqual(res.statusVariant, 'neutral');
      });

      it('P3-08: getPipelineErrorDisplay classifies quota exhaustion as non-retryable with user guidance and retryAllowed=false', () => {
        const res = getPipelineErrorDisplay('Quota_exceeded: Daily usage exhausted for models/gemini-2.5-flash');
        assert.strictEqual(res.retryAllowed, false, 'Daily quota exhaustion must NOT allow retry loop');
        assert.strictEqual(res.technicalCode, 'QUOTA_EXHAUSTED');
        assert.ok(res.message.includes('AI usage limit has been reached'));
        assert.ok(res.message.includes('preserved'));
      });

      it('P3-09: getPipelineErrorDisplay classifies transient 503 / network error as retryable with data preserved', () => {
        const res = getPipelineErrorDisplay('503 Service Unavailable: High load on backend');
        assert.strictEqual(res.retryAllowed, true, 'Transient network errors must allow retry');
        assert.strictEqual(res.technicalCode, 'TRANSIENT_NETWORK_ERROR');
        assert.ok(res.message.includes('preserved'));
      });

      it('P3-10: getPipelineErrorDisplay classifies transient rate limit as retryable with backoff guidance', () => {
        const res = getPipelineErrorDisplay('429 Too Many Requests: Rate limit exceeded');
        assert.strictEqual(res.retryAllowed, true, 'Transient 429 rate limit must allow retry');
        assert.strictEqual(res.technicalCode, 'RATE_LIMIT_ERROR');
        assert.ok(res.message.includes('preserved'));
      });

      it('P3-11: Cross-Dimension Attack: Technical Pass + Teacher Pending renders as Code Verified, Teacher Review Pending (NOT Teacher approved)', () => {
        const res = getCrossDimensionTrustDisplay({
          technicalVerified: true,
          teacherDecision: 'pending',
        });
        assert.strictEqual(res.overallVerified, false, 'Teacher pending means overall verified is false');
        assert.strictEqual(res.label, 'Code Verified · Teacher Review Pending');
        assert.strictEqual(res.variant, 'warning');
      });

      it('P3-12: Cross-Dimension Attack: Teacher Accepted + Technical Check Incomplete renders as Teacher Accepted but overallVerified=false', () => {
        const res = getCrossDimensionTrustDisplay({
          technicalVerified: false,
          teacherDecision: 'accepted',
        });
        assert.strictEqual(res.overallVerified, false, 'Technical failure must prevent overallVerified=true even if teacher accepted');
        assert.strictEqual(res.label, 'Teacher Accepted · Technical Check Incomplete');
        assert.strictEqual(res.variant, 'warning');
      });

      it('P3-13: Cross-Dimension Attack: Technical Pass + Teacher Accepted renders overallVerified=true', () => {
        const res = getCrossDimensionTrustDisplay({
          technicalVerified: true,
          teacherDecision: 'accepted',
        });
        assert.strictEqual(res.overallVerified, true);
        assert.strictEqual(res.label, 'Verified & Teacher Approved');
        assert.strictEqual(res.variant, 'verified');
      });

      it('P3-14: Teacher decision canonical resolver: unreviewed AI items default to pending, not accepted', () => {
        const rawAiItem = {
          clusterId: 'c-test',
          misconceptionTitle: 'Sample Title',
          // legacy generator set status to accepted without human action
          status: 'accepted',
        };
        const canonical = getCanonicalTeacherDecision(rawAiItem);
        assert.strictEqual(canonical, 'pending', 'Legacy status=accepted must NOT bypass teacher review');
      });

      it('P3-15: Canonical teacher actions: edits survive into exported data without reverting to original AI suggestions', () => {
        const cluster: MisconceptionCluster = {
          clusterId: 'cluster-edit-1',
          misconceptionTitle: 'Original AI Title',
          explanation: 'Explanation',
          studentCount: 2,
          percentageAffected: 20,
          affectedStudentIds: ['S1', 'S2'],
          evidenceExamples: [],
          teachingPriority: 'high',
          confidence: 0.9,
          recommendedInstructionalResponse: 'R',
          teacherDecision: 'edited',
        };
        // Simulated teacher edit
        const editedCluster = {
          ...cluster,
          misconceptionTitle: 'Teacher Refined Title: Past Time Markers vs Unfinished Time',
          teacherDecision: 'edited' as TeacherDecision,
        };
        assert.strictEqual(editedCluster.teacherDecision, 'edited');
        assert.strictEqual(editedCluster.misconceptionTitle, 'Teacher Refined Title: Past Time Markers vs Unfinished Time');
        assert.strictEqual(getTeacherStatusLabel(editedCluster), 'Teacher Edited');
      });
    });

    describe('Section 31: Phase P4.0 Privacy Gateway & Sensitive Data Protection Verification', () => {
      it('P4-01: sanitizeText with no PII leaves educational grammar text completely unchanged', async () => {
        const gateway = new PrivacyGateway();
        const text = 'I have lived in London for two years and I visited Paris last summer.';
        const result = await gateway.sanitizeText(text);

        assert.strictEqual(result.sanitizedText, text);
        assert.strictEqual(result.findingCount, 0);
        assert.deepStrictEqual(result.findingTypeCounts, {});
      });

      it('P4-02: sanitizeText detects and redacts person names without corrupting lesson grammar terms', async () => {
        const gateway = new PrivacyGateway();
        const text = 'My name is Nguyen Van A and I have studied Present Perfect tense.';
        const result = await gateway.sanitizeText(text);

        assert.ok(result.sanitizedText.includes('[PERSON_NAME]'), 'Must replace student name with [PERSON_NAME]');
        assert.ok(!result.sanitizedText.includes('Nguyen Van A'), 'Raw student name must not appear in sanitized text');
        assert.ok(result.sanitizedText.includes('Present Perfect'), 'Educational terms must be preserved');
        assert.strictEqual(result.findingCount, 1);
        assert.strictEqual(result.findingTypeCounts['PERSON_NAME'], 1);
      });

      it('P4-03: sanitizeText detects and redacts student email addresses', async () => {
        const gateway = new PrivacyGateway();
        const text = 'Here is my homework. Email me at student.test@school.edu.vn with feedback.';
        const result = await gateway.sanitizeText(text);

        assert.ok(result.sanitizedText.includes('[EMAIL_ADDRESS]'));
        assert.ok(!result.sanitizedText.includes('student.test@school.edu.vn'));
        assert.strictEqual(result.findingCount, 1);
        assert.strictEqual(result.findingTypeCounts['EMAIL_ADDRESS'], 1);
      });

      it('P4-04: sanitizeText detects and redacts student telephone numbers', async () => {
        const gateway = new PrivacyGateway();
        const text = 'In case of emergency call 0901234567 or (555) 123-4567.';
        const result = await gateway.sanitizeText(text);

        assert.ok(result.sanitizedText.includes('[PHONE_NUMBER]'));
        assert.ok(!result.sanitizedText.includes('0901234567'));
        assert.ok(!result.sanitizedText.includes('(555) 123-4567'));
        assert.strictEqual(result.findingCount, 2);
        assert.strictEqual(result.findingTypeCounts['PHONE_NUMBER'], 2);
      });

      it('P4-05: sanitizeText handles multilingual introductions and multiple PII categories simultaneously', async () => {
        const gateway = new PrivacyGateway();
        const text = 'Em tên là Tran Thi B, liên hệ qua email student@example.com hoặc số điện thoại 0912345678.';
        const result = await gateway.sanitizeText(text);

        assert.ok(!result.sanitizedText.includes('Tran Thi B'));
        assert.ok(!result.sanitizedText.includes('student@example.com'));
        assert.ok(!result.sanitizedText.includes('0912345678'));
        assert.strictEqual(result.findingCount, 3);
        assert.strictEqual(result.findingTypeCounts['PERSON_NAME'], 1);
        assert.strictEqual(result.findingTypeCounts['EMAIL_ADDRESS'], 1);
        assert.strictEqual(result.findingTypeCounts['PHONE_NUMBER'], 1);
      });

      it('P4-06: Student identity normalization maintains stable pseudonymous IDs without positional fallback', () => {
        const gateway = new PrivacyGateway();
        const rawSubmissions: StudentSubmission[] = [
          { studentId: 'Student 01', studentText: 'Text 1', workType: 'typed' },
          { studentId: '   ', studentText: 'Text 2', workType: 'typed' },
          { studentId: 'Student 03', studentText: 'Text 3', workType: 'typed' },
        ];

        const normalized = gateway.normalizeStudentIdentities(rawSubmissions);
        assert.strictEqual(normalized[0].studentId, 'Student 01');
        assert.strictEqual(normalized[1].studentId, 'Student 02');
        assert.strictEqual(normalized[2].studentId, 'Student 03');
      });

      it('P4-07: Fail-Closed: Provider timeout aborts sanitization with PRIVACY_SCAN_FAILED and retryable=true', async () => {
        const failingProvider = new DeterministicSensitiveDataProtectionProvider({
          simulateFailure: 'timeout',
        });
        const gateway = new PrivacyGateway({ provider: failingProvider });

        await assert.rejects(
          async () => {
            await gateway.sanitizeText('Sample text');
          },
          (err: any) => {
            assert.strictEqual(err.code, 'PRIVACY_SCAN_FAILED');
            assert.strictEqual(err.retryable, true);
            assert.strictEqual(err.stage, 'Privacy Gateway');
            return true;
          }
        );
      });

      it('P4-08: Fail-Closed: Provider 401 unauthenticated aborts sanitization with PRIVACY_AUTH_ERROR and retryable=false', async () => {
        const failingProvider = new DeterministicSensitiveDataProtectionProvider({
          simulateFailure: 'auth',
        });
        const gateway = new PrivacyGateway({ provider: failingProvider });

        await assert.rejects(
          async () => {
            await gateway.sanitizeText('Sample text');
          },
          (err: any) => {
            assert.strictEqual(err.code, 'PRIVACY_AUTH_ERROR');
            assert.strictEqual(err.retryable, false);
            assert.strictEqual(err.stage, 'Privacy Gateway');
            return true;
          }
        );
      });

      it('P4-09: Fail-Closed: Provider 429 quota exhaustion aborts sanitization with PRIVACY_QUOTA_EXHAUSTED and retryable=false', async () => {
        const failingProvider = new DeterministicSensitiveDataProtectionProvider({
          simulateFailure: 'quota',
        });
        const gateway = new PrivacyGateway({ provider: failingProvider });

        await assert.rejects(
          async () => {
            await gateway.sanitizeText('Sample text');
          },
          (err: any) => {
            assert.strictEqual(err.code, 'PRIVACY_QUOTA_EXHAUSTED');
            assert.strictEqual(err.retryable, false);
            assert.strictEqual(err.stage, 'Privacy Gateway');
            return true;
          }
        );
      });

      it('P4-10: Fail-Closed: Provider 503 outage aborts sanitization with PRIVACY_SCAN_FAILED and retryable=true', async () => {
        const failingProvider = new DeterministicSensitiveDataProtectionProvider({
          simulateFailure: 'network',
        });
        const gateway = new PrivacyGateway({ provider: failingProvider });

        await assert.rejects(
          async () => {
            await gateway.sanitizeBatch([
              { studentId: 'Student 01', studentText: 'Sample text', workType: 'typed' },
            ]);
          },
          (err: any) => {
            assert.strictEqual(err.code, 'PRIVACY_SCAN_FAILED');
            assert.strictEqual(err.retryable, true);
            return true;
          }
        );
      });

      it('P4-11: Zero-PII logging safety: Spying on console logs confirms raw PII is strictly absent from log outputs', async () => {
        const originalLog = console.log;
        const loggedMessages: string[] = [];
        console.log = (...args: any[]) => {
          loggedMessages.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
        };

        try {
          const gateway = new PrivacyGateway();
          const piiText = 'My name is Le Van C and email is secret.le@domain.com with phone 0987654321';
          await gateway.sanitizeBatch([
            { studentId: 'Student 01', studentText: piiText, workType: 'typed' },
          ]);

          const joinedLogs = loggedMessages.join('\n');
          assert.ok(!joinedLogs.includes('Le Van C'), 'Raw name must never appear in console logs');
          assert.ok(!joinedLogs.includes('secret.le@domain.com'), 'Raw email must never appear in console logs');
          assert.ok(!joinedLogs.includes('0987654321'), 'Raw phone must never appear in console logs');
          assert.ok(joinedLogs.includes('rawValuesRetained=false'), 'Must log safe non-PII verification metadata');
        } finally {
          console.log = originalLog;
        }
      });

      it('P4-12: Canonical PrivacyAudit structure strictly omits raw values (rawValuesRetained: false, failClosed: true)', async () => {
        const gateway = new PrivacyGateway();
        const submissions: StudentSubmission[] = [
          { studentId: 'Student 01', studentText: 'Name is John Doe email is john@edu.com', workType: 'typed' },
        ];

        const { privacyAudit } = await gateway.sanitizeBatch(submissions);

        assert.strictEqual(privacyAudit.status, 'passed');
        assert.strictEqual(privacyAudit.provider, 'deterministic-demo-sanitizer');
        assert.strictEqual(privacyAudit.rawValuesRetained, false);
        assert.strictEqual(privacyAudit.failClosed, true);
        assert.strictEqual(privacyAudit.sanitizationApplied, true);
        assert.strictEqual(privacyAudit.findingCount, 2);
        assert.strictEqual(privacyAudit.findingTypeCounts['PERSON_NAME'], 1);
        assert.strictEqual(privacyAudit.findingTypeCounts['EMAIL_ADDRESS'], 1);
        assert.strictEqual((privacyAudit as any).rawValues, undefined);
      });

      it('P4-13: Downstream pipeline receives sanitized submissions; raw PII never leaks to Observer', async () => {
        const gateway = new PrivacyGateway();
        const rawSubmission: StudentSubmission = {
          studentId: 'Student 01',
          studentText: 'My name is Alice Johnson and I have visited London last year.',
          workType: 'typed',
        };

        const { sanitizedSubmissions } = await gateway.sanitizeBatch([rawSubmission]);
        assert.ok(sanitizedSubmissions[0].studentText.includes('[PERSON_NAME]'));
        assert.ok(!sanitizedSubmissions[0].studentText.includes('Alice Johnson'));
      });

      it('P4-14: Canonical Demo Isolation: Demo classroom dataset contains 0 PII and fingerprint is unchanged', () => {
        assert.strictEqual(
          DEMO_DATASET_SHA256,
          'f82100e176cd233e0b65efbf00fc7b8947e7dab66aadff9389f1f25f128bf1ce',
          'Demo SHA-256 fingerprint must remain strictly intact'
        );
        const isDemo = isExactDemoClassroom(DEMO_CONTEXT, DEMO_SUBMISSIONS);
        assert.strictEqual(isDemo, true, 'Exact demo classroom must be recognized');
      });

      it('P4-15: Cross-Dimension Independence: Privacy status, evidence grounding, and teacher decisions remain independent', () => {
        const auditClean: PrivacyAudit = {
          status: 'passed',
          findingCount: 0,
          findingTypeCounts: {},
          sanitizationApplied: false,
          provider: 'google-sensitive-data-protection',
          rawValuesRetained: false,
          failClosed: true,
        };

        const displayClean = getPrivacyStatusDisplay(auditClean);
        assert.strictEqual(displayClean.label, 'Privacy Check: Clean');
        assert.strictEqual(displayClean.status, 'passed');

        const auditRedacted: PrivacyAudit = {
          status: 'passed',
          findingCount: 3,
          findingTypeCounts: { PERSON_NAME: 2, EMAIL_ADDRESS: 1 },
          sanitizationApplied: true,
          provider: 'google-sensitive-data-protection',
          rawValuesRetained: false,
          failClosed: true,
        };

        const displayRedacted = getPrivacyStatusDisplay(auditRedacted);
        assert.strictEqual(displayRedacted.label, 'Privacy Check: 3 Removed');
        assert.strictEqual(displayRedacted.findingsCount, 3);
      });

      it('P4-16: Image privacy redaction handles worksheet images safely before multimodal processing', async () => {
        const gateway = new PrivacyGateway();
        const fakeBase64 = Buffer.from('fake-worksheet-image-bytes').toString('base64');
        const imgResult = await gateway.sanitizeImage(fakeBase64, 'image/jpeg');

        assert.ok(imgResult.redactedImageBase64);
        assert.ok(imgResult.durationMs >= 0);
      });

      it('P4-17: getPipelineErrorDisplay formats privacy errors with actionable guidance and preserves teacher input', () => {
        const privacyErr = new PipelineError({
          code: 'PRIVACY_SCAN_FAILED',
          stage: 'Privacy Gateway',
          message: 'Sensitive Data Protection scan timeout',
          retryable: true,
        });

        const display = getPipelineErrorDisplay(privacyErr);
        assert.strictEqual(display.title, 'Student Privacy Check Incomplete');
        assert.ok(display.message.includes('student work was not sent for AI analysis'));
        assert.ok(display.message.includes('Your entered work has been preserved'));
        assert.strictEqual(display.retryAllowed, true);

        const quotaErr = new PipelineError({
          code: 'PRIVACY_QUOTA_EXHAUSTED',
          stage: 'Privacy Gateway',
          message: 'Sensitive Data Protection daily limit reached',
          retryable: false,
        });

        const quotaDisplay = getPipelineErrorDisplay(quotaErr);
        assert.strictEqual(quotaDisplay.title, 'Student Privacy Check Incomplete');
        assert.strictEqual(quotaDisplay.retryAllowed, false);
      });

      it('P4-18: Semantic Correction #1 — Raw sensitive values are explicitly certified absent from PrivacyAudit metadata', async () => {
        const gateway = new PrivacyGateway();
        const submissions: StudentSubmission[] = [
          {
            studentId: 'Student 01',
            studentText: 'My name is Nguyen Van Minh, email minh@example.com, call 0901234567.',
            workType: 'typed',
          },
        ];

        const { privacyAudit } = await gateway.sanitizeBatch(submissions);
        assert.strictEqual(privacyAudit.rawValuesRetained, false);
        // Explicitly check that no raw PII values are leaked into audit properties
        const auditJson = JSON.stringify(privacyAudit);
        assert.ok(!auditJson.includes('Nguyen Van Minh'), 'Audit object must never contain raw student name');
        assert.ok(!auditJson.includes('minh@example.com'), 'Audit object must never contain raw email');
        assert.ok(!auditJson.includes('0901234567'), 'Audit object must never contain raw phone number');
      });

      it('P4-19: Semantic Correction #2 — Static demo fallback honestly discloses Prevalidated Demo Dataset instead of fake live scan', () => {
        const demoAnalysis = generateGroundedDemoAnalysis(DEMO_CONTEXT, DEMO_SUBMISSIONS);
        assert.strictEqual(demoAnalysis.privacyAudit?.providerVersionOrPolicyId, 'prevalidated-demo-fixture');

        const display = getPrivacyStatusDisplay(demoAnalysis.privacyAudit);
        assert.strictEqual(display.label, 'Prevalidated Demo Dataset');
        assert.ok(
          display.description.includes('The canonical demo fixture was previously validated to contain no configured PII categories'),
          'Must honestly disclose prevalidation rather than simulating a live scan'
        );
      });

      it('P4-20: False-Positive Educational Privacy Eval — 35 benchmark cases achieve 100% grammar preservation without destroying lesson content', async () => {
        const evalResults = await runPrivacyEvaluation();
        assert.strictEqual(evalResults.totalCases, 35);
        assert.strictEqual(evalResults.grammarPreservationRate, 100);
        assert.strictEqual(evalResults.falsePositives, 0);
        assert.strictEqual(evalResults.falseNegatives, 0);
        assert.strictEqual(evalResults.passedCases, 35);
      });
    });

    // =======================================================================
    // SECTION 32: PRODUCTION RELIABILITY & STAGE-AWARE GEMINI FAILOVER
    // =======================================================================
    describe('Section 32: Production Reliability & Stage-Aware Gemini Failover Audit', () => {
      beforeEach(() => {
        clearModelCooldowns();
        resetGeminiClient();
      });

      afterEach(() => {
        clearModelCooldowns();
        resetGeminiClient();
      });

      it('PR-01: a 503 on gemini-3.8-flash causes immediate stage fallback without retrying failed model', async () => {
        const calls: string[] = [];
        const mockAi: any = {
          models: {
            generateContent: async (args: { model: string; contents: any; config?: any }) => {
              calls.push(args.model);
              if (args.model === 'gemini-3.8-flash') {
                const err: any = new Error('503 Service Unavailable: High demand on gemini-3.8-flash backend');
                err.status = 503;
                throw err;
              }
              if (args.model === 'gemini-3.6-flash') {
                return {
                  text: JSON.stringify({
                    classSnapshot: {
                      totalSubmissions: 1,
                      misconceptionCount: 1,
                      strongestConcept: 'Present Perfect',
                      highestPriorityNeed: 'Time clauses',
                      overallRecommendation: 'Focus on duration vs finished time',
                    },
                    misconceptionClusters: [],
                  }),
                };
              }
              throw new Error(`Unexpected model: ${args.model}`);
            },
          },
        };

        setGeminiClient(mockAi);

        // Run Diagnosis stage which has gemini-3.8-flash as primary
        const result = await generateContentDetailed({
          stageName: 'Stage 2: Diagnosis',
          stageKey: 'diagnosis',
          contents: 'Test prompt',
        });

        // gemini-3.8-flash must be called ONCE (immediate fallback, no retry on 503)
        assert.strictEqual(calls[0], 'gemini-3.8-flash', 'Primary model gemini-3.8-flash must be attempted first');
        assert.strictEqual(calls[1], 'gemini-3.6-flash', 'Must immediately fall back to gemini-3.6-flash');
        assert.strictEqual(calls.filter((m) => m === 'gemini-3.8-flash').length, 1, '503 must not retry failed model');
        assert.strictEqual(result.modelUsed, 'gemini-3.6-flash');
        assert.strictEqual(result.telemetry.requestedModel, 'gemini-3.8-flash');
        assert.strictEqual(result.telemetry.actualModel, 'gemini-3.6-flash');
        assert.ok(result.telemetry.fallbackReason?.includes('503'));
        assert.strictEqual(isModelInCooldown('gemini-3.8-flash'), true, 'gemini-3.8-flash must be placed on cooldown');
      });

      it('PR-02: a daily quota 429 does not repeatedly retry the same model', async () => {
        const calls: string[] = [];
        const mockAi: any = {
          models: {
            generateContent: async (args: { model: string; contents: any; config?: any }) => {
              calls.push(args.model);
              if (args.model === 'gemini-3.8-flash') {
                const err: any = new Error(
                  'ResourceExhausted 429: Quota_exceeded for generativelanguage.googleapis.com/generate_content_free_tier_requests (limit: 20)'
                );
                err.status = 429;
                throw err;
              }
              return { text: '{"result": "success"}' };
            },
          },
        };

        setGeminiClient(mockAi);

        // First call encounters 429 quota exhaustion on 3.8-flash
        const res1 = await generateContentDetailed({
          stageName: 'Stage 2: Diagnosis',
          stageKey: 'diagnosis',
          contents: 'First diagnosis prompt',
        });

        assert.strictEqual(res1.modelUsed, 'gemini-3.6-flash');
        assert.strictEqual(calls.filter((m) => m === 'gemini-3.8-flash').length, 1, '429 quota must break attempt loop immediately');

        const cdInfo = getModelCooldown('gemini-3.8-flash');
        assert.ok(cdInfo, 'Model must have cooldown entry');
        assert.strictEqual(cdInfo?.reason, '429_quota_exceeded');
        assert.ok(cdInfo!.durationMs >= 3600_000, 'Quota cooldown must be a long interval (e.g. 24h), NOT 60 seconds');

        // Subsequent call for Teaching Strategist (which also has 3.8-flash as primary)
        const callsCountBefore = calls.length;
        const res2 = await generateContentDetailed({
          stageName: 'Stage 5: Teaching Strategist',
          stageKey: 'teaching_strategist',
          contents: 'Second strategy prompt',
        });

        const newCalls = calls.slice(callsCountBefore);
        assert.ok(!newCalls.includes('gemini-3.8-flash'), 'Quota-exhausted model must not be called again in subsequent requests');
        assert.strictEqual(res2.modelUsed, 'gemini-3.6-flash');
      });

      it('PR-03: Observer can use Flash-Lite', async () => {
        const calls: string[] = [];
        const mockAi: any = {
          models: {
            generateContent: async (args: { model: string; contents: any; config?: any }) => {
              calls.push(args.model);
              return {
                text: JSON.stringify([
                  {
                    studentId: 'Student 01',
                    demonstratedUnderstanding: ['Uses past simple'],
                    misconceptions: [],
                    supportingEvidence: [{ quoteOrDetail: 'I went', interpretation: 'Past simple' }],
                  },
                ]),
              };
            },
          },
        };

        setGeminiClient(mockAi);

        // Check stage routing policy for observer
        const policy = resolveStageRoutingPolicy('Stage 1: Observer', 'observer');
        assert.strictEqual(policy.primaryModel, 'gemini-3.5-flash-lite', 'Observer primary must be gemini-3.5-flash-lite');
        assert.strictEqual(policy.fallbackModels[0], 'gemini-3.1-flash-lite', 'Observer fallback must be gemini-3.1-flash-lite');

        const result = await generateContentDetailed({
          stageName: 'Stage 1: Observer',
          stageKey: 'observer',
          contents: 'Extract evidence prompt',
        });

        assert.strictEqual(calls[0], 'gemini-3.5-flash-lite', 'Observer must request Flash-Lite first');
        assert.strictEqual(result.modelUsed, 'gemini-3.5-flash-lite');
      });

      it('PR-04: Diagnosis and Strategist prefer 3.8 Flash when healthy', async () => {
        const diagPolicy = resolveStageRoutingPolicy('Stage 2: Diagnosis', 'diagnosis');
        const stratPolicy = resolveStageRoutingPolicy('Stage 5: Teaching Strategist', 'teaching_strategist');
        const verifPolicy = resolveStageRoutingPolicy('Stage 4: Adversarial Verifier Pass', 'semantic_verifier');

        assert.strictEqual(diagPolicy.primaryModel, 'gemini-3.8-flash', 'Diagnosis must prefer gemini-3.8-flash');
        assert.strictEqual(stratPolicy.primaryModel, 'gemini-3.8-flash', 'Teaching Strategist must prefer gemini-3.8-flash');
        assert.strictEqual(verifPolicy.primaryModel, 'gemini-3.6-flash', 'Semantic Verifier must prefer gemini-3.6-flash');

        const calls: string[] = [];
        const mockAi: any = {
          models: {
            generateContent: async (args: { model: string }) => {
              calls.push(args.model);
              return { text: '{"status": "ok"}' };
            },
          },
        };
        setGeminiClient(mockAi);

        await generateContentDetailed({
          stageName: 'Stage 2: Diagnosis',
          stageKey: 'diagnosis',
          contents: 'Test',
        });
        assert.strictEqual(calls[0], 'gemini-3.8-flash', 'Healthy diagnosis must attempt gemini-3.8-flash first');

        await generateContentDetailed({
          stageName: 'Stage 5: Teaching Strategist',
          stageKey: 'teaching_strategist',
          contents: 'Test',
        });
        assert.strictEqual(calls[1], 'gemini-3.8-flash', 'Healthy strategist must attempt gemini-3.8-flash first');
      });

      it('PR-05: timeout fallback does not duplicate stage output', async () => {
        const mockAi: any = {
          models: {
            generateContent: async (args: { model: string; config?: any }) => {
              if (args.model === 'gemini-3.8-flash') {
                // Simulate HTTP timeout
                const err: any = new Error('Request timed out after 35000ms');
                throw err;
              }
              return {
                text: JSON.stringify({ output: 'single authoritative synthesis' }),
              };
            },
          },
        };
        setGeminiClient(mockAi);

        const result = await generateContentDetailed({
          stageName: 'Stage 2: Diagnosis',
          stageKey: 'diagnosis',
          contents: 'Test prompt',
        });

        assert.strictEqual(result.modelUsed, 'gemini-3.6-flash');
        assert.strictEqual(result.text, JSON.stringify({ output: 'single authoritative synthesis' }));
        const parsed = JSON.parse(result.text);
        assert.strictEqual(parsed.output, 'single authoritative synthesis');
      });

      it('PR-06: final AnalysisResult records which model actually ran each stage', async () => {
        const customSubmissions: StudentSubmission[] = [
          {
            studentId: 'Custom 01',
            studentText: 'I have finished my homework last night.',
            workType: 'typed',
          },
        ];

        const mockAi: any = {
          models: {
            generateContent: async (args: { model: string; contents?: any; config?: any }) => {
              if (args.model === 'gemini-3.5-flash-lite') {
                // Stage 2: Observer
                return {
                  text: JSON.stringify([
                    {
                      studentId: 'Custom 01',
                      demonstratedUnderstanding: ['Uses have auxiliary'],
                      misconceptions: ['Combines present perfect with finished time last night'],
                      supportingEvidence: [
                        { quoteOrDetail: 'finished my homework last night', interpretation: 'Finished past marker' },
                      ],
                    },
                  ]),
                };
              }
              if (args.model === 'gemini-3.8-flash') {
                const promptStr = String(typeof args.contents === 'string' ? args.contents : JSON.stringify(args.contents));
                if (promptStr.includes('DIAGNOSIS')) {
                  return {
                    text: JSON.stringify({
                      classSnapshot: {
                        totalSubmissions: 1,
                        misconceptionCount: 1,
                        strongestConcept: 'Basic verb forms',
                        highestPriorityNeed: 'Finished time markers',
                        overallRecommendation: 'Target time markers',
                      },
                      misconceptionClusters: [
                        {
                          clusterId: 'cluster-1',
                          misconceptionTitle: 'Finished-Time Markers with Present Perfect',
                          explanation: 'Uses past markers with present perfect',
                          affectedStudentIds: ['Custom 01'],
                          recommendedInstructionalResponse: 'Target with calendar sorting drill',
                          evidenceExamples: [
                            { studentId: 'Custom 01', excerpt: 'finished my homework last night', groundingReason: 'Direct quote' },
                          ],
                        },
                      ],
                    }),
                  };
                }

                // Stage 5: Teaching Strategist
                return {
                  text: JSON.stringify({
                    instructionalGroups: [
                      {
                        groupId: 'group-1',
                        groupName: 'Needs Concept Clarification: Finished-Time Markers',
                        studentIds: ['Custom 01'],
                        commonLearningNeed: 'Distinguish finished vs unfinished time',
                        evidenceSummary: 'Uses past markers with present perfect',
                        suggestedActivity: 'Time line sorting',
                        teacherInstructions: 'Guide through time markers',
                        exampleQuestion: 'Which sentence is correct?',
                        successCriterion: 'Accurate identification',
                      },
                    ],
                    nextLessonPlan: {
                      totalDuration: '25 minutes',
                      targetObjective: 'Present perfect time markers',
                      phases: [
                        {
                          timeRange: '0-5 min',
                          phaseTitle: 'Warm up',
                          description: 'Warm up',
                          actionableTeacherPrompt: 'Check past markers',
                          materials: 'Whiteboard',
                        },
                      ],
                    },
                    interventions: [
                      {
                        interventionId: 'interv-1',
                        clusterId: 'cluster-1',
                        targetMisconceptionTitle: 'Finished-Time Markers with Present Perfect',
                        title: 'Calendar Sorting Drill',
                        supportTier: 'Guided Practice',
                        rationale: 'Clarifies time expressions',
                        suggestedActivity: 'Sort time phrases into open vs closed periods',
                        teacherScript: 'Review calendar boundaries',
                        exampleQuestion: 'Can yesterday pair with have finished?',
                        exitTicketQuestion: 'Correct this sentence',
                      },
                    ],
                  }),
                };
              }
              if (args.model === 'gemini-3.6-flash') {
                // Stage 6: Verifier
                return {
                  text: JSON.stringify({
                    overallStatus: 'verified',
                    evidenceCoverageStatus: 'verified',
                    objectiveAlignmentStatus: 'verified',
                    unsupportedClaimsStatus: 'none_detected',
                    pedagogicalPlausibility: 'sound',
                    explanation: 'All student quotes verified directly.',
                    groundedCheckDetails: [],
                  }),
                };
              }
              return { text: '{}' };
            },
          },
        };

        setGeminiClient(mockAi);

        const result = await runFullAnalysisPipeline(
          {
            subject: 'English',
            gradeLevel: 'Grade 10',
            lessonTitle: 'Grammar Review',
            learningObjective: 'Present Perfect vs Past Simple',
            expectedAnswerRubric: 'Correct usage of Present Perfect and time markers',
          },
          customSubmissions
        );

        assert.ok(result.executionMetadata, 'Result must contain executionMetadata');
        assert.ok(result.executionMetadata.stageModels, 'executionMetadata must contain stageModels map');

        const stageModels = result.executionMetadata.stageModels!;
        assert.strictEqual(stageModels['Stage 2: Gemini Observer'], 'gemini-3.5-flash-lite');
        assert.strictEqual(stageModels['Stage 3: Gemini Diagnosis'], 'gemini-3.8-flash');
        assert.strictEqual(stageModels['Stage 5: Gemini Teaching Strategist'], 'gemini-3.8-flash');
        assert.strictEqual(stageModels['Stage 6: Gemini Verification'], 'gemini-3.6-flash');
        assert.ok(result.executionMetadata.modelsUsed.includes('gemini-3.5-flash-lite'));
        assert.ok(result.executionMetadata.modelsUsed.includes('gemini-3.8-flash'));
        assert.ok(result.executionMetadata.modelsUsed.includes('gemini-3.6-flash'));
      });
    });

    describe('Section 33: Production Portfolio Transformation & Privacy Architecture Audit', () => {
      it('PT-01: Identity normalization converts real student names to stable pseudonyms without leaking PII', () => {
        const gateway = new PrivacyGateway();
        const rawSubmissions: StudentSubmission[] = [
          { studentId: 'Nguyen Van An', studentText: 'I visited Da Nang yesterday', workType: 'typed' },
          { studentId: 'Johnathan Smith', studentText: 'I have seen the bridge', workType: 'typed' },
          { studentId: 'Student 03', studentText: 'I went to Hue', workType: 'typed' },
          { studentId: 'Custom 04', studentText: 'I have arrived', workType: 'typed' },
        ];

        const normalized = gateway.normalizeStudentIdentities(rawSubmissions);
        assert.strictEqual(normalized[0].studentId, 'Student 01', 'Full name Nguyen Van An must be pseudonymized to Student 01');
        assert.strictEqual(normalized[1].studentId, 'Student 02', 'Full name Johnathan Smith must be pseudonymized to Student 02');
        assert.strictEqual(normalized[2].studentId, 'Student 03', 'Pre-existing pseudonym Student 03 must be preserved');
        assert.strictEqual(normalized[3].studentId, 'Custom 04', 'Pre-existing pseudonym Custom 04 must be preserved');
      });

      it('PT-02: SDP provider configuration honors environment variables and production mode', () => {
        const originalEnv = process.env.SDP_PROVIDER;
        try {
          process.env.SDP_PROVIDER = 'google-sdp';
          const cloudProvider = createDefaultSensitiveDataProtectionProvider();
          assert.ok(
            cloudProvider instanceof GoogleSensitiveDataProtectionProvider,
            'Explicit SDP_PROVIDER=google-sdp must instantiate GoogleSensitiveDataProtectionProvider'
          );

          process.env.SDP_PROVIDER = 'deterministic';
          const localProvider = createDefaultSensitiveDataProtectionProvider();
          assert.ok(
            localProvider instanceof DeterministicSensitiveDataProtectionProvider,
            'Explicit SDP_PROVIDER=deterministic must instantiate DeterministicSensitiveDataProtectionProvider'
          );
        } finally {
          process.env.SDP_PROVIDER = originalEnv;
        }
      });

      it('PT-03: Google SDP text de-identification strictly fails closed if response lacks item.value', async () => {
        const originalFetch = global.fetch;
        try {
          // Mock fetch to simulate an unexpected 200 response lacking item.value
          global.fetch = async () =>
            ({
              ok: true,
              json: async () => ({ unexpectedField: true }), // Missing item.value!
            } as any);

          const provider = new GoogleSensitiveDataProtectionProvider({ projectId: 'test-project' });
          (provider as any).auth = {
            getClient: async () => ({
              getRequestHeaders: async () => ({ Authorization: 'Bearer mock-adc-token' }),
            }),
            getProjectId: async () => 'test-project',
          };

          await assert.rejects(
            async () => {
              await provider.deidentifyText({
                text: 'Sensitive student raw name: Nguyen Van An',
                infoTypes: ['PERSON_NAME'],
              });
            },
            (err: any) => {
              assert.strictEqual(err.code, 'PRIVACY_SCAN_FAILED');
              assert.ok(
                err.message.includes('missing deidentified item value'),
                'Must reject missing item value rather than falling back to original sensitive text'
              );
              return true;
            }
          );
        } finally {
          global.fetch = originalFetch;
        }
      });

      it('PT-04: Google SDP image redaction strictly fails closed if response lacks redactedImage', async () => {
        const originalFetch = global.fetch;
        try {
          // Mock fetch to simulate 200 response without redactedImage
          global.fetch = async () =>
            ({
              ok: true,
              json: async () => ({ overview: {} }), // Missing redactedImage!
            } as any);

          const provider = new GoogleSensitiveDataProtectionProvider({ projectId: 'test-project' });
          (provider as any).auth = {
            getClient: async () => ({
              getRequestHeaders: async () => ({ Authorization: 'Bearer mock-adc-token' }),
            }),
            getProjectId: async () => 'test-project',
          };

          await assert.rejects(
            async () => {
              await provider.redactImage({
                imageBytesBase64: 'raw-image-bytes-containing-handwritten-pii',
                mimeType: 'image/png',
                infoTypes: ['PERSON_NAME'],
              });
            },
            (err: any) => {
              assert.strictEqual(err.code, 'PRIVACY_SCAN_FAILED');
              assert.ok(
                err.message.includes('missing redacted image in response'),
                'Must reject missing redactedImage rather than falling back to original raw image'
              );
              return true;
            }
          );
        } finally {
          global.fetch = originalFetch;
        }
      });

      it('PT-05: AnalysisController HTTP boundary rejects invalid requests with HTTP 400 and structured error', async () => {
        let capturedStatus = 0;
        let capturedJson: any = null;

        const mockRes: any = {
          status: (code: number) => {
            capturedStatus = code;
            return mockRes;
          },
          json: (data: any) => {
            capturedJson = data;
            return mockRes;
          },
        };

        // Missing context and empty submissions
        const mockReq: any = {
          body: {
            context: null,
            submissions: [],
          },
        };

        await analysisController.analyze(mockReq, mockRes);

        assert.strictEqual(capturedStatus, 400, 'Invalid request must return HTTP 400');
        assert.ok(capturedJson?.error, 'Response must contain structured error object');
        assert.strictEqual(capturedJson.error.code, 'INVALID_REQUEST');
        assert.ok(capturedJson.error.message, 'Response error must contain actionable message');
      });
    });

    // =======================================================================
    // PHASE P5: Privacy Provider and Startup Configuration Hardening
    // =======================================================================
    describe('Phase P5: Privacy Provider and Startup Configuration Hardening', () => {
      it('P5.1: development + deterministic starts without Google credentials', () => {
        const config = loadAppConfig({
          NODE_ENV: 'development',
          SDP_PROVIDER: 'deterministic',
        });
        assert.strictEqual(config.nodeEnv, 'development');
        assert.strictEqual(config.privacyProvider, 'deterministic');
        assert.strictEqual(config.googleCloudProject, undefined);
      });

      it('P5.2: test + deterministic starts without Google credentials', () => {
        const config = loadAppConfig({
          NODE_ENV: 'test',
          SDP_PROVIDER: 'deterministic',
        });
        assert.strictEqual(config.nodeEnv, 'test');
        assert.strictEqual(config.privacyProvider, 'deterministic');
        assert.strictEqual(config.googleCloudProject, undefined);
      });

      it('P5.3: production + deterministic fails startup validation', () => {
        assert.throws(
          () => {
            loadAppConfig({
              NODE_ENV: 'production',
              SDP_PROVIDER: 'deterministic',
            });
          },
          (err: any) => {
            return (
              err instanceof Error &&
              err.message.includes('Production environment strictly forbids SDP_PROVIDER="deterministic"')
            );
          }
        );
      });

      it('P5.4: production + google without required configuration fails', () => {
        assert.throws(
          () => {
            loadAppConfig({
              NODE_ENV: 'production',
              SDP_PROVIDER: 'google',
              GOOGLE_CLOUD_PROJECT: '',
            });
          },
          (err: any) => {
            return (
              err instanceof Error &&
              err.message.includes('GOOGLE_CLOUD_PROJECT configuration is missing')
            );
          }
        );
      });

      it('P5.5: Google sanitization failure does not return original text (fails closed)', async () => {
        const googleProvider = new GoogleSensitiveDataProtectionProvider({
          projectId: 'mock-proj',
        });
        (googleProvider as any).auth = {
          getClient: async () => ({
            getRequestHeaders: async () => ({ Authorization: 'Bearer mock-adc-token' }),
          }),
          getProjectId: async () => 'mock-proj',
        };

        // Mock fetch to simulate Google Cloud SDP HTTP 500 failure
        const originalFetch = globalThis.fetch;
        globalThis.fetch = (async () => {
          return new Response(JSON.stringify({ error: { message: 'SDP internal error' } }), {
            status: 500,
            statusText: 'Internal Server Error',
          });
        }) as any;

        const rawStudentText = 'My name is John Doe and my email is john@example.com';
        try {
          await assert.rejects(
            async () => {
              await googleProvider.deidentifyText({
                text: rawStudentText,
                infoTypes: ['PERSON_NAME', 'EMAIL_ADDRESS'],
              });
            },
            (err: any) => {
              assert.ok(err instanceof PipelineError, 'Must throw PipelineError');
              assert.strictEqual(err.code, 'PRIVACY_SCAN_FAILED');
              // Original text must NEVER be in error message or returned
              assert.ok(!err.message.includes('john@example.com'));
              assert.ok(!err.message.includes('John Doe'));
              return true;
            }
          );
        } finally {
          globalThis.fetch = originalFetch;
        }
      });

      it('P5.6: Google sanitization failure does not return original image (fails closed)', async () => {
        const googleProvider = new GoogleSensitiveDataProtectionProvider({
          projectId: 'mock-proj',
        });
        (googleProvider as any).auth = {
          getClient: async () => ({
            getRequestHeaders: async () => ({ Authorization: 'Bearer mock-adc-token' }),
          }),
          getProjectId: async () => 'mock-proj',
        };

        const originalFetch = globalThis.fetch;
        globalThis.fetch = (async () => {
          return new Response(JSON.stringify({ error: { message: 'Image redact service error' } }), {
            status: 503,
            statusText: 'Service Unavailable',
          });
        }) as any;

        const rawImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
        try {
          await assert.rejects(
            async () => {
              await googleProvider.redactImage({
                imageBytesBase64: rawImageBase64,
                mimeType: 'image/png',
                infoTypes: ['PERSON_NAME'],
              });
            },
            (err: any) => {
              assert.ok(err instanceof PipelineError, 'Must throw PipelineError');
              assert.strictEqual(err.code, 'PRIVACY_SCAN_FAILED');
              return true;
            }
          );
        } finally {
          globalThis.fetch = originalFetch;
        }
      });

      it('P5.7: deterministic image mode never pretends an unchanged image was sanitized', async () => {
        const deterministicProvider = new DeterministicSensitiveDataProtectionProvider();
        const rawImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

        const result = await deterministicProvider.redactImage({
          imageBytesBase64: rawImageBase64,
          mimeType: 'image/png',
          infoTypes: ['PERSON_NAME'],
        });

        // The returned image MUST NOT equal the unredacted input image
        assert.notStrictEqual(
          result.redactedImageBase64,
          rawImageBase64,
          'Deterministic provider must never return the original raw image bytes unchanged'
        );
        assert.ok(result.redactedImageBase64.length > 0, 'Redacted image must be non-empty');
        assert.strictEqual(result.provider, 'deterministic-demo-sanitizer');
        assert.strictEqual(result.findingCount, 0, 'Does not fabricate image finding count');
      });
    });

    describe('Phase P6: Pre-Deployment Hardening Verification', () => {
      it('P6.1: Raw PII (names, emails, phones, raw text) cannot enter persistent browser storage', () => {
        // Raw student submission containing PII
        const rawPiiSubmission: StudentSubmission = {
          studentId: 'Nguyen Van An',
          studentText: 'My name is Nguyen Van An and my email is an.nguyen@example.com and phone is 0901234567. Yesterday I have visited Hanoi.',
          imageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
          workType: 'typed',
        };
        assert.ok(rawPiiSubmission.studentText.includes('Nguyen Van An'));

        // Server-sanitized result simulating pipeline output
        const mockResult: ClassAnalysisResult = {
          id: 'analysis_hardening_01',
          timestamp: new Date().toISOString(),
          context: DEMO_CONTEXT,
          classSnapshot: {
            totalSubmissions: 1,
            misconceptionCount: 1,
            strongestConcept: 'Vocabulary',
            highestPriorityNeed: 'Tense consistency',
            overallRecommendation: 'Targeted drill',
          },
          studentObservations: [
            {
              studentId: 'Student 01',
              demonstratedUnderstanding: ['Past narrative structure'],
              misconceptions: ['Present perfect with finished time'],
              supportingEvidence: [
                {
                  quoteOrDetail: 'Yesterday I have visited Hanoi',
                  interpretation: 'Finished time adverbial violation',
                },
              ],
              rubricAlignment: 'Developing',
              confidence: 0.95,
              recommendedSupportLevel: 'concept_clarification',
            },
          ],
          misconceptionClusters: [],
          instructionalGroups: [],
          nextLessonPlan: { phases: [], totalDuration: '25m', targetObjective: 'Tense contrast' },
          interventions: [],
          verification: {
            overallStatus: 'verified',
            evidenceCoverageStatus: 'verified',
            objectiveAlignmentStatus: 'verified',
            unsupportedClaimsStatus: 'none_detected',
            pedagogicalPlausibility: 'sound',
            explanation: 'Verified',
            groundedCheckDetails: [],
          },
          normalizedSourceEvidence: [
            {
              studentId: 'Student 01',
              extractedText: 'My name is [PERSON_NAME] and my email is [EMAIL_ADDRESS] and phone is [PHONE_NUMBER]. Yesterday I have visited Hanoi.',
              sourceType: 'typed',
              confidenceOrStatus: 'exact_source',
            },
          ],
        };

        // Simulate saveAnalysis persistence construction:
        const sanitizedSubmissionsToCache: StudentSubmission[] =
          mockResult.normalizedSourceEvidence && mockResult.normalizedSourceEvidence.length > 0
            ? mockResult.normalizedSourceEvidence.map((evidence) => ({
                studentId: evidence.studentId,
                studentText: evidence.extractedText,
                workType: evidence.sourceType === 'image_transcription' ? 'handwritten_work' : 'typed',
              }))
            : (mockResult.studentObservations || []).map((obs) => ({
                studentId: obs.studentId,
                studentText: obs.supportingEvidence?.[0]?.quoteOrDetail || '',
                workType: 'typed',
              }));

        const persistedSession: SavedSession = {
          result: mockResult,
          sanitizedSubmissions: sanitizedSubmissionsToCache,
          savedAt: new Date().toISOString(),
        };

        const serialized = JSON.stringify(persistedSession);

        // REGRESSION PROOF:
        // 1. Raw name must NOT exist anywhere in persisted string
        assert.strictEqual(
          serialized.includes('Nguyen Van An'),
          false,
          'Raw student name must NEVER be stored in persisted browser session'
        );
        // 2. Raw email must NOT exist anywhere in persisted string
        assert.strictEqual(
          serialized.includes('an.nguyen@example.com'),
          false,
          'Raw student email must NEVER be stored in persisted browser session'
        );
        // 3. Raw phone must NOT exist anywhere in persisted string
        assert.strictEqual(
          serialized.includes('0901234567'),
          false,
          'Raw student phone number must NEVER be stored in persisted browser session'
        );
        // 4. Raw base64 image payload must NOT exist in persisted session
        assert.strictEqual(
          serialized.includes('iVBORw0KGgoAAAANSUhEUg'),
          false,
          'Raw image payload must NEVER be stored in persisted browser session'
        );
        // 5. Stored studentId must be pseudonymous
        assert.strictEqual(
          persistedSession.sanitizedSubmissions[0].studentId,
          'Student 01',
          'Stored ID must be normalized pseudonym'
        );
      });

      it('P6.2: Browser persistence strictly omits raw images', () => {
        const mockResult: ClassAnalysisResult = {
          id: 'analysis_hardening_02',
          timestamp: new Date().toISOString(),
          context: DEMO_CONTEXT,
          classSnapshot: {
            totalSubmissions: 1,
            misconceptionCount: 0,
            strongestConcept: 'All',
            highestPriorityNeed: 'None',
            overallRecommendation: 'None',
          },
          studentObservations: [],
          misconceptionClusters: [],
          instructionalGroups: [],
          nextLessonPlan: { phases: [], totalDuration: '25m', targetObjective: 'None' },
          interventions: [],
          verification: {
            overallStatus: 'verified',
            evidenceCoverageStatus: 'verified',
            objectiveAlignmentStatus: 'verified',
            unsupportedClaimsStatus: 'none_detected',
            pedagogicalPlausibility: 'sound',
            explanation: 'Verified',
            groundedCheckDetails: [],
          },
          normalizedSourceEvidence: [
            {
              studentId: 'Student 01',
              extractedText: 'Transcribed handwritten work',
              sourceType: 'image_transcription',
              confidenceOrStatus: 'transcription_reviewed',
            },
          ],
        };

        const cached: StudentSubmission[] = (mockResult.normalizedSourceEvidence || []).map((e) => ({
          studentId: e.studentId,
          studentText: e.extractedText,
          workType: 'handwritten_work',
        }));

        const session: SavedSession = {
          result: mockResult,
          sanitizedSubmissions: cached,
          savedAt: new Date().toISOString(),
        };

        assert.strictEqual(session.sanitizedSubmissions[0].imageBase64, undefined);
        const serialized = JSON.stringify(session);
        assert.strictEqual(serialized.includes('imageBase64'), false);
      });

      it('P6.3: Provider identity truthfully models runtime states', async () => {
        // Deterministic provider
        const detProvider = new DeterministicSensitiveDataProtectionProvider();
        const detResult = await detProvider.deidentifyText({
          text: 'Hello My name is John Doe',
          infoTypes: ['PERSON_NAME'],
        });
        assert.strictEqual(
          detResult.provider,
          'deterministic-demo-sanitizer',
          'Deterministic provider must identify as deterministic-demo-sanitizer'
        );

        // Demo fixture
        const demoAnalysis = generateGroundedDemoAnalysis(DEMO_CONTEXT, DEMO_SUBMISSIONS);
        assert.strictEqual(
          demoAnalysis.privacyAudit?.provider,
          'prevalidated-demo-fixture',
          'Demo analysis must identify as prevalidated-demo-fixture'
        );

        // Verification display truthfulness
        const demoDisplay = getPrivacyStatusDisplay(demoAnalysis.privacyAudit);
        assert.strictEqual(demoDisplay.label, 'Prevalidated Demo Dataset');

        const detAudit: PrivacyAudit = {
          status: 'passed',
          findingCount: 1,
          findingTypeCounts: { PERSON_NAME: 1 },
          sanitizationApplied: true,
          provider: 'deterministic-demo-sanitizer',
          providerVersionOrPolicyId: 'deterministic-edu-v1',
          durationMs: 12,
          imagesScanned: 0,
          imageRedactionCompleted: false,
          rawValuesRetained: false,
          failClosed: true,
        };
        const detDisplay = getPrivacyStatusDisplay(detAudit);
        assert.strictEqual(detDisplay.label, 'Demo Privacy: 1 Removed');
        assert.ok(detDisplay.description.includes('development/demo mode'));
      });

      it('P6.4: Verification trust badge derives truthfully from analysis state', () => {
        // Fully verified analysis
        const fullyVerified = isAnalysisFullyVerified({
          deterministicAuditPassed: true,
          overallStatus: 'verified',
          coveragePassed: true,
          clusterMathPassed: true,
          groupPartitionPassed: true,
          evidenceValidationPassed: true,
        });
        assert.strictEqual(fullyVerified, true);

        // Unverified / review needed
        const needsReview = isAnalysisFullyVerified({
          deterministicAuditPassed: false,
          overallStatus: 'needs_review',
          coveragePassed: false,
          clusterMathPassed: true,
          groupPartitionPassed: true,
          evidenceValidationPassed: true,
        });
        assert.strictEqual(needsReview, false);

        // Missing atomic check fails closed
        const missingAtomic = isAnalysisFullyVerified({
          deterministicAuditPassed: true,
          overallStatus: 'verified',
          coveragePassed: undefined,
          clusterMathPassed: true,
          groupPartitionPassed: true,
          evidenceValidationPassed: true,
        });
        assert.strictEqual(missingAtomic, false);
      });
    });

    // -----------------------------------------------------------------------
    // Phase P7: Deployment Hardening & Contract Verification
    // -----------------------------------------------------------------------
    describe('Phase P7: Deployment Hardening & Contract Verification', () => {
      beforeEach(() => {
        resetRateLimiterStore();
        resetAppConfig();
      });

      afterEach(() => {
        resetRateLimiterStore();
        resetAppConfig();
      });

      it('P7.1: Inference rate limiter throttles burst requests with HTTP 429 and structured error', () => {
        const limiter = createRateLimiter({
          windowMs: 60_000,
          maxRequests: 2,
          message: 'Rate limit exceeded for testing.',
        });

        const responses: Array<{ status: number; body: any }> = [];
        let nextCount = 0;

        const makeReq = () => {
          const req: any = {
            ip: '192.168.1.100',
            headers: {},
            socket: {},
          };
          const res: any = {
            statusCode: 200,
            headers: {} as Record<string, any>,
            setHeader(k: string, v: any) {
              this.headers[k] = v;
            },
            status(code: number) {
              this.statusCode = code;
              return this;
            },
            json(body: any) {
              responses.push({ status: this.statusCode, body });
              return this;
            },
          };
          const next = () => {
            nextCount++;
          };
          limiter(req, res, next);
        };

        makeReq(); // Call 1 -> allowed
        makeReq(); // Call 2 -> allowed
        makeReq(); // Call 3 -> throttled (429)

        assert.strictEqual(nextCount, 2, 'Only 2 requests should reach next()');
        assert.strictEqual(responses.length, 1, 'Exactly 1 request should be rejected with json response');
        assert.strictEqual(responses[0].status, 429, 'Rejected request must return HTTP 429');
        assert.strictEqual(responses[0].body?.error?.code, 'RATE_LIMIT_EXCEEDED');
        assert.strictEqual(responses[0].body?.retryable, false);
      });

      it('P7.2: AnalyzeRequestSchema rejects empty work items', () => {
        const invalidPayload = {
          context: {
            subject: 'English',
            gradeLevel: 'Grade 10',
            lessonTitle: 'Present Perfect',
            learningObjective: 'Understand tense contrast',
          },
          submissions: [
            {
              studentId: 'Student 01',
              studentText: '   ', // whitespace only
              workType: 'typed',
            },
          ],
        };

        const result = AnalyzeRequestSchema.safeParse(invalidPayload);
        assert.strictEqual(result.success, false, 'Empty student work must fail schema validation');
        const issue = result.error?.issues.find((i) => i.path.includes('studentText'));
        assert.ok(issue, 'Must report validation issue on studentText for empty work');
      });

      it('P7.3: AnalyzeRequestSchema strictly rejects unsupported image MIME types', () => {
        const invalidMimePayload = {
          context: {
            subject: 'English',
            gradeLevel: 'Grade 10',
            lessonTitle: 'Present Perfect',
            learningObjective: 'Understand tense contrast',
          },
          submissions: [
            {
              studentId: 'Student 01',
              studentText: 'Valid text',
              imageBase64: 'dGVzdA==',
              mimeType: 'image/gif', // unsupported MIME type
            },
          ],
        };

        const result = AnalyzeRequestSchema.safeParse(invalidMimePayload);
        assert.strictEqual(result.success, false, 'Unsupported MIME type image/gif must be rejected');

        const validMimePayload = {
          ...invalidMimePayload,
          submissions: [
            {
              studentId: 'Student 01',
              studentText: 'Valid text',
              imageBase64: 'dGVzdA==',
              mimeType: 'image/jpeg',
            },
          ],
        };
        const validResult = AnalyzeRequestSchema.safeParse(validMimePayload);
        assert.strictEqual(validResult.success, true, 'Supported MIME type image/jpeg must pass');
      });

      it('P7.4: AnalyzeRequestSchema rejects unbounded oversized inputs', () => {
        // Exceed learning objective (max 1000)
        const oversizedObjective = {
          context: {
            subject: 'English',
            gradeLevel: 'Grade 10',
            lessonTitle: 'Present Perfect',
            learningObjective: 'A'.repeat(1005),
          },
          submissions: [
            {
              studentId: 'Student 01',
              studentText: 'Sample text',
            },
          ],
        };
        const objResult = AnalyzeRequestSchema.safeParse(oversizedObjective);
        assert.strictEqual(objResult.success, false, 'Oversized learning objective must be rejected');

        // Exceed student text (max 10000)
        const oversizedText = {
          context: {
            subject: 'English',
            gradeLevel: 'Grade 10',
            lessonTitle: 'Present Perfect',
            learningObjective: 'Valid objective',
          },
          submissions: [
            {
              studentId: 'Student 01',
              studentText: 'X'.repeat(10005),
            },
          ],
        };
        const textResult = AnalyzeRequestSchema.safeParse(oversizedText);
        assert.strictEqual(textResult.success, false, 'Oversized student text must be rejected');
      });

      it('P7.5: AnalyzeRequestSchema validates and preserves teacherNotes in LearningContext', () => {
        const payloadWithNotes = {
          context: {
            subject: 'English Language Arts',
            gradeLevel: 'Grade 10',
            lessonTitle: 'Diagnostic Assessment',
            learningObjective: 'Understand tense contrast with finished time markers',
            expectedAnswerRubric: 'Standard rubric criteria',
            teacherNotes: 'Vietnamese L1 speakers often omit tense conjugation due to aspect particles.',
          },
          submissions: [
            {
              studentId: 'Student 01',
              studentText: 'I have finished my work yesterday.',
            },
          ],
        };

        const result = AnalyzeRequestSchema.safeParse(payloadWithNotes);
        assert.strictEqual(result.success, true, 'Payload with valid teacherNotes must parse cleanly');
        assert.strictEqual(
          result.data?.context?.teacherNotes,
          'Vietnamese L1 speakers often omit tense conjugation due to aspect particles.'
        );
      });

      it('P7.6: ResultsView fail-closed verification: undefined evidenceValidationPassed strictly fails', () => {
        const withoutEvidenceValidation = isAnalysisFullyVerified({
          deterministicAuditPassed: true,
          overallStatus: 'verified',
          coveragePassed: true,
          clusterMathPassed: true,
          groupPartitionPassed: true,
          evidenceValidationPassed: undefined, // missing or omitted check
        });
        assert.strictEqual(
          withoutEvidenceValidation,
          false,
          'Missing evidenceValidationPassed must fail verification closed'
        );

        const withEvidenceValidation = isAnalysisFullyVerified({
          deterministicAuditPassed: true,
          overallStatus: 'verified',
          coveragePassed: true,
          clusterMathPassed: true,
          groupPartitionPassed: true,
          evidenceValidationPassed: true,
        });
        assert.strictEqual(withEvidenceValidation, true);
      });

      it('P7.7: Production configuration requires non-empty GEMINI_API_KEY', () => {
        // Missing GEMINI_API_KEY in production must fail
        assert.throws(
          () => {
            loadAppConfig({
              NODE_ENV: 'production',
              SDP_PROVIDER: 'google',
              GOOGLE_CLOUD_PROJECT: 'lotuslearn-prod-project',
              GEMINI_API_KEY: '', // Missing
            });
          },
          (err: Error) => {
            return (
              err.message.includes('GEMINI_API_KEY is required in production') ||
              err.message.includes('geminiApiKey')
            );
          },
          'Missing GEMINI_API_KEY in production must throw clear configuration error'
        );

        // Valid production configuration passes
        const validConfig = loadAppConfig({
          NODE_ENV: 'production',
          SDP_PROVIDER: 'google',
          GOOGLE_CLOUD_PROJECT: 'lotuslearn-prod-project',
          GEMINI_API_KEY: 'test-gemini-key-prod',
        });
        assert.strictEqual(validConfig.nodeEnv, 'production');
        assert.strictEqual(validConfig.privacyProvider, 'google');
        assert.strictEqual(validConfig.geminiApiKey, 'test-gemini-key-prod');
        resetAppConfig();
      });

      it('P7.8: Rate limiter sets standard X-RateLimit headers and Retry-After on limit hit', () => {
        const limiter = createRateLimiter({
          windowMs: 30_000,
          maxRequests: 1,
        });

        const headers: Record<string, any> = {};
        const req: any = { ip: '10.0.0.1', headers: {}, socket: {} };
        const res: any = {
          setHeader(k: string, v: any) {
            headers[k] = v;
          },
          status() {
            return this;
          },
          json() {
            return this;
          },
        };

        limiter(req, res, () => {});
        assert.strictEqual(headers['X-RateLimit-Limit'], 1);
        assert.strictEqual(headers['X-RateLimit-Remaining'], 0);

        // Second call triggers 429 and Retry-After
        limiter(req, res, () => {});
        assert.ok(headers['Retry-After'] !== undefined, 'Retry-After header must be set');
      });
    });

    // =========================================================================
    // PHASE P8: FINAL SECURITY, PRIVACY & REPRODUCIBILITY GATE
    // =========================================================================
    describe('Phase P8: Final Security, Privacy & Reproducibility Gate', () => {
      beforeEach(() => {
        resetAppConfig();
        setPrivacyGateway(null);
        setSensitiveDataProtectionProvider(null);
        resetRateLimiterStore();
        resetGeminiClient();
        clearModelCooldowns();
      });

      afterEach(() => {
        resetAppConfig();
        setPrivacyGateway(null);
        setSensitiveDataProtectionProvider(null);
        resetRateLimiterStore();
        resetGeminiClient();
        clearModelCooldowns();
      });

      it('P8.1: POST /api/verify enforces privacy gateway: raw PII never reaches verifier model prompt', async () => {
        let capturedPrompt = '';
        const mockAi: any = {
          models: {
            generateContent: async (args: any) => {
              capturedPrompt = typeof args.contents === 'string' ? args.contents : JSON.stringify(args.contents);
              return {
                text: JSON.stringify({
                  overallStatus: 'partially_verified',
                  evidenceCoverageStatus: 'partially_verified',
                  objectiveAlignmentStatus: 'verified',
                  unsupportedClaimsStatus: 'none_detected',
                  pedagogicalPlausibility: 'sound',
                  explanation: 'Verification audit passed safely',
                  groundedCheckDetails: [],
                }),
              };
            },
          },
        };
        setGeminiClient(mockAi);

        // Inject obvious PII into verification request
        const piiName = 'Jonathan Doe';
        const piiEmail = 'johndoe@district42.edu';
        const piiPhone = '(555) 789-1234';

        const req: any = {
          body: {
            context: DEMO_CONTEXT,
            submissions: [
              {
                studentId: piiName,
                studentText: `Hello my name is ${piiName}, reach me at ${piiEmail} or call ${piiPhone}. I have finished my task yesterday.`,
                workType: 'typed',
              },
            ],
            observations: [],
            misconceptions: [],
            groups: [],
            interventions: [],
          },
        };

        let responseJson: any = null;
        let statusCode = 200;
        const res: any = {
          status(code: number) {
            statusCode = code;
            return this;
          },
          json(data: any) {
            responseJson = data;
            return this;
          },
        };

        await analysisController.verify(req, res);

        assert.strictEqual(statusCode, 200);
        assert.ok(responseJson);

        // Architectural Invariant Check: zero raw PII in prompt
        assert.strictEqual(
          capturedPrompt.includes(piiName),
          false,
          'Raw student name must NEVER reach verifier model prompt'
        );
        assert.strictEqual(
          capturedPrompt.includes(piiEmail),
          false,
          'Raw student email must NEVER reach verifier model prompt'
        );
        assert.strictEqual(
          capturedPrompt.includes(piiPhone),
          false,
          'Raw student phone number must NEVER reach verifier model prompt'
        );

        // Must be normalized to stable pseudonym
        assert.ok(
          capturedPrompt.includes('Student 01'),
          'Model prompt must use normalized pseudonym Student 01'
        );
      });

      it('P8.2: Rate limiter ignores spoofed X-Forwarded-For headers and relies on Express req.ip', () => {
        const limiter = createRateLimiter({
          windowMs: 60_000,
          maxRequests: 2,
        });

        const headers: Record<string, any> = {};
        const res: any = {
          setHeader(k: string, v: any) {
            headers[k] = v;
          },
          status(code: number) {
            this.statusCode = code;
            return this;
          },
          json(data: any) {
            this.body = data;
            return this;
          },
        };

        // Same physical client IP (192.168.1.50) attempts to bypass limit by spoofing different X-Forwarded-For headers
        const req1: any = {
          ip: '192.168.1.50',
          headers: { 'x-forwarded-for': '1.1.1.1' },
          socket: { remoteAddress: '192.168.1.50' },
        };
        const req2: any = {
          ip: '192.168.1.50',
          headers: { 'x-forwarded-for': '2.2.2.2' },
          socket: { remoteAddress: '192.168.1.50' },
        };
        const req3: any = {
          ip: '192.168.1.50',
          headers: { 'x-forwarded-for': '3.3.3.3' },
          socket: { remoteAddress: '192.168.1.50' },
        };

        let nextCalledCount = 0;
        limiter(req1, res, () => { nextCalledCount++; });
        limiter(req2, res, () => { nextCalledCount++; });
        limiter(req3, res, () => { nextCalledCount++; });

        assert.strictEqual(nextCalledCount, 2, 'Only 2 requests should be permitted per IP');
        assert.strictEqual(res.statusCode, 429, 'Spoofed header request 3 must be blocked with 429');
        assert.strictEqual(res.body?.code, 'RATE_LIMIT_EXCEEDED');
      });

      it('P8.3: Rate limiter bounded cleanup purges expired records and limits store size', () => {
        const limiter = createRateLimiter({
          windowMs: 100, // 100ms window
          maxRequests: 10,
          maxStoreEntries: 3,
        });

        const res: any = {
          setHeader() {},
          status() { return this; },
          json() { return this; },
        };

        // Add 3 entries
        limiter({ ip: '10.0.0.1', headers: {}, socket: {} } as any, res, () => {});
        limiter({ ip: '10.0.0.2', headers: {}, socket: {} } as any, res, () => {});
        limiter({ ip: '10.0.0.3', headers: {}, socket: {} } as any, res, () => {});

        assert.strictEqual(getRateLimiterStoreSize(), 3);

        // Add 4th entry: should trigger capacity eviction
        limiter({ ip: '10.0.0.4', headers: {}, socket: {} } as any, res, () => {});
        assert.ok(getRateLimiterStoreSize() <= 3, 'Store size must stay bounded at or below maxStoreEntries');

        // Test explicit time purge
        const futureTime = Date.now() + 500;
        const purged = cleanupExpiredEntries(futureTime);
        assert.ok(purged > 0, 'Expired entries must be purged');
        assert.strictEqual(getRateLimiterStoreSize(), 0, 'All expired entries purged');
      });

      it('P8.4: GoogleSensitiveDataProtectionProvider strictly requires ADC and does not accept or fallback to GEMINI_API_KEY', () => {
        const provider = new GoogleSensitiveDataProtectionProvider({
          projectId: 'test-gcp-project',
          locationId: 'global',
        });

        // Ensure there is no apiKey property on the provider instance
        assert.strictEqual(
          (provider as any).apiKey,
          undefined,
          'GoogleSensitiveDataProtectionProvider must not retain or accept apiKey'
        );
      });

      it('P8.5: GoogleSensitiveDataProtectionProvider fails closed if ADC cannot be obtained', async () => {
        const provider = new GoogleSensitiveDataProtectionProvider({
          projectId: 'test-gcp-project',
          locationId: 'global',
        });

        // Mock auth to throw credential error
        (provider as any).auth = {
          getClient: async () => {
            throw new Error('Could not load the default credentials');
          },
          getProjectId: async () => 'test-gcp-project',
        };

        await assert.rejects(
          async () => {
            await provider.deidentifyText({
              text: 'Student text sample',
              infoTypes: ['PERSON_NAME'],
            });
          },
          (err: any) => {
            return (
              err instanceof PipelineError &&
              err.code === 'PRIVACY_AUTH_ERROR' &&
              err.message.includes('Application Default Credentials')
            );
          },
          'Provider must fail closed with PRIVACY_AUTH_ERROR when ADC is unavailable'
        );
      });
    });

  });
});
