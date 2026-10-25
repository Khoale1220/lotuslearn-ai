import { z } from 'zod';
import {
  CanonicalInterventionSchema,
  MisconceptionClusterSchema,
  NextLessonPlanSchema,
  StudentObservationSchema,
} from './analysisSchemas';

export const LearningContextSchema = z.object({
  subject: z.string().trim().min(1, 'Subject is required').max(100, 'Subject cannot exceed 100 characters'),
  gradeLevel: z.string().trim().min(1, 'Grade level is required').max(50, 'Grade level cannot exceed 50 characters'),
  lessonTitle: z.string().trim().min(1, 'Lesson title is required').max(200, 'Lesson title cannot exceed 200 characters'),
  learningObjective: z
    .string()
    .trim()
    .min(3, 'Learning objective is required (minimum 3 characters)')
    .max(1000, 'Learning objective cannot exceed 1000 characters'),
  expectedAnswerRubric: z.string().max(4000, 'Rubric cannot exceed 4000 characters').optional().default(''),
  teacherNotes: z.string().max(2000, 'Teacher notes cannot exceed 2000 characters').optional().default(''),
});

export const StudentSubmissionInputSchema = z
  .object({
    studentId: z
      .string()
      .trim()
      .min(1, 'Student ID cannot be empty')
      .max(64, 'Student ID cannot exceed 64 characters'),
    studentText: z.string().max(10000, 'Student text cannot exceed 10000 characters').optional().default(''),
    workType: z.enum(['typed', 'handwritten_work', 'worksheet']).optional().default('typed'),
    imageBase64: z.string().max(7_500_000, 'Encoded image exceeds maximum allowed size (approx 5MB unencoded)').optional(),
    mimeType: z.enum(['image/jpeg', 'image/png']).optional(),
    sourceType: z.enum(['typed', 'image_transcription']).optional(),
    confidenceOrStatus: z.string().max(100).optional(),
  })
  .superRefine((data, ctx) => {
    const hasText = Boolean(data.studentText && data.studentText.trim().length > 0);
    const hasImage = Boolean(data.imageBase64 && data.imageBase64.trim().length > 0);

    // Reject empty work items
    if (!hasText && !hasImage) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Submission must contain meaningful student work (non-empty text or image).',
        path: ['studentText'],
      });
    }

    // Require supported MIME type when image is supplied
    if (hasImage && !data.mimeType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Image submission must specify a supported mimeType (image/jpeg or image/png).',
        path: ['mimeType'],
      });
    }
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
