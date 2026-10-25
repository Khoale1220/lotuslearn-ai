import { z } from 'zod';

export type PrivacyProviderMode = 'deterministic' | 'google';

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  privacyProvider: PrivacyProviderMode;
  googleCloudProject?: string;
  geminiApiKey?: string;
  appUrl: string;
}

const RawEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().optional().default('3000'),
  SDP_PROVIDER: z.string().optional(),
  GOOGLE_CLOUD_PROJECT: z.string().optional(),
  GCP_PROJECT_ID: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  APP_URL: z.string().optional().default('http://localhost:3000'),
});

export const ConfigValidationSchema = z
  .object({
    nodeEnv: z.enum(['development', 'test', 'production']),
    privacyProvider: z.enum(['deterministic', 'google']),
    googleCloudProject: z.string().optional(),
    port: z.number().default(3000),
    geminiApiKey: z.string().optional(),
    appUrl: z.string().default('http://localhost:3000'),
  })
  .superRefine((data, ctx) => {
    if (data.nodeEnv === 'production') {
      if (!data.geminiApiKey) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'GEMINI_API_KEY is required in production for Gemini live analysis.',
          path: ['geminiApiKey'],
        });
      }
      if (data.privacyProvider === 'deterministic') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Production environment strictly forbids SDP_PROVIDER="deterministic". Production requires SDP_PROVIDER="google".',
          path: ['privacyProvider'],
        });
      }
      if (data.privacyProvider === 'google' && !data.googleCloudProject) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Google Sensitive Data Protection is required in production but GOOGLE_CLOUD_PROJECT configuration is missing.',
          path: ['googleCloudProject'],
        });
      }
    }
  });

export function loadAppConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const parsedEnv = RawEnvSchema.parse(env);
  const nodeEnv = parsedEnv.NODE_ENV;
  const port = parseInt(parsedEnv.PORT, 10) || 3000;

  // Normalize SDP_PROVIDER: support 'deterministic' and 'google' (also 'google-sdp' for backwards compatibility)
  const rawProvider = (parsedEnv.SDP_PROVIDER || '').toLowerCase().trim();
  let privacyProvider: PrivacyProviderMode;

  if (rawProvider === 'google' || rawProvider === 'google-sdp') {
    privacyProvider = 'google';
  } else if (rawProvider === 'deterministic') {
    privacyProvider = 'deterministic';
  } else {
    // Development & test default to 'deterministic'
    // Production defaults to 'google'
    privacyProvider = nodeEnv === 'production' ? 'google' : 'deterministic';
  }

  const googleCloudProject =
    (parsedEnv.GOOGLE_CLOUD_PROJECT || parsedEnv.GCP_PROJECT_ID || '').trim() || undefined;

  const rawConfig = {
    nodeEnv,
    port,
    privacyProvider,
    googleCloudProject,
    geminiApiKey: parsedEnv.GEMINI_API_KEY?.trim() || undefined,
    appUrl: parsedEnv.APP_URL,
  };

  const validationResult = ConfigValidationSchema.safeParse(rawConfig);
  if (!validationResult.success) {
    const errorMsg = validationResult.error.issues.map((i) => i.message).join('; ');
    throw new Error(`[Configuration Error] ${errorMsg}`);
  }

  return validationResult.data;
}

let activeConfig: AppConfig | null = null;

export function getAppConfig(): AppConfig {
  if (!activeConfig) {
    activeConfig = loadAppConfig();
  }
  return activeConfig;
}

export function resetAppConfig(): void {
  activeConfig = null;
}

export function setAppConfig(config: AppConfig | null): void {
  activeConfig = config;
}
