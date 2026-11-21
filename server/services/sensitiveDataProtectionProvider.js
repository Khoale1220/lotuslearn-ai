import { GoogleAuth } from "google-auth-library";
import { classifyPrivacyError, PipelineError } from "../errors/pipelineErrors.js";
import { getAppConfig } from "../config/index.js";
const DEFAULT_PII_INFOTYPES = [
  "PERSON_NAME",
  "EMAIL_ADDRESS",
  "PHONE_NUMBER"
];
class DeterministicSensitiveDataProtectionProvider {
  constructor(options) {
    this.simulateFailure = options?.simulateFailure;
  }
  setSimulatedFailure(failure) {
    this.simulateFailure = failure;
  }
  async deidentifyText(params) {
    const startTime = Date.now();
    if (this.simulateFailure === "timeout") {
      throw new PipelineError({
        code: "PRIVACY_SCAN_FAILED",
        stage: "Privacy Gateway",
        message: "Sensitive Data Protection request timed out after 5000ms",
        retryable: true
      });
    }
    if (this.simulateFailure === "auth") {
      throw new PipelineError({
        code: "PRIVACY_AUTH_ERROR",
        stage: "Privacy Gateway",
        message: "Sensitive Data Protection 401 Unauthenticated: Missing or invalid Google Cloud credentials",
        retryable: false
      });
    }
    if (this.simulateFailure === "quota") {
      throw new PipelineError({
        code: "PRIVACY_QUOTA_EXHAUSTED",
        stage: "Privacy Gateway",
        message: "Sensitive Data Protection 429 Quota Exceeded: Daily inspect/de-identify quota exhausted",
        retryable: false
      });
    }
    if (this.simulateFailure === "network") {
      throw new PipelineError({
        code: "PRIVACY_SCAN_FAILED",
        stage: "Privacy Gateway",
        message: "Sensitive Data Protection 503 Service Unavailable: Backend temporary outage",
        retryable: true
      });
    }
    if (this.simulateFailure === "malformed") {
      throw new PipelineError({
        code: "PRIVACY_SCAN_FAILED",
        stage: "Privacy Gateway",
        message: "Sensitive Data Protection returned invalid payload without transformed item",
        retryable: false
      });
    }
    const { text, infoTypes } = params;
    let sanitizedText = text;
    const findingTypeCounts = {};
    let findingCount = 0;
    if (infoTypes.includes("EMAIL_ADDRESS")) {
      const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
      const emailMatches = sanitizedText.match(emailRegex);
      if (emailMatches && emailMatches.length > 0) {
        findingTypeCounts["EMAIL_ADDRESS"] = (findingTypeCounts["EMAIL_ADDRESS"] || 0) + emailMatches.length;
        findingCount += emailMatches.length;
        sanitizedText = sanitizedText.replace(emailRegex, "[EMAIL_ADDRESS]");
      }
    }
    if (infoTypes.includes("PHONE_NUMBER")) {
      const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b|\b0\d{9,10}\b/g;
      const phoneMatches = sanitizedText.match(phoneRegex);
      if (phoneMatches && phoneMatches.length > 0) {
        findingTypeCounts["PHONE_NUMBER"] = (findingTypeCounts["PHONE_NUMBER"] || 0) + phoneMatches.length;
        findingCount += phoneMatches.length;
        sanitizedText = sanitizedText.replace(phoneRegex, "[PHONE_NUMBER]");
      }
    }
    if (infoTypes.includes("PERSON_NAME")) {
      const introPatterns = [
        /\b(?:[Mm]y\s+[Nn]ame\s+[Ii]s|[Ii]\s+[Aa]m|[Ii]'m|[Nn]ame\s*:|[Ss]tudent\s+[Nn]ame\s*:)\s+([A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+){1,3})\b/g,
        /\b(?:[Tt]ên\s+[Tt]ôi\s+[Ll]à|[Tt]ôi\s+[Tt]ên\s+[Ll]à|[Tt]ên\s+[Ee]m\s+[Ll]à|[Ee]m\s+[Tt]ên\s+[Ll]à|[Ee]m\s+[Ll]à|[Tt]ôi\s+[Ll]à|[Hh]ọc\s+[Ss]inh\s*:)\s+([A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+){1,3})\b/g
      ];
      for (const pattern of introPatterns) {
        let match;
        while ((match = pattern.exec(sanitizedText)) !== null) {
          const matchedName = match[1];
          const protectedGrammarWords = /* @__PURE__ */ new Set([
            "Present Perfect",
            "Past Simple",
            "Present Simple",
            "Past Continuous",
            "London",
            "Paris",
            "Vietnam",
            "English"
          ]);
          if (!protectedGrammarWords.has(matchedName)) {
            findingTypeCounts["PERSON_NAME"] = (findingTypeCounts["PERSON_NAME"] || 0) + 1;
            findingCount += 1;
            const fullMatch = match[0];
            const replacement = fullMatch.replace(matchedName, "[PERSON_NAME]");
            sanitizedText = sanitizedText.replace(fullMatch, replacement);
          }
        }
      }
      const specificNamesRegex = /\b(?:Nguyen\s+Van\s+[A-ZÀ-Ỹ]|Tran\s+Thi\s+[A-ZÀ-Ỹ]|Le\s+Van\s+[A-ZÀ-Ỹ]|John\s+Doe|Jane\s+Smith|Alice\s+Johnson)\b/gi;
      const specificMatches = sanitizedText.match(specificNamesRegex);
      if (specificMatches && specificMatches.length > 0) {
        findingTypeCounts["PERSON_NAME"] = (findingTypeCounts["PERSON_NAME"] || 0) + specificMatches.length;
        findingCount += specificMatches.length;
        sanitizedText = sanitizedText.replace(specificNamesRegex, "[PERSON_NAME]");
      }
    }
    const durationMs = Date.now() - startTime;
    return {
      sanitizedText,
      findingCount,
      findingTypeCounts,
      durationMs,
      provider: "deterministic-demo-sanitizer",
      policyId: params.inspectTemplateName || "standard-education-privacy-v1"
    };
  }
  async redactImage(_params) {
    const startTime = Date.now();
    if (this.simulateFailure === "timeout") {
      throw new PipelineError({
        code: "PRIVACY_SCAN_FAILED",
        stage: "Privacy Gateway",
        message: "Sensitive Data Protection image redaction timed out",
        retryable: true
      });
    }
    if (this.simulateFailure === "auth") {
      throw new PipelineError({
        code: "PRIVACY_AUTH_ERROR",
        stage: "Privacy Gateway",
        message: "Sensitive Data Protection 401 Unauthenticated on image redaction",
        retryable: false
      });
    }
    if (this.simulateFailure === "quota") {
      throw new PipelineError({
        code: "PRIVACY_QUOTA_EXHAUSTED",
        stage: "Privacy Gateway",
        message: "Sensitive Data Protection 429 Quota Exceeded on image redaction",
        retryable: false
      });
    }
    const syntheticRedactedImage = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#000000"/><text x="20" y="105" fill="#ffffff" font-family="monospace" font-size="12">REDACTED (TEST/DEV)</text></svg>`
    ).toString("base64");
    return {
      redactedImageBase64: syntheticRedactedImage,
      findingCount: 0,
      findingTypeCounts: {},
      durationMs: Date.now() - startTime,
      provider: "deterministic-demo-sanitizer"
    };
  }
}
class GoogleSensitiveDataProtectionProvider {
  constructor(options) {
    let configuredProject;
    try {
      const config = getAppConfig();
      configuredProject = config.googleCloudProject;
    } catch {
      configuredProject = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID;
    }
    this.projectId = options?.projectId || configuredProject;
    this.locationId = options?.locationId || process.env.DLP_LOCATION || "global";
    this.auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"]
    });
  }
  async resolveAuthHeadersAndUrl(endpointAction) {
    let projectId = this.projectId;
    if (!projectId) {
      try {
        projectId = await this.auth.getProjectId();
      } catch {
      }
    }
    if (!projectId) {
      throw new PipelineError({
        code: "PRIVACY_AUTH_ERROR",
        stage: "Privacy Gateway (Google Cloud SDP)",
        message: "Google Sensitive Data Protection is required in production but could not be initialized: GOOGLE_CLOUD_PROJECT is missing",
        retryable: false
      });
    }
    const parent = this.locationId === "global" ? `projects/${projectId}` : `projects/${projectId}/locations/${this.locationId}`;
    const headers = {
      "Content-Type": "application/json",
      "User-Agent": "LotusLearn-PrivacyGateway/1.0"
    };
    const url = `https://dlp.googleapis.com/v2/${parent}/${endpointAction}`;
    try {
      const client = await this.auth.getClient();
      const authHeaders = await client.getRequestHeaders();
      let authVal = null;
      if (authHeaders) {
        if (typeof authHeaders.get === "function") {
          authVal = authHeaders.get("Authorization") || authHeaders.get("authorization");
        } else if (typeof authHeaders === "object") {
          authVal = authHeaders["Authorization"] || authHeaders["authorization"];
        }
      }
      if (authVal) {
        headers["Authorization"] = String(authVal);
      } else {
        throw new Error("No Authorization token acquired from Application Default Credentials");
      }
    } catch (authErr) {
      throw new PipelineError({
        code: "PRIVACY_AUTH_ERROR",
        stage: "Privacy Gateway (Google Cloud SDP)",
        message: "Sensitive Data Protection authentication failed: unable to acquire Application Default Credentials. Valid Google Cloud credentials are required.",
        retryable: false,
        cause: authErr
      });
    }
    return { url, headers };
  }
  async deidentifyText(params) {
    const startTime = Date.now();
    const { url, headers } = await this.resolveAuthHeadersAndUrl("content:deidentify");
    const body = {
      item: {
        value: params.text
      },
      deidentifyConfig: {
        infoTypeTransformations: {
          transformations: [
            {
              primitiveTransformation: {
                replaceWithInfoTypeConfig: {}
              }
            }
          ]
        }
      },
      inspectConfig: {
        infoTypes: params.infoTypes.map((name) => ({ name })),
        minLikelihood: params.minLikelihood || "POSSIBLE",
        includeQuote: false
        // MANDATORY: Never request or retain raw PII values
      }
    };
    if (params.inspectTemplateName) {
      body.inspectTemplateName = params.inspectTemplateName;
    }
    if (params.deidentifyTemplateName) {
      body.deidentifyTemplateName = params.deidentifyTemplateName;
    }
    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Sensitive Data Protection HTTP ${response.status}: ${errorText.slice(0, 200)}`
        );
      }
      const data = await response.json();
      const sanitizedText = data.item?.value;
      if (typeof sanitizedText !== "string") {
        throw new PipelineError({
          code: "PRIVACY_SCAN_FAILED",
          stage: "Privacy Gateway (Google Cloud SDP)",
          message: "Sensitive Data Protection returned invalid payload: missing deidentified item value",
          retryable: false
        });
      }
      const findingTypeCounts = {};
      let findingCount = 0;
      const summaries = data.overview?.transformationSummaries || [];
      for (const s of summaries) {
        const typeName = s.infoType?.name || "UNKNOWN";
        const count = s.results?.reduce((sum, r) => sum + (Number(r.count) || 0), 0) || 1;
        findingTypeCounts[typeName] = (findingTypeCounts[typeName] || 0) + count;
        findingCount += count;
      }
      return {
        sanitizedText,
        findingCount,
        findingTypeCounts,
        durationMs: Date.now() - startTime,
        provider: "google-sensitive-data-protection",
        policyId: params.inspectTemplateName
      };
    } catch (err) {
      throw classifyPrivacyError(err, "Privacy Gateway (Google Cloud SDP)");
    }
  }
  async redactImage(params) {
    const startTime = Date.now();
    const { url, headers } = await this.resolveAuthHeadersAndUrl("image:redact");
    const byteType = params.mimeType.toLowerCase() === "image/png" ? "IMAGE_PNG" : "IMAGE_JPEG";
    const body = {
      byteItem: {
        type: byteType,
        data: params.imageBytesBase64
      },
      imageRedactionConfigs: params.infoTypes.map((name) => ({
        infoType: { name },
        redactionColor: { red: 0, green: 0, blue: 0 }
      })),
      inspectConfig: {
        infoTypes: params.infoTypes.map((name) => ({ name })),
        minLikelihood: "POSSIBLE",
        includeQuote: false
      }
    };
    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Sensitive Data Protection image redaction HTTP ${response.status}: ${errorText.slice(0, 200)}`
        );
      }
      const data = await response.json();
      const redactedImageBase64 = data.redactedImage;
      if (!redactedImageBase64 || typeof redactedImageBase64 !== "string") {
        throw new PipelineError({
          code: "PRIVACY_SCAN_FAILED",
          stage: "Privacy Gateway (Image Redaction)",
          message: "Sensitive Data Protection image redaction failed: missing redacted image in response",
          retryable: false
        });
      }
      return {
        redactedImageBase64,
        findingCount: 0,
        findingTypeCounts: {},
        durationMs: Date.now() - startTime,
        provider: "google-sensitive-data-protection"
      };
    } catch (err) {
      throw classifyPrivacyError(err, "Privacy Gateway (Image Redaction)");
    }
  }
}
function createDefaultSensitiveDataProtectionProvider() {
  const explicitProvider = (process.env.SDP_PROVIDER || "").toLowerCase().trim();
  if (explicitProvider === "google" || explicitProvider === "google-sdp") {
    return new GoogleSensitiveDataProtectionProvider();
  }
  if (explicitProvider === "deterministic") {
    return new DeterministicSensitiveDataProtectionProvider();
  }
  let providerMode = "deterministic";
  try {
    const config = getAppConfig();
    providerMode = config.privacyProvider;
  } catch {
    providerMode = process.env.NODE_ENV === "production" ? "google" : "deterministic";
  }
  if (providerMode === "google") {
    return new GoogleSensitiveDataProtectionProvider();
  }
  return new DeterministicSensitiveDataProtectionProvider();
}
let activeProvider = null;
function setSensitiveDataProtectionProvider(provider) {
  activeProvider = provider;
}
function getSensitiveDataProtectionProvider() {
  if (!activeProvider) {
    activeProvider = createDefaultSensitiveDataProtectionProvider();
  }
  return activeProvider;
}
export {
  DEFAULT_PII_INFOTYPES,
  DeterministicSensitiveDataProtectionProvider,
  GoogleSensitiveDataProtectionProvider,
  createDefaultSensitiveDataProtectionProvider,
  getSensitiveDataProtectionProvider,
  setSensitiveDataProtectionProvider
};
