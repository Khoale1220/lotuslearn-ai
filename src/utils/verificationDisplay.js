function getCanonicalTeacherDecision(item) {
  if (!item) return "pending";
  if (item.teacherDecision === "accepted") return "accepted";
  if (item.teacherDecision === "edited") return "edited";
  if (item.teacherDecision === "dismissed") return "dismissed";
  if (item.teacherDecision === "pending") return "pending";
  if (item.status === "edited") return "edited";
  if (item.status === "dismissed") return "dismissed";
  return "pending";
}
function getEvidenceDisplay(deterministicMatch, _sourceType) {
  switch (deterministicMatch) {
    case "exact_match":
    case "exact_quote_found":
      return {
        label: "Exact Source Match",
        badgeClass: "ui-status-success",
        explanation: "Verbatim excerpt matched student submission directly.",
        isSupported: true,
        statusVariant: "success"
      };
    case "normalized_exact_match":
      return {
        label: "Source Match (Normalized)",
        badgeClass: "ui-status-success",
        explanation: "Matched after conservative whitespace, punctuation, and case normalization.",
        isSupported: true,
        statusVariant: "success"
      };
    case "image_transcription_verified":
      return {
        label: "Verified Transcription Match",
        badgeClass: "text-teal-800 bg-teal-50 border-teal-300",
        explanation: "Ground-truth verified handwriting transcription matches claim.",
        isSupported: true,
        statusVariant: "success"
      };
    case "image_transcription_match":
      return {
        label: "Transcription Needs Review",
        badgeClass: "ui-status-warning",
        explanation: "Claim matches unverified model transcription of handwritten work.",
        isSupported: false,
        statusVariant: "warning"
      };
    case "approximate_match":
      return {
        label: "Review Evidence",
        badgeClass: "ui-status-warning",
        explanation: "Partial source similarity detected (3+ contiguous words); requires teacher review.",
        isSupported: false,
        statusVariant: "warning"
      };
    case "unsupported_citation":
      return {
        label: "Source Support Not Found",
        badgeClass: "ui-status-error",
        explanation: "Excerpt could not be verified in the student submission.",
        isSupported: false,
        statusVariant: "error"
      };
    default:
      return {
        label: "Not Checked",
        badgeClass: "ui-status-neutral",
        explanation: "Grounding check not evaluated for this item.",
        isSupported: false,
        statusVariant: "neutral"
      };
  }
}
function getPipelineErrorDisplay(errorOrMessage) {
  const code = errorOrMessage?.code;
  const retryable = errorOrMessage?.retryable;
  const msg = typeof errorOrMessage === "string" ? errorOrMessage : errorOrMessage instanceof Error ? errorOrMessage.message : errorOrMessage?.message || String(errorOrMessage || "");
  if (code === "QUOTA_EXHAUSTED") {
    return {
      title: "AI Usage Limit Reached",
      message: "Analysis is temporarily unavailable because the AI usage limit has been reached. Your entered student work has been preserved.",
      recommendedAction: "Please wait until the API quota resets before re-running the analysis.",
      retryAllowed: false,
      technicalCode: "QUOTA_EXHAUSTED"
    };
  }
  if (code === "RATE_LIMIT_ERROR") {
    return {
      title: "Temporary Rate Limit Encountered",
      message: "The AI model received multiple rapid requests and paused processing. Your student work has been preserved.",
      recommendedAction: "You can retry the analysis in a few seconds.",
      retryAllowed: retryable !== void 0 ? retryable : true,
      technicalCode: "RATE_LIMIT_ERROR"
    };
  }
  if (code === "TRANSIENT_NETWORK_ERROR") {
    return {
      title: "AI Service Temporarily Unavailable",
      message: "Analysis could not finish due to a temporary network or model backend interruption. Your student work has been preserved.",
      recommendedAction: "Click Retry Analysis to attempt the current stage again.",
      retryAllowed: retryable !== void 0 ? retryable : true,
      technicalCode: "TRANSIENT_NETWORK_ERROR"
    };
  }
  if (code === "PRIVACY_SCAN_FAILED" || code === "PRIVACY_AUTH_ERROR" || code === "PRIVACY_QUOTA_EXHAUSTED") {
    return {
      title: "Student Privacy Check Incomplete",
      message: "We couldn't complete the privacy check, so your student work was not sent for AI analysis. Your entered work has been preserved.",
      recommendedAction: code === "PRIVACY_QUOTA_EXHAUSTED" ? "Please wait until privacy service quota resets before re-running the analysis." : "Please verify the privacy service configuration or retry in a few moments.",
      retryAllowed: code !== "PRIVACY_QUOTA_EXHAUSTED" && code !== "PRIVACY_AUTH_ERROR" && retryable !== false,
      technicalCode: code
    };
  }
  if (code === "OBSERVER_IDENTITY_ERROR" || code === "OBSERVER_SCHEMA_ERROR" || code === "DIAGNOSIS_SCHEMA_ERROR" || code === "DIAGNOSIS_DOMAIN_ERROR" || code === "STRATEGY_SCHEMA_ERROR" || code === "STRATEGY_DOMAIN_ERROR" || code === "VERIFIER_SCHEMA_ERROR" || code === "INVARIANT_FAILURE" || code === "VALIDATION_ERROR") {
    return {
      title: "Submission Validation Issue",
      message: msg || "The student roster or submission inputs contain formatting inconsistencies.",
      recommendedAction: "Return to the wizard to verify student IDs and response text.",
      retryAllowed: false,
      technicalCode: code
    };
  }
  const lower = msg.toLowerCase();
  if (lower.includes("quota_exceeded") || lower.includes("daily usage exhausted") || lower.includes("quota exhausted") || lower.includes("exceeded your current quota") || lower.includes("429") && lower.includes("quota")) {
    return {
      title: "AI Usage Limit Reached",
      message: "Analysis is temporarily unavailable because the AI usage limit has been reached. Your entered student work has been preserved.",
      recommendedAction: "Please wait until the API quota resets before re-running the analysis.",
      retryAllowed: false,
      technicalCode: "QUOTA_EXHAUSTED"
    };
  }
  if (lower.includes("rate_limit_error") || lower.includes("too many requests") || lower.includes("rate limit exceeded") || lower.includes("429")) {
    return {
      title: "Temporary Rate Limit Encountered",
      message: "The AI model received multiple rapid requests and paused processing. Your student work has been preserved.",
      recommendedAction: "You can retry the analysis in a few seconds.",
      retryAllowed: true,
      technicalCode: "RATE_LIMIT_ERROR"
    };
  }
  if (lower.includes("503") || lower.includes("504") || lower.includes("deadline") || lower.includes("timeout") || lower.includes("timed out") || lower.includes("service unavailable") || lower.includes("network error") || lower.includes("fetch failed") || lower.includes("econnrefused") || lower.includes("transient_network_error")) {
    return {
      title: "AI Service Temporarily Unavailable",
      message: "Analysis could not finish due to a temporary network or model backend interruption. Your student work has been preserved.",
      recommendedAction: "Click Retry Analysis to attempt the current stage again.",
      retryAllowed: true,
      technicalCode: "TRANSIENT_NETWORK_ERROR"
    };
  }
  if (lower.includes("invariant") || lower.includes("schema") || lower.includes("validation") || lower.includes("duplicate student id")) {
    return {
      title: "Submission Validation Issue",
      message: msg || "The student roster or submission inputs contain formatting inconsistencies.",
      recommendedAction: "Return to the wizard to verify student IDs and response text.",
      retryAllowed: false,
      technicalCode: "VALIDATION_ERROR"
    };
  }
  return {
    title: "Analysis Interrupted",
    message: msg || "An unexpected issue occurred while analyzing student work. Your student work has been kept.",
    recommendedAction: "You can retry the stage or return to the analysis wizard.",
    retryAllowed: retryable !== void 0 ? retryable : true,
    technicalCode: "UNKNOWN_ERROR"
  };
}
function getCrossDimensionTrustDisplay(params) {
  if (params.technicalVerified && params.teacherDecision === "accepted") {
    return {
      overallVerified: true,
      label: "Verified & Teacher Approved",
      description: "Technical code checks passed, Gemini verified, and teacher approved.",
      variant: "verified"
    };
  }
  if (params.technicalVerified && params.teacherDecision === "pending") {
    return {
      overallVerified: false,
      label: "Code Verified \xB7 Teacher Review Pending",
      description: "All technical checks passed; awaiting educator review.",
      variant: "warning"
    };
  }
  if (!params.technicalVerified && params.teacherDecision === "accepted") {
    return {
      overallVerified: false,
      label: "Teacher Accepted \xB7 Technical Check Incomplete",
      description: "Teacher accepted this item, but technical verification failed or requires review.",
      variant: "warning"
    };
  }
  return {
    overallVerified: false,
    label: "Review Required \xB7 Teacher Review Pending",
    description: "Technical checks flagged review; teacher decision is pending.",
    variant: "neutral"
  };
}
function getDeterministicMatchDisplay(deterministicMatch, _sourceType) {
  switch (deterministicMatch) {
    case "exact_match":
    case "exact_quote_found":
      return {
        label: "Exact Verbatim Match",
        badgeClass: "ui-status-success",
        isSupported: true
      };
    case "normalized_exact_match":
      return {
        label: "Normalized Exact Match",
        badgeClass: "ui-status-success",
        isSupported: true
      };
    case "image_transcription_verified":
      return {
        label: "Transcription Verified \xB7 Grounded",
        badgeClass: "text-teal-800 bg-teal-50 border-teal-200",
        isSupported: true
      };
    case "image_transcription_match":
      return {
        label: "Transcription Match \xB7 Review Required",
        badgeClass: "text-teal-800 bg-teal-50 border-teal-200",
        isSupported: false
      };
    case "approximate_match":
      return {
        label: "Approximate Match \xB7 Review Required",
        badgeClass: "ui-status-warning",
        isSupported: false
      };
    case "unsupported_citation":
      return {
        label: "Unsupported Citation \xB7 Review Required",
        badgeClass: "ui-status-error",
        isSupported: false
      };
    default:
      return {
        label: "Not Checked",
        badgeClass: "text-slate-600 bg-slate-100 border-slate-200",
        isSupported: false
      };
  }
}
function isAnalysisFullyVerified(params) {
  if (params.overallStatus !== "verified") return false;
  if (params.deterministicAuditPassed === false) return false;
  if (params.coveragePassed !== true || params.clusterMathPassed !== true || params.groupPartitionPassed !== true || params.evidenceValidationPassed !== true) {
    return false;
  }
  if (params.deterministicAuditPassed !== void 0 && params.deterministicAuditPassed !== true) {
    return false;
  }
  return true;
}
function getCodeVerificationBadge(deterministicAuditPassed) {
  if (deterministicAuditPassed === true) {
    return { label: "Code Verified", variant: "code" };
  }
  if (deterministicAuditPassed === false) {
    return { label: "Code Check Failed", variant: "warning" };
  }
  return { label: "Code Not Checked", variant: "warning" };
}
function getClusterCodeVerificationBadge(cluster) {
  if (!cluster || !cluster.evidenceExamples || cluster.evidenceExamples.length === 0) {
    return { label: "Code Not Checked", variant: "warning" };
  }
  const matches = cluster.evidenceExamples.map((e) => e.deterministicMatch);
  if (matches.includes("unsupported_citation")) {
    return { label: "Code Check Failed", variant: "warning" };
  }
  if (matches.includes("approximate_match") || matches.includes("image_transcription_match")) {
    return { label: "Code Review Required", variant: "warning" };
  }
  if (matches.some((m) => !m || m === "not_checked")) {
    return { label: "Code Not Checked", variant: "warning" };
  }
  const isGrounded = (m) => m === "exact_match" || m === "exact_quote_found" || m === "normalized_exact_match" || m === "image_transcription_verified";
  if (matches.every((m) => isGrounded(m))) {
    return { label: "Code Verified", variant: "code" };
  }
  return { label: "Code Not Checked", variant: "warning" };
}
function getGeminiVerificationBadge(overallStatus) {
  switch (overallStatus) {
    case "verified":
      return { label: "Gemini Verified", variant: "verified" };
    case "partially_verified":
      return { label: "Gemini Review: Partial", variant: "warning" };
    case "needs_review":
      return { label: "Gemini Review Required", variant: "warning" };
    case "not_checked":
      return { label: "Gemini Not Checked", variant: "warning" };
    default:
      return { label: "Gemini Not Checked", variant: "warning" };
  }
}
function getTeacherStatusLabel(itemOrStatus) {
  const decision = typeof itemOrStatus === "string" ? itemOrStatus : getCanonicalTeacherDecision(itemOrStatus);
  if (decision === "accepted") return "Teacher Accepted";
  if (decision === "edited") return "Teacher Edited";
  if (decision === "dismissed") return "Teacher Dismissed";
  return "Teacher Review Pending";
}
const BACKEND_STAGE_KEYS = [
  "Stage 1: Source Evidence",
  "Stage 2: Gemini Observer",
  "Stage 3: Gemini Diagnosis",
  "Stage 4: Deterministic Validation",
  "Stage 5: Gemini Teaching Strategist",
  "Stage 6: Gemini Verification"
];
function formatStageLatency(stageDurationsMs, stageKey, isDemo) {
  if (isDemo) {
    return "Benchmark Cache";
  }
  const duration = stageDurationsMs?.[stageKey];
  if (typeof duration === "number" && duration > 0) {
    return `${(duration / 1e3).toFixed(1)}s`;
  }
  return "Not recorded";
}
function getPrivacyStatusDisplay(audit) {
  if (!audit || audit.status === "not_checked") {
    return {
      label: "Privacy: Not Evaluated",
      badgeClass: "ui-status-neutral",
      description: "Privacy scan was not evaluated for this session.",
      findingsCount: 0,
      status: "not_checked",
      sanitizationApplied: false
    };
  }
  if (audit.provider === "prevalidated-demo-fixture" || audit.providerVersionOrPolicyId === "prevalidated-demo-fixture") {
    return {
      label: "Prevalidated Demo Dataset",
      badgeClass: "ui-status-neutral",
      description: "The canonical demo fixture was previously validated to contain no configured PII categories.",
      findingsCount: 0,
      status: "passed",
      sanitizationApplied: false
    };
  }
  if (audit.status === "failed") {
    return {
      label: "Privacy: Incomplete",
      badgeClass: "ui-status-error",
      description: "Privacy scan could not be completed; AI execution blocked.",
      findingsCount: audit.findingCount || 0,
      status: "failed",
      sanitizationApplied: false
    };
  }
  if (audit.provider === "deterministic-demo-sanitizer") {
    return {
      label: audit.findingCount > 0 ? `Demo Privacy: ${audit.findingCount} Removed` : "Demo Privacy Check",
      badgeClass: "ui-status-neutral",
      description: "Local deterministic de-identification applied (development/demo mode). Do not submit real student data.",
      findingsCount: audit.findingCount,
      status: "passed",
      sanitizationApplied: audit.findingCount > 0
    };
  }
  if (audit.findingCount > 0) {
    return {
      label: `Privacy Check: ${audit.findingCount} Removed`,
      badgeClass: "ui-status-success",
      description: "Sensitive student identifiers were removed before AI analysis via Google Cloud SDP.",
      findingsCount: audit.findingCount,
      status: "passed",
      sanitizationApplied: true
    };
  }
  return {
    label: "Privacy Check: Clean",
    badgeClass: "ui-status-success",
    description: "No sensitive student identifiers detected before AI analysis.",
    findingsCount: 0,
    status: "passed",
    sanitizationApplied: false
  };
}
export {
  BACKEND_STAGE_KEYS,
  formatStageLatency,
  getCanonicalTeacherDecision,
  getClusterCodeVerificationBadge,
  getCodeVerificationBadge,
  getCrossDimensionTrustDisplay,
  getDeterministicMatchDisplay,
  getEvidenceDisplay,
  getGeminiVerificationBadge,
  getPipelineErrorDisplay,
  getPrivacyStatusDisplay,
  getTeacherStatusLabel,
  isAnalysisFullyVerified
};
