import crypto from "crypto";
function structuredRequestLogger(req, res, next) {
  const startTime = Date.now();
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  req.requestId = requestId;
  res.on("finish", () => {
    const durationMs = Date.now() - startTime;
    const route = req.baseUrl ? `${req.baseUrl}${req.path}` : req.path;
    if (route.startsWith("/@") || route.startsWith("/node_modules") || route.startsWith("/src")) {
      return;
    }
    const logEntry = {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      requestId,
      method: req.method,
      route,
      status: res.statusCode,
      durationMs,
      ...res.locals?.analysisRunId ? { analysisRunId: res.locals.analysisRunId } : {}
    };
    console.log(`[HTTP] ${JSON.stringify(logEntry)}`);
  });
  next();
}
export {
  structuredRequestLogger
};
