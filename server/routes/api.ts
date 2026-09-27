import { Router, Request, Response } from 'express';
import { DEMO_CONTEXT, DEMO_SUBMISSIONS } from '../../src/data/demoClassroom';
import { runFullAnalysisPipeline } from '../services/pipelineCoordinator';
import { adjustIntervention } from '../services/strategyService';
import { verifyAnalysisPipeline } from '../services/verifierService';

const router = Router();

// GET /api/demo-data
router.get('/demo-data', (_req: Request, res: Response) => {
  res.json({
    context: DEMO_CONTEXT,
    submissions: DEMO_SUBMISSIONS,
  });
});

// POST /api/analyze (Standard JSON request)
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { context, submissions } = req.body;
    if (!context || !submissions || !Array.isArray(submissions) || submissions.length === 0) {
      return res.status(400).json({
        error: 'Missing learning context or student submissions.',
      });
    }

    const result = await runFullAnalysisPipeline(context, submissions);
    return res.json(result);
  } catch (err: any) {
    console.error('[LotusLearn AI API] Error in /analyze:', err);
    return res.status(500).json({
      error: err.message || 'An error occurred during multi-stage analysis.',
    });
  }
});

// POST /api/analyze-stream (Server-Sent Events for live pipeline visualizer)
router.post('/analyze-stream', async (req: Request, res: Response) => {
  const { context, submissions } = req.body;
  if (!context || !submissions || !Array.isArray(submissions) || submissions.length === 0) {
    return res.status(400).json({
      error: 'Missing learning context or student submissions.',
    });
  }

  // Set SSE headers
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
      submissions,
      (stage, stageName, detail) => {
        sendEvent('progress', { stage, stageName, detail });
      }
    );

    sendEvent('complete', result);
    res.end();
  } catch (err: any) {
    console.error('[LotusLearn AI API] Error in /analyze-stream:', err);
    sendEvent('error', {
      message: err.message || 'Pipeline execution failed.',
    });
    res.end();
  }
});

// POST /api/intervention/adjust
router.post('/intervention/adjust', async (req: Request, res: Response) => {
  try {
    const { intervention, action } = req.body;
    if (!intervention || !action) {
      return res.status(400).json({ error: 'Missing intervention or action parameter.' });
    }

    const updated = await adjustIntervention(intervention, action);
    return res.json(updated);
  } catch (err: any) {
    console.error('[LotusLearn AI API] Error in /intervention/adjust:', err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/verify
router.post('/verify', async (req: Request, res: Response) => {
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
    } = req.body;
    const norm =
      normalizedEvidence ||
      (submissions || []).map((s: any) => ({
        studentId: s.studentId,
        sourceType: s.workType === 'handwritten_work' || s.imageBase64 ? 'image_transcription' : 'typed',
        extractedText: s.studentText,
        confidenceOrStatus: 'exact_source',
      }));
    const verified = await verifyAnalysisPipeline(
      context,
      submissions,
      norm,
      observations,
      misconceptions,
      groups,
      interventions,
      nextLessonPlan
    );
    return res.json(verified);
  } catch (err: any) {
    console.error('[LotusLearn AI API] Error in /verify:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
