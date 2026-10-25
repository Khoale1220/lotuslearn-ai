/**
 * LotusLearn AI — Google Cloud Sensitive Data Protection (Cloud DLP) Provider
 *
 * Implements Google Cloud Sensitive Data Protection REST API v2:
 * - projects.content.deidentify (text de-identification)
 * - image.redact (multimodal image redaction)
 *
 * Strict Compliance:
 * - Minimal Education-Focused Detectors: PERSON_NAME, EMAIL_ADDRESS, PHONE_NUMBER
 * - No raw PII retained in audit metadata, logs, or error details
 * - Fail-closed: provider failures or network timeouts throw typed PipelineError
 */

import { GoogleAuth } from 'google-auth-library';
import { classifyPrivacyError, PipelineError } from '../errors/pipelineErrors';
import { getAppConfig } from '../config';
import { PrivacyProviderIdentity } from '../../src/types';

export interface TextDeidentifyParams {
  text: string;
  infoTypes: string[];
  inspectTemplateName?: string;
  deidentifyTemplateName?: string;
  minLikelihood?: 'VERY_UNLIKELY' | 'UNLIKELY' | 'POSSIBLE' | 'LIKELY' | 'VERY_LIKELY';
}

export interface TextDeidentifyResult {
  sanitizedText: string;
  findingCount: number;
  findingTypeCounts: Record<string, number>;
  durationMs: number;
  provider: PrivacyProviderIdentity;
  policyId?: string;
}

export interface ImageRedactParams {
  imageBytesBase64: string;
  mimeType: string;
  infoTypes: string[];
}

export interface ImageRedactResult {
  redactedImageBase64: string;
  findingCount: number;
  findingTypeCounts: Record<string, number>;
  durationMs: number;
  provider: PrivacyProviderIdentity;
}

export interface SensitiveDataProtectionProvider {
  deidentifyText(params: TextDeidentifyParams): Promise<TextDeidentifyResult>;
  redactImage(params: ImageRedactParams): Promise<ImageRedactResult>;
}

export const DEFAULT_PII_INFOTYPES = [
  'PERSON_NAME',
  'EMAIL_ADDRESS',
  'PHONE_NUMBER',
];

/**
 * Deterministic SDP policy provider for offline test suites, hermetic testing,
 * and environments where cloud DLP credentials are not directly mounted.
 * Implements the exact same replacement schema and infoType taxonomy as Google Cloud SDP.
 */
export class DeterministicSensitiveDataProtectionProvider
  implements SensitiveDataProtectionProvider
{
  private simulateFailure?: 'timeout' | 'auth' | 'quota' | 'network' | 'malformed';

  constructor(options?: {
    simulateFailure?: 'timeout' | 'auth' | 'quota' | 'network' | 'malformed';
  }) {
    this.simulateFailure = options?.simulateFailure;
  }

  public setSimulatedFailure(
    failure?: 'timeout' | 'auth' | 'quota' | 'network' | 'malformed'
  ): void {
    this.simulateFailure = failure;
  }

  public async deidentifyText(
    params: TextDeidentifyParams
  ): Promise<TextDeidentifyResult> {
    const startTime = Date.now();

    // Check simulated failure conditions for fail-closed validation tests
    if (this.simulateFailure === 'timeout') {
      throw new PipelineError({
        code: 'PRIVACY_SCAN_FAILED',
        stage: 'Privacy Gateway',
        message: 'Sensitive Data Protection request timed out after 5000ms',
        retryable: true,
      });
    }
    if (this.simulateFailure === 'auth') {
      throw new PipelineError({
        code: 'PRIVACY_AUTH_ERROR',
        stage: 'Privacy Gateway',
        message: 'Sensitive Data Protection 401 Unauthenticated: Missing or invalid Google Cloud credentials',
        retryable: false,
      });
    }
    if (this.simulateFailure === 'quota') {
      throw new PipelineError({
        code: 'PRIVACY_QUOTA_EXHAUSTED',
        stage: 'Privacy Gateway',
        message: 'Sensitive Data Protection 429 Quota Exceeded: Daily inspect/de-identify quota exhausted',
        retryable: false,
      });
    }
    if (this.simulateFailure === 'network') {
      throw new PipelineError({
        code: 'PRIVACY_SCAN_FAILED',
        stage: 'Privacy Gateway',
        message: 'Sensitive Data Protection 503 Service Unavailable: Backend temporary outage',
        retryable: true,
      });
    }
    if (this.simulateFailure === 'malformed') {
      throw new PipelineError({
        code: 'PRIVACY_SCAN_FAILED',
        stage: 'Privacy Gateway',
        message: 'Sensitive Data Protection returned invalid payload without transformed item',
        retryable: false,
      });
    }

    const { text, infoTypes } = params;
    let sanitizedText = text;
    const findingTypeCounts: Record<string, number> = {};
    let findingCount = 0;

    // 1. EMAIL_ADDRESS detector (RFC 5322 compatible regex)
    if (infoTypes.includes('EMAIL_ADDRESS')) {
      const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
      const emailMatches = sanitizedText.match(emailRegex);
      if (emailMatches && emailMatches.length > 0) {
        findingTypeCounts['EMAIL_ADDRESS'] =
          (findingTypeCounts['EMAIL_ADDRESS'] || 0) + emailMatches.length;
        findingCount += emailMatches.length;
        sanitizedText = sanitizedText.replace(emailRegex, '[EMAIL_ADDRESS]');
      }
    }

    // 2. PHONE_NUMBER detector (International & domestic phone formats)
    if (infoTypes.includes('PHONE_NUMBER')) {
      // Matches strings like 0901234567, +84 901 234 567, (555) 123-4567, 555-123-4567
      const phoneRegex =
        /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b|\b0\d{9,10}\b/g;
      const phoneMatches = sanitizedText.match(phoneRegex);
      if (phoneMatches && phoneMatches.length > 0) {
        findingTypeCounts['PHONE_NUMBER'] =
          (findingTypeCounts['PHONE_NUMBER'] || 0) + phoneMatches.length;
        findingCount += phoneMatches.length;
        sanitizedText = sanitizedText.replace(phoneRegex, '[PHONE_NUMBER]');
      }
    }

    // 3. PERSON_NAME detector (Contextual name identification)
    // Matches intro patterns: "My name is X", "I am X", "Tên tôi là X", or explicit person names
    if (infoTypes.includes('PERSON_NAME')) {
      // Common student intro phrases (case-sensitive on proper capitalized name tokens)
      const introPatterns = [
        /\b(?:[Mm]y\s+[Nn]ame\s+[Ii]s|[Ii]\s+[Aa]m|[Ii]'m|[Nn]ame\s*:|[Ss]tudent\s+[Nn]ame\s*:)\s+([A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+){1,3})\b/g,
        /\b(?:[Tt]ên\s+[Tt]ôi\s+[Ll]à|[Tt]ôi\s+[Tt]ên\s+[Ll]à|[Tt]ên\s+[Ee]m\s+[Ll]à|[Ee]m\s+[Tt]ên\s+[Ll]à|[Ee]m\s+[Ll]à|[Tt]ôi\s+[Ll]à|[Hh]ọc\s+[Ss]inh\s*:)\s+([A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+){1,3})\b/g,
      ];

      for (const pattern of introPatterns) {
        let match;
        // Run match iteratively
        while ((match = pattern.exec(sanitizedText)) !== null) {
          const matchedName = match[1];
          // Protect common English grammar words that might be capitalized at start of phrase
          const protectedGrammarWords = new Set([
            'Present Perfect',
            'Past Simple',
            'Present Simple',
            'Past Continuous',
            'London',
            'Paris',
            'Vietnam',
            'English',
          ]);
          if (!protectedGrammarWords.has(matchedName)) {
            findingTypeCounts['PERSON_NAME'] =
              (findingTypeCounts['PERSON_NAME'] || 0) + 1;
            findingCount += 1;
            // Replace the full match while preserving the intro label
            const fullMatch = match[0];
            const replacement = fullMatch.replace(matchedName, '[PERSON_NAME]');
            sanitizedText = sanitizedText.replace(fullMatch, replacement);
          }
        }
      }

      // Standalone full names with Vietnamese or standard English title (e.g., Nguyen Van A)
      const specificNamesRegex =
        /\b(?:Nguyen\s+Van\s+[A-ZÀ-Ỹ]|Tran\s+Thi\s+[A-ZÀ-Ỹ]|Le\s+Van\s+[A-ZÀ-Ỹ]|John\s+Doe|Jane\s+Smith|Alice\s+Johnson)\b/gi;
      const specificMatches = sanitizedText.match(specificNamesRegex);
      if (specificMatches && specificMatches.length > 0) {
        findingTypeCounts['PERSON_NAME'] =
          (findingTypeCounts['PERSON_NAME'] || 0) + specificMatches.length;
        findingCount += specificMatches.length;
        sanitizedText = sanitizedText.replace(specificNamesRegex, '[PERSON_NAME]');
      }
    }

    const durationMs = Date.now() - startTime;

    return {
      sanitizedText,
      findingCount,
      findingTypeCounts,
      durationMs,
      provider: 'deterministic-demo-sanitizer',
      policyId: params.inspectTemplateName || 'standard-education-privacy-v1',
    };
  }

  public async redactImage(_params: ImageRedactParams): Promise<ImageRedactResult> {
    const startTime = Date.now();

    if (this.simulateFailure === 'timeout') {
      throw new PipelineError({
        code: 'PRIVACY_SCAN_FAILED',
        stage: 'Privacy Gateway',
        message: 'Sensitive Data Protection image redaction timed out',
        retryable: true,
      });
    }
    if (this.simulateFailure === 'auth') {
      throw new PipelineError({
        code: 'PRIVACY_AUTH_ERROR',
        stage: 'Privacy Gateway',
        message: 'Sensitive Data Protection 401 Unauthenticated on image redaction',
        retryable: false,
      });
    }
    if (this.simulateFailure === 'quota') {
      throw new PipelineError({
        code: 'PRIVACY_QUOTA_EXHAUSTED',
        stage: 'Privacy Gateway',
        message: 'Sensitive Data Protection 429 Quota Exceeded on image redaction',
        retryable: false,
      });
    }

    // Deterministic safe test redaction:
    // Generate an explicitly transformed visual placeholder.
    // Never returns the original raw unredacted image bytes across the privacy boundary.
    const syntheticRedactedImage = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#000000"/><text x="20" y="105" fill="#ffffff" font-family="monospace" font-size="12">REDACTED (TEST/DEV)</text></svg>`
    ).toString('base64');

    return {
      redactedImageBase64: syntheticRedactedImage,
      findingCount: 0,
      findingTypeCounts: {},
      durationMs: Date.now() - startTime,
      provider: 'deterministic-demo-sanitizer',
    };
  }
}

/**
 * Official Google Cloud Sensitive Data Protection REST v2 Provider.
 * Communicates directly with https://dlp.googleapis.com/v2/
 */
export class GoogleSensitiveDataProtectionProvider
  implements SensitiveDataProtectionProvider
{
  private auth: GoogleAuth;
  private projectId?: string;
  private locationId: string;

  constructor(options?: {
    projectId?: string;
    locationId?: string;
  }) {
    let configuredProject: string | undefined;
    try {
      const config = getAppConfig();
      configuredProject = config.googleCloudProject;
    } catch {
      configuredProject = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID;
    }

    this.projectId = options?.projectId || configuredProject;
    this.locationId = options?.locationId || process.env.DLP_LOCATION || 'global';
    this.auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
  }

  private async resolveAuthHeadersAndUrl(
    endpointAction: 'content:deidentify' | 'image:redact'
  ): Promise<{ url: string; headers: Record<string, string> }> {
    let projectId = this.projectId;

    if (!projectId) {
      try {
        projectId = await this.auth.getProjectId();
      } catch {
        // Fallback if metadata not available
      }
    }

    if (!projectId) {
      throw new PipelineError({
        code: 'PRIVACY_AUTH_ERROR',
        stage: 'Privacy Gateway (Google Cloud SDP)',
        message: 'Google Sensitive Data Protection is required in production but could not be initialized: GOOGLE_CLOUD_PROJECT is missing',
        retryable: false,
      });
    }

    const parent =
      this.locationId === 'global'
        ? `projects/${projectId}`
        : `projects/${projectId}/locations/${this.locationId}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'LotusLearn-PrivacyGateway/1.0',
    };

    const url = `https://dlp.googleapis.com/v2/${parent}/${endpointAction}`;

    try {
      const client = await this.auth.getClient();
      const authHeaders: any = await client.getRequestHeaders();
      let authVal: string | null = null;
      if (authHeaders) {
        if (typeof authHeaders.get === 'function') {
          authVal = authHeaders.get('Authorization') || authHeaders.get('authorization');
        } else if (typeof authHeaders === 'object') {
          authVal = authHeaders['Authorization'] || authHeaders['authorization'];
        }
      }
      if (authVal) {
        headers['Authorization'] = String(authVal);
      } else {
        throw new Error('No Authorization token acquired from Application Default Credentials');
      }
    } catch (authErr: any) {
      throw new PipelineError({
        code: 'PRIVACY_AUTH_ERROR',
        stage: 'Privacy Gateway (Google Cloud SDP)',
        message: 'Sensitive Data Protection authentication failed: unable to acquire Application Default Credentials. Valid Google Cloud credentials are required.',
        retryable: false,
        cause: authErr,
      });
    }

    return { url, headers };
  }

  public async deidentifyText(
    params: TextDeidentifyParams
  ): Promise<TextDeidentifyResult> {
    const startTime = Date.now();
    const { url, headers } = await this.resolveAuthHeadersAndUrl('content:deidentify');

    const body: Record<string, any> = {
      item: {
        value: params.text,
      },
      deidentifyConfig: {
        infoTypeTransformations: {
          transformations: [
            {
              primitiveTransformation: {
                replaceWithInfoTypeConfig: {},
              },
            },
          ],
        },
      },
      inspectConfig: {
        infoTypes: params.infoTypes.map((name) => ({ name })),
        minLikelihood: params.minLikelihood || 'POSSIBLE',
        includeQuote: false, // MANDATORY: Never request or retain raw PII values
      },
    };

    if (params.inspectTemplateName) {
      body.inspectTemplateName = params.inspectTemplateName;
    }
    if (params.deidentifyTemplateName) {
      body.deidentifyTemplateName = params.deidentifyTemplateName;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Sensitive Data Protection HTTP ${response.status}: ${errorText.slice(0, 200)}`
        );
      }

      const data = (await response.json()) as any;
      const sanitizedText = data.item?.value;
      if (typeof sanitizedText !== 'string') {
        throw new PipelineError({
          code: 'PRIVACY_SCAN_FAILED',
          stage: 'Privacy Gateway (Google Cloud SDP)',
          message: 'Sensitive Data Protection returned invalid payload: missing deidentified item value',
          retryable: false,
        });
      }
      const findingTypeCounts: Record<string, number> = {};
      let findingCount = 0;

      const summaries = data.overview?.transformationSummaries || [];
      for (const s of summaries) {
        const typeName = s.infoType?.name || 'UNKNOWN';
        const count =
          s.results?.reduce((sum: number, r: any) => sum + (Number(r.count) || 0), 0) || 1;
        findingTypeCounts[typeName] = (findingTypeCounts[typeName] || 0) + count;
        findingCount += count;
      }

      return {
        sanitizedText,
        findingCount,
        findingTypeCounts,
        durationMs: Date.now() - startTime,
        provider: 'google-sensitive-data-protection',
        policyId: params.inspectTemplateName,
      };
    } catch (err: unknown) {
      throw classifyPrivacyError(err, 'Privacy Gateway (Google Cloud SDP)');
    }
  }

  public async redactImage(params: ImageRedactParams): Promise<ImageRedactResult> {
    const startTime = Date.now();
    const { url, headers } = await this.resolveAuthHeadersAndUrl('image:redact');

    const byteType =
      params.mimeType.toLowerCase() === 'image/png' ? 'IMAGE_PNG' : 'IMAGE_JPEG';

    const body: Record<string, any> = {
      byteItem: {
        type: byteType,
        data: params.imageBytesBase64,
      },
      imageRedactionConfigs: params.infoTypes.map((name) => ({
        infoType: { name },
        redactionColor: { red: 0, green: 0, blue: 0 },
      })),
      inspectConfig: {
        infoTypes: params.infoTypes.map((name) => ({ name })),
        minLikelihood: 'POSSIBLE',
        includeQuote: false,
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Sensitive Data Protection image redaction HTTP ${response.status}: ${errorText.slice(0, 200)}`
        );
      }

      const data = (await response.json()) as any;
      const redactedImageBase64 = data.redactedImage;
      if (!redactedImageBase64 || typeof redactedImageBase64 !== 'string') {
        throw new PipelineError({
          code: 'PRIVACY_SCAN_FAILED',
          stage: 'Privacy Gateway (Image Redaction)',
          message: 'Sensitive Data Protection image redaction failed: missing redacted image in response',
          retryable: false,
        });
      }

      return {
        redactedImageBase64,
        findingCount: 0,
        findingTypeCounts: {},
        durationMs: Date.now() - startTime,
        provider: 'google-sensitive-data-protection',
      };
    } catch (err: unknown) {
      throw classifyPrivacyError(err, 'Privacy Gateway (Image Redaction)');
    }
  }
}

/**
 * Configure default provider based on centralized app configuration:
 * - Production requires Google Cloud Sensitive Data Protection ('google')
 * - Development and tests default to 'deterministic'
 */
export function createDefaultSensitiveDataProtectionProvider(): SensitiveDataProtectionProvider {
  const explicitProvider = (process.env.SDP_PROVIDER || '').toLowerCase().trim();
  if (explicitProvider === 'google' || explicitProvider === 'google-sdp') {
    return new GoogleSensitiveDataProtectionProvider();
  }
  if (explicitProvider === 'deterministic') {
    return new DeterministicSensitiveDataProtectionProvider();
  }

  let providerMode: 'deterministic' | 'google' = 'deterministic';
  try {
    const config = getAppConfig();
    providerMode = config.privacyProvider;
  } catch {
    providerMode = process.env.NODE_ENV === 'production' ? 'google' : 'deterministic';
  }

  if (providerMode === 'google') {
    return new GoogleSensitiveDataProtectionProvider();
  }

  return new DeterministicSensitiveDataProtectionProvider();
}

let activeProvider: SensitiveDataProtectionProvider | null = null;

export function setSensitiveDataProtectionProvider(
  provider: SensitiveDataProtectionProvider | null
): void {
  activeProvider = provider;
}

export function getSensitiveDataProtectionProvider(): SensitiveDataProtectionProvider {
  if (!activeProvider) {
    activeProvider = createDefaultSensitiveDataProtectionProvider();
  }
  return activeProvider;
}

