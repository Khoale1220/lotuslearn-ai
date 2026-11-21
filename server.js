import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import apiRoutes from "./server/routes/api";
import { structuredRequestLogger } from "./server/middleware/logger";
import { getAppConfig } from "./server/config";
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
async function startServer() {
  const config = getAppConfig();
  const app = express();
  const PORT = config.port;
  app.set("trust proxy", 1);
  app.use(structuredRequestLogger);
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));
  app.use("/api", apiRoutes);
  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.get("/health", (_req, res) => {
    const currentConfig = getAppConfig();
    res.json({
      status: "ok",
      service: "LotusLearn AI",
      environment: currentConfig.nodeEnv,
      privacyProvider: currentConfig.privacyProvider
    });
  });
  const isProduction = config.nodeEnv === "production";
  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `[LotusLearn AI] Server running on http://0.0.0.0:${PORT} (env=${config.nodeEnv}, privacyProvider=${config.privacyProvider})`
    );
  });
}
startServer().catch((err) => {
  console.error("[LotusLearn AI] Fatal server startup error:", err);
  process.exit(1);
});
