/**
 * LotusLearn AI — Privacy Gateway Service
 *
 * Sits strictly BEFORE the AI Analysis Pipeline.
 * Protects student privacy using Google Cloud Sensitive Data Protection:
 * 1. Application-level identity normalization to pseudonymous IDs (Student 01, Student 02...).
 * 2. Pre-AI PII de-identification (names, emails, phones) replaced with explicit placeholders.
 * 3. Photographed student worksheet redaction.
 * 4. Canonical fail-closed PrivacyAudit object generation.
 * 5. Strict zero-PII logging policy: raw PII is never logged or exposed.
 */

import { PrivacyAudit, StudentSubmission } from '../../src/types';
import { PipelineError } from '../errors/pipelineErrors';
import { getAppConfig } from '../config';
import {
  DEFAULT_PII_INFOTYPES,
  getSensitiveDataProtectionProvider,
  SensitiveDataProtectionProvider,
} from './sensitiveDataProtectionProvider';

export interface PrivacySanitizationResult {
  sanitizedSubmissions: StudentSubmission[];
  privacyAudit: PrivacyAudit;
  privacyScanDurationMs: number;
}

export class PrivacyGateway {
  private provider: SensitiveDataProtectionProvider;
  private enabledInfoTypes: string[];

  constructor(options?: {
    provider?: SensitiveDataProtectionProvider;
    enabledInfoTypes?: string[];
  }) {
    this.provider = options?.provider || getSensitiveDataProtectionProvider();
    this.enabledInfoTypes = options?.enabledInfoTypes || DEFAULT_PII_INFOTYPES;
  }

  /**
   * P4.0 Identity Normalization:
   * Maps student submissions to stable pseudonymous IDs (e.g., "Student 01", "Student 02").
   * Ensures the legal identity or raw name is never used as the analytical key in Gemini.
   */
  public normalizeStudentIdentities(
    submissions: StudentSubmission[]
  ): StudentSubmission[] {
    return (submissions || []).map((s, index) => {
      const rawId = (s.studentId || '').trim();

      // Check if ID is already a pseudonymous identifier like "Student 01", "Custom 01", "Pupil 1", "S1"
      const isPseudonym = /^(student|custom|pupil|learner|id|sub)[\s_-]*\d+$/i.test(rawId);

      // If ID is empty, unformatted, or represents a real name (e.g., "Nguyen Van An", "Jane Doe"),
      // replace with a stable deterministic pseudonym so full names never leak to model boundaries.
      let cleanId: string;
      if (!rawId || !isPseudonym) {
        cleanId = `Student ${String(index + 1).padStart(2, '0')}`;
      } else {
        cleanId = rawId;
      }

      return {
        ...s,
        studentId: cleanId,
      };
    });
  }

  /**
   * Sanitizes single text snippet using Google Cloud Sensitive Data Protection.
   * Fail-Closed: Never falls back to raw text if an error occurs.
   */
  public async sanitizeText(
    text: string
  ): Promise<{
    sanitizedText: string;
    findingCount: number;
    findingTypeCounts: Record<string, number>;
    durationMs: number;
  }> {
    if (!text || text.trim() === '') {
      return {
        sanitizedText: text,
        findingCount: 0,
        findingTypeCounts: {},
        durationMs: 0,
      };
    }

    const result = await this.provider.deidentifyText({
      text,
      infoTypes: this.enabledInfoTypes,
    });

    return {
      sanitizedText: result.sanitizedText,
      findingCount: result.findingCount,
      findingTypeCounts: result.findingTypeCounts,
      durationMs: result.durationMs,
    };
  }

  /**
   * Sanitizes image work if present by redacting PII rectangles via SDP image:redact.
   */
  public async sanitizeImage(
    imageBase64: string,
    mimeType: string
  ): Promise<{ redactedImageBase64: string; durationMs: number }> {
    if (!imageBase64) {
      return { redactedImageBase64: imageBase64, durationMs: 0 };
    }

    const result = await this.provider.redactImage({
      imageBytesBase64: imageBase64,
      mimeType,
      infoTypes: this.enabledInfoTypes,
    });

    return {
      redactedImageBase64: result.redactedImageBase64,
      durationMs: result.durationMs,
    };
  }

  /**
   * Master Batch Sanitization Pipeline:
   * Normalizes identities and strips all sensitive PII before submissions enter Gemini Observer.
   */
  public async sanitizeBatch(
    submissions: StudentSubmission[]
  ): Promise<PrivacySanitizationResult> {
    const startTime = Date.now();
    const normalized = this.normalizeStudentIdentities(submissions);
    const sanitizedSubmissions: StudentSubmission[] = [];

    let totalFindingCount = 0;
    const aggregatedTypeCounts: Record<string, number> = {};

    for (const sub of normalized) {
      // 1. Text Sanitization
      const textResult = await this.sanitizeText(sub.studentText);
      totalFindingCount += textResult.findingCount;

      for (const [type, count] of Object.entries(textResult.findingTypeCounts)) {
        aggregatedTypeCounts[type] = (aggregatedTypeCounts[type] || 0) + count;
      }

      // 2. Image Redaction (if multimodal image present)
      let finalImageBase64 = sub.imageBase64;
      if (sub.imageBase64 && sub.mimeType) {
        const imgResult = await this.sanitizeImage(sub.imageBase64, sub.mimeType);
        finalImageBase64 = imgResult.redactedImageBase64;
      }

      sanitizedSubmissions.push({
        ...sub,
        studentText: textResult.sanitizedText,
        imageBase64: finalImageBase64,
      });
    }

    const durationMs = Date.now() - startTime;
    let isGoogleMode = false;
    try {
      const config = getAppConfig();
      isGoogleMode = config.privacyProvider === 'google';
    } catch {
      isGoogleMode = process.env.NODE_ENV === 'production';
    }

    // Structured audit metadata without raw PII
    const privacyAudit: PrivacyAudit = {
      status: 'passed',
      findingCount: totalFindingCount,
      findingTypeCounts: aggregatedTypeCounts,
      sanitizationApplied: totalFindingCount > 0,
      provider: 'google-sensitive-data-protection',
      providerVersionOrPolicyId: isGoogleMode
        ? 'google-sdp-edu-v2'
        : 'deterministic-edu-v1',
      durationMs,
      rawValuesRetained: false,
      failClosed: true,
    };

    // Safe structured logging: NO raw student names, emails, phones, or submissions!
    console.log(
      `[LotusLearn Privacy Gateway] Scan complete: ${sanitizedSubmissions.length} submissions evaluated, ` +
        `${totalFindingCount} PII tokens removed (${durationMs}ms). rawValuesRetained=false rawSensitiveValuesStoredInAudit=false.`
    );

    return {
      sanitizedSubmissions,
      privacyAudit,
      privacyScanDurationMs: durationMs,
    };
  }
}

/**
 * Singleton gateway instance
 */
let defaultGateway: PrivacyGateway | null = null;

export function getPrivacyGateway(): PrivacyGateway {
  if (!defaultGateway) {
    defaultGateway = new PrivacyGateway();
  }
  return defaultGateway;
}

export function setPrivacyGateway(gateway: PrivacyGateway | null): void {
  defaultGateway = gateway;
}
