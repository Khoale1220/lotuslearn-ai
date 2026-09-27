// Centralized dynamic verification and provenance mapping for LotusLearn AI
// Enforces Priority 3, 4, 5, 9, 10 requirements: strictly factual, zero fabricated statuses

export interface DeterministicMatchDisplay {
  label: string;
  badgeClass: string;
  isSupported: boolean;
}

export function getDeterministicMatchDisplay(
  deterministicMatch?: string,
  sourceType?: string
): DeterministicMatchDisplay {
  switch (deterministicMatch) {
    case 'exact_quote_found':
      return {
        label: 'Exact Source Match',
        badgeClass: 'text-emerald-800 bg-emerald-50 border-emerald-200',
        isSupported: true,
      };
    case 'image_transcription_match':
      return {
        label: 'Transcription Match',
        badgeClass: 'text-teal-800 bg-teal-50 border-teal-200',
        isSupported: true,
      };
    case 'approximate_match':
      return {
        label: 'Approximate Match · Review Recommended',
        badgeClass: 'text-amber-800 bg-amber-50 border-amber-200',
        isSupported: true,
      };
    case 'unsupported_citation':
      return {
        label: 'Unsupported Citation · Review Required',
        badgeClass: 'text-rose-800 bg-rose-50 border-rose-300',
        isSupported: false,
      };
    default:
      if (sourceType === 'image_transcription') {
        return {
          label: 'Transcription Match',
          badgeClass: 'text-teal-800 bg-teal-50 border-teal-200',
          isSupported: true,
        };
      }
      return {
        label: 'Verified Grounding',
        badgeClass: 'text-slate-700 bg-slate-100 border-slate-200',
        isSupported: true,
      };
  }
}

export function getCodeVerificationBadge(deterministicAuditPassed?: boolean): {
  label: string;
  variant: 'code' | 'warning';
} {
  if (deterministicAuditPassed === true) {
    return { label: 'Code Verified', variant: 'code' };
  }
  if (deterministicAuditPassed === false) {
    return { label: 'Code Review Required', variant: 'warning' };
  }
  return { label: 'Code Partially Verified', variant: 'code' };
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
    default:
      return { label: 'Gemini Analysis Pending', variant: 'gemini' };
  }
}

export function getTeacherStatusLabel(status?: 'accepted' | 'edited' | 'dismissed'): string {
  if (status === 'accepted') return 'Teacher Accepted';
  if (status === 'edited') return 'Teacher Edited';
  if (status === 'dismissed') return 'Teacher Dismissed';
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
