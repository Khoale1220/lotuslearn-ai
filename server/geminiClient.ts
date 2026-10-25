import { GoogleGenAI } from '@google/genai';
import { classifyGeminiError, PipelineError } from './errors/pipelineErrors';

export const PRIMARY_GEMINI_MODEL = 'gemini-3.8-flash';
export const FALLBACK_GEMINI_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
];
export const GEMINI_MODEL = PRIMARY_GEMINI_MODEL;

export type PipelineStageKey =
  | 'observer'
  | 'diagnosis'
  | 'teaching_strategist'
  | 'semantic_verifier';

export interface StageRoutingPolicy {
  stageKey: PipelineStageKey;
  displayName: string;
  primaryModel: string;
  fallbackModels: string[];
  emergencyFallbackModel?: string;
  stageTimeoutMs: number;
}

/**
 * Stage-Aware Model Routing Table:
 * Observer: primary gemini-3.5-flash-lite, fallback gemini-3.1-flash-lite (~20s)
 * Diagnosis: primary gemini-3.8-flash, fallback gemini-3.6-flash, emergency gemini-3.5-flash-lite (~35s)
 * Teaching Strategist: primary gemini-3.8-flash, fallback gemini-3.6-flash, emergency gemini-3.5-flash-lite (~35s)
 * Semantic Verifier: primary gemini-3.6-flash, fallback gemini-3.8-flash, emergency gemini-3.5-flash-lite (~25s)
 */
export const STAGE_ROUTING_POLICIES: Record<PipelineStageKey, StageRoutingPolicy> = {
  observer: {
    stageKey: 'observer',
    displayName: 'Observer',
    primaryModel: 'gemini-3.5-flash-lite',
    fallbackModels: ['gemini-3.1-flash-lite'],
    stageTimeoutMs: 25_000,
  },
  diagnosis: {
    stageKey: 'diagnosis',
    displayName: 'Diagnosis',
    primaryModel: 'gemini-3.8-flash',
    fallbackModels: ['gemini-3.6-flash'],
    emergencyFallbackModel: 'gemini-3.5-flash-lite',
    stageTimeoutMs: 45_000,
  },
  teaching_strategist: {
    stageKey: 'teaching_strategist',
    displayName: 'Teaching Strategist',
    primaryModel: 'gemini-3.8-flash',
    fallbackModels: ['gemini-3.6-flash'],
    emergencyFallbackModel: 'gemini-3.5-flash-lite',
    stageTimeoutMs: 45_000,
  },
  semantic_verifier: {
    stageKey: 'semantic_verifier',
    displayName: 'Semantic Verifier',
    primaryModel: 'gemini-3.6-flash',
    fallbackModels: ['gemini-3.8-flash'],
    emergencyFallbackModel: 'gemini-3.5-flash-lite',
    stageTimeoutMs: 35_000,
  },
};

export type CooldownReason =
  | '503_service_overload'
  | '429_rate_limit'
  | '429_quota_exceeded'
  | 'transient_network'
  | 'timeout';

export interface ModelCooldownEntry {
  until: number;
  reason: CooldownReason;
  failureCount: number;
  durationMs: number;
  errorSnippet?: string;
}

export const modelCooldownMap = new Map<string, ModelCooldownEntry>();

export function isModelInCooldown(model: string): boolean {
  const entry = modelCooldownMap.get(model);
  if (!entry) return false;
  if (Date.now() > entry.until) {
    modelCooldownMap.delete(model);
    return false;
  }
  return true;
}

export function getModelCooldown(model: string): ModelCooldownEntry | undefined {
  const entry = modelCooldownMap.get(model);
  if (!entry) return undefined;
  if (Date.now() > entry.until) {
    modelCooldownMap.delete(model);
    return undefined;
  }
  return entry;
}

export function clearModelCooldowns(): void {
  modelCooldownMap.clear();
}

export function extractRetryAfterMs(errorMsg?: string): number | null {
  if (!errorMsg) return null;
  const secMatch = errorMsg.match(/retry(?:[-_\s]+after|[-_\s]+in)?[:\s]+([0-9]+(?:\.[0-9]+)?)\s*s(?:ec)?/i);
  if (secMatch) {
    const sec = parseFloat(secMatch[1]);
    if (!isNaN(sec) && sec > 0) return Math.ceil(sec * 1000);
  }
  const msMatch = errorMsg.match(/retry(?:[-_\s]+after|[-_\s]+in)?[:\s]+([0-9]+)\s*ms/i);
  if (msMatch) {
    const ms = parseInt(msMatch[1], 10);
    if (!isNaN(ms) && ms > 0) return ms;
  }
  return null;
}

/**
 * Differentiated Cooldown Policy:
 * - 503 / transient network / timeout: short cooldown (12s-60s) + exponential backoff with jitter
 * - 429 rate_limit: honors Retry-After if provided, else bounded exponential backoff
 * - 429 quota_exceeded: 24-hour long interval until quota reset (never retried every 60 seconds)
 */
export function markModelCooldown(
  model: string,
  reason: CooldownReason,
  customDurationMs?: number,
  errorSnippet?: string
): number {
  const existing = modelCooldownMap.get(model);
  const failureCount = (existing ? existing.failureCount : 0) + 1;
  let durationMs: number;

  if (customDurationMs !== undefined) {
    durationMs = customDurationMs;
  } else if (reason === '429_quota_exceeded') {
    durationMs = 24 * 60 * 60 * 1000; // 24 hours: do NOT retry every 60 seconds
  } else if (reason === '429_rate_limit') {
    const retryAfter = extractRetryAfterMs(errorSnippet);
    if (retryAfter) {
      durationMs = retryAfter;
    } else {
      const base = Math.min(10_000 * Math.pow(2, failureCount - 1), 60_000);
      const jitter = Math.floor(Math.random() * 2000);
      durationMs = base + jitter;
    }
  } else {
    // 503 / transient network / timeout
    const base = Math.min(12_000 * Math.pow(2, failureCount - 1), 60_000);
    const jitter = Math.floor(Math.random() * 2000);
    durationMs = base + jitter;
  }

  modelCooldownMap.set(model, {
    until: Date.now() + durationMs,
    reason,
    failureCount,
    durationMs,
    errorSnippet: errorSnippet ? errorSnippet.slice(0, 200) : undefined,
  });

  return durationMs;
}

export interface StageModelTelemetry {
  stage: string;
  requestedModel: string;
  actualModel: string;
  fallbackReason?: string;
  latencyMs: number;
  errorCode?: string;
  cooldownApplied?: {
    model: string;
    durationMs: number;
    reason: CooldownReason;
  };
}

let clientInstance: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!clientInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.log(
        '[LotusLearn AI] Notice: GEMINI_API_KEY is not set in environment. Demo fallback pipeline will be used.'
      );
    }

    clientInstance = new GoogleGenAI({
      apiKey: apiKey || '',
    });
  }
  return clientInstance;
}

export function setGeminiClient(client: GoogleGenAI | null): void {
  clientInstance = client;
}

export function resetGeminiClient(): void {
  clientInstance = null;
}

export function resolveStageRoutingPolicy(
  stageName?: string,
  stageKey?: PipelineStageKey
): StageRoutingPolicy {
  if (stageKey && STAGE_ROUTING_POLICIES[stageKey]) {
    return STAGE_ROUTING_POLICIES[stageKey];
  }
  const s = (stageName || '').toLowerCase();
  if (s.includes('obs')) return STAGE_ROUTING_POLICIES.observer;
  if (s.includes('diag')) return STAGE_ROUTING_POLICIES.diagnosis;
  if (s.includes('strat')) return STAGE_ROUTING_POLICIES.teaching_strategist;
  if (s.includes('verif')) return STAGE_ROUTING_POLICIES.semantic_verifier;

  return {
    stageKey: 'diagnosis',
    displayName: stageName || 'AI Stage',
    primaryModel: 'gemini-3.8-flash',
    fallbackModels: ['gemini-3.6-flash'],
    emergencyFallbackModel: 'gemini-3.5-flash-lite',
    stageTimeoutMs: 35_000,
  };
}

export interface GenerationResult {
  text: string;
  modelUsed: string;
  durationMs: number;
  telemetry: StageModelTelemetry;
}

export interface GenerateContentParams {
  contents: any;
  config?: any;
  stageName?: string;
  stageKey?: PipelineStageKey;
  timeoutMs?: number;
}

export async function generateContentWithRetry(params: GenerateContentParams): Promise<string> {
  const result = await generateContentDetailed(params);
  return result.text;
}

export async function generateContentDetailed(
  params: GenerateContentParams
): Promise<GenerationResult> {
  const ai = getGeminiClient();
  const stage = params.stageName || 'ai_stage';
  const startTime = Date.now();

  const policy = resolveStageRoutingPolicy(params.stageName, params.stageKey);
  const stageTimeoutMs = params.timeoutMs || policy.stageTimeoutMs;
  const initialRequestedModel = policy.primaryModel;

  // Build candidate chain for this specific stage:
  // [primaryModel, ...fallbackModels, emergencyFallbackModel]
  const rawCandidates = [
    policy.primaryModel,
    ...policy.fallbackModels,
    ...(policy.emergencyFallbackModel ? [policy.emergencyFallbackModel] : []),
  ];
  const uniqueCandidates = Array.from(new Set(rawCandidates));

  // Sort candidate models so healthy (not in cooldown) candidates are attempted first in priority order
  const healthyCandidates = uniqueCandidates.filter((m) => !isModelInCooldown(m));
  const coolingCandidates = uniqueCandidates.filter((m) => isModelInCooldown(m));

  const candidateList =
    healthyCandidates.length > 0
      ? healthyCandidates
      : [...coolingCandidates].sort((a, b) => {
          const aEntry = modelCooldownMap.get(a);
          const bEntry = modelCooldownMap.get(b);
          const aQuota = aEntry?.reason === '429_quota_exceeded' ? 1 : 0;
          const bQuota = bEntry?.reason === '429_quota_exceeded' ? 1 : 0;
          if (aQuota !== bQuota) return aQuota - bQuota;
          return (aEntry?.until || 0) - (bEntry?.until || 0);
        });

  let lastError: PipelineError | Error | null = null;
  let fallbackReason: string | undefined;
  let lastErrorCode: string | undefined;
  let lastCooldownApplied: { model: string; durationMs: number; reason: CooldownReason } | undefined;

  for (let cIdx = 0; cIdx < candidateList.length; cIdx++) {
    const modelName = candidateList[cIdx];

    if (modelName !== initialRequestedModel && !fallbackReason) {
      const prevCooldown = modelCooldownMap.get(initialRequestedModel);
      fallbackReason = prevCooldown
        ? `Primary model ${initialRequestedModel} unavailable (${prevCooldown.reason}), switched to ${modelName}`
        : `Switched from ${initialRequestedModel} to ${modelName}`;
    }

    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const attemptStart = Date.now();
      const abortController = new AbortController();
      let timeoutHandle: NodeJS.Timeout | undefined;

      try {
        // Enforce both SDK-supported HTTP timeout and client-side AbortController / Promise.race
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            abortController.abort();
            reject(
              new Error(
                `Model ${modelName} timed out after ${stageTimeoutMs}ms in stage "${stage}" (attempt ${attempt})`
              )
            );
          }, stageTimeoutMs);
        });

        // Pass SDK-supported httpOptions.timeout and abortSignal
        const mergedConfig = {
          ...params.config,
          httpOptions: {
            timeout: stageTimeoutMs,
            ...(params.config?.httpOptions || {}),
          },
          abortSignal: abortController.signal,
        };

        const callPromise = ai.models.generateContent({
          model: modelName,
          contents: params.contents,
          config: mergedConfig,
        });

        let response: any;
        try {
          response = await Promise.race([callPromise, timeoutPromise]);
        } finally {
          if (timeoutHandle) clearTimeout(timeoutHandle);
        }

        const text = response?.text?.trim();
        const duration = Date.now() - attemptStart;

        if (text) {
          const telemetry: StageModelTelemetry = {
            stage,
            requestedModel: initialRequestedModel,
            actualModel: modelName,
            fallbackReason,
            latencyMs: Date.now() - startTime,
            errorCode: lastErrorCode,
            cooldownApplied: lastCooldownApplied,
          };

          // Safe telemetry logging without prompt or student work
          console.log(
            `[LotusLearn Telemetry] stage="${telemetry.stage}" requestedModel=${telemetry.requestedModel} actualModel=${telemetry.actualModel} latencyMs=${telemetry.latencyMs}${telemetry.fallbackReason ? ` fallbackReason="${telemetry.fallbackReason}"` : ''}`
          );

          return {
            text,
            modelUsed: modelName,
            durationMs: Date.now() - startTime,
            telemetry,
          };
        }
      } catch (err: any) {
        if (timeoutHandle) clearTimeout(timeoutHandle);

        const classified = classifyGeminiError(err, stage);
        lastError = classified;
        lastErrorCode = classified.code;

        // 1. Quota Exhaustion (429 QUOTA_EXHAUSTED)
        // Mark model unavailable for 24h. Do NOT retry the same model. Break to next candidate immediately.
        if (classified.code === 'QUOTA_EXHAUSTED') {
          const cdMs = markModelCooldown(modelName, '429_quota_exceeded', undefined, err.message);
          lastCooldownApplied = { model: modelName, durationMs: cdMs, reason: '429_quota_exceeded' };
          fallbackReason = `HTTP 429 Daily Quota Exhausted on ${modelName}, immediately falling back`;
          console.log(
            `[LotusLearn AI] Model ${modelName} quota exhausted for ${stage}. Applying 24h cooldown, switching to next candidate...`
          );
          break;
        }

        // 2. Non-retryable domain / invariant error: halt pipeline immediately
        if (!classified.retryable) {
          console.log(`[LotusLearn AI] Non-retryable error [${classified.code}] encountered in ${stage}. Halting.`);
          throw classified;
        }

        // 3. HTTP 503 / Service Overload / Transient Network / Timeout / 504 Deadline Exceeded
        // P0 Requirement: a 503 or 504 on gemini-3.8-flash causes immediate stage fallback
        if (classified.code === 'TRANSIENT_NETWORK_ERROR') {
          const errLower = String(err?.message || '').toLowerCase();
          const isTimeout =
            errLower.includes('time') ||
            errLower.includes('deadline') ||
            errLower.includes('504');
          const reason: CooldownReason = isTimeout ? 'timeout' : '503_service_overload';
          const cdMs = markModelCooldown(modelName, reason, undefined, err.message);
          lastCooldownApplied = { model: modelName, durationMs: cdMs, reason };
          fallbackReason = `${isTimeout ? 'Timeout / Deadline Exceeded' : 'HTTP 503 Service Overload'} on ${modelName}, immediately falling back`;
          console.log(
            `[LotusLearn AI] Stage "${stage}" on ${modelName} encountered ${reason}. Applying cooldown (${cdMs}ms) and switching immediately to next candidate...`
          );
          break;
        }

        // 4. HTTP 429 Transient Rate Limit (RATE_LIMIT_ERROR)
        if (attempt < maxAttempts) {
          const retryAfterMs = extractRetryAfterMs(err.message);
          const backoffDelay =
            retryAfterMs ||
            Math.min(1000 * Math.pow(2, attempt - 1), 3000) + Math.floor(Math.random() * 250);
          console.log(
            `[LotusLearn AI] Applying rate limit backoff (${backoffDelay}ms) for ${modelName} before attempt ${attempt + 1}...`
          );
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        } else {
          const cdMs = markModelCooldown(modelName, '429_rate_limit', undefined, err.message);
          lastCooldownApplied = { model: modelName, durationMs: cdMs, reason: '429_rate_limit' };
          fallbackReason = `HTTP 429 Rate Limit exceeded on ${modelName} after ${maxAttempts} attempts`;
          break;
        }
      }
    }
  }

  const failureTelemetry: StageModelTelemetry = {
    stage,
    requestedModel: initialRequestedModel,
    actualModel: 'none',
    fallbackReason,
    latencyMs: Date.now() - startTime,
    errorCode: lastErrorCode || 'TRANSIENT_NETWORK_ERROR',
    cooldownApplied: lastCooldownApplied,
  };

  console.log(
    `[LotusLearn Telemetry] stage="${failureTelemetry.stage}" requestedModel=${failureTelemetry.requestedModel} actualModel=none latencyMs=${failureTelemetry.latencyMs} errorCode=${failureTelemetry.errorCode}`
  );

  throw (
    lastError ||
    new PipelineError({
      code: 'TRANSIENT_NETWORK_ERROR',
      stage,
      message: `Stage "${stage}" failed across all stage-routed Gemini model candidates.`,
      retryable: true,
    })
  );
}
