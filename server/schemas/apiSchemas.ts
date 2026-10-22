import { z } from 'zod';
import {
  CanonicalInterventionSchema,
  MisconceptionClusterSchema,
  NextLessonPlanSchema,
  StudentObservationSchema,
} from './analysisSchemas';

export const LearningContextSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  gradeLevel: z.string().min(1, 'Grade level is required'),
  lessonTitle: z.string().min(1, 'Lesson title is required'),
  learningObjective: z.string().min(1, 'Learning objective is required'),
  expectedAnswerRubric: z.string().optional().default(''),
});

export const StudentSubmissionInputSchema = z.object({
  studentId: z.string().optional().default(''),
  studentText: z.string().optional().default(''),
  workType: z.enum(['typed', 'handwritten_work', 'worksheet']).optional().default('typed'),
  imageBase64: z.string().optional(),
  mimeType: z.string().optional(),
  sourceType: z.enum(['typed', 'image_transcription']).optional(),
  confidenceOrStatus: z.string().optional(),
});

export const AnalyzeRequestSchema = z.object({
  context: LearningContextSchema,
  submissions: z
    .array(StudentSubmissionInputSchema)
    .min(1, 'At least one student submission is required')
    .max(100, 'Submissions cannot exceed 100 per analysis session'),
});

export const InterventionAdjustSchema = z.object({
  intervention: CanonicalInterventionSchema,
  action: z.enum(['simplify', 'challenge', 'exit_ticket']),
});

export const VerifyRequestSchema = z.object({
  context: LearningContextSchema,
  submissions: z.array(StudentSubmissionInputSchema).min(1),
  normalizedEvidence: z.array(z.any()).optional(),
  observations: z.array(StudentObservationSchema),
  misconceptions: z.array(MisconceptionClusterSchema),
  groups: z.array(z.any()),
  interventions: z.array(CanonicalInterventionSchema),
  nextLessonPlan: NextLessonPlanSchema.optional(),
  deterministicAudit: z.any().optional(),
});
