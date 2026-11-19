import type { StageModelTelemetry } from '../geminiClient';
import {
  LearningContext,
  NormalizedSourceEvidence,
  StudentObservation,
  StudentSubmission,
} from '../../src/types';
import { StudentObservationListSchema } from '../schemas/analysisSchemas';
import { PipelineError } from '../errors/pipelineErrors';
import { generateObserverProviderResult } from './observerProvider';

export interface ObserverResult {
  observations: StudentObservation[];
  normalizedEvidence: NormalizedSourceEvidence[];
  modelUsed: string;
  durationMs: number;
  telemetry?: StageModelTelemetry;
}

export interface ObserverValidationResult {
  valid: boolean;
  issues: string[];
  missingStudentIds: string[];
  duplicateStudentIds: string[];
  unknownStudentIds: string[];
  matchedObservations: Map<string, any>;
}

/**
 * P2A / P2B: Pure domain validator for Gemini Observer outputs.
 * Strict identity contract:
 * - Every expected student ID must appear exactly once.
 * - Reordered IDs are valid as long as identity set is identical.
 * - Missing, duplicate, or unknown student IDs strictly fail validation.
 * - Never silently repair student identities by array index.
 */
export function validateObserverOutput(
  expectedSubmissions: StudentSubmission[],
  rawObservations: Array<{ studentId: string; [k: string]: any }>
): ObserverValidationResult {
  const expectedIds = new Set(expectedSubmissions.map((s) => s.studentId));
  const seenIds = new Set<string>();
  const duplicateStudentIds: string[] = [];
  const unknownStudentIds: string[] = [];
  const matchedObservations = new Map<string, any>();
  const issues: string[] = [];

  for (const obs of rawObservations || []) {
    const sId = obs.studentId;
    if (!expectedIds.has(sId)) {
      unknownStudentIds.push(sId);
      issues.push(`Observer returned unknown student ID: "${sId}"`);
    }
    if (seenIds.has(sId)) {
      duplicateStudentIds.push(sId);
      issues.push(`Observer returned duplicate observation for student ID: "${sId}"`);
    } else {
      seenIds.add(sId);
      matchedObservations.set(sId, obs);
    }
  }

  const missingStudentIds: string[] = [];
  for (const id of expectedIds) {
    if (!seenIds.has(id)) {
      missingStudentIds.push(id);
      issues.push(`Observer omitted expected student ID: "${id}"`);
    }
  }

  const valid = issues.length === 0;
  return {
    valid,
    issues,
    missingStudentIds,
    duplicateStudentIds,
    unknownStudentIds,
    matchedObservations,
  };
}

export async function observeSubmissions(
  context: LearningContext,
  submissions: StudentSubmission[]
): Promise<ObserverResult> {
  const genResult = await generateObserverProviderResult(context, submissions);
  let rawJson: any;
  try {
    rawJson = JSON.parse(genResult.text);
  } catch {
    // Attempt markdown strip repair
    const cleaned = genResult.text.replace(/```json\n?|\n?```/g, '').trim();
    try {
      rawJson = JSON.parse(cleaned);
    } catch (parseErr) {
      throw new Error(`Stage 1 (Observer) JSON malformed: ${(parseErr as Error).message}`);
    }
  }

  // 1. Structural schema validation with Zod
  const parseResult = StudentObservationListSchema.safeParse(rawJson);
  if (!parseResult.success) {
    console.error(
      `[LotusLearn AI] Stage 1 Zod validation issues:`,
      parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')
    );
    throw new PipelineError({
      code: 'OBSERVER_SCHEMA_ERROR',
      stage: 'Stage 2: Gemini Observer',
      message: `Observer schema validation failed: ${parseResult.error.issues[0]?.message || 'Invalid observation format'}`,
      retryable: false,
    });
  }

  const rawObservations = parseResult.data;

  // 2. Strict domain identity validation against expected roster (P2A / P2B)
  const idValidation = validateObserverOutput(submissions, rawObservations);
  if (!idValidation.valid) {
    console.error(`[LotusLearn AI] Observer identity validation failed:`, idValidation.issues);
    throw new PipelineError({
      code: 'OBSERVER_IDENTITY_ERROR',
      stage: 'Stage 2: Gemini Observer',
      message: `Observer identity validation failed: ${idValidation.issues.join('; ')}`,
      retryable: false,
    });
  }

  // Build normalized source evidence for downstream verification (Priority 6 & P2F)
  const normalizedEvidence: NormalizedSourceEvidence[] = submissions.map((sub) => {
    const rawObs = idValidation.matchedObservations.get(sub.studentId);
    const isImage = sub.workType === 'handwritten_work' || !!sub.imageBase64;
    const extractedText =
      isImage && rawObs?.extractedSourceText ? rawObs.extractedSourceText : sub.studentText;

    // Multimodal transcription honesty (P2F):
    // Image source alone does NOT imply transcription confidence.
    // Untested model transcriptions default to 'transcription_unverified'.
    const confidenceOrStatus = isImage
      ? !extractedText || extractedText.trim().length === 0
        ? ('unreadable' as const)
        : ('transcription_unverified' as const)
      : ('exact_source' as const);

    return {
      studentId: sub.studentId,
      sourceType: isImage ? 'image_transcription' : 'typed',
      extractedText,
      confidenceOrStatus,
    };
  });

  // Map observations strictly through matched student ID (zero positional fallback)
  const observations: StudentObservation[] = submissions.map((sub) => {
    const obs = idValidation.matchedObservations.get(sub.studentId)!;
    const norm = normalizedEvidence.find((n) => n.studentId === sub.studentId);
    const sourceType = norm?.sourceType || 'typed';

    const supportingEvidence = (obs.supportingEvidence || []).map((ev: any) => ({
      quoteOrDetail: ev.quoteOrDetail || '',
      interpretation: ev.interpretation || '',
      sourceType,
    }));

    return {
      studentId: sub.studentId,
      demonstratedUnderstanding: obs.demonstratedUnderstanding || [],
      misconceptions: obs.misconceptions || [],
      supportingEvidence,
      rubricAlignment: obs.rubricAlignment || 'Evaluated against lesson rubric.',
      confidence: typeof obs.confidence === 'number' ? obs.confidence : 0.92,
      recommendedSupportLevel: obs.recommendedSupportLevel || 'guided_practice',
    };
  });

  return {
    observations,
    normalizedEvidence,
    modelUsed: genResult.modelUsed,
    durationMs: genResult.durationMs,
    telemetry: genResult.telemetry,
  };
}
