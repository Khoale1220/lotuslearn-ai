import {
  AnalyzeRequestSchema,
  InterventionAdjustSchema,
  VerifyRequestSchema
} from "../schemas/apiSchemas.js";
import { runFullAnalysisPipeline } from "../services/pipelineCoordinator.js";
import { adjustIntervention } from "../services/strategyService.js";
import { verifyAnalysisPipeline } from "../services/verifierService.js";
import { runDeterministicValidation } from "../services/deterministicValidator.js";
import { DEMO_CONTEXT, DEMO_SUBMISSIONS } from "../../src/data/demoClassroom.js";
import { getPrivacyGateway } from "../services/privacyGateway.js";
class AnalysisController {
  /**
   * GET /api/demo-data
   * Returns canonical demo dataset for reproducible exploration
   */
  getDemoData(_req, res) {
    res.json({
      context: DEMO_CONTEXT,
      submissions: DEMO_SUBMISSIONS
    });
  }
  /**
   * POST /api/analyze
   * Standard synchronous analysis execution
   */
  async analyze(req, res) {
    const parsed = AnalyzeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || "Invalid request payload";
      return res.status(400).json({
        error: {
          code: "INVALID_REQUEST",
          message: firstIssue,
          details: parsed.error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message
          }))
        },
        code: "VALIDATION_ERROR",
        message: firstIssue,
        retryable: false
      });
    }
    try {
      const { context, submissions } = parsed.data;
      const result = await runFullAnalysisPipeline(context, submissions);
      res.locals.analysisRunId = result.id;
      return res.json(result);
    } catch (err) {
      console.error("[LotusLearn API] Analysis pipeline error:", err?.message || err);
      const code = err.code || "PIPELINE_ERROR";
      const message = err.message || "An error occurred during multi-stage analysis.";
      const status = err.httpStatus || 500;
      return res.status(status).json({
        error: {
          code,
          message,
          stage: err.stage,
          retryable: err.retryable ?? false
        },
        code,
        message,
        stage: err.stage,
        retryable: err.retryable ?? false
      });
    }
  }
  /**
   * POST /api/analyze-stream
   * Live streaming execution with Server-Sent Events (SSE)
   */
  async analyzeStream(req, res) {
    const parsed = AnalyzeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || "Invalid request payload";
      res.status(400).json({
        error: {
          code: "INVALID_REQUEST",
          message: firstIssue
        },
        code: "VALIDATION_ERROR",
        message: firstIssue,
        retryable: false
      });
      return;
    }
    const { context, submissions } = parsed.data;
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    const sendEvent = (event, data) => {
      res.write(`event: ${event}
data: ${JSON.stringify(data)}

`);
    };
    try {
      const result = await runFullAnalysisPipeline(
        context,
        submissions,
        (stage, stageName, detail) => {
          sendEvent("progress", { stage, stageName, detail });
        }
      );
      res.locals.analysisRunId = result.id;
      sendEvent("complete", result);
      res.end();
    } catch (err) {
      console.error("[LotusLearn API] Analysis stream error:", err?.message || err);
      sendEvent("error", {
        code: err.code || "PIPELINE_ERROR",
        message: err.message || "Pipeline execution failed.",
        stage: err.stage,
        retryable: err.retryable ?? false
      });
      res.end();
    }
  }
  /**
   * POST /api/intervention/adjust
   * Refines a specific intervention card (simplify / challenge / exit_ticket)
   */
  async adjust(req, res) {
    const parsed = InterventionAdjustSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: "INVALID_REQUEST",
          message: parsed.error.issues[0]?.message || "Invalid intervention payload"
        }
      });
    }
    try {
      const { intervention, action } = parsed.data;
      const updated = await adjustIntervention(intervention, action);
      return res.json(updated);
    } catch (err) {
      console.error("[LotusLearn API] Intervention adjust error:", err?.message || err);
      return res.status(500).json({
        error: {
          code: "ADJUSTMENT_FAILED",
          message: err.message || "Failed to adjust intervention"
        }
      });
    }
  }
  /**
   * POST /api/verify
   * Standalone verification endpoint
   */
  async verify(req, res) {
    const parsed = VerifyRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: "INVALID_REQUEST",
          message: parsed.error.issues[0]?.message || "Invalid verification request"
        }
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
        deterministicAudit: providedAudit
      } = parsed.data;
      const privacyGateway = getPrivacyGateway();
      const sanitizationResult = await privacyGateway.sanitizeBatch(submissions);
      const sanitizedSubmissions = sanitizationResult.sanitizedSubmissions;
      const rawToSanitizedIdMap = /* @__PURE__ */ new Map();
      submissions.forEach((rawSub, idx) => {
        if (sanitizedSubmissions[idx]) {
          rawToSanitizedIdMap.set(rawSub.studentId, sanitizedSubmissions[idx].studentId);
        }
      });
      let norm;
      if (normalizedEvidence && normalizedEvidence.length > 0) {
        norm = await Promise.all(
          normalizedEvidence.map(async (n) => {
            const mappedId = rawToSanitizedIdMap.get(n.studentId) || n.studentId;
            const textRes = await privacyGateway.sanitizeText(n.extractedText);
            return {
              ...n,
              studentId: mappedId,
              extractedText: textRes.sanitizedText
            };
          })
        );
      } else {
        norm = sanitizedSubmissions.map((s) => {
          const isImage = s.workType === "handwritten_work" || Boolean(s.imageBase64);
          return {
            studentId: s.studentId,
            sourceType: isImage ? "image_transcription" : "typed",
            extractedText: s.studentText,
            confidenceOrStatus: isImage ? s.confidenceOrStatus === "transcription_reviewed" ? "transcription_reviewed" : "transcription_unverified" : "exact_source"
          };
        });
      }
      let deterministicAudit = providedAudit;
      if (!deterministicAudit && sanitizedSubmissions && observations && misconceptions && groups) {
        try {
          deterministicAudit = runDeterministicValidation({
            submissions: sanitizedSubmissions,
            normalizedEvidence: norm,
            observations,
            clusters: misconceptions,
            groups
          });
        } catch (detErr) {
          console.warn("[LotusLearn API] /verify auto-run deterministic audit notice:", detErr);
        }
      }
      const verified = await verifyAnalysisPipeline(
        context,
        sanitizedSubmissions,
        norm,
        observations,
        misconceptions,
        groups,
        interventions,
        nextLessonPlan,
        deterministicAudit
      );
      return res.json(verified);
    } catch (err) {
      console.error("[LotusLearn API] Verify endpoint error:", err?.message || err);
      return res.status(500).json({
        error: {
          code: "VERIFICATION_FAILED",
          message: err.message || "Verification audit failed"
        }
      });
    }
  }
}
const analysisController = new AnalysisController();
export {
  AnalysisController,
  analysisController
};
