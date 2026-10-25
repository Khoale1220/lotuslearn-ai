import { Request, Response, NextFunction } from 'express';

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
  maxStoreEntries?: number;
}

interface ClientRecord {
  count: number;
  resetTime: number;
}

const DEFAULT_MAX_STORE_ENTRIES = 10_000;
const rateLimitStore = new Map<string, ClientRecord>();

/**
 * Periodically or on-demand purges expired entries from the in-memory store
 * to prevent memory leaks over long container runtimes.
 */
export function cleanupExpiredEntries(currentTime: number = Date.now()): number {
  let purgedCount = 0;
  for (const [key, record] of rateLimitStore.entries()) {
    if (currentTime >= record.resetTime) {
      rateLimitStore.delete(key);
      purgedCount++;
    }
  }
  return purgedCount;
}

/**
 * Resets rate limit store (for automated test isolation).
 */
export function resetRateLimiterStore(): void {
  rateLimitStore.clear();
}

/**
 * Returns current store size (for tests and diagnostics).
 */
export function getRateLimiterStoreSize(): number {
  return rateLimitStore.size;
}

// Background cleanup timer: sweeps expired entries every 60 seconds
let cleanupTimer: NodeJS.Timeout | null = null;
if (typeof setInterval !== 'undefined') {
  cleanupTimer = setInterval(() => {
    cleanupExpiredEntries();
  }, 60_000);
  // Ensure background timer does not hold Node process open in test runners or CLI scripts
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }
}

/**
 * In-Memory Fixed-Window Rate Limiter Middleware.
 *
 * ALGORITHMIC SPECIFICATION & DEPLOYMENT BOUNDARIES:
 * 1. Algorithm: Fixed-window counter. A client's request count resets after `windowMs` from their first request.
 * 2. Scope: In-process and per-instance. Each Node.js server container maintains its own local memory map.
 * 3. Multi-Instance Horizon: In horizontal multi-replica deployments (e.g., auto-scaled Cloud Run),
 *    each instance throttles independently. Cluster-wide unified limits require an edge rate limiter
 *    (Google Cloud Armor) or centralized memory store (Google Cloud Memorystore / Redis).
 * 4. Client Identity: Relies on Express's trusted `req.ip` resolution (governed by `app.set('trust proxy', ...)`).
 *    Never manually parses arbitrary, spoofable `X-Forwarded-For` header values directly.
 * 5. Bounded Memory Lifecycle: Expired keys are evicted periodically and when the store reaches capacity.
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many analysis requests. Please wait a moment before trying again.',
    maxStoreEntries = DEFAULT_MAX_STORE_ENTRIES,
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Rely exclusively on Express's verified req.ip (governed by Express trust proxy configuration)
    // with socket remoteAddress fallback. Do NOT parse raw untrusted X-Forwarded-For strings.
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';

    const now = Date.now();
    let record = rateLimitStore.get(ip);

    if (!record || now >= record.resetTime) {
      // Memory bounding: if store exceeds capacity, sweep expired entries first
      if (rateLimitStore.size >= maxStoreEntries) {
        cleanupExpiredEntries(now);
        // If still at capacity after sweep, evict oldest entry to prevent unbounded growth
        if (rateLimitStore.size >= maxStoreEntries) {
          const firstKey = rateLimitStore.keys().next().value;
          if (firstKey) {
            rateLimitStore.delete(firstKey);
          }
        }
      }

      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      rateLimitStore.set(ip, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, maxRequests - record.count);
    const resetSeconds = Math.ceil(Math.max(0, record.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetSeconds);

    if (record.count > maxRequests) {
      res.setHeader('Retry-After', resetSeconds);
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message,
          retryable: false,
        },
        code: 'RATE_LIMIT_EXCEEDED',
        message,
        retryable: false,
      });
      return;
    }

    next();
  };
}

/**
 * Centralized inference rate limiter instance:
 * 20 requests per minute per IP for expensive inference endpoints.
 */
export const inferenceRateLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 20,
  message: 'Inference rate limit exceeded. Please wait a moment before requesting further analysis.',
});
