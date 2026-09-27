import { GoogleGenAI } from '@google/genai';

export const PRIMARY_GEMINI_MODEL = 'gemini-3.8-flash';
export const FALLBACK_GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];
export const GEMINI_MODEL = PRIMARY_GEMINI_MODEL;

let clientInstance: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!clientInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn(
        '[LotusLearn AI] Warning: GEMINI_API_KEY is not set in environment. Gemini calls will fail without a valid key.'
      );
    }

    clientInstance = new GoogleGenAI({
      apiKey: apiKey || '',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return clientInstance;
}

export interface GenerationResult {
  text: string;
  modelUsed: string;
  durationMs: number;
}

export async function generateContentWithRetry(params: {
  contents: any;
  config?: any;
  stageName?: string;
}): Promise<string> {
  const result = await generateContentDetailed(params);
  return result.text;
}

export async function generateContentDetailed(params: {
  contents: any;
  config?: any;
  stageName?: string;
}): Promise<GenerationResult> {
  const ai = getGeminiClient();
  let lastError: any = null;
  const stage = params.stageName || 'ai_stage';
  const startTime = Date.now();

  for (const modelName of FALLBACK_GEMINI_MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const attemptStart = Date.now();
        const response = await ai.models.generateContent({
          model: modelName,
          contents: params.contents,
          config: params.config,
        });

        const text = response.text?.trim();
        const duration = Date.now() - attemptStart;

        if (text) {
          // Safe structured logging: stage, model, duration, no student PII
          console.log(
            `[LotusLearn AI] Stage "${stage}" completed successfully via ${modelName} (${duration}ms)`
          );
          return {
            text,
            modelUsed: modelName,
            durationMs: Date.now() - startTime,
          };
        }
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || err || '');
        const lower = msg.toLowerCase();
        console.warn(
          `[LotusLearn AI] Stage "${stage}" on ${modelName} (attempt ${attempt}) encountered error: ${msg.slice(0, 100)}`
        );

        if (
          lower.includes('quota') ||
          lower.includes('resource_exhausted') ||
          lower.includes('429') ||
          lower.includes('rate limit')
        ) {
          console.warn(`[LotusLearn AI] Quota or rate limit encountered on ${modelName}`);
          throw err;
        }

        if (lower.includes('503') || lower.includes('high demand') || lower.includes('unavailable')) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        } else {
          break;
        }
      }
    }
  }

  throw lastError || new Error(`Stage "${stage}" failed across all Gemini model candidates.`);
}
