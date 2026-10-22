import { Router } from 'express';
import { analysisController } from '../controllers/analysisController';

const router = Router();

// GET /api/demo-data — Canonical reproducible classroom demonstration
router.get('/demo-data', (req, res) => analysisController.getDemoData(req, res));

// POST /api/analyze — Synchronous full-pipeline execution
router.post('/analyze', (req, res) => analysisController.analyze(req, res));

// POST /api/analyze-stream — Server-Sent Events live execution
router.post('/analyze-stream', (req, res) => analysisController.analyzeStream(req, res));

// POST /api/intervention/adjust — Dynamic scaffold adjustment
router.post('/intervention/adjust', (req, res) => analysisController.adjust(req, res));

// POST /api/verify — Adversarial verification audit
router.post('/verify', (req, res) => analysisController.verify(req, res));

export default router;
