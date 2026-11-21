const DEFAULT_MAX_STORE_ENTRIES = 1e4;
const rateLimitStore = /* @__PURE__ */ new Map();
function cleanupExpiredEntries(currentTime = Date.now()) {
  let purgedCount = 0;
  for (const [key, record] of rateLimitStore.entries()) {
    if (currentTime >= record.resetTime) {
      rateLimitStore.delete(key);
      purgedCount++;
    }
  }
  return purgedCount;
}
function resetRateLimiterStore() {
  rateLimitStore.clear();
}
function getRateLimiterStoreSize() {
  return rateLimitStore.size;
}
let cleanupTimer = null;
if (typeof setInterval !== "undefined") {
  cleanupTimer = setInterval(() => {
    cleanupExpiredEntries();
  }, 6e4);
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }
}
function createRateLimiter(options) {
  const {
    windowMs,
    maxRequests,
    message = "Too many analysis requests. Please wait a moment before trying again.",
    maxStoreEntries = DEFAULT_MAX_STORE_ENTRIES
  } = options;
  return (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const now = Date.now();
    let record = rateLimitStore.get(ip);
    if (!record || now >= record.resetTime) {
      if (rateLimitStore.size >= maxStoreEntries) {
        cleanupExpiredEntries(now);
        if (rateLimitStore.size >= maxStoreEntries) {
          const firstKey = rateLimitStore.keys().next().value;
          if (firstKey) {
            rateLimitStore.delete(firstKey);
          }
        }
      }
      record = {
        count: 1,
        resetTime: now + windowMs
      };
      rateLimitStore.set(ip, record);
    } else {
      record.count += 1;
    }
    const remaining = Math.max(0, maxRequests - record.count);
    const resetSeconds = Math.ceil(Math.max(0, record.resetTime - now) / 1e3);
    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", resetSeconds);
    if (record.count > maxRequests) {
      res.setHeader("Retry-After", resetSeconds);
      res.status(429).json({
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message,
          retryable: false
        },
        code: "RATE_LIMIT_EXCEEDED",
        message,
        retryable: false
      });
      return;
    }
    next();
  };
}
const inferenceRateLimiter = createRateLimiter({
  windowMs: 6e4,
  maxRequests: 20,
  message: "Inference rate limit exceeded. Please wait a moment before requesting further analysis."
});
export {
  cleanupExpiredEntries,
  createRateLimiter,
  getRateLimiterStoreSize,
  inferenceRateLimiter,
  resetRateLimiterStore
};
