export type PipelineErrorCode =
  | 'NORMALIZATION_ERROR'
  | 'OBSERVER_IDENTITY_ERROR'
  | 'OBSERVER_SCHEMA_ERROR'
  | 'DIAGNOSIS_SCHEMA_ERROR'
  | 'DIAGNOSIS_DOMAIN_ERROR'
  | 'STRATEGY_SCHEMA_ERROR'
  | 'STRATEGY_DOMAIN_ERROR'
  | 'VERIFIER_SCHEMA_ERROR'
  | 'VERIFIER_CLAIM_ERROR'
  | 'INVARIANT_FAILURE'
  | 'RATE_LIMIT_ERROR'
  | 'QUOTA_EXHAUSTED'
  | 'TRANSIENT_NETWORK_ERROR'
  | 'PRIVACY_SCAN_FAILED'
  | 'PRIVACY_AUTH_ERROR'
  | 'PRIVACY_QUOTA_EXHAUSTED';

export interface PipelineErrorDetails {
  code: PipelineErrorCode;
  stage: string;
  message: string;
  retryable: boolean;
  cause?: unknown;
  httpStatus?: number;
  retryAfterMs?: number;
}

export class PipelineError extends Error {
  public readonly code: PipelineErrorCode;
  public readonly stage: string;
  public readonly retryable: boolean;
  public readonly cause?: unknown;
  public readonly httpStatus?: number;
  public readonly retryAfterMs?: number;

  constructor(details: PipelineErrorDetails) {
    super(`[${details.stage}] ${details.code}: ${details.message}`);
    this.name = 'PipelineError';
    this.code = details.code;
    this.stage = details.stage;
    this.retryable = details.retryable;
    this.cause = details.cause;
    this.httpStatus = details.httpStatus;
    this.retryAfterMs = details.retryAfterMs;
    Object.setPrototypeOf(this, PipelineError.prototype);
  }
}

/**
 * P2.1 Semantic Error & Retry Classification
 * Strictly distinguishes HTTP 503 service overload from HTTP 429 rate & quota exhaustion:
 * - 429 Quota Exhausted (quota_exceeded, daily limit): NON-RETRYABLE on that model, long cooldown
 * - 429 Rate Limit (too_many_requests, concurrency): RETRYABLE with bounded exponential backoff & Retry-After
 * - 503 Service Overload / High Demand: RETRYABLE with immediate fallback to next candidate model
 * - Transient Network / Timeout: RETRYABLE
 * - Domain Invariant Failure: NON-RETRYABLE
 */
export function classifyGeminiError(err: unknown, stage: string): PipelineError {
  if (err instanceof PipelineError) return err;

  const msg = String((err as any)?.message || err || '');
  const lower = msg.toLowerCase();
  const status = (err as any)?.status || (err as any)?.statusCode || (err as any)?.httpStatus;

  // 1. Quota Exhaustion / Daily Limit (HTTP 429 - Non-retryable on this model)
  if (
    lower.includes('quota_exceeded') ||
    lower.includes('daily usage exhausted') ||
    lower.includes('daily quota') ||
    lower.includes('quota exceeded') ||
    (lower.includes('quota') && lower.includes('exhausted')) ||
    lower.includes('generate_content_free_tier_requests')
  ) {
    const limitMatch = msg.match(/limit:\s*([0-9]+)/i);
    const limitDetail = limitMatch ? ` (limit: ${limitMatch[1]})` : '';
    return new PipelineError({
      code: 'QUOTA_EXHAUSTED',
      stage,
      message: `Gemini API quota exhausted${limitDetail}. Non-retryable on this model until quota reset. Details: ${msg}`,
      retryable: false,
      httpStatus: 429,
      cause: err,
    });
  }

  // 2. Transient Rate Limit (HTTP 429 Too Many Requests / Resource Exhausted transient without quota)
  if (
    status === 429 ||
    lower.includes('too_many_requests') ||
    lower.includes('rate_limit_exceeded') ||
    lower.includes('rate limit') ||
    lower.includes('429') ||
    lower.includes('resource_exhausted')
  ) {
    return new PipelineError({
      code: 'RATE_LIMIT_ERROR',
      stage,
      message: `Gemini API transient rate limit exceeded (HTTP 429): ${msg}`,
      retryable: true,
      httpStatus: 429,
      cause: err,
    });
  }

  // 3. Service Overload (HTTP 503) & Transient Network Errors
  if (
    status === 503 ||
    lower.includes('503') ||
    lower.includes('service unavailable') ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('econnreset') ||
    lower.includes('etimedout') ||
    lower.includes('timed out') ||
    lower.includes('timeout') ||
    lower.includes('abort') ||
    lower.includes('network')
  ) {
    const isServiceOverload =
      status === 503 ||
      lower.includes('503') ||
      lower.includes('high demand') ||
      lower.includes('overloaded') ||
      lower.includes('service unavailable') ||
      lower.includes('unavailable');

    return new PipelineError({
      code: 'TRANSIENT_NETWORK_ERROR',
      stage,
      message: isServiceOverload
        ? `Gemini API service overload (HTTP 503 / high demand): ${msg}`
        : `Transient network or request timeout error: ${msg}`,
      retryable: true,
      httpStatus: isServiceOverload ? 503 : (status || 504),
      cause: err,
    });
  }

  // 4. Domain / Invariant Failure (Non-retryable)
  return new PipelineError({
    code: 'INVARIANT_FAILURE',
    stage,
    message: `Domain invariant or model pipeline failure: ${msg}`,
    retryable: false,
    cause: err,
  });
}

/**
 * P4.0 Sensitive Data Protection & Privacy Error Classifier
 * Fail-Closed: Privacy errors strictly abort downstream AI reasoning.
 * Differentiates auth errors, quota exhaustion, and transient failures.
 */
export function classifyPrivacyError(err: unknown, stage = 'Privacy Gateway'): PipelineError {
  if (err instanceof PipelineError) return err;

  const msg = String((err as any)?.message || err || '');
  const lower = msg.toLowerCase();

  // 1. Quota exhaustion in SDP / DLP
  if (
    lower.includes('quota') ||
    lower.includes('resource_exhausted') ||
    lower.includes('daily limit') ||
    lower.includes('rate_limit_exceeded')
  ) {
    return new PipelineError({
      code: 'PRIVACY_QUOTA_EXHAUSTED',
      stage,
      message: `Sensitive Data Protection quota limit reached: ${msg}`,
      retryable: false,
      cause: err,
    });
  }

  // 2. Authentication / IAM permission failure
  if (
    lower.includes('auth') ||
    lower.includes('unauthorized') ||
    lower.includes('unauthenticated') ||
    lower.includes('permission_denied') ||
    lower.includes('forbidden') ||
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('credentials')
  ) {
    return new PipelineError({
      code: 'PRIVACY_AUTH_ERROR',
      stage,
      message: `Sensitive Data Protection authentication or permission error: ${msg}`,
      retryable: false,
      cause: err,
    });
  }

  // 3. Transient network or provider unavailable
  const isTransient =
    lower.includes('timeout') ||
    lower.includes('etimedout') ||
    lower.includes('econnreset') ||
    lower.includes('503') ||
    lower.includes('502') ||
    lower.includes('unavailable') ||
    lower.includes('network');

  return new PipelineError({
    code: 'PRIVACY_SCAN_FAILED',
    stage,
    message: `Sensitive Data Protection scan failed: ${msg}`,
    retryable: isTransient,
    cause: err,
  });
}

