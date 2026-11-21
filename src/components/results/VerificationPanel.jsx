import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Calculator,
  UserCheck
} from "lucide-react";
import {
  isAnalysisFullyVerified,
  getCanonicalTeacherDecision
} from "../../utils/verificationDisplay";
const VerificationPanel = ({
  verification,
  misconceptions = [],
  interventions = []
}) => {
  const det = verification.deterministicChecks;
  const isDetChecked = Boolean(det);
  const isDetVerified = det ? det.coveragePassed === true && det.clusterMathPassed === true && det.groupPartitionPassed === true && det.evidenceValidationPassed === true : false;
  const isGeminiVerified = verification.overallStatus === "verified";
  const isGeminiPartial = verification.overallStatus === "partially_verified";
  const allTeacherDecisions = [
    ...misconceptions.map((c) => getCanonicalTeacherDecision(c)),
    ...interventions.map((i) => getCanonicalTeacherDecision(i))
  ];
  const acceptedCount = allTeacherDecisions.filter((d) => d === "accepted").length;
  const editedCount = allTeacherDecisions.filter((d) => d === "edited").length;
  const dismissedCount = allTeacherDecisions.filter((d) => d === "dismissed").length;
  const pendingCount = allTeacherDecisions.filter((d) => d === "pending").length;
  void acceptedCount;
  void editedCount;
  void dismissedCount;
  void pendingCount;
  const technicalFullyVerified = isAnalysisFullyVerified({
    deterministicAuditPassed: isDetVerified,
    overallStatus: verification.overallStatus,
    coveragePassed: det?.coveragePassed,
    clusterMathPassed: det?.clusterMathPassed,
    groupPartitionPassed: det?.groupPartitionPassed,
    evidenceValidationPassed: det?.evidenceValidationPassed
  });
  return <div className="ui-card rounded-2xl p-6 sm:p-8 shadow-2xs space-y-8">
      {
    /* Header */
  }
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-[var(--border-decorative)] gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--status-success-bg)] text-[var(--status-success)] border border-[var(--status-success-border)] shrink-0">
            <ShieldCheck size={22} />
          </div>
          <div>
            <span className="text-xs font-semibold text-[var(--status-success)] uppercase tracking-wider block mb-1">
              Multi-Layer Verification &amp; Trust Boundaries
            </span>
            <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
              System Verification &amp; Educator Agency
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Explicit separation between AI reasoning, deterministic code checks, independent audit, and human decision.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span
    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-semibold ${technicalFullyVerified ? "ui-status-success" : "ui-status-warning"}`}
  >
            {technicalFullyVerified ? <CheckCircle2 size={14} className="text-[var(--status-success)]" /> : <AlertTriangle size={14} className="text-[var(--status-warning)]" />}
            <span>
              {technicalFullyVerified ? "Technical Checks: Passed" : "Technical Checks: Review Required"}
            </span>
          </span>
        </div>
      </div>

      {
    /* THREE PILLAR ARCHITECTURE */
  }
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {
    /* Pillar 1: DETERMINISTIC CODE CHECK */
  }
        <div className="rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-5 space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
            <div>
              <span className="text-xs font-bold text-[var(--status-success-fg)] uppercase tracking-wider flex items-center gap-1.5">
                <Calculator size={14} className="text-[var(--status-success)]" />
                Pillar 1: Code Check
              </span>
              <span className="text-[10px] text-[var(--status-success)] font-mono block">
                Deterministic Software Layer
              </span>
            </div>
            <span
    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${!isDetChecked ? "text-[var(--text-primary)] bg-[var(--bg-elevated)] border-[var(--border-control)]" : isDetVerified ? "text-[var(--status-success)] bg-[var(--status-success-bg)] border-[var(--status-success-border)]" : "text-[var(--status-warning)] bg-[var(--status-warning-bg)] border-[var(--status-warning-border)]"}`}
  >
              {!isDetChecked ? "Not Checked" : isDetVerified ? "Code Verified" : "Check Flagged"}
            </span>
          </div>

          <div className="space-y-2 text-xs text-[var(--text-primary)]">
            <div className="flex items-center justify-between py-1 border-b border-[var(--border-subtle)] font-mono text-[11px]">
              <span>Roster Coverage:</span>
              <span className={det?.coveragePassed ? "text-[var(--status-success)] font-bold" : "text-[var(--status-warning)]"}>
                {det?.coveragePassed ? "Coverage Complete" : "Incomplete"}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-[var(--border-subtle)] font-mono text-[11px]">
              <span>Cluster Arithmetic:</span>
              <span className={det?.clusterMathPassed ? "text-[var(--status-success)] font-bold" : "text-[var(--status-warning)]"}>
                {det?.clusterMathPassed ? "Math Sound" : "Discrepancy"}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-[var(--border-subtle)] font-mono text-[11px]">
              <span>Student Partition:</span>
              <span className={det?.groupPartitionPassed ? "text-[var(--status-success)] font-bold" : "text-[var(--status-warning)]"}>
                {det?.groupPartitionPassed ? "Disjoint & Complete" : "Overlap"}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-[var(--border-subtle)] font-mono text-[11px]">
              <span>Evidence Validation:</span>
              <span className={det?.evidenceValidationPassed === true ? "text-[var(--status-success)] font-bold" : det?.evidenceValidationPassed === false ? "text-[var(--status-error)] font-bold" : "text-[var(--text-secondary)]"}>
                {det?.evidenceValidationPassed === true ? "Passed" : det?.evidenceValidationPassed === false ? "Review Required" : "Not Checked"}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 font-mono text-[11px]">
              <span>Grounded Citations:</span>
              <span className="text-[var(--text-primary)] font-semibold">
                {det?.quotesGroundedCount || 0} grounded / {det?.quotesFlaggedCount || 0} flagged
              </span>
            </div>
          </div>
        </div>

        {
    /* Pillar 2: INDEPENDENT SEMANTIC AUDIT */
  }
        <div className="rounded-xl border border-[var(--status-info-border)] bg-[var(--status-info-bg)] p-5 space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--status-info-border)]">
            <div>
              <span className="text-xs font-bold text-[var(--status-info-fg)] uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-[var(--status-info-fg)]" />
                Pillar 2: Semantic Audit
              </span>
              <span className="text-[10px] text-[var(--status-info-fg)] font-mono block">
                Gemini Verification Engine
              </span>
            </div>
            <span
    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${isGeminiVerified ? "text-[var(--status-info-fg)] bg-[var(--status-info-bg)] border-[var(--status-info-border)]" : isGeminiPartial ? "text-[var(--status-warning)] bg-[var(--status-warning-bg)] border-[var(--status-warning-border)]" : "text-[var(--text-primary)] bg-[var(--bg-elevated)] border-[var(--border-control)]"}`}
  >
              {isGeminiVerified ? "Audit Passed" : isGeminiPartial ? "Partial Audit" : "Review Required"}
            </span>
          </div>

          <div className="space-y-2 text-xs text-[var(--text-primary)]">
            <div className="flex items-center justify-between py-1 border-b border-[var(--status-info-border)] font-mono text-[11px]">
              <span>Objective Alignment:</span>
              <span className="text-[var(--status-info-fg)] font-semibold">
                {verification.objectiveAlignmentStatus ? verification.objectiveAlignmentStatus.toUpperCase() : "CHECKED"}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-[var(--status-info-border)] font-mono text-[11px]">
              <span>Evidence Coverage:</span>
              <span className="text-[var(--status-info-fg)] font-semibold">
                {verification.evidenceCoverageStatus ? verification.evidenceCoverageStatus.toUpperCase() : "CHECKED"}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-[var(--status-info-border)] font-mono text-[11px]">
              <span>Unsupported Claims:</span>
              <span className="text-[var(--status-info-fg)] font-semibold">
                {verification.unsupportedClaimsStatus === "none_detected" ? "None Detected" : "Flagged"}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 font-mono text-[11px]">
              <span>Pedagogical Plausibility:</span>
              <span className="text-[var(--status-info-fg)] font-semibold">
                {verification.pedagogicalPlausibility ? verification.pedagogicalPlausibility.toUpperCase() : "CHECKED"}
              </span>
            </div>
          </div>
        </div>

        {
    /* Pillar 3: HUMAN EDUCATOR AGENCY */
  }
        <div className="rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-5 space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--status-warning-border)]">
            <div>
              <span className="text-xs font-bold text-[var(--status-warning)] uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck size={14} className="text-[var(--status-warning)]" />
                Pillar 3: Teacher Review
              </span>
              <span className="text-[10px] text-[var(--status-warning)] font-mono block">
                Educator Decision Authority
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border text-[var(--status-warning)] bg-[var(--status-warning-bg)] border-[var(--status-warning-border)]">
              {pendingCount > 0 ? `${pendingCount} Review Pending` : "All Reviewed"}
            </span>
          </div>

          <div className="space-y-2 text-xs text-[var(--text-primary)]">
            <div className="flex items-center justify-between py-1 border-b border-[var(--border-subtle)] font-mono text-[11px]">
              <span>Accepted by Teacher:</span>
              <span className="text-[var(--status-success)] font-bold">{acceptedCount} items</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-[var(--border-subtle)] font-mono text-[11px]">
              <span>Edited by Teacher:</span>
              <span className="text-[var(--status-info-fg)] font-bold">{editedCount} items</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-[var(--border-subtle)] font-mono text-[11px]">
              <span>Dismissed by Teacher:</span>
              <span className="text-[var(--text-secondary)] font-bold">{dismissedCount} items</span>
            </div>
            <div className="flex items-center justify-between py-1 font-mono text-[11px]">
              <span>Awaiting Review:</span>
              <span className={pendingCount > 0 ? "text-[var(--status-warning)] font-bold" : "text-[var(--status-success)]"}>
                {pendingCount} items
              </span>
            </div>
          </div>
        </div>
      </div>

      {
    /* Cross-Dimension Trust Matrix Disclosure */
  }
      <div className="rounded-xl border border-[var(--border-decorative)] bg-[var(--bg-elevated)] p-4 space-y-2 text-xs">
        <span className="font-semibold text-[var(--text-primary)] block">
          Trust Dimension Independence Guarantee:
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[var(--text-secondary)]">
          <div className="rounded-lg bg-[var(--bg-surface)] p-3 border border-[var(--border-decorative)]">
            <span className="font-semibold text-[var(--text-primary)] block mb-0.5">
              Technical Pass ≠ Human Approval
            </span>
            <p className="leading-relaxed text-[11px]">
              When deterministic code and Gemini verification pass, the item is labeled <em>&quot;Code Verified / Teacher Review Pending&quot;</em> until the educator explicitly reviews and accepts it.
            </p>
          </div>
          <div className="rounded-lg bg-[var(--bg-surface)] p-3 border border-[var(--border-decorative)]">
            <span className="font-semibold text-[var(--text-primary)] block mb-0.5">
              Teacher Acceptance ≠ Technical Pass
            </span>
            <p className="leading-relaxed text-[11px]">
              If an educator accepts an insight that had an arithmetic or evidence grounding discrepancy, the human decision is honored but the technical check remains flagged as failed.
            </p>
          </div>
        </div>
      </div>
    </div>;
};
export {
  VerificationPanel
};
