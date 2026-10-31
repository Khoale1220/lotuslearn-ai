// Centralized dynamic verification and provenance mapping for LotusLearn
// Enforces Priority 3, 4, 5, 9, 10 requirements: strictly factual, zero fabricated statuses
import { MisconceptionCluster, TeacherDecision } from '../types';

export interface DeterministicMatchDisplay {
  label: string;
  badgeClass: string;
  isSupported: boolean;
}

/**
 * Canonical human-review source-of-truth resolver.
 * 
 * Rules:
 * 1. If item.teacherDecision is set to a valid TeacherDecision, it is AUTHORITATIVE.
 * 2. If item.teacherDecision is missing or invalid:
 *    - Legacy status='accepted' CANNOT prove explicit human action because legacy AI
 *      generators defaulted all generated artifacts to 'accepted'. It MUST fail-safe migrate to 'pending'.
 *    - Legacy status='edited' proves explicit human edit action (only reachable by user edit).
 *    - Legacy status='dismissed' proves explicit human dismiss action (only reachable by user dismiss).
 *    - Missing status and malformed values migrate to 'pending'.
 */
export function getCanonicalTeacherDecision(
  item?: { teacherDecision?: TeacherDecision | string; status?: TeacherDecision | string } | null
): TeacherDecision {
  if (!item) return 'pending';

  // 1. Canonical teacherDecision check
  if (item.teacherDecision === 'accepted') return 'accepted';
  if (item.teacherDecision === 'edited') return 'edited';
  if (item.teacherDecision === 'dismissed') return 'dismissed';
  if (item.teacherDecision === 'pending') return 'pending';

  // 2. Legacy status fallback migration (fail-safe)
  // Legacy 'accepted' is NOT trusted as human action without explicit teacherDecision
  if (item.status === 'edited') return 'edited';
  if (item.status === 'dismissed') return 'dismissed';

  // Everything else (missing, malformed, or legacy status='accepted') is pending
  return 'pending';
}

export interface EvidenceDisplayInfo {
  label: string;
  badgeClass: string;
  explanation: string;
  isSupported: boolean;
  statusVariant: 'success' | 'warning' | 'error' | 'neutral';
}

export interface PipelineErrorDisplay {
  title: string;
  message: string;
  recommendedAction: string;
  retryAllowed: boolean;
  technicalCode: string;
}

export interface CrossDimensionTrustDisplay {
  overallVerified: boolean;
  label: string;
  description: string;
  variant: 'verified' | 'warning' | 'neutral';
}

export function getEvidenceDisplay(
  deterministicMatch?: string,
  sourceType?: string
): EvidenceDisplayInfo {
  switch (deterministicMatch) {
    case 'exact_match':
    case 'exact_quote_found':
      return {
        label: 'Exact Source Match',
        badgeClass: 'text-emerald-800 bg-emerald-50 border-emerald-300',
        explanation: 'Verbatim excerpt matched student submission directly.',
        isSupported: true,
        statusVariant: 'success',
      };
    case 'normalized_exact_match':
      return {
        label: 'Source Match (Normalized)',
        badgeClass: 'text-emerald-800 bg-emerald-50 border-emerald-300',
        explanation: 'Matched after conservative whitespace, punctuation, and case normalization.',
        isSupported: true,
        statusVariant: 'success',
      };
    case 'image_transcription_verified':
      return {
        label: 'Verified Transcription Match',
        badgeClass: 'text-teal-800 bg-teal-50 border-teal-300',
        explanation: 'Ground-truth verified handwriting transcription matches claim.',
        isSupported: true,
        statusVariant: 'success',
      };
    case 'image_transcription_match':
      return {
        label: 'Transcription Needs Review',
        badgeClass: 'text-amber-800 bg-amber-50 border-amber-300',
        explanation: 'Claim matches unverified model transcription of handwritten work.',
        isSupported: false,
        statusVariant: 'warning',
      };
    case 'approximate_match':
      return {
        label: 'Review Evidence',
        badgeClass: 'text-amber-800 bg-amber-50 border-amber-300',
        explanation: 'Partial source similarity detected (3+ contiguous words); requires teacher review.',
        isSupported: false,
        statusVariant: 'warning',
      };
    case 'unsupported_citation':
      return {
        label: 'Source Support Not Found',
        badgeClass: 'text-rose-800 bg-rose-50 border-rose-300',
        explanation: 'Excerpt could not be verified in the student submission.',
        isSupported: false,
        statusVariant: 'error',
      };
    default:
      return {
        label: 'Not Checked',
        badgeClass: 'text-slate-700 bg-slate-100 border-slate-300',
        explanation: 'Grounding check not evaluated for this item.',
        isSupported: false,
        statusVariant: 'neutral',
      };
  }
}

export function getPipelineErrorDisplay(errorOrMessage?: unknown): PipelineErrorDisplay {
  const code = (errorOrMessage as any)?.code;
  const retryable = (errorOrMessage as any)?.retryable;
  const msg = typeof errorOrMessage === 'string'
    ? errorOrMessage
    : errorOrMessage instanceof Error
    ? errorOrMessage.message
    : (errorOrMessage as any)?.message || String(errorOrMessage || '');

  // 1. Authoritative Typed Code (P3.1: Typed state is authoritative over string guessing)
  if (code === 'QUOTA_EXHAUSTED') {
    return {
      title: 'AI Usage Limit Reached',
      message: 'Analysis is temporarily unavailable because the AI usage limit has been reached. Your entered student work has been preserved.',
      recommendedAction: 'Please wait until the API quota resets before re-running the analysis.',
      retryAllowed: false,
      technicalCode: 'QUOTA_EXHAUSTED',
    };
  }

  if (code === 'RATE_LIMIT_ERROR') {
    return {
      title: 'Temporary Rate Limit Encountered',
      message: 'The AI model received multiple rapid requests and paused processing. Your student work has been preserved.',
      recommendedAction: 'You can retry the analysis in a few seconds.',
      retryAllowed: retryable !== undefined ? retryable : true,
      technicalCode: 'RATE_LIMIT_ERROR',
    };
  }

  if (code === 'TRANSIENT_NETWORK_ERROR') {
    return {
      title: 'AI Service Temporarily Unavailable',
      message: 'Analysis could not finish due to a temporary network or model backend interruption. Your student work has been preserved.',
      recommendedAction: 'Click Retry Analysis to attempt the current stage again.',
      retryAllowed: retryable !== undefined ? retryable : true,
      technicalCode: 'TRANSIENT_NETWORK_ERROR',
    };
  }

  // P4.0: Sensitive Data Protection Privacy Gateway Failures
  if (
    code === 'PRIVACY_SCAN_FAILED' ||
    code === 'PRIVACY_AUTH_ERROR' ||
    code === 'PRIVACY_QUOTA_EXHAUSTED'
  ) {
    return {
      title: 'Student Privacy Check Incomplete',
      message:
        "We couldn't complete the privacy check, so your student work was not sent for AI analysis. Your entered work has been preserved.",
      recommendedAction:
        code === 'PRIVACY_QUOTA_EXHAUSTED'
          ? 'Please wait until privacy service quota resets before re-running the analysis.'
          : 'Please verify the privacy service configuration or retry in a few moments.',
      retryAllowed:
        code !== 'PRIVACY_QUOTA_EXHAUSTED' &&
        code !== 'PRIVACY_AUTH_ERROR' &&
        retryable !== false,
      technicalCode: code,
    };
  }

  if (
    code === 'OBSERVER_IDENTITY_ERROR' ||
    code === 'OBSERVER_SCHEMA_ERROR' ||
    code === 'DIAGNOSIS_SCHEMA_ERROR' ||
    code === 'DIAGNOSIS_DOMAIN_ERROR' ||
    code === 'STRATEGY_SCHEMA_ERROR' ||
    code === 'STRATEGY_DOMAIN_ERROR' ||
    code === 'VERIFIER_SCHEMA_ERROR' ||
    code === 'INVARIANT_FAILURE' ||
    code === 'VALIDATION_ERROR'
  ) {
    return {
      title: 'Submission Validation Issue',
      message: msg || 'The student roster or submission inputs contain formatting inconsistencies.',
      recommendedAction: 'Return to the wizard to verify student IDs and response text.',
      retryAllowed: false,
      technicalCode: code,
    };
  }

  // 2. Legacy string heuristic fallback (used only when structured code is absent)
  const lower = msg.toLowerCase();

  // Quota exhaustion - explicitly non-retryable
  if (
    lower.includes('quota_exceeded') ||
    lower.includes('daily usage exhausted') ||
    lower.includes('quota exhausted') ||
    lower.includes('exceeded your current quota') ||
    (lower.includes('429') && lower.includes('quota'))
  ) {
    return {
      title: 'AI Usage Limit Reached',
      message: 'Analysis is temporarily unavailable because the AI usage limit has been reached. Your entered student work has been preserved.',
      recommendedAction: 'Please wait until the API quota resets before re-running the analysis.',
      retryAllowed: false,
      technicalCode: 'QUOTA_EXHAUSTED',
    };
  }

  // Transient rate limit - retryable with backoff
  if (
    lower.includes('rate_limit_error') ||
    lower.includes('too many requests') ||
    lower.includes('rate limit exceeded') ||
    lower.includes('429')
  ) {
    return {
      title: 'Temporary Rate Limit Encountered',
      message: 'The AI model received multiple rapid requests and paused processing. Your student work has been preserved.',
      recommendedAction: 'You can retry the analysis in a few seconds.',
      retryAllowed: true,
      technicalCode: 'RATE_LIMIT_ERROR',
    };
  }

  // Transient network / 503 service unavailable / 504 timeout / deadline exceeded
  if (
    lower.includes('503') ||
    lower.includes('504') ||
    lower.includes('deadline') ||
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('service unavailable') ||
    lower.includes('network error') ||
    lower.includes('fetch failed') ||
    lower.includes('econnrefused') ||
    lower.includes('transient_network_error')
  ) {
    return {
      title: 'AI Service Temporarily Unavailable',
      message: 'Analysis could not finish due to a temporary network or model backend interruption. Your student work has been preserved.',
      recommendedAction: 'Click Retry Analysis to attempt the current stage again.',
      retryAllowed: true,
      technicalCode: 'TRANSIENT_NETWORK_ERROR',
    };
  }

  // Domain invariant or schema issue
  if (
    lower.includes('invariant') ||
    lower.includes('schema') ||
    lower.includes('validation') ||
    lower.includes('duplicate student id')
  ) {
    return {
      title: 'Submission Validation Issue',
      message: msg || 'The student roster or submission inputs contain formatting inconsistencies.',
      recommendedAction: 'Return to the wizard to verify student IDs and response text.',
      retryAllowed: false,
      technicalCode: 'VALIDATION_ERROR',
    };
  }

  // Default generic failure
  return {
    title: 'Analysis Interrupted',
    message: msg || 'An unexpected issue occurred while analyzing student work. Your student work has been kept.',
    recommendedAction: 'You can retry the stage or return to the analysis wizard.',
    retryAllowed: retryable !== undefined ? retryable : true,
    technicalCode: 'UNKNOWN_ERROR',
  };
}

export function getCrossDimensionTrustDisplay(params: {
  technicalVerified: boolean;
  teacherDecision: TeacherDecision;
}): CrossDimensionTrustDisplay {
  if (params.technicalVerified && params.teacherDecision === 'accepted') {
    return {
      overallVerified: true,
      label: 'Verified & Teacher Approved',
      description: 'Technical code checks passed, Gemini verified, and teacher approved.',
      variant: 'verified',
    };
  }
  if (params.technicalVerified && params.teacherDecision === 'pending') {
    return {
      overallVerified: false,
      label: 'Code Verified · Teacher Review Pending',
      description: 'All technical checks passed; awaiting educator review.',
      variant: 'warning',
    };
  }
  if (!params.technicalVerified && params.teacherDecision === 'accepted') {
    return {
      overallVerified: false,
      label: 'Teacher Accepted · Technical Check Incomplete',
      description: 'Teacher accepted this item, but technical verification failed or requires review.',
      variant: 'warning',
    };
  }
  return {
    overallVerified: false,
    label: 'Review Required · Teacher Review Pending',
    description: 'Technical checks flagged review; teacher decision is pending.',
    variant: 'neutral',
  };
}

export function getDeterministicMatchDisplay(
  deterministicMatch?: string,
  _sourceType?: string
): DeterministicMatchDisplay {
  switch (deterministicMatch) {
    case 'exact_match':
    case 'exact_quote_found':
      return {
        label: 'Exact Verbatim Match',
        badgeClass: 'text-emerald-800 bg-emerald-50 border-emerald-200',
        isSupported: true,
      };
    case 'normalized_exact_match':
      return {
        label: 'Normalized Exact Match',
        badgeClass: 'text-emerald-800 bg-emerald-50 border-emerald-200',
        isSupported: true,
      };
    case 'image_transcription_verified':
      return {
        label: 'Transcription Verified · Grounded',
        badgeClass: 'text-teal-800 bg-teal-50 border-teal-200',
        isSupported: true,
      };
    case 'image_transcription_match':
      return {
        label: 'Transcription Match · Review Required',
        badgeClass: 'text-teal-800 bg-teal-50 border-teal-200',
        isSupported: false,
      };
    case 'approximate_match':
      return {
        label: 'Approximate Match · Review Required',
        badgeClass: 'text-amber-800 bg-amber-50 border-amber-200',
        isSupported: false,
      };
    case 'unsupported_citation':
      return {
        label: 'Unsupported Citation · Review Required',
        badgeClass: 'text-rose-800 bg-rose-50 border-rose-300',
        isSupported: false,
      };
    default:
      return {
        label: 'Not Checked',
        badgeClass: 'text-slate-600 bg-slate-100 border-slate-200',
        isSupported: false,
      };
  }
}

/**
 * P2K / P2.1: Single canonical derivation for full technical verification.
 * Deterministic code checks strictly dominate semantic confidence.
 * Rules:
 * - All atomic deterministic subchecks (coveragePassed, clusterMathPassed, groupPartitionPassed, evidenceValidationPassed)
 *   are MANDATORY and must explicitly equal true.
 * - Missing atomic state (undefined) or false MUST fail-closed.
 * - Aggregate boolean (deterministicAuditPassed) CANNOT bypass missing atomic checks.
 * - Gemini semantic verification must explicitly equal 'verified'.
 * - Teacher decision is strictly independent and cannot overwrite technical failure.
 */
export function isAnalysisFullyVerified(params: {
  deterministicAuditPassed?: boolean;
  overallStatus?: string;
  coveragePassed?: boolean;
  clusterMathPassed?: boolean;
  groupPartitionPassed?: boolean;
  evidenceValidationPassed?: boolean;
}): boolean {
  // 1. Semantic verifier must explicitly equal 'verified'
  if (params.overallStatus !== 'verified') return false;

  // 2. Aggregate boolean cannot be false
  if (params.deterministicAuditPassed === false) return false;

  // 3. All atomic deterministic subchecks are MANDATORY and must explicitly equal true
  if (
    params.coveragePassed !== true ||
    params.clusterMathPassed !== true ||
    params.groupPartitionPassed !== true ||
    params.evidenceValidationPassed !== true
  ) {
    return false;
  }

  // 4. If aggregate boolean is provided, it must also be true
  if (params.deterministicAuditPassed !== undefined && params.deterministicAuditPassed !== true) {
    return false;
  }

  return true;
}

export function getCodeVerificationBadge(deterministicAuditPassed?: boolean): {
  label: string;
  variant: 'code' | 'warning';
} {
  if (deterministicAuditPassed === true) {
    return { label: 'Code Verified', variant: 'code' };
  }
  if (deterministicAuditPassed === false) {
    return { label: 'Code Check Failed', variant: 'warning' };
  }
  return { label: 'Code Not Checked', variant: 'warning' };
}

export function getClusterCodeVerificationBadge(cluster?: MisconceptionCluster | null): {
  label: string;
  variant: 'code' | 'warning';
} {
  if (!cluster || !cluster.evidenceExamples || cluster.evidenceExamples.length === 0) {
    return { label: 'Code Not Checked', variant: 'warning' };
  }
  const matches = cluster.evidenceExamples.map((e) => e.deterministicMatch);
  if (matches.includes('unsupported_citation')) {
    return { label: 'Code Check Failed', variant: 'warning' };
  }
  if (matches.includes('approximate_match') || matches.includes('image_transcription_match')) {
    return { label: 'Code Review Required', variant: 'warning' };
  }
  if (matches.some((m) => !m || (m as string) === 'not_checked')) {
    return { label: 'Code Not Checked', variant: 'warning' };
  }
  const isGrounded = (m?: string) =>
    m === 'exact_match' ||
    m === 'exact_quote_found' ||
    m === 'normalized_exact_match' ||
    m === 'image_transcription_verified';

  if (matches.every((m) => isGrounded(m))) {
    return { label: 'Code Verified', variant: 'code' };
  }
  return { label: 'Code Not Checked', variant: 'warning' };
}

export function getGeminiVerificationBadge(overallStatus?: string): {
  label: string;
  variant: 'gemini' | 'warning' | 'verified';
} {
  switch (overallStatus) {
    case 'verified':
      return { label: 'Gemini Verified', variant: 'verified' };
    case 'partially_verified':
      return { label: 'Gemini Review: Partial', variant: 'warning' };
    case 'needs_review':
      return { label: 'Gemini Review Required', variant: 'warning' };
    case 'not_checked':
      return { label: 'Gemini Not Checked', variant: 'warning' };
    default:
      return { label: 'Gemini Not Checked', variant: 'warning' };
  }
}

export function getTeacherStatusLabel(itemOrStatus?: TeacherDecision | { teacherDecision?: TeacherDecision | string; status?: TeacherDecision | string }): string {
  const decision = typeof itemOrStatus === 'string'
    ? (itemOrStatus as TeacherDecision)
    : getCanonicalTeacherDecision(itemOrStatus);

  if (decision === 'accepted') return 'Teacher Accepted';
  if (decision === 'edited') return 'Teacher Edited';
  if (decision === 'dismissed') return 'Teacher Dismissed';
  return 'Teacher Review Pending';
}

// Backend keys from server/services/pipelineCoordinator.ts
export const BACKEND_STAGE_KEYS = [
  'Stage 1: Source Evidence',
  'Stage 2: Gemini Observer',
  'Stage 3: Gemini Diagnosis',
  'Stage 4: Deterministic Validation',
  'Stage 5: Gemini Teaching Strategist',
  'Stage 6: Gemini Verification',
] as const;

export function formatStageLatency(
  stageDurationsMs: Record<string, number> | undefined,
  stageKey: string,
  isDemo: boolean
): string {
  if (isDemo) {
    return 'Benchmark Cache';
  }
  const duration = stageDurationsMs?.[stageKey];
  if (typeof duration === 'number' && duration > 0) {
    return `${(duration / 1000).toFixed(1)}s`;
  }
  return 'Not recorded';
}

export interface PrivacyStatusDisplay {
  label: string;
  badgeClass: string;
  description: string;
  findingsCount: number;
  status: 'passed' | 'review_required' | 'failed' | 'not_checked';
  sanitizationApplied: boolean;
}

export function getPrivacyStatusDisplay(
  audit?: import('../types').PrivacyAudit
): PrivacyStatusDisplay {
  if (!audit || audit.status === 'not_checked') {
    return {
      label: 'Privacy: Not Evaluated',
      badgeClass: 'text-slate-700 bg-slate-100 border-slate-300',
      description: 'Privacy scan was not evaluated for this session.',
      findingsCount: 0,
      status: 'not_checked',
      sanitizationApplied: false,
    };
  }

  // P4.0 Semantic Correction #2: Canonical demo fixture must honestly disclose prevalidation
  if (audit.provider === 'prevalidated-demo-fixture' || audit.providerVersionOrPolicyId === 'prevalidated-demo-fixture') {
    return {
      label: 'Prevalidated Demo Dataset',
      badgeClass: 'text-slate-800 bg-slate-100 border-slate-300',
      description: 'The canonical demo fixture was previously validated to contain no configured PII categories.',
      findingsCount: 0,
      status: 'passed',
      sanitizationApplied: false,
    };
  }

  if (audit.status === 'failed') {
    return {
      label: 'Privacy: Incomplete',
      badgeClass: 'text-rose-800 bg-rose-50 border-rose-300',
      description: 'Privacy scan could not be completed; AI execution blocked.',
      findingsCount: audit.findingCount || 0,
      status: 'failed',
      sanitizationApplied: false,
    };
  }

  // Deterministic local provider (development/demo/test only)
  if (audit.provider === 'deterministic-demo-sanitizer') {
    return {
      label: audit.findingCount > 0 ? `Demo Privacy: ${audit.findingCount} Removed` : 'Demo Privacy Check',
      badgeClass: 'text-indigo-800 bg-indigo-50 border-indigo-300',
      description: 'Local deterministic de-identification applied (development/demo mode). Do not submit real student data.',
      findingsCount: audit.findingCount,
      status: 'passed',
      sanitizationApplied: audit.findingCount > 0,
    };
  }

  if (audit.findingCount > 0) {
    return {
      label: `Privacy Check: ${audit.findingCount} Removed`,
      badgeClass: 'text-blue-800 bg-blue-50 border-blue-300',
      description: 'Sensitive student identifiers were removed before AI analysis via Google Cloud SDP.',
      findingsCount: audit.findingCount,
      status: 'passed',
      sanitizationApplied: true,
    };
  }

  return {
    label: 'Privacy Check: Clean',
    badgeClass: 'text-emerald-800 bg-emerald-50 border-emerald-300',
    description: 'No sensitive student identifiers detected before AI analysis.',
    findingsCount: 0,
    status: 'passed',
    sanitizationApplied: false,
  };
}

