import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface StructuredLogEntry {
  timestamp: string;
  requestId: string;
  method: string;
  route: string;
  status: number;
  durationMs: number;
  analysisRunId?: string;
}

/**
 * Structured HTTP Request Logger Middleware
 *
 * Guarantees:
 * - Emits machine-readable structured operational metadata
 * - Strictly NEVER logs student names, emails, phone numbers, worksheet text, or images
 * - Strictly NEVER logs API keys, cookies, or authorization tokens
 */
export function structuredRequestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  (req as any).requestId = requestId;

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const route = req.baseUrl ? `${req.baseUrl}${req.path}` : req.path;

    // Filter out static asset noise in development
    if (route.startsWith('/@') || route.startsWith('/node_modules') || route.startsWith('/src')) {
      return;
    }

    const logEntry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      requestId,
      method: req.method,
      route,
      status: res.statusCode,
      durationMs,
      ...(res.locals?.analysisRunId ? { analysisRunId: res.locals.analysisRunId } : {}),
    };

    // Format single-line JSON log entry for operational ingestion
    console.log(`[HTTP] ${JSON.stringify(logEntry)}`);
  });

  next();
}
