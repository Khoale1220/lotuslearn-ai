import { Request, Response } from 'express';
import {
  AnalyzeRequestSchema,
  InterventionAdjustSchema,
  VerifyRequestSchema,
} from '../schemas/apiSchemas';
import { runFullAnalysisPipeline } from '../services/pipelineCoordinator';
import { adjustIntervention } from '../services/strategyService';
import { verifyAnalysisPipeline } from '../services/verifierService';
import { runDeterministicValidation } from '../services/deterministicValidator';
import { DEMO_CONTEXT, DEMO_SUBMISSIONS } from '../../src/data/demoClassroom';
import { getPrivacyGateway } from '../services/privacyGateway';
import { NormalizedSourceEvidence } from '../../src/types';

export class AnalysisController {
  /**
   * GET /api/demo-data
   * Returns canonical demo dataset for reproducible exploration
   */
  public getDemoData(_req: Request, res: Response): void {
    res.json({
      context: DEMO_CONTEXT,
      submissions: DEMO_SUBMISSIONS,
    });
  }

  /**
   * POST /api/analyze
   * Standard synchronous analysis execution
   */
  public async analyze(req: Request, res: Response): Promise<Response> {
    const parsed = AnalyzeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || 'Invalid request payload';
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: firstIssue,
          details: parsed.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
        code: 'VALIDATION_ERROR',
        message: firstIssue,
        retryable: false,
      });
    }

    try {
      const { context, submissions } = parsed.data;
      const result = await runFullAnalysisPipeline(context, submissions as any);
      res.locals.analysisRunId = result.id;
      return res.json(result);
    } catch (err: any) {
      console.error('[LotusLearn API] Analysis pipeline error:', err?.message || err);
      const code = err.code || 'PIPELINE_ERROR';
      const message = err.message || 'An error occurred during multi-stage analysis.';
      const status = err.httpStatus || 500;

      return res.status(status).json({
        error: {
          code,
          message,
          stage: err.stage,
          retryable: err.retryable ?? false,
        },
        code,
        message,
        stage: err.stage,
        retryable: err.retryable ?? false,
      });
    }
  }

  /**
   * POST /api/analyze-stream
   * Live streaming execution with Server-Sent Events (SSE)
   */
  public async analyzeStream(req: Request, res: Response): Promise<void> {
    const parsed = AnalyzeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || 'Invalid request payload';
      res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: firstIssue,
        },
        code: 'VALIDATION_ERROR',
        message: firstIssue,
        retryable: false,
      });
      return;
    }

    const { context, submissions } = parsed.data;

    // Establish SSE channel
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const result = await runFullAnalysisPipeline(
        context,
        submissions as any,
        (stage, stageName, detail) => {
          sendEvent('progress', { stage, stageName, detail });
        }
      );

      res.locals.analysisRunId = result.id;
      sendEvent('complete', result);
      res.end();
    } catch (err: any) {
      console.error('[LotusLearn API] Analysis stream error:', err?.message || err);
      sendEvent('error', {
        code: err.code || 'PIPELINE_ERROR',
        message: err.message || 'Pipeline execution failed.',
        stage: err.stage,
        retryable: err.retryable ?? false,
      });
      res.end();
    }
  }

  /**
   * POST /api/intervention/adjust
   * Refines a specific intervention card (simplify / challenge / exit_ticket)
   */
  public async adjust(req: Request, res: Response): Promise<Response> {
    const parsed = InterventionAdjustSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: parsed.error.issues[0]?.message || 'Invalid intervention payload',
        },
      });
    }

    try {
      const { intervention, action } = parsed.data;
      const updated = await adjustIntervention(intervention as any, action);
      return res.json(updated);
    } catch (err: any) {
      console.error('[LotusLearn API] Intervention adjust error:', err?.message || err);
      return res.status(500).json({
        error: {
          code: 'ADJUSTMENT_FAILED',
          message: err.message || 'Failed to adjust intervention',
        },
      });
    }
  }

  /**
   * POST /api/verify
   * Standalone verification endpoint
   */
  public async verify(req: Request, res: Response): Promise<Response> {
    const parsed = VerifyRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: parsed.error.issues[0]?.message || 'Invalid verification request',
        },
      });
    }

    try {
      const {
        context,
        submissions,
        normalizedEvidence,
        observations,
        misconceptions,
        groups,
        interventions,
        nextLessonPlan,
        deterministicAudit: providedAudit,
      } = parsed.data;

      // Enforce Architectural Privacy Boundary:
      // Never allow unsanitized student submissions or raw PII (student names, emails, phone numbers,
      // unredacted text) to reach the downstream verifier model.
      // Any submission data accepted by this endpoint must pass through the canonical Privacy Gateway.
      const privacyGateway = getPrivacyGateway();
      const sanitizationResult = await privacyGateway.sanitizeBatch(submissions as any);
      const sanitizedSubmissions = sanitizationResult.sanitizedSubmissions;

      // Map raw student IDs to sanitized pseudonyms
      const rawToSanitizedIdMap = new Map<string, string>();
      submissions.forEach((rawSub: any, idx: number) => {
        if (sanitizedSubmissions[idx]) {
          rawToSanitizedIdMap.set(rawSub.studentId, sanitizedSubmissions[idx].studentId);
        }
      });

      // Construct normalized evidence strictly from sanitized submissions
      // If client supplied normalizedEvidence, sanitize its text and normalize its student IDs
      let norm: NormalizedSourceEvidence[];
      if (normalizedEvidence && normalizedEvidence.length > 0) {
        norm = await Promise.all(
          normalizedEvidence.map(async (n: any) => {
            const mappedId = rawToSanitizedIdMap.get(n.studentId) || n.studentId;
            const textRes = await privacyGateway.sanitizeText(n.extractedText);
            return {
              ...n,
              studentId: mappedId,
              extractedText: textRes.sanitizedText,
            };
          })
        );
      } else {
        norm = sanitizedSubmissions.map((s: any) => {
          const isImage = s.workType === 'handwritten_work' || Boolean(s.imageBase64);
          return {
            studentId: s.studentId,
            sourceType: isImage ? 'image_transcription' : 'typed',
            extractedText: s.studentText,
            confidenceOrStatus: isImage
              ? s.confidenceOrStatus === 'transcription_reviewed'
                ? 'transcription_reviewed'
                : 'transcription_unverified'
              : 'exact_source',
          };
        });
      }

      let deterministicAudit = providedAudit;
      if (!deterministicAudit && sanitizedSubmissions && observations && misconceptions && groups) {
        try {
          deterministicAudit = runDeterministicValidation({
            submissions: sanitizedSubmissions as any,
            normalizedEvidence: norm,
            observations: observations as any,
            clusters: misconceptions as any,
            groups,
          });
        } catch (detErr) {
          console.warn('[LotusLearn API] /verify auto-run deterministic audit notice:', detErr);
        }
      }

      const verified = await verifyAnalysisPipeline(
        context,
        sanitizedSubmissions as any,
        norm,
        observations as any,
        misconceptions as any,
        groups,
        interventions as any,
        nextLessonPlan as any,
        deterministicAudit
      );

      return res.json(verified);
    } catch (err: any) {
      console.error('[LotusLearn API] Verify endpoint error:', err?.message || err);
      return res.status(500).json({
        error: {
          code: 'VERIFICATION_FAILED',
          message: err.message || 'Verification audit failed',
        },
      });
    }
  }
}

export const analysisController = new AnalysisController();
