import { Quote, User, ChevronDown, CheckCircle2, AlertTriangle } from "lucide-react";
import { getEvidenceDisplay } from "../../utils/verificationDisplay";
const EvidencePanel = ({
  clusters,
  selectedClusterId,
  observations,
  onInspectStudent
}) => {
  const activeCluster = clusters.find((c) => c.clusterId === selectedClusterId) || clusters[0] || null;
  return <div className="ui-card rounded-2xl p-6 sm:p-8 shadow-2xs space-y-6">
      {
    /* Header */
  }
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[var(--border-decorative)] gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--status-info-fg)] uppercase tracking-wider">
              Student Evidence &amp; Citations
            </span>
            <span className="text-[var(--text-secondary)]" aria-hidden="true">/</span>
            {(() => {
    if (!activeCluster?.evidenceExamples || activeCluster.evidenceExamples.length === 0) {
      return <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-control)]">
                    Evidence Not Checked
                  </span>;
    }
    const allSupported = activeCluster.evidenceExamples.every(
      (e) => e.deterministicMatch === "exact_match" || e.deterministicMatch === "exact_quote_found" || e.deterministicMatch === "normalized_exact_match" || e.deterministicMatch === "image_transcription_verified"
    );
    return <span
      className={`text-xs font-semibold px-2 py-0.5 rounded border flex items-center gap-1 ${allSupported ? "ui-status-success" : "ui-status-warning"}`}
    >
                  {allSupported ? <>
                      <CheckCircle2 size={12} className="text-[var(--status-success)]" />
                      <span>Evidence Grounded</span>
                    </> : <>
                      <AlertTriangle size={12} className="text-[var(--status-warning)]" />
                      <span>Evidence Review Required</span>
                    </>}
                </span>;
  })()}
          </div>
          <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
            Grounded Evidence Panel
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Every diagnosed pattern is anchored directly to verbatim student excerpts and checked for grounded support.
          </p>
        </div>

        {activeCluster && <div className="text-xs text-[var(--text-primary)] bg-[var(--bg-elevated)] border border-[var(--border-decorative)] px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-mono self-start sm:self-auto">
            <span className="text-[var(--text-secondary)]">Selected:</span>
            <span className="font-bold text-[var(--text-primary)] truncate max-w-xs">{activeCluster.misconceptionTitle}</span>
          </div>}
      </div>

      {!activeCluster ? <div className="text-xs text-[var(--text-secondary)] text-center py-8">
          Select a misconception cluster above to view supporting student evidence.
        </div> : <div className="space-y-6">
          {
    /* Active Diagnostic Claim Context Banner */
  }
          <div className="rounded-xl border border-[var(--border-decorative)] bg-[var(--bg-elevated)] p-4 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-[var(--status-info-fg)] bg-[var(--status-info-bg)] px-2 py-0.5 rounded border border-[var(--status-info-border)]">
                  DIAGNOSED PATTERN
                </span>
                <span className="font-bold text-[var(--text-primary)] text-sm">
                  {activeCluster.misconceptionTitle}
                </span>
              </div>
              <div className="font-mono text-xs text-[var(--text-secondary)] bg-[var(--bg-surface)] px-2.5 py-1 rounded border border-[var(--border-decorative)] font-medium">
                Impact: {activeCluster.studentCount} / {observations.length} Students ({activeCluster.percentageAffected}%)
              </div>
            </div>
            <p className="text-xs text-[var(--text-primary)] leading-relaxed">
              {activeCluster.explanation}
            </p>
          </div>

          {
    /* Evidence Citations Grid */
  }
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeCluster.evidenceExamples.map((item, idx) => {
    const display = getEvidenceDisplay(item.deterministicMatch, item.sourceType);
    return <div
      key={idx}
      className="ui-card ui-card-interactive rounded-xl p-5 space-y-3.5 shadow-2xs"
    >
                  {
      /* Top line: Student ID & Grounding Match Status */
    }
                  <div className="flex items-center justify-between text-xs">
                    <button
      type="button"
      onClick={() => onInspectStudent(item.studentId)}
      className="font-mono font-bold text-[var(--status-info-fg)] bg-[var(--status-info-bg)] hover:bg-[var(--status-info-bg)] border border-[var(--status-info-border)] px-2 py-1 rounded-md transition flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
      aria-label={`Inspect ${item.studentId} submission`}
    >
                      <User size={13} />
                      <span>{item.studentId}</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${display.badgeClass}`}>
                        {display.label}
                      </span>
                      <span className="text-[11px] text-[var(--text-secondary)] font-mono">#{idx + 1}</span>
                    </div>
                  </div>

                  {
      /* Student Work Excerpt */
    }
                  <div className="relative pl-3.5 border-l-2 border-[var(--status-info-border)] bg-[var(--bg-elevated)] p-3 rounded-r-lg">
                    <Quote size={14} className="text-[var(--text-secondary)] absolute top-2 right-2 opacity-30" aria-hidden="true" />
                    <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider block mb-1">
                      Student Work Excerpt ({item.sourceType === "image_transcription" ? "Photographed Worksheet" : "Typed Response"}):
                    </span>
                    <blockquote className="text-xs font-medium text-[var(--text-primary)] italic font-serif leading-relaxed">
                      &quot;{item.excerpt}&quot;
                    </blockquote>
                  </div>

                  {
      /* Diagnostic Justification */
    }
                  <div className="rounded-lg bg-[var(--status-info-bg)] border border-[var(--status-info-border)] p-3 text-xs text-[var(--text-primary)] space-y-1">
                    <span className="font-semibold text-[var(--status-info-fg)] text-[11px] block uppercase tracking-wider">
                      Why this excerpt was cited:
                    </span>
                    <p className="text-[var(--text-primary)] leading-relaxed text-xs">
                      {item.groundingReason}
                    </p>
                  </div>

                  {
      /* Progressive Disclosure: How this evidence was checked */
    }
                  <details className="group rounded-lg border border-[var(--border-decorative)] bg-[var(--bg-elevated)] p-2.5 text-xs">
                    <summary className="cursor-pointer font-semibold text-[var(--text-primary)] flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] rounded">
                      <span className="text-[11px] text-[var(--text-secondary)]">Verification Details &amp; Grounding</span>
                      <ChevronDown size={13} className="text-[var(--text-secondary)] group-open:rotate-180 transition-transform" />
                    </summary>
                    <div className="mt-2 pt-2 border-t border-[var(--border-decorative)] text-[11px] space-y-1.5 text-[var(--text-secondary)] font-mono">
                      <p>
                        <strong>Source Format:</strong> {item.sourceType === "image_transcription" ? "Handwritten Image (OCR)" : "Direct Typed Text"}
                      </p>
                      <p>
                        <strong>Deterministic Match:</strong> {item.deterministicMatch || "not_checked"}
                      </p>
                      <p>
                        <strong>Explanation:</strong> {display.explanation}
                      </p>
                      <p>
                        <strong>Support Status:</strong>{" "}
                        <span className={display.isSupported ? "text-[var(--status-success)] font-bold" : "text-[var(--status-warning)] font-bold"}>
                          {display.isSupported ? "Supported & Grounded" : "Review Required"}
                        </span>
                      </p>
                    </div>
                  </details>
                </div>;
  })}
          </div>

          {
    /* Student Roster Drill-Down Bar */
  }
          <div className="pt-4 border-t border-[var(--border-decorative)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 text-xs gap-1">
              <span className="font-semibold text-[var(--text-primary)]">
                All Student Responses in Cohort ({observations.length} Students)
              </span>
              <span className="text-[var(--text-secondary)]">Click any student to view their complete individual profile</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {observations.map((obs) => {
    const isAffected = activeCluster.affectedStudentIds.includes(obs.studentId);
    return <button
      key={obs.studentId}
      type="button"
      onClick={() => onInspectStudent(obs.studentId)}
      className={`p-2.5 rounded-lg border text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] ${isAffected ? "border-[var(--status-info-border)] bg-[var(--status-info-bg)] hover:bg-[var(--status-info-bg)] text-[var(--status-info-fg)] font-semibold shadow-2xs" : "border-[var(--border-decorative)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-[var(--text-primary)]"}`}
      aria-label={`Inspect ${obs.studentId} profile ${isAffected ? "(affected by this pattern)" : ""}`}
    >
                    <div className="flex items-center justify-between">
                      <span className="font-mono">{obs.studentId}</span>
                      {isAffected && <span className="h-1.5 w-1.5 rounded-full bg-[var(--status-info-bg)]" aria-label="Affected student" />}
                    </div>
                    <div className="mt-1 text-[10px] text-[var(--text-secondary)] truncate">
                      {obs.recommendedSupportLevel ? obs.recommendedSupportLevel.replace("_", " ") : "Review"}
                    </div>
                  </button>;
  })}
            </div>
          </div>
        </div>}
    </div>;
};
export {
  EvidencePanel
};
