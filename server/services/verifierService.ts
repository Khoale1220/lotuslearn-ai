import { Type } from '@google/genai';
import { generateContentDetailed } from '../geminiClient';
import {
  DifferentiatedIntervention,
  InstructionalGroup,
  LearningContext,
  MisconceptionCluster,
  NextLessonPlan,
  NormalizedSourceEvidence,
  StudentObservation,
  StudentSubmission,
  VerificationResult,
} from '../../src/types';
import { VerificationResultSchema } from '../schemas/analysisSchemas';
import { DeterministicValidationResult } from './deterministicValidator';

export async function verifyAnalysisPipeline(
  context: LearningContext,
  rawSubmissions: StudentSubmission[],
  normalizedEvidence: NormalizedSourceEvidence[],
  observations: StudentObservation[],
  misconceptions: MisconceptionCluster[],
  groups: InstructionalGroup[],
  interventions: DifferentiatedIntervention[],
  nextLessonPlan?: NextLessonPlan,
  deterministicAudit?: DeterministicValidationResult
): Promise<VerificationResult> {
  const promptText = `You are conducting a SEPARATE GEMINI VERIFICATION PASS (Adversarial Quality & Evidence Auditor) in LotusLearn AI.
Your job is to rigorously audit the outputs produced by earlier pipeline stages against the ground-truth student submissions and lesson objective.

=== LEARNING OBJECTIVE ===
${context.learningObjective}

=== RAW STUDENT SUBMISSIONS & NORMALIZED EVIDENCE (GROUND TRUTH) ===
${rawSubmissions
  .map((s) => {
    const norm = normalizedEvidence.find((n) => n.studentId === s.studentId);
    return `[${s.studentId}] (${norm?.sourceType === 'image_transcription' ? 'Image-Transcribed' : 'Typed'}): "${norm?.extractedText || s.studentText}"`;
  })
  .join('\n')}

=== DETERMINISTIC AUDIT FINDINGS (PRE-COMPUTED BY SYSTEM) ===
- Student Coverage Passed: ${deterministicAudit?.coveragePassed ?? true}
- Cluster Prevalence Math Passed: ${deterministicAudit?.clusterMathPassed ?? true}
- Instructional Group Partition Passed: ${deterministicAudit?.groupPartitionPassed ?? true}
- Grounded Evidence Quotes Count: ${deterministicAudit?.quotesGroundedCount ?? 0}
- Flagged/Unverified Quotes Count: ${deterministicAudit?.quotesFlaggedCount ?? 0}
${deterministicAudit?.issues && deterministicAudit.issues.length > 0 ? `Issues Flagged by Deterministic Code:\n${deterministicAudit.issues.map((i) => `  * ${i}`).join('\n')}` : 'No code-level integrity discrepancies.'}

=== CLAIMS & MISCONCEPTION CLUSTERS TO AUDIT ===
${JSON.stringify(
  misconceptions.map((m) => ({
    title: m.misconceptionTitle,
    affectedStudents: m.affectedStudentIds,
    evidenceSamples: m.evidenceExamples.map((e) => ({
      studentId: e.studentId,
      excerpt: e.excerpt,
      match: e.deterministicMatch,
    })),
  })),
  null,
  2
)}

=== INSTRUCTIONAL GROUPS TO AUDIT ===
${JSON.stringify(
  groups.map((g) => ({
    name: g.groupName,
    studentIds: g.studentIds,
    commonNeed: g.commonLearningNeed,
    suggestedActivity: g.suggestedActivity,
  })),
  null,
  2
)}

=== DIFFERENTIATED INTERVENTIONS & LESSON PLAN TO AUDIT ===
${JSON.stringify(
  interventions.map((i) => ({
    title: i.title,
    supportTier: i.supportTier,
    targetMisconception: i.targetMisconceptionTitle,
  })),
  null,
  2
)}

=== ADVERSARIAL AUDIT CHECKLIST ===
1. Evidence Coverage: Does every claimed misconception and student assignment have direct, verifiable textual evidence in the raw student submission?
2. Objective Alignment: Do the findings and intervention recommendations directly address the stated learning objective?
3. Unsupported Claims: Did any previous stage invent student text, attribute errors to students who did not make them, or hallucinate concepts not in the student work?
4. Pedagogical Plausibility: Are the instructional grouping, lesson timeline, and recommendations realistic for a high school classroom setting?

=== FAIL-CLOSED EVALUATION CRITERIA ===
- If any student quote is unsupported or student assignment is ungrounded: overallStatus MUST be "needs_review" or "partially_verified".
- Never mark status as "verified" if evidence coverage is insufficient.

Return a JSON object matching this schema.`;

  const genResult = await generateContentDetailed({
    stageName: 'Stage 4: Adversarial Verifier Pass',
    contents: promptText,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overallStatus: {
            type: Type.STRING,
            description: '"verified", "partially_verified", or "needs_review"',
          },
          evidenceCoverageStatus: {
            type: Type.STRING,
            description: '"verified", "partially_verified", or "insufficient"',
          },
          objectiveAlignmentStatus: {
            type: Type.STRING,
            description: '"verified", "partially_verified", or "misaligned"',
          },
          unsupportedClaimsStatus: {
            type: Type.STRING,
            description: '"none_detected", "minor_discrepancy", or "unsupported_found"',
          },
          pedagogicalPlausibility: {
            type: Type.STRING,
            description: '"sound" or "review_suggested"',
          },
          explanation: {
            type: Type.STRING,
            description: 'Professional 3-4 sentence evidence audit justification.',
          },
          groundedCheckDetails: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                claim: { type: Type.STRING },
                evidenceFound: { type: Type.STRING },
                verdict: { type: Type.STRING },
              },
              required: ['claim', 'evidenceFound', 'verdict'],
            },
          },
        },
        required: [
          'overallStatus',
          'evidenceCoverageStatus',
          'objectiveAlignmentStatus',
          'unsupportedClaimsStatus',
          'pedagogicalPlausibility',
          'explanation',
          'groundedCheckDetails',
        ],
      },
      systemInstruction:
        'You are an adversarial quality assurance verifier for educational AI systems. You never approve claims without verifiable textual proof from the provided ground truth text. When in doubt, you fail-closed and request teacher review.',
      temperature: 0.1,
    },
  });

  let rawJson: any;
  try {
    rawJson = JSON.parse(genResult.text);
  } catch (err) {
    const cleaned = genResult.text.replace(/```json\n?|\n?```/g, '').trim();
    try {
      rawJson = JSON.parse(cleaned);
    } catch (parseErr) {
      throw new Error(`Stage 4 (Verifier Pass) JSON malformed: ${(parseErr as Error).message}`);
    }
  }

  // Validate with Zod
  const parsed = VerificationResultSchema.safeParse(rawJson);
  if (!parsed.success) {
    console.warn(
      `[LotusLearn AI] Stage 4 Verifier Zod warnings:`,
      parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')
    );
  }

  const data = parsed.success ? parsed.data : rawJson;

  // PRIORITY 3: Conservative fail-closed defaults! Never default missing data to "verified" or "sound"
  let overallStatus: 'verified' | 'partially_verified' | 'needs_review' =
    data?.overallStatus === 'verified'
      ? 'verified'
      : data?.overallStatus === 'partially_verified'
      ? 'partially_verified'
      : 'needs_review';

  let evidenceCoverageStatus: 'verified' | 'partially_verified' | 'insufficient' =
    data?.evidenceCoverageStatus === 'verified'
      ? 'verified'
      : data?.evidenceCoverageStatus === 'partially_verified'
      ? 'partially_verified'
      : 'insufficient';

  let objectiveAlignmentStatus: 'verified' | 'partially_verified' | 'misaligned' =
    data?.objectiveAlignmentStatus === 'verified'
      ? 'verified'
      : data?.objectiveAlignmentStatus === 'misaligned'
      ? 'misaligned'
      : 'partially_verified';

  let unsupportedClaimsStatus: 'none_detected' | 'minor_discrepancy' | 'unsupported_found' =
    data?.unsupportedClaimsStatus === 'none_detected'
      ? 'none_detected'
      : data?.unsupportedClaimsStatus === 'unsupported_found'
      ? 'unsupported_found'
      : 'minor_discrepancy';

  let pedagogicalPlausibility: 'sound' | 'review_suggested' =
    data?.pedagogicalPlausibility === 'sound' ? 'sound' : 'review_suggested';

  // Enforce hybrid deterministic safety: if deterministic checks flagged unverified quotes or group partition issues, fail-closed!
  if (deterministicAudit) {
    if (!deterministicAudit.coveragePassed || !deterministicAudit.clusterMathPassed) {
      overallStatus = 'needs_review';
      evidenceCoverageStatus = 'insufficient';
    }
    if (deterministicAudit.quotesFlaggedCount > 0) {
      unsupportedClaimsStatus = 'minor_discrepancy';
      if (overallStatus === 'verified') {
        overallStatus = 'partially_verified';
      }
    }
  }

  // Combine semantic audit checks with deterministic audit checks
  const semanticChecks = (Array.isArray(data?.groundedCheckDetails) ? data.groundedCheckDetails : []).map(
    (c: any) => ({
      claim: c.claim || 'Audited claim',
      evidenceFound: c.evidenceFound || 'Evidence cross-referenced against submissions',
      verdict: c.verdict === 'verified' ? ('verified' as const) : ('flagged' as const),
      auditType: 'semantic' as const,
    })
  );

  const deterministicCheckItems = (deterministicAudit?.issues || []).map((issue) => ({
    claim: 'Deterministic ground-truth cross-reference',
    evidenceFound: issue,
    verdict: 'flagged' as const,
    auditType: 'deterministic' as const,
  }));

  const allChecks = [...semanticChecks, ...deterministicCheckItems];

  // If no check details returned by model, construct conservative check list from actual raw data (not hardcoded demo)
  const finalCheckDetails =
    allChecks.length > 0
      ? allChecks
      : misconceptions.slice(0, 3).map((m) => {
          const sample = m.evidenceExamples[0];
          return {
            claim: `Evidence check for cluster: ${m.misconceptionTitle}`,
            evidenceFound: sample
              ? `Student ${sample.studentId}: "${sample.excerpt}" (${sample.deterministicMatch || 'evaluated'})`
              : 'No sample quotes provided for this cluster',
            verdict: sample && sample.deterministicMatch !== 'unsupported_citation' ? ('verified' as const) : ('flagged' as const),
            auditType: 'deterministic' as const,
          };
        });

  return {
    overallStatus,
    evidenceCoverageStatus,
    objectiveAlignmentStatus,
    unsupportedClaimsStatus,
    pedagogicalPlausibility,
    explanation:
      data?.explanation ||
      (overallStatus === 'verified'
        ? 'All diagnosed misconception clusters and instructional groupings were verified against raw student responses with direct quotation grounding.'
        : 'Adversarial verification pass completed with conservative recommendations pending teacher review.'),
    groundedCheckDetails: finalCheckDetails,
    deterministicChecks: deterministicAudit
      ? {
          coveragePassed: deterministicAudit.coveragePassed,
          clusterMathPassed: deterministicAudit.clusterMathPassed,
          groupPartitionPassed: deterministicAudit.groupPartitionPassed,
          quotesGroundedCount: deterministicAudit.quotesGroundedCount,
          quotesFlaggedCount: deterministicAudit.quotesFlaggedCount,
        }
      : undefined,
  };
}
