export type CheckState = 'not_checked' | 'passed' | 'failed' | 'review_required';
export type TeacherDecision = 'pending' | 'accepted' | 'edited' | 'dismissed';
export type ArtifactProvenance =
  | 'source'
  | 'gemini'
  | 'deterministic_code'
  | 'gemini_verifier'
  | 'human';

export interface ArtifactTrustState {
  provenance: ArtifactProvenance;
  deterministic: {
    state: CheckState;
    reasons?: string[];
  };
  semanticVerification: {
    state: CheckState;
    reasons?: string[];
  };
  teacherDecision: TeacherDecision;
}

export interface LearningContext {
  subject: string;
  gradeLevel: string;
  lessonTitle: string;
  learningObjective: string;
  expectedAnswerRubric: string;
  teacherNotes?: string;
}

export interface StudentSubmission {
  studentId: string;
  studentText: string;
  imageBase64?: string;
  mimeType?: string;
  workType: 'typed' | 'handwritten_work' | 'worksheet';
}

export interface NormalizedSourceEvidence {
  studentId: string;
  sourceType: 'typed' | 'image_transcription';
  extractedText: string;
  confidenceOrStatus:
    | 'exact_source'
    | 'transcription_unverified'
    | 'transcription_supported'
    | 'transcription_reviewed'
    | 'unreadable'
    | 'transcription_high'
    | 'transcription_moderate';
}

export type DeterministicMatchType =
  | 'exact_match'
  | 'exact_quote_found'
  | 'normalized_exact_match'
  | 'image_transcription_match'
  | 'image_transcription_verified'
  | 'approximate_match'
  | 'unsupported_citation';

export interface StudentObservation {
  studentId: string;
  demonstratedUnderstanding: string[];
  misconceptions: string[];
  supportingEvidence: Array<{
    quoteOrDetail: string;
    interpretation: string;
    sourceType?: 'typed' | 'image_transcription';
    deterministicMatch?: DeterministicMatchType;
  }>;
  rubricAlignment: string;
  confidence: number;
  evidenceStrength?: 'strong' | 'moderate' | 'review_required';
  recommendedSupportLevel: 'extension' | 'concept_clarification' | 'guided_practice' | 'error_correction';
}

export interface MisconceptionCluster {
  clusterId: string;
  misconceptionTitle: string;
  explanation: string;
  affectedStudentIds: string[];
  studentCount: number;
  percentageAffected: number;
  evidenceExamples: Array<{
    studentId: string;
    excerpt: string;
    groundingReason: string;
    sourceType?: 'typed' | 'image_transcription';
    deterministicMatch?: DeterministicMatchType;
  }>;
  teachingPriority: 'urgent' | 'high' | 'moderate';
  confidence: number;
  evidenceStrength?: 'strong' | 'moderate' | 'review_required';
  recommendedInstructionalResponse: string;
  status?: TeacherDecision;
  teacherDecision?: TeacherDecision;
}

export interface InstructionalGroup {
  groupId: string;
  groupName: string; // e.g. "Needs Tense-Choice Clarification", "Needs Irregular Participle Practice", "Ready for Extension"
  studentIds: string[];
  commonLearningNeed: string;
  evidenceSummary: string;
  suggestedActivity: string;
  teacherInstructions: string;
  exampleQuestion: string;
  estimatedDuration: string;
  successCriterion: string;
}

export interface LessonPhase {
  timeRange: string;
  phaseTitle: string;
  description: string;
  actionableTeacherPrompt: string;
  materials: string;
}

export interface NextLessonPlan {
  totalDuration: string;
  targetObjective: string;
  phases: LessonPhase[];
}

export interface DifferentiatedIntervention {
  interventionId: string;
  /**
   * Required for new canonical interventions.
   * Optional only in raw legacy payloads before deterministic migration.
   */
  clusterId?: string;
  targetMisconceptionTitle: string;
  title: string;
  supportTier: 'Guided Practice' | 'Concept Clarification' | 'Ready for Extension' | 'Error Correction';
  rationale: string;
  suggestedActivity: string;
  teacherScript: string;
  exampleQuestion: string;
  exitTicketQuestion: string;
  status?: TeacherDecision;
  teacherDecision?: TeacherDecision;
}

export interface VerificationResult {
  overallStatus: 'verified' | 'partially_verified' | 'needs_review';
  evidenceCoverageStatus: 'verified' | 'partially_verified' | 'insufficient';
  objectiveAlignmentStatus: 'verified' | 'partially_verified' | 'misaligned';
  unsupportedClaimsStatus: 'none_detected' | 'minor_discrepancy' | 'unsupported_found';
  pedagogicalPlausibility: 'sound' | 'review_suggested';
  explanation: string;
  groundedCheckDetails: Array<{
    claim: string;
    evidenceFound: string;
    verdict: 'verified' | 'flagged';
    auditType?: 'deterministic' | 'semantic';
  }>;
  deterministicChecks?: {
    coveragePassed: boolean;
    clusterMathPassed: boolean;
    groupPartitionPassed: boolean;
    evidenceValidationPassed?: boolean;
    quotesGroundedCount: number;
    quotesFlaggedCount: number;
  };
  modelUsed?: string;
  durationMs?: number;
}

export interface PrivacyAudit {
  status: 'passed' | 'review_required' | 'failed' | 'not_checked';
  findingCount: number;
  findingTypeCounts: {
    [infoType: string]: number;
  };
  sanitizationApplied: boolean;
  provider: 'google-sensitive-data-protection';
  providerVersionOrPolicyId?: string;
  durationMs?: number;
  rawValuesRetained: false;
  failClosed: true;
}

export interface ClassSnapshot {
  totalSubmissions: number;
  misconceptionCount: number;
  strongestConcept: string;
  highestPriorityNeed: string;
  overallRecommendation: string;
}

export interface ExecutionMetadata {
  executionMode: 'live_gemini' | 'demo_resilience';
  primaryModel: string;
  modelsUsed: string[];
  stageModels?: Record<string, string>;
  stageTelemetry?: any[];
  totalDurationMs: number;
  privacyScanDurationMs?: number;
  stageDurationsMs: Record<string, number>;
  submissionCount: number;
  deterministicAuditPassed: boolean;
  runId?: string;
  pipelineVersion?: string;
  datasetFingerprint?: string;
  fallbackUsed?: boolean;
  startedAt?: string;
  completedAt?: string;
}

export interface ClassAnalysisResult {
  id: string;
  timestamp: string;
  context: LearningContext;
  classSnapshot: ClassSnapshot;
  studentObservations: StudentObservation[];
  misconceptionClusters: MisconceptionCluster[];
  instructionalGroups: InstructionalGroup[];
  nextLessonPlan: NextLessonPlan;
  interventions: DifferentiatedIntervention[];
  verification: VerificationResult;
  privacyAudit?: PrivacyAudit;
  normalizedSourceEvidence?: NormalizedSourceEvidence[];
  executionMetadata?: ExecutionMetadata;
}

export interface SavedSession {
  result: ClassAnalysisResult;
  rawSubmissions: StudentSubmission[];
  savedAt: string;
}

export interface PipelineStageProgress {
  stage: number; // 1 to 6
  stageName: string;
  description: string;
  completed: boolean;
}
