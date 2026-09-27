import { createHash } from 'crypto';
import { LearningContext, StudentSubmission } from '../../src/types';

/**
 * Priority 1: Strict Cryptographic Fingerprinting for Demo Resilience
 *
 * Canonical Serialization Protocol:
 * 1. Context: [subject]|[gradeLevel]|[lessonTitle]|[learningObjective] (trimmed)
 * 2. Submissions: Deterministically sorted by studentId ascending.
 *    Each entry: [studentId]:[workType]:[normalizedWhitespaceText]
 *    (Preserves exact characters while collapsing non-semantic whitespace variance)
 * 3. Payload: canonicalContext + '||' + canonicalSubmissions.join(';')
 * 4. Algorithm: SHA-256
 */

export function canonicalizeDemoPayload(
  context: LearningContext,
  submissions: StudentSubmission[]
): string {
  const ctx = [
    (context?.subject || '').trim(),
    (context?.gradeLevel || '').trim(),
    (context?.lessonTitle || '').trim(),
    (context?.learningObjective || '').trim(),
  ].join('|');

  const subs = [...(submissions || [])]
    .sort((a, b) => (a.studentId || '').localeCompare(b.studentId || ''))
    .map((s) => [
      (s.studentId || '').trim(),
      (s.workType || 'typed').trim().toLowerCase(),
      (s.studentText || '').trim().replace(/\s+/g, ' '),
    ].join(':'))
    .join(';');

  return `${ctx}||${subs}`;
}

export function computeDatasetFingerprint(
  context: LearningContext,
  submissions: StudentSubmission[]
): string {
  const payload = canonicalizeDemoPayload(context, submissions);
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * Precomputed SHA-256 fingerprint of the canonical Grade 10 ELA Demo Classroom.
 * Any modification of student text (even 1 character or punctuation), lesson context,
 * or custom input will yield a completely different hash due to cryptographic avalanche.
 */
export const DEMO_DATASET_SHA256 = 'f82100e176cd233e0b65efbf00fc7b8947e7dab66aadff9389f1f25f128bf1ce';

export function isExactDemoClassroom(
  context: LearningContext,
  submissions: StudentSubmission[]
): boolean {
  if (!submissions || submissions.length === 0 || !context) {
    return false;
  }
  const fingerprint = computeDatasetFingerprint(context, submissions);
  return fingerprint === DEMO_DATASET_SHA256;
}
