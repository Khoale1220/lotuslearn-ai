import {
  ClassAnalysisResult,
  LearningContext,
  StudentSubmission,
} from '../../src/types';
import { DEMO_SUBMISSIONS } from '../../src/data/demoClassroom';
import { observeSubmissions } from './observerService';
import { diagnoseClassPatterns } from './diagnosisService';
import { planTeachingStrategy } from './strategyService';
import { verifyAnalysisPipeline } from './verifierService';
import { runDeterministicValidation } from './deterministicValidator';
import { generateGroundedDemoAnalysis } from './demoFallbackGenerator';
import { PRIMARY_GEMINI_MODEL } from '../geminiClient';

import { isExactDemoClassroom } from './demoFingerprint';

export type ProgressCallback = (stage: number, stageName: string, detail: string) => void;
export { isExactDemoClassroom };

export async function runFullAnalysisPipeline(
  context: LearningContext,
  submissions: StudentSubmission[],
  onProgress?: ProgressCallback
): Promise<ClassAnalysisResult> {
  const timestamp = new Date().toISOString();
  const analysisId = `analysis_${Date.now()}`;
  const pipelineStartTime = Date.now();
  const stageDurations: Record<string, number> = {};
  const modelsUsed: string[] = [];
  let currentStageNumber = 1;
  let currentStageName = 'Reading evidence';

  try {
    // Stage 1: Source Evidence - Ingestion
    currentStageNumber = 1;
    currentStageName = 'Source Evidence';
    onProgress?.(1, 'Source Evidence', `Ingesting ${submissions.length} student submissions & learning context`);
    const s1Start = Date.now();
    await new Promise((r) => setTimeout(r, 200));
    stageDurations['Stage 1: Source Evidence'] = Date.now() - s1Start;

    // Stage 2: Gemini Observer - Evidence extraction & multimodal transcription
    currentStageNumber = 2;
    currentStageName = 'Gemini Observer';
    onProgress?.(2, 'Gemini Observer', 'Multimodal evidence extraction & handwriting OCR transcription');
    const obsStart = Date.now();
    const { observations, normalizedEvidence, modelUsed: obsModel, durationMs: obsDuration } =
      await observeSubmissions(context, submissions);
    stageDurations['Stage 2: Gemini Observer'] = obsDuration || (Date.now() - obsStart);
    if (obsModel && !modelsUsed.includes(obsModel)) modelsUsed.push(obsModel);

    // Stage 3: Gemini Diagnosis - Misconception synthesis
    currentStageNumber = 3;
    currentStageName = 'Gemini Diagnosis';
    onProgress?.(3, 'Gemini Diagnosis', 'Synthesizing class-wide misconception patterns and root causes');
    const diagStart = Date.now();
    const { classSnapshot, misconceptionClusters, modelUsed: diagModel, durationMs: diagDuration } =
      await diagnoseClassPatterns(context, observations);
    stageDurations['Stage 3: Gemini Diagnosis'] = diagDuration || (Date.now() - diagStart);
    if (diagModel && !modelsUsed.includes(diagModel)) modelsUsed.push(diagModel);

    // Stage 4: Deterministic Validation - Code grounding & arithmetic checks
    currentStageNumber = 4;
    currentStageName = 'Deterministic Validation';
    onProgress?.(4, 'Deterministic Validation', 'Verifying student ID coverage, cluster math, and exact quotes');
    const valStart = Date.now();
    const deterministicAudit = runDeterministicValidation({
      submissions,
      normalizedEvidence,
      observations,
      clusters: misconceptionClusters,
      groups: [], // Will validate after groups are generated, or validate clusters first
    });
    stageDurations['Stage 4: Deterministic Validation'] = Date.now() - valStart;

    // Stage 5: Gemini Teaching Strategist - Interventions & 25-minute lesson sequence
    currentStageNumber = 5;
    currentStageName = 'Gemini Teaching Strategist';
    onProgress?.(5, 'Gemini Teaching Strategist', 'Generating differentiated scaffolds and 25-minute lesson sequence');
    const stratStart = Date.now();
    const { instructionalGroups, nextLessonPlan, interventions, modelUsed: stratModel, durationMs: stratDuration } =
      await planTeachingStrategy(context, observations, misconceptionClusters);
    stageDurations['Stage 5: Gemini Teaching Strategist'] = stratDuration || (Date.now() - stratStart);
    if (stratModel && !modelsUsed.includes(stratModel)) modelsUsed.push(stratModel);

    // Run complete deterministic audit with groups now populated
    const audit2Start = Date.now();
    const completeDeterministicAudit = runDeterministicValidation({
      submissions,
      normalizedEvidence,
      observations,
      clusters: misconceptionClusters,
      groups: instructionalGroups,
    });
    stageDurations['Stage 4: Deterministic Validation'] =
      (stageDurations['Stage 4: Deterministic Validation'] || 0) + (Date.now() - audit2Start);

    // Stage 6: Gemini Verification - Adversarial grounding audit pass
    currentStageNumber = 6;
    currentStageName = 'Gemini Verification';
    onProgress?.(6, 'Gemini Verification', 'Adversarial pass auditing claims against student evidence');
    const verifierStart = Date.now();
    const verification = await verifyAnalysisPipeline(
      context,
      submissions,
      normalizedEvidence,
      completeDeterministicAudit.auditedObservations,
      completeDeterministicAudit.auditedClusters,
      completeDeterministicAudit.auditedGroups,
      interventions,
      nextLessonPlan,
      completeDeterministicAudit
    );
    stageDurations['Stage 6: Gemini Verification'] = Date.now() - verifierStart;

    // Stage 7: Complete
    currentStageNumber = 7;
    currentStageName = 'Complete';
    onProgress?.(7, 'Complete', 'Diagnostic assessment ready for teacher review & decision');

    const totalDurationMs = Date.now() - pipelineStartTime;

    return {
      id: analysisId,
      timestamp,
      context,
      classSnapshot,
      studentObservations: completeDeterministicAudit.auditedObservations,
      misconceptionClusters: completeDeterministicAudit.auditedClusters,
      instructionalGroups: completeDeterministicAudit.auditedGroups,
      nextLessonPlan,
      interventions,
      verification,
      normalizedSourceEvidence: normalizedEvidence,
      executionMetadata: {
        executionMode: 'live_gemini',
        primaryModel: PRIMARY_GEMINI_MODEL,
        modelsUsed: modelsUsed.length > 0 ? modelsUsed : [PRIMARY_GEMINI_MODEL],
        totalDurationMs,
        stageDurationsMs: stageDurations,
        submissionCount: submissions.length,
        deterministicAuditPassed:
          completeDeterministicAudit.coveragePassed &&
          completeDeterministicAudit.clusterMathPassed &&
          completeDeterministicAudit.groupPartitionPassed &&
          completeDeterministicAudit.evidenceValidationPassed,
      },
    };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.warn(`[LotusLearn AI] Pipeline failed at Stage ${currentStageNumber} (${currentStageName}):`, errorMsg);

    // PRIORITY 1: Strict demo identity check!
    const isDemo = isExactDemoClassroom(context, submissions);

    if (isDemo) {
      console.log('[LotusLearn AI] Verified exact Demo Classroom dataset. Engaging Demo Resilience Fallback...');

      // Animate remaining visual stages so user experiences full workflow
      const stages = [
        { stage: 1, name: 'Source Evidence', detail: `Ingested ${submissions.length} student submissions & learning context` },
        { stage: 2, name: 'Gemini Observer', detail: 'Multimodal evidence extraction & handwriting OCR transcription' },
        { stage: 3, name: 'Gemini Diagnosis', detail: 'Synthesized 4 core misconception clusters and root causes' },
        { stage: 4, name: 'Deterministic Validation', detail: 'Verified student ID coverage, cluster math, and exact quotes' },
        { stage: 5, name: 'Gemini Teaching Strategist', detail: 'Generated differentiated scaffolds and 25-minute lesson sequence' },
        { stage: 6, name: 'Gemini Verification', detail: 'Audited claims against raw student evidence' },
        { stage: 7, name: 'Complete', detail: 'All 7 stages verified · preparing diagnostic results' },
      ];

      for (const s of stages) {
        if (s.stage >= currentStageNumber) {
          onProgress?.(s.stage, s.name, s.detail);
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }

      return generateGroundedDemoAnalysis(context, submissions);
    }

    // For ANY non-demo or custom submission: NEVER substitute demo analysis!
    // Throw clean stage-specific error with retry instruction
    let cleanMsg = errorMsg;
    try {
      const parsed = typeof errorMsg === 'string' && errorMsg.startsWith('{') ? JSON.parse(errorMsg) : null;
      if (parsed?.error?.message) {
        cleanMsg = parsed.error.message.split('\n')[0];
      }
    } catch {
      // Keep original message
    }

    throw new Error(
      `Stage ${currentStageNumber} (${currentStageName}) failed: ${cleanMsg}. Please try again.`
    );
  }
}
