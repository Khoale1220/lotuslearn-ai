import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from './server/routes/api';
import { PRIMARY_GEMINI_MODEL } from './server/geminiClient';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Support base64 image uploads and rich JSON payloads
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // Mount server-side Gemini endpoints
  app.use('/api', apiRoutes);

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'LotusLearn AI',
      runtime: 'Google Cloud Node.js',
      primaryModel: PRIMARY_GEMINI_MODEL,
    });
  });

  const isProduction = process.env.NODE_ENV === 'production';

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
      `[LotusLearn AI] Server running on http://0.0.0.0:${PORT} (${
        isProduction ? 'production' : 'development'
      })`
    );
  });
}

startServer().catch((err) => {
  console.error('[LotusLearn AI] Fatal server startup error:', err);
  process.exit(1);
});
