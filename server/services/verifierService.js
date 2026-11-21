import { Type } from "@google/genai";
import { generateContentDetailed } from "../geminiClient";
import { VerificationResultSchema } from "../schemas/analysisSchemas";
async function verifyAnalysisPipeline(context, sanitizedSubmissions, normalizedEvidence, observations, misconceptions, groups, interventions, nextLessonPlan, deterministicAudit) {
  const promptText = `You are conducting a SEPARATE GEMINI VERIFICATION PASS (Adversarial Quality & Evidence Auditor) in LotusLearn AI.
Your job is to rigorously audit the outputs produced by earlier pipeline stages against the ground-truth student submissions and lesson objective.

=== LEARNING OBJECTIVE ===
${context.learningObjective}

=== SANITIZED STUDENT EVIDENCE (GROUND TRUTH) ===
${sanitizedSubmissions.map((s) => {
    const norm = normalizedEvidence.find((n) => n.studentId === s.studentId);
    return `[${s.studentId}] (${norm?.sourceType === "image_transcription" ? "Image-Transcribed" : "Typed"}): "${norm?.extractedText || s.studentText}"`;
  }).join("\n")}

=== DETERMINISTIC AUDIT FINDINGS (PRE-COMPUTED BY SYSTEM) ===
- Student Coverage Passed: ${deterministicAudit ? deterministicAudit.coveragePassed ? "PASS" : "FAIL" : "NOT CHECKED (Audit unavailable)"}
- Cluster Prevalence Math Passed: ${deterministicAudit ? deterministicAudit.clusterMathPassed ? "PASS" : "FAIL" : "NOT CHECKED (Audit unavailable)"}
- Instructional Group Partition Passed: ${deterministicAudit ? deterministicAudit.groupPartitionPassed ? "PASS" : "FAIL" : "NOT CHECKED (Audit unavailable)"}
- Evidence Validation Passed: ${deterministicAudit ? deterministicAudit.evidenceValidationPassed ? "PASS" : "FAIL" : "NOT CHECKED (Audit unavailable)"}
- Grounded Evidence Quotes Count: ${deterministicAudit?.quotesGroundedCount ?? 0}
- Flagged/Unverified Quotes Count: ${deterministicAudit?.quotesFlaggedCount ?? 0}
${deterministicAudit?.issues && deterministicAudit.issues.length > 0 ? `Issues Flagged by Deterministic Code:
${deterministicAudit.issues.map((i) => `  * ${i}`).join("\n")}` : deterministicAudit ? "No code-level integrity discrepancies." : "WARNING: Deterministic audit was not executed; all technical checks are unverified."}

=== CLAIMS & MISCONCEPTION CLUSTERS TO AUDIT ===
${JSON.stringify(
    misconceptions.map((m) => ({
      title: m.misconceptionTitle,
      affectedStudents: m.affectedStudentIds,
      evidenceSamples: m.evidenceExamples.map((e) => ({
        studentId: e.studentId,
        excerpt: e.excerpt,
        match: e.deterministicMatch
      }))
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
      suggestedActivity: g.suggestedActivity
    })),
    null,
    2
  )}

=== DIFFERENTIATED INTERVENTIONS TO AUDIT ===
${JSON.stringify(
    interventions.map((i) => ({
      title: i.title,
      supportTier: i.supportTier,
      targetMisconception: i.targetMisconceptionTitle
    })),
    null,
    2
  )}

=== 25-MINUTE LESSON PLAN TO AUDIT ===
${nextLessonPlan ? JSON.stringify(nextLessonPlan, null, 2) : "[NOT PROVIDED: Lesson plan omitted from this verification run]"}

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
    stageName: "Stage 4: Adversarial Verifier Pass",
    stageKey: "semantic_verifier",
    contents: promptText,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overallStatus: {
            type: Type.STRING,
            description: '"verified", "partially_verified", or "needs_review"'
          },
          evidenceCoverageStatus: {
            type: Type.STRING,
            description: '"verified", "partially_verified", or "insufficient"'
          },
          objectiveAlignmentStatus: {
            type: Type.STRING,
            description: '"verified", "partially_verified", or "misaligned"'
          },
          unsupportedClaimsStatus: {
            type: Type.STRING,
            description: '"none_detected", "minor_discrepancy", or "unsupported_found"'
          },
          pedagogicalPlausibility: {
            type: Type.STRING,
            description: '"sound" or "review_suggested"'
          },
          explanation: {
            type: Type.STRING,
            description: "Professional 3-4 sentence evidence audit justification."
          },
          groundedCheckDetails: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                claim: { type: Type.STRING },
                evidenceFound: { type: Type.STRING },
                verdict: { type: Type.STRING }
              },
              required: ["claim", "evidenceFound", "verdict"]
            }
          }
        },
        required: [
          "overallStatus",
          "evidenceCoverageStatus",
          "objectiveAlignmentStatus",
          "unsupportedClaimsStatus",
          "pedagogicalPlausibility",
          "explanation",
          "groundedCheckDetails"
        ]
      },
      systemInstruction: "You are an adversarial quality assurance verifier for educational AI systems. You never approve claims without verifiable textual proof from the provided ground truth text. When in doubt, you fail-closed and request teacher review."
    }
  });
  let rawJson;
  try {
    rawJson = JSON.parse(genResult.text);
  } catch {
    const cleaned = genResult.text.replace(/```json\n?|\n?```/g, "").trim();
    try {
      rawJson = JSON.parse(cleaned);
    } catch (parseErr) {
      throw new Error(`Stage 4 (Verifier Pass) JSON malformed: ${parseErr.message}`);
    }
  }
  const parsed = VerificationResultSchema.safeParse(rawJson);
  if (!parsed.success) {
    console.warn(
      `[LotusLearn AI] Stage 4 Verifier Zod warnings:`,
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")
    );
  }
  const data = parsed.success ? parsed.data : rawJson;
  let overallStatus = data?.overallStatus === "verified" ? "verified" : data?.overallStatus === "partially_verified" ? "partially_verified" : "needs_review";
  let evidenceCoverageStatus = data?.evidenceCoverageStatus === "verified" ? "verified" : data?.evidenceCoverageStatus === "partially_verified" ? "partially_verified" : "insufficient";
  let objectiveAlignmentStatus = data?.objectiveAlignmentStatus === "verified" ? "verified" : data?.objectiveAlignmentStatus === "misaligned" ? "misaligned" : "partially_verified";
  let unsupportedClaimsStatus = data?.unsupportedClaimsStatus === "none_detected" ? "none_detected" : data?.unsupportedClaimsStatus === "unsupported_found" ? "unsupported_found" : "minor_discrepancy";
  let pedagogicalPlausibility = data?.pedagogicalPlausibility === "sound" ? "sound" : "review_suggested";
  const hasSubmissions = Boolean(sanitizedSubmissions && sanitizedSubmissions.length > 0);
  const hasNormalizedEvidence = Boolean(normalizedEvidence && normalizedEvidence.length > 0);
  const hasMisconceptions = Boolean(misconceptions && misconceptions.length > 0);
  const hasGroups = Boolean(groups && groups.length > 0);
  const hasInterventions = Boolean(interventions && interventions.length > 0);
  const hasLessonPlan = Boolean(nextLessonPlan && nextLessonPlan.phases && nextLessonPlan.phases.length > 0);
  if (!hasSubmissions || !hasNormalizedEvidence) {
    evidenceCoverageStatus = "insufficient";
    overallStatus = "needs_review";
  }
  if (!hasLessonPlan) {
    pedagogicalPlausibility = "review_suggested";
    if (overallStatus === "verified") {
      overallStatus = "partially_verified";
    }
  }
  if (!hasGroups || !hasInterventions || !hasMisconceptions) {
    if (overallStatus === "verified") {
      overallStatus = "partially_verified";
    }
  }
  if (deterministicAudit) {
    if (!deterministicAudit.coveragePassed || !deterministicAudit.clusterMathPassed || !deterministicAudit.groupPartitionPassed || !deterministicAudit.evidenceValidationPassed) {
      overallStatus = "needs_review";
    }
    if (!deterministicAudit.coveragePassed || !deterministicAudit.clusterMathPassed || !deterministicAudit.evidenceValidationPassed) {
      evidenceCoverageStatus = "insufficient";
    }
    if (deterministicAudit.quotesFlaggedCount > 0) {
      unsupportedClaimsStatus = "minor_discrepancy";
    }
  } else {
    if (overallStatus === "verified") {
      overallStatus = "needs_review";
    }
    evidenceCoverageStatus = "insufficient";
  }
  const semanticChecks = (Array.isArray(data?.groundedCheckDetails) ? data.groundedCheckDetails : []).map(
    (c) => ({
      claim: c.claim || "Audited claim",
      evidenceFound: c.evidenceFound || "Evidence cross-referenced against submissions",
      verdict: c.verdict === "verified" ? "verified" : "flagged",
      auditType: "semantic"
    })
  );
  const deterministicCheckItems = (deterministicAudit?.issues || []).map((issue) => ({
    claim: "Deterministic ground-truth cross-reference",
    evidenceFound: issue,
    verdict: "flagged",
    auditType: "deterministic"
  }));
  const allChecks = [...semanticChecks, ...deterministicCheckItems];
  const finalCheckDetails = allChecks.length > 0 ? allChecks : misconceptions.slice(0, 3).map((m) => {
    const sample = m.evidenceExamples[0];
    const isSupportedMatch = sample && (sample.deterministicMatch === "exact_quote_found" || sample.deterministicMatch === "normalized_exact_match" || sample.deterministicMatch === "image_transcription_verified");
    return {
      claim: `Evidence check for cluster: ${m.misconceptionTitle}`,
      evidenceFound: sample ? `Student ${sample.studentId}: "${sample.excerpt}" (${sample.deterministicMatch || "not_checked"})` : "No sample quotes provided for this cluster",
      verdict: isSupportedMatch ? "verified" : "flagged",
      auditType: "deterministic"
    };
  });
  return {
    overallStatus,
    evidenceCoverageStatus,
    objectiveAlignmentStatus,
    unsupportedClaimsStatus,
    pedagogicalPlausibility,
    explanation: data?.explanation || (overallStatus === "verified" ? "All diagnosed misconception clusters and instructional groupings were verified against raw student responses with direct quotation grounding." : "Adversarial verification pass completed with conservative recommendations pending teacher review."),
    groundedCheckDetails: finalCheckDetails,
    deterministicChecks: deterministicAudit ? {
      coveragePassed: deterministicAudit.coveragePassed,
      clusterMathPassed: deterministicAudit.clusterMathPassed,
      groupPartitionPassed: deterministicAudit.groupPartitionPassed,
      evidenceValidationPassed: deterministicAudit.evidenceValidationPassed,
      quotesGroundedCount: deterministicAudit.quotesGroundedCount,
      quotesFlaggedCount: deterministicAudit.quotesFlaggedCount
    } : void 0,
    modelUsed: genResult.modelUsed,
    durationMs: genResult.durationMs
  };
}
export {
  verifyAnalysisPipeline
};
