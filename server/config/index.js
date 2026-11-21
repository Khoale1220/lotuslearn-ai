import { z } from "zod";
const RawEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.string().optional().default("3000"),
  SDP_PROVIDER: z.string().optional(),
  GOOGLE_CLOUD_PROJECT: z.string().optional(),
  GCP_PROJECT_ID: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  APP_URL: z.string().optional().default("http://localhost:3000")
});
const ConfigValidationSchema = z.object({
  nodeEnv: z.enum(["development", "test", "production"]),
  privacyProvider: z.enum(["deterministic", "google"]),
  googleCloudProject: z.string().optional(),
  port: z.number().default(3e3),
  geminiApiKey: z.string().optional(),
  appUrl: z.string().default("http://localhost:3000")
}).superRefine((data, ctx) => {
  if (data.nodeEnv === "production") {
    if (!data.geminiApiKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "GEMINI_API_KEY is required in production for Gemini live analysis.",
        path: ["geminiApiKey"]
      });
    }
    if (data.privacyProvider === "deterministic") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Production environment strictly forbids SDP_PROVIDER="deterministic". Production requires SDP_PROVIDER="google".',
        path: ["privacyProvider"]
      });
    }
    if (data.privacyProvider === "google" && !data.googleCloudProject) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Google Sensitive Data Protection is required in production but GOOGLE_CLOUD_PROJECT configuration is missing.",
        path: ["googleCloudProject"]
      });
    }
  }
});
function loadAppConfig(env = process.env) {
  const parsedEnv = RawEnvSchema.parse(env);
  const nodeEnv = parsedEnv.NODE_ENV;
  const port = parseInt(parsedEnv.PORT, 10) || 3e3;
  const rawProvider = (parsedEnv.SDP_PROVIDER || "").toLowerCase().trim();
  let privacyProvider;
  if (rawProvider === "google" || rawProvider === "google-sdp") {
    privacyProvider = "google";
  } else if (rawProvider === "deterministic") {
    privacyProvider = "deterministic";
  } else {
    privacyProvider = nodeEnv === "production" ? "google" : "deterministic";
  }
  const googleCloudProject = (parsedEnv.GOOGLE_CLOUD_PROJECT || parsedEnv.GCP_PROJECT_ID || "").trim() || void 0;
  const rawConfig = {
    nodeEnv,
    port,
    privacyProvider,
    googleCloudProject,
    geminiApiKey: parsedEnv.GEMINI_API_KEY?.trim() || void 0,
    appUrl: parsedEnv.APP_URL
  };
  const validationResult = ConfigValidationSchema.safeParse(rawConfig);
  if (!validationResult.success) {
    const errorMsg = validationResult.error.issues.map((i) => i.message).join("; ");
    throw new Error(`[Configuration Error] ${errorMsg}`);
  }
  return validationResult.data;
}
let activeConfig = null;
function getAppConfig() {
  if (!activeConfig) {
    activeConfig = loadAppConfig();
  }
  return activeConfig;
}
function resetAppConfig() {
  activeConfig = null;
}
function setAppConfig(config) {
  activeConfig = config;
}
export {
  ConfigValidationSchema,
  getAppConfig,
  loadAppConfig,
  resetAppConfig,
  setAppConfig
};
