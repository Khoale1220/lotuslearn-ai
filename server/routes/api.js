import { Router } from "express";
import { analysisController } from "../controllers/analysisController.js";
import { inferenceRateLimiter } from "../middleware/rateLimiter.js";
const router = Router();
router.get("/demo-data", (req, res) => analysisController.getDemoData(req, res));
router.post("/analyze", inferenceRateLimiter, (req, res) => analysisController.analyze(req, res));
router.post("/analyze-stream", inferenceRateLimiter, (req, res) => analysisController.analyzeStream(req, res));
router.post("/intervention/adjust", inferenceRateLimiter, (req, res) => analysisController.adjust(req, res));
router.post("/verify", inferenceRateLimiter, (req, res) => analysisController.verify(req, res));
var api_default = router;
export {
  api_default as default
};
