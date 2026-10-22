import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from './server/routes/api';
import { PRIMARY_GEMINI_MODEL } from './server/geminiClient';
import { structuredRequestLogger } from './server/middleware/logger';
import { getAppConfig } from './server/config';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  // Validate typed configuration at startup (fails fast if invalid)
  const config = getAppConfig();
  const app = express();
  const PORT = config.port;

  // Structured HTTP operational logging (zero PII)
  app.use(structuredRequestLogger);

  // Support base64 image uploads and rich JSON payloads
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // Mount server-side Gemini endpoints
  app.use('/api', apiRoutes);

  // Health check with active privacy provider disclosure
  app.get('/health', (_req, res) => {
    const currentConfig = getAppConfig();
    res.json({
      status: 'ok',
      service: 'LotusLearn AI',
      privacyProvider: currentConfig.privacyProvider,
      privacyModeLabel:
        currentConfig.privacyProvider === 'google'
          ? 'Google Cloud SDP'
          : 'Demo privacy mode',
      runtime: 'Google Cloud Node.js',
      primaryModel: PRIMARY_GEMINI_MODEL,
    });
  });

  const isProduction = config.nodeEnv === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `[LotusLearn AI] Server running on http://0.0.0.0:${PORT} (env=${config.nodeEnv}, privacyProvider=${config.privacyProvider})`
    );
  });
}

startServer().catch((err) => {
  console.error('[LotusLearn AI] Fatal server startup error:', err);
  process.exit(1);
});
