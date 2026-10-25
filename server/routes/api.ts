import { Router } from 'express';
import { analysisController } from '../controllers/analysisController';
import { inferenceRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// GET /api/demo-data — Canonical reproducible classroom demonstration (no rate limit needed)
router.get('/demo-data', (req, res) => analysisController.getDemoData(req, res));

// POST /api/analyze — Synchronous full-pipeline execution (protected by rate limiter)
router.post('/analyze', inferenceRateLimiter, (req, res) => analysisController.analyze(req, res));

// POST /api/analyze-stream — Server-Sent Events live execution (protected by rate limiter)
router.post('/analyze-stream', inferenceRateLimiter, (req, res) => analysisController.analyzeStream(req, res));

// POST /api/intervention/adjust — Dynamic scaffold adjustment (protected by rate limiter)
router.post('/intervention/adjust', inferenceRateLimiter, (req, res) => analysisController.adjust(req, res));

// POST /api/verify — Adversarial verification audit (protected by rate limiter)
router.post('/verify', inferenceRateLimiter, (req, res) => analysisController.verify(req, res));

export default router;
