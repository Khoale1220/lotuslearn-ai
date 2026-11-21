class PipelineError extends Error {
  constructor(details) {
    super(`[${details.stage}] ${details.code}: ${details.message}`);
    this.name = "PipelineError";
    this.code = details.code;
    this.stage = details.stage;
    this.retryable = details.retryable;
    this.cause = details.cause;
    this.httpStatus = details.httpStatus;
    this.retryAfterMs = details.retryAfterMs;
    Object.setPrototypeOf(this, PipelineError.prototype);
  }
}
function classifyGeminiError(err, stage) {
  if (err instanceof PipelineError) return err;
  const msg = String(err?.message || err || "");
  const lower = msg.toLowerCase();
  let parsedErrorObj = null;
  try {
    const trimmed = msg.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      parsedErrorObj = JSON.parse(trimmed);
    }
  } catch {
  }
  const rawStatus = parsedErrorObj?.error?.status || parsedErrorObj?.status || err?.status || err?.statusCode || err?.httpStatus || err?.error?.status;
  const rawCode = parsedErrorObj?.error?.code || parsedErrorObj?.code || err?.code || err?.error?.code || err?.statusCode || err?.httpStatus;
  const statusStr = String(rawStatus || "").toLowerCase();
  const codeNum = typeof rawCode === "number" ? rawCode : parseInt(String(rawCode), 10);
  const detailedMessage = parsedErrorObj?.error?.message || parsedErrorObj?.message || msg;
  if (lower.includes("quota_exceeded") || lower.includes("daily usage exhausted") || lower.includes("daily quota") || lower.includes("quota exceeded") || lower.includes("quota") && lower.includes("exhausted") || lower.includes("generate_content_free_tier_requests")) {
    const limitMatch = msg.match(/limit:\s*([0-9]+)/i);
    const limitDetail = limitMatch ? ` (limit: ${limitMatch[1]})` : "";
    return new PipelineError({
      code: "QUOTA_EXHAUSTED",
      stage,
      message: `Gemini API quota exhausted${limitDetail}. Non-retryable on this model until quota reset. Details: ${detailedMessage}`,
      retryable: false,
      httpStatus: 429,
      cause: err
    });
  }
  if (codeNum === 429 || statusStr === "resource_exhausted" || lower.includes("too_many_requests") || lower.includes("rate_limit_exceeded") || lower.includes("rate limit") || lower.includes("resource_exhausted") || lower.includes("429") && !lower.includes("quota")) {
    return new PipelineError({
      code: "RATE_LIMIT_ERROR",
      stage,
      message: `Gemini API transient rate limit exceeded (HTTP 429): ${detailedMessage}`,
      retryable: true,
      httpStatus: 429,
      cause: err
    });
  }
  const isTransientCode = codeNum === 504 || codeNum === 503 || codeNum === 502 || codeNum === 500 || statusStr === "deadline_exceeded" || statusStr === "unavailable" || statusStr === "internal";
  const isTransientText = lower.includes("deadline expired") || lower.includes("deadline_exceeded") || lower.includes("deadline") || lower.includes("504") || lower.includes("503") || lower.includes("502") || lower.includes("gateway timeout") || lower.includes("service unavailable") || lower.includes("unavailable") || lower.includes("high demand") || lower.includes("overloaded") || lower.includes("econnreset") || lower.includes("etimedout") || lower.includes("timed out") || lower.includes("timeout") || lower.includes("abort") || lower.includes("network") || lower.includes("socket hang up") || lower.includes("fetch failed") || lower.includes("connection reset");
  if (isTransientCode || isTransientText) {
    const isServiceOverload = codeNum === 503 || statusStr === "unavailable" || lower.includes("503") || lower.includes("high demand") || lower.includes("overloaded") || lower.includes("service unavailable");
    const isTimeout = codeNum === 504 || statusStr === "deadline_exceeded" || lower.includes("deadline") || lower.includes("504") || lower.includes("timed out") || lower.includes("timeout") || lower.includes("etimedout");
    let errorLabel = "Transient network or request timeout error";
    if (isServiceOverload) {
      errorLabel = "Gemini API service overload (HTTP 503 / high demand)";
    } else if (isTimeout) {
      errorLabel = "Gemini API deadline exceeded / request timeout (HTTP 504)";
    }
    return new PipelineError({
      code: "TRANSIENT_NETWORK_ERROR",
      stage,
      message: `${errorLabel}: ${detailedMessage}`,
      retryable: true,
      httpStatus: isServiceOverload ? 503 : isTimeout ? 504 : codeNum || 504,
      cause: err
    });
  }
  return new PipelineError({
    code: "INVARIANT_FAILURE",
    stage,
    message: `Domain invariant or model pipeline failure: ${detailedMessage}`,
    retryable: false,
    cause: err
  });
}
function classifyPrivacyError(err, stage = "Privacy Gateway") {
  if (err instanceof PipelineError) return err;
  const msg = String(err?.message || err || "");
  const lower = msg.toLowerCase();
  if (lower.includes("quota") || lower.includes("resource_exhausted") || lower.includes("daily limit") || lower.includes("rate_limit_exceeded")) {
    return new PipelineError({
      code: "PRIVACY_QUOTA_EXHAUSTED",
      stage,
      message: `Sensitive Data Protection quota limit reached: ${msg}`,
      retryable: false,
      cause: err
    });
  }
  if (lower.includes("auth") || lower.includes("unauthorized") || lower.includes("unauthenticated") || lower.includes("permission_denied") || lower.includes("forbidden") || lower.includes("401") || lower.includes("403") || lower.includes("credentials")) {
    return new PipelineError({
      code: "PRIVACY_AUTH_ERROR",
      stage,
      message: `Sensitive Data Protection authentication or permission error: ${msg}`,
      retryable: false,
      cause: err
    });
  }
  const isTransient = lower.includes("timeout") || lower.includes("etimedout") || lower.includes("econnreset") || lower.includes("503") || lower.includes("502") || lower.includes("unavailable") || lower.includes("network");
  return new PipelineError({
    code: "PRIVACY_SCAN_FAILED",
    stage,
    message: `Sensitive Data Protection scan failed: ${msg}`,
    retryable: isTransient,
    cause: err
  });
}
export {
  PipelineError,
  classifyGeminiError,
  classifyPrivacyError
};
