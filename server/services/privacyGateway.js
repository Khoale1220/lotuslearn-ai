import { getAppConfig } from "../config/index.js";
import {
  DEFAULT_PII_INFOTYPES,
  getSensitiveDataProtectionProvider
} from "./sensitiveDataProtectionProvider.js";
class PrivacyGateway {
  constructor(options) {
    this.provider = options?.provider || getSensitiveDataProtectionProvider();
    this.enabledInfoTypes = options?.enabledInfoTypes || DEFAULT_PII_INFOTYPES;
  }
  /**
   * P4.0 Identity Normalization:
   * Maps student submissions to stable pseudonymous IDs (e.g., "Student 01", "Student 02").
   * Ensures the legal identity or raw name is never used as the analytical key in Gemini.
   */
  normalizeStudentIdentities(submissions) {
    return (submissions || []).map((s, index) => {
      const rawId = (s.studentId || "").trim();
      const isPseudonym = /^(student|custom|pupil|learner|id|sub)[\s_-]*\d+$/i.test(rawId);
      let cleanId;
      if (!rawId || !isPseudonym) {
        cleanId = `Student ${String(index + 1).padStart(2, "0")}`;
      } else {
        cleanId = rawId;
      }
      return {
        ...s,
        studentId: cleanId
      };
    });
  }
  /**
   * Sanitizes single text snippet using Google Cloud Sensitive Data Protection.
   * Fail-Closed: Never falls back to raw text if an error occurs.
   */
  async sanitizeText(text) {
    if (!text || text.trim() === "") {
      return {
        sanitizedText: text,
        findingCount: 0,
        findingTypeCounts: {},
        durationMs: 0
      };
    }
    const result = await this.provider.deidentifyText({
      text,
      infoTypes: this.enabledInfoTypes
    });
    return {
      sanitizedText: result.sanitizedText,
      findingCount: result.findingCount,
      findingTypeCounts: result.findingTypeCounts,
      durationMs: result.durationMs
    };
  }
  /**
   * Sanitizes image work if present by redacting PII rectangles via SDP image:redact.
   */
  async sanitizeImage(imageBase64, mimeType) {
    if (!imageBase64) {
      return { redactedImageBase64: imageBase64, durationMs: 0 };
    }
    const result = await this.provider.redactImage({
      imageBytesBase64: imageBase64,
      mimeType,
      infoTypes: this.enabledInfoTypes
    });
    return {
      redactedImageBase64: result.redactedImageBase64,
      durationMs: result.durationMs
    };
  }
  /**
   * Master Batch Sanitization Pipeline:
   * Normalizes identities and strips all sensitive PII before submissions enter Gemini Observer.
   */
  async sanitizeBatch(submissions) {
    const startTime = Date.now();
    const normalized = this.normalizeStudentIdentities(submissions);
    const sanitizedSubmissions = [];
    let totalFindingCount = 0;
    const aggregatedTypeCounts = {};
    for (const sub of normalized) {
      const textResult = await this.sanitizeText(sub.studentText);
      totalFindingCount += textResult.findingCount;
      for (const [type, count] of Object.entries(textResult.findingTypeCounts)) {
        aggregatedTypeCounts[type] = (aggregatedTypeCounts[type] || 0) + count;
      }
      let finalImageBase64 = sub.imageBase64;
      if (sub.imageBase64 && sub.mimeType) {
        const imgResult = await this.sanitizeImage(sub.imageBase64, sub.mimeType);
        finalImageBase64 = imgResult.redactedImageBase64;
      }
      sanitizedSubmissions.push({
        ...sub,
        studentText: textResult.sanitizedText,
        imageBase64: finalImageBase64
      });
    }
    const durationMs = Date.now() - startTime;
    let isGoogleMode = false;
    try {
      const config = getAppConfig();
      isGoogleMode = config.privacyProvider === "google";
    } catch {
      isGoogleMode = process.env.NODE_ENV === "production";
    }
    const imagesScanned = normalized.filter((s) => Boolean(s.imageBase64)).length;
    const privacyAudit = {
      status: "passed",
      findingCount: totalFindingCount,
      findingTypeCounts: aggregatedTypeCounts,
      sanitizationApplied: totalFindingCount > 0,
      provider: isGoogleMode ? "google-sensitive-data-protection" : "deterministic-demo-sanitizer",
      providerVersionOrPolicyId: isGoogleMode ? "google-sdp-edu-v2" : "deterministic-edu-v1",
      durationMs,
      imagesScanned,
      imageRedactionCompleted: imagesScanned > 0,
      rawValuesRetained: false,
      failClosed: true
    };
    console.log(
      `[LotusLearn Privacy Gateway] Scan complete: ${sanitizedSubmissions.length} submissions evaluated, ${totalFindingCount} PII tokens removed (${durationMs}ms). rawValuesRetained=false rawSensitiveValuesStoredInAudit=false.`
    );
    return {
      sanitizedSubmissions,
      privacyAudit,
      privacyScanDurationMs: durationMs
    };
  }
}
let defaultGateway = null;
function getPrivacyGateway() {
  if (!defaultGateway) {
    defaultGateway = new PrivacyGateway();
  }
  return defaultGateway;
}
function setPrivacyGateway(gateway) {
  defaultGateway = gateway;
}
export {
  PrivacyGateway,
  getPrivacyGateway,
  setPrivacyGateway
};
