import { GoogleGenAI } from "@google/genai";
import { classifyGeminiError, PipelineError } from "./errors/pipelineErrors";
const PRIMARY_GEMINI_MODEL = "gemini-3.8-flash";
const FALLBACK_GEMINI_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite"
];
const GEMINI_MODEL = PRIMARY_GEMINI_MODEL;
const STAGE_ROUTING_POLICIES = {
  observer: {
    stageKey: "observer",
    displayName: "Observer",
    primaryModel: "gemini-3.5-flash-lite",
    fallbackModels: ["gemini-3.1-flash-lite"],
    stageTimeoutMs: 25e3
  },
  diagnosis: {
    stageKey: "diagnosis",
    displayName: "Diagnosis",
    primaryModel: "gemini-3.8-flash",
    fallbackModels: ["gemini-3.6-flash"],
    emergencyFallbackModel: "gemini-3.5-flash-lite",
    stageTimeoutMs: 45e3
  },
  teaching_strategist: {
    stageKey: "teaching_strategist",
    displayName: "Teaching Strategist",
    primaryModel: "gemini-3.8-flash",
    fallbackModels: ["gemini-3.6-flash"],
    emergencyFallbackModel: "gemini-3.5-flash-lite",
    stageTimeoutMs: 45e3
  },
  semantic_verifier: {
    stageKey: "semantic_verifier",
    displayName: "Semantic Verifier",
    primaryModel: "gemini-3.6-flash",
    fallbackModels: ["gemini-3.8-flash"],
    emergencyFallbackModel: "gemini-3.5-flash-lite",
    stageTimeoutMs: 35e3
  }
};
const modelCooldownMap = /* @__PURE__ */ new Map();
function isModelInCooldown(model) {
  const entry = modelCooldownMap.get(model);
  if (!entry) return false;
  if (Date.now() > entry.until) {
    modelCooldownMap.delete(model);
    return false;
  }
  return true;
}
function getModelCooldown(model) {
  const entry = modelCooldownMap.get(model);
  if (!entry) return void 0;
  if (Date.now() > entry.until) {
    modelCooldownMap.delete(model);
    return void 0;
  }
  return entry;
}
function clearModelCooldowns() {
  modelCooldownMap.clear();
}
function extractRetryAfterMs(errorMsg) {
  if (!errorMsg) return null;
  const secMatch = errorMsg.match(/retry(?:[-_\s]+after|[-_\s]+in)?[:\s]+([0-9]+(?:\.[0-9]+)?)\s*s(?:ec)?/i);
  if (secMatch) {
    const sec = parseFloat(secMatch[1]);
    if (!isNaN(sec) && sec > 0) return Math.ceil(sec * 1e3);
  }
  const msMatch = errorMsg.match(/retry(?:[-_\s]+after|[-_\s]+in)?[:\s]+([0-9]+)\s*ms/i);
  if (msMatch) {
    const ms = parseInt(msMatch[1], 10);
    if (!isNaN(ms) && ms > 0) return ms;
  }
  return null;
}
function markModelCooldown(model, reason, customDurationMs, errorSnippet) {
  const existing = modelCooldownMap.get(model);
  const failureCount = (existing ? existing.failureCount : 0) + 1;
  let durationMs;
  if (customDurationMs !== void 0) {
    durationMs = customDurationMs;
  } else if (reason === "429_quota_exceeded") {
    durationMs = 24 * 60 * 60 * 1e3;
  } else if (reason === "429_rate_limit") {
    const retryAfter = extractRetryAfterMs(errorSnippet);
    if (retryAfter) {
      durationMs = retryAfter;
    } else {
      const base = Math.min(1e4 * Math.pow(2, failureCount - 1), 6e4);
      const jitter = Math.floor(Math.random() * 2e3);
      durationMs = base + jitter;
    }
  } else {
    const base = Math.min(12e3 * Math.pow(2, failureCount - 1), 6e4);
    const jitter = Math.floor(Math.random() * 2e3);
    durationMs = base + jitter;
  }
  modelCooldownMap.set(model, {
    until: Date.now() + durationMs,
    reason,
    failureCount,
    durationMs,
    errorSnippet: errorSnippet ? errorSnippet.slice(0, 200) : void 0
  });
  return durationMs;
}
let clientInstance = null;
function getGeminiClient() {
  if (!clientInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.log(
        "[LotusLearn AI] Notice: GEMINI_API_KEY is not set in environment. Demo fallback pipeline will be used."
      );
    }
    clientInstance = new GoogleGenAI({
      apiKey: apiKey || ""
    });
  }
  return clientInstance;
}
function setGeminiClient(client) {
  clientInstance = client;
}
function resetGeminiClient() {
  clientInstance = null;
}
function resolveStageRoutingPolicy(stageName, stageKey) {
  if (stageKey && STAGE_ROUTING_POLICIES[stageKey]) {
    return STAGE_ROUTING_POLICIES[stageKey];
  }
  const s = (stageName || "").toLowerCase();
  if (s.includes("obs")) return STAGE_ROUTING_POLICIES.observer;
  if (s.includes("diag")) return STAGE_ROUTING_POLICIES.diagnosis;
  if (s.includes("strat")) return STAGE_ROUTING_POLICIES.teaching_strategist;
  if (s.includes("verif")) return STAGE_ROUTING_POLICIES.semantic_verifier;
  return {
    stageKey: "diagnosis",
    displayName: stageName || "AI Stage",
    primaryModel: "gemini-3.8-flash",
    fallbackModels: ["gemini-3.6-flash"],
    emergencyFallbackModel: "gemini-3.5-flash-lite",
    stageTimeoutMs: 35e3
  };
}
async function generateContentWithRetry(params) {
  const result = await generateContentDetailed(params);
  return result.text;
}
async function generateContentDetailed(params) {
  const ai = getGeminiClient();
  const stage = params.stageName || "ai_stage";
  const startTime = Date.now();
  const policy = resolveStageRoutingPolicy(params.stageName, params.stageKey);
  const stageTimeoutMs = params.timeoutMs || policy.stageTimeoutMs;
  const initialRequestedModel = policy.primaryModel;
  const rawCandidates = [
    policy.primaryModel,
    ...policy.fallbackModels,
    ...policy.emergencyFallbackModel ? [policy.emergencyFallbackModel] : []
  ];
  const uniqueCandidates = Array.from(new Set(rawCandidates));
  const healthyCandidates = uniqueCandidates.filter((m) => !isModelInCooldown(m));
  const coolingCandidates = uniqueCandidates.filter((m) => isModelInCooldown(m));
  const candidateList = healthyCandidates.length > 0 ? healthyCandidates : [...coolingCandidates].sort((a, b) => {
    const aEntry = modelCooldownMap.get(a);
    const bEntry = modelCooldownMap.get(b);
    const aQuota = aEntry?.reason === "429_quota_exceeded" ? 1 : 0;
    const bQuota = bEntry?.reason === "429_quota_exceeded" ? 1 : 0;
    if (aQuota !== bQuota) return aQuota - bQuota;
    return (aEntry?.until || 0) - (bEntry?.until || 0);
  });
  let lastError = null;
  let fallbackReason;
  let lastErrorCode;
  let lastCooldownApplied;
  for (let cIdx = 0; cIdx < candidateList.length; cIdx++) {
    const modelName = candidateList[cIdx];
    if (modelName !== initialRequestedModel && !fallbackReason) {
      const prevCooldown = modelCooldownMap.get(initialRequestedModel);
      fallbackReason = prevCooldown ? `Primary model ${initialRequestedModel} unavailable (${prevCooldown.reason}), switched to ${modelName}` : `Switched from ${initialRequestedModel} to ${modelName}`;
    }
    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const attemptStart = Date.now();
      const abortController = new AbortController();
      let timeoutHandle;
      try {
        const timeoutPromise = new Promise((_, reject) => {
          timeoutHandle = setTimeout(() => {
            abortController.abort();
            reject(
              new Error(
                `Model ${modelName} timed out after ${stageTimeoutMs}ms in stage "${stage}" (attempt ${attempt})`
              )
            );
          }, stageTimeoutMs);
        });
        const mergedConfig = {
          ...params.config,
          httpOptions: {
            timeout: stageTimeoutMs,
            ...params.config?.httpOptions || {}
          },
          abortSignal: abortController.signal
        };
        const callPromise = ai.models.generateContent({
          model: modelName,
          contents: params.contents,
          config: mergedConfig
        });
        let response;
        try {
          response = await Promise.race([callPromise, timeoutPromise]);
        } finally {
          if (timeoutHandle) clearTimeout(timeoutHandle);
        }
        const text = response?.text?.trim();
        const duration = Date.now() - attemptStart;
        if (text) {
          const telemetry = {
            stage,
            requestedModel: initialRequestedModel,
            actualModel: modelName,
            fallbackReason,
            latencyMs: Date.now() - startTime,
            errorCode: lastErrorCode,
            cooldownApplied: lastCooldownApplied
          };
          console.log(
            `[LotusLearn Telemetry] stage="${telemetry.stage}" requestedModel=${telemetry.requestedModel} actualModel=${telemetry.actualModel} latencyMs=${telemetry.latencyMs}${telemetry.fallbackReason ? ` fallbackReason="${telemetry.fallbackReason}"` : ""}`
          );
          return {
            text,
            modelUsed: modelName,
            durationMs: Date.now() - startTime,
            telemetry
          };
        }
      } catch (err) {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        const classified = classifyGeminiError(err, stage);
        lastError = classified;
        lastErrorCode = classified.code;
        if (classified.code === "QUOTA_EXHAUSTED") {
          const cdMs = markModelCooldown(modelName, "429_quota_exceeded", void 0, err.message);
          lastCooldownApplied = { model: modelName, durationMs: cdMs, reason: "429_quota_exceeded" };
          fallbackReason = `HTTP 429 Daily Quota Exhausted on ${modelName}, immediately falling back`;
          console.log(
            `[LotusLearn AI] Model ${modelName} quota exhausted for ${stage}. Applying 24h cooldown, switching to next candidate...`
          );
          break;
        }
        if (!classified.retryable) {
          console.log(`[LotusLearn AI] Non-retryable error [${classified.code}] encountered in ${stage}. Halting.`);
          throw classified;
        }
        if (classified.code === "TRANSIENT_NETWORK_ERROR") {
          const errLower = String(err?.message || "").toLowerCase();
          const isTimeout = errLower.includes("time") || errLower.includes("deadline") || errLower.includes("504");
          const reason = isTimeout ? "timeout" : "503_service_overload";
          const cdMs = markModelCooldown(modelName, reason, void 0, err.message);
          lastCooldownApplied = { model: modelName, durationMs: cdMs, reason };
          fallbackReason = `${isTimeout ? "Timeout / Deadline Exceeded" : "HTTP 503 Service Overload"} on ${modelName}, immediately falling back`;
          console.log(
            `[LotusLearn AI] Stage "${stage}" on ${modelName} encountered ${reason}. Applying cooldown (${cdMs}ms) and switching immediately to next candidate...`
          );
          break;
        }
        if (attempt < maxAttempts) {
          const retryAfterMs = extractRetryAfterMs(err.message);
          const backoffDelay = retryAfterMs || Math.min(1e3 * Math.pow(2, attempt - 1), 3e3) + Math.floor(Math.random() * 250);
          console.log(
            `[LotusLearn AI] Applying rate limit backoff (${backoffDelay}ms) for ${modelName} before attempt ${attempt + 1}...`
          );
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        } else {
          const cdMs = markModelCooldown(modelName, "429_rate_limit", void 0, err.message);
          lastCooldownApplied = { model: modelName, durationMs: cdMs, reason: "429_rate_limit" };
          fallbackReason = `HTTP 429 Rate Limit exceeded on ${modelName} after ${maxAttempts} attempts`;
          break;
        }
      }
    }
  }
  const failureTelemetry = {
    stage,
    requestedModel: initialRequestedModel,
    actualModel: "none",
    fallbackReason,
    latencyMs: Date.now() - startTime,
    errorCode: lastErrorCode || "TRANSIENT_NETWORK_ERROR",
    cooldownApplied: lastCooldownApplied
  };
  console.log(
    `[LotusLearn Telemetry] stage="${failureTelemetry.stage}" requestedModel=${failureTelemetry.requestedModel} actualModel=none latencyMs=${failureTelemetry.latencyMs} errorCode=${failureTelemetry.errorCode}`
  );
  throw lastError || new PipelineError({
    code: "TRANSIENT_NETWORK_ERROR",
    stage,
    message: `Stage "${stage}" failed across all stage-routed Gemini model candidates.`,
    retryable: true
  });
}
export {
  FALLBACK_GEMINI_MODELS,
  GEMINI_MODEL,
  PRIMARY_GEMINI_MODEL,
  STAGE_ROUTING_POLICIES,
  clearModelCooldowns,
  extractRetryAfterMs,
  generateContentDetailed,
  generateContentWithRetry,
  getGeminiClient,
  getModelCooldown,
  isModelInCooldown,
  markModelCooldown,
  modelCooldownMap,
  resetGeminiClient,
  resolveStageRoutingPolicy,
  setGeminiClient
};
