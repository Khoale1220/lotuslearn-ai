import { z } from 'zod';

export const NormalizedSourceEvidenceSchema = z.object({
  studentId: z.string(),
  sourceType: z.enum(['typed', 'image_transcription']),
  extractedText: z.string(),
  confidenceOrStatus: z.enum(['exact_source', 'transcription_high', 'transcription_moderate', 'unreadable']),
});

export const SupportingEvidenceItemSchema = z.object({
  quoteOrDetail: z.string(),
  interpretation: z.string(),
  sourceType: z.enum(['typed', 'image_transcription']).optional(),
  deterministicMatch: z.enum(['exact_quote_found', 'image_transcription_match', 'approximate_match', 'unsupported_citation']).optional(),
});

export const StudentObservationSchema = z.object({
  studentId: z.string(),
  demonstratedUnderstanding: z.array(z.string()).default([]),
  misconceptions: z.array(z.string()).default([]),
  supportingEvidence: z.array(SupportingEvidenceItemSchema).default([]),
  rubricAlignment: z.string().default('Evaluated against lesson rubric.'),
  confidence: z.number().min(0).max(1).default(0.92),
  evidenceStrength: z.enum(['strong', 'moderate', 'review_required']).optional(),
  recommendedSupportLevel: z.enum(['extension', 'concept_clarification', 'guided_practice', 'error_correction']).default('guided_practice'),
  extractedSourceText: z.string().optional(), // For image-based submissions to capture normalized transcription
});

export const StudentObservationListSchema = z.array(StudentObservationSchema);

export const ClusterEvidenceItemSchema = z.object({
  studentId: z.string(),
  excerpt: z.string(),
  groundingReason: z.string(),
  sourceType: z.enum(['typed', 'image_transcription']).optional(),
  deterministicMatch: z.enum(['exact_quote_found', 'image_transcription_match', 'approximate_match', 'unsupported_citation']).optional(),
});

export const MisconceptionClusterSchema = z.object({
  clusterId: z.string(),
  misconceptionTitle: z.string(),
  explanation: z.string(),
  affectedStudentIds: z.array(z.string()),
  studentCount: z.number().int().nonnegative().optional(),
  percentageAffected: z.number().min(0).max(100).optional(),
  evidenceExamples: z.array(ClusterEvidenceItemSchema).default([]),
  teachingPriority: z.enum(['urgent', 'high', 'moderate']).default('high'),
  confidence: z.number().min(0).max(1).default(0.9),
  evidenceStrength: z.enum(['strong', 'moderate', 'review_required']).optional(),
  recommendedInstructionalResponse: z.string(),
  status: z.enum(['accepted', 'edited', 'dismissed']).default('accepted'),
});

export const ClassSnapshotSchema = z.object({
  totalSubmissions: z.number().int().nonnegative().default(0),
  misconceptionCount: z.number().int().nonnegative().default(0),
  strongestConcept: z.string().default('Core objective foundation'),
  highestPriorityNeed: z.string().default('Targeted misconception remediation'),
  overallRecommendation: z.string().default('Address highest-prevalence misconception in tomorrow warm-up.'),
});

export const DiagnosisResultSchema = z.object({
  classSnapshot: ClassSnapshotSchema.optional(),
  misconceptionClusters: z.array(MisconceptionClusterSchema).default([]),
});

export const InstructionalGroupSchema = z.object({
  groupId: z.string(),
  groupName: z.string(),
  studentIds: z.array(z.string()),
  commonLearningNeed: z.string(),
  evidenceSummary: z.string(),
  suggestedActivity: z.string(),
  teacherInstructions: z.string(),
  exampleQuestion: z.string(),
  estimatedDuration: z.string().default('12-15 min'),
  successCriterion: z.string(),
});

export const LessonPhaseSchema = z.object({
  timeRange: z.string(),
  phaseTitle: z.string(),
  description: z.string(),
  actionableTeacherPrompt: z.string(),
  materials: z.string(),
});

export const NextLessonPlanSchema = z.object({
  totalDuration: z.string().default('25 minutes'),
  targetObjective: z.string(),
  phases: z.array(LessonPhaseSchema).default([]),
});

export const DifferentiatedInterventionSchema = z.object({
  interventionId: z.string(),
  targetMisconceptionTitle: z.string(),
  title: z.string(),
  supportTier: z.enum(['Guided Practice', 'Concept Clarification', 'Ready for Extension', 'Error Correction']).default('Guided Practice'),
  rationale: z.string(),
  suggestedActivity: z.string(),
  teacherScript: z.string(),
  exampleQuestion: z.string(),
  exitTicketQuestion: z.string(),
  status: z.enum(['accepted', 'edited', 'dismissed']).default('accepted'),
});

export const StrategyResultSchema = z.object({
  instructionalGroups: z.array(InstructionalGroupSchema).default([]),
  nextLessonPlan: NextLessonPlanSchema,
  interventions: z.array(DifferentiatedInterventionSchema).default([]),
});

export const GroundedCheckDetailSchema = z.object({
  claim: z.string(),
  evidenceFound: z.string(),
  verdict: z.enum(['verified', 'flagged']),
  auditType: z.enum(['deterministic', 'semantic']).optional(),
});

export const VerificationResultSchema = z.object({
  overallStatus: z.enum(['verified', 'partially_verified', 'needs_review']).default('needs_review'),
  evidenceCoverageStatus: z.enum(['verified', 'partially_verified', 'insufficient']).default('insufficient'),
  objectiveAlignmentStatus: z.enum(['verified', 'partially_verified', 'misaligned']).default('partially_verified'),
  unsupportedClaimsStatus: z.enum(['none_detected', 'minor_discrepancy', 'unsupported_found']).default('minor_discrepancy'),
  pedagogicalPlausibility: z.enum(['sound', 'review_suggested']).default('review_suggested'),
  explanation: z.string().default('Conservative verification audit pending full review.'),
  groundedCheckDetails: z.array(GroundedCheckDetailSchema).default([]),
  deterministicChecks: z
    .object({
      coveragePassed: z.boolean(),
      clusterMathPassed: z.boolean(),
      groupPartitionPassed: z.boolean(),
      quotesGroundedCount: z.number(),
      quotesFlaggedCount: z.number(),
    })
    .optional(),
});
