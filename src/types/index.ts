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
  confidenceOrStatus: 'exact_source' | 'transcription_high' | 'transcription_moderate' | 'unreadable';
}

export interface StudentObservation {
  studentId: string;
  demonstratedUnderstanding: string[];
  misconceptions: string[];
  supportingEvidence: Array<{
    quoteOrDetail: string;
    interpretation: string;
    sourceType?: 'typed' | 'image_transcription';
    deterministicMatch?: 'exact_quote_found' | 'image_transcription_match' | 'approximate_match' | 'unsupported_citation';
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
    deterministicMatch?: 'exact_quote_found' | 'image_transcription_match' | 'approximate_match' | 'unsupported_citation';
  }>;
  teachingPriority: 'urgent' | 'high' | 'moderate';
  confidence: number;
  evidenceStrength?: 'strong' | 'moderate' | 'review_required';
  recommendedInstructionalResponse: string;
  status?: 'accepted' | 'edited' | 'dismissed';
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
  targetMisconceptionTitle: string;
  title: string;
  supportTier: 'Guided Practice' | 'Concept Clarification' | 'Ready for Extension' | 'Error Correction';
  rationale: string;
  suggestedActivity: string;
  teacherScript: string;
  exampleQuestion: string;
  exitTicketQuestion: string;
  status?: 'accepted' | 'edited' | 'dismissed';
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
    quotesGroundedCount: number;
    quotesFlaggedCount: number;
  };
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
  totalDurationMs: number;
  stageDurationsMs: Record<string, number>;
  submissionCount: number;
  deterministicAuditPassed: boolean;
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
