import { useState } from "react";
import { Copy, Check, X } from "lucide-react";
import { getTeacherStatusLabel, getCanonicalTeacherDecision } from "../../utils/verificationDisplay";
const DifferentiatedInterventions = ({
  interventions,
  misconceptions = [],
  totalStudents: _totalStudents = 12,
  verificationStatus: _verificationStatus = "verified",
  onAdjustIntervention,
  onUpdateStatus
}) => {
  const [copiedId, setCopiedId] = useState(null);
  const [loadingAction, setLoadingAction] = useState(null);
  const handleCopy = (int) => {
    const text = `INTERVENTION: ${int.title} (${int.supportTier})
Target Misconception: ${int.targetMisconceptionTitle}
Rationale: ${int.rationale}
Activity: ${int.suggestedActivity}
Teacher Prompt: "${int.teacherScript}"
Diagnostic Question: "${int.exampleQuestion}"
Exit Ticket: "${int.exitTicketQuestion}"`;
    navigator.clipboard.writeText(text);
    setCopiedId(int.interventionId);
    setTimeout(() => setCopiedId(null), 2e3);
  };
  const handleAction = async (int, action) => {
    setLoadingAction(`${int.interventionId}_${action}`);
    try {
      await onAdjustIntervention(int, action);
    } finally {
      setLoadingAction(null);
    }
  };
  return <div className="ui-card rounded-2xl p-6 sm:p-8 shadow-2xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[var(--border-decorative)] gap-2">
        <div>
          <span className="text-xs font-semibold text-[var(--status-info-fg)] uppercase tracking-wider block mb-1">
            Differentiated Teaching Scaffolds
          </span>
          <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
            Targeted Micro-Interventions
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Actionable scaffolds tailored to diagnosed misconception clusters with classroom-ready scripts and exit tickets.
          </p>
        </div>
        <div className="text-xs text-[var(--text-secondary)] font-mono">
          <span className="font-bold text-[var(--text-primary)]">{interventions.length}</span> intervention cards
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {interventions.map((int) => {
    const canonicalDecision = getCanonicalTeacherDecision(int);
    const isDismissed = canonicalDecision === "dismissed";
    const isProcessingThis = loadingAction?.startsWith(int.interventionId);
    const tierColor = int.supportTier === "Ready for Extension" ? "ui-status-success" : int.supportTier === "Concept Clarification" ? "bg-[var(--status-info-bg)] text-[var(--status-info-fg)] border-[var(--status-info-border)]" : "ui-status-warning";
    const matchingCluster = misconceptions.find(
      (c) => int.clusterId && c.clusterId === int.clusterId || c.misconceptionTitle.toLowerCase() === int.targetMisconceptionTitle.toLowerCase()
    );
    return <div
      key={int.interventionId}
      className={`rounded-xl border border-[var(--border-decorative)] bg-[var(--bg-surface)] p-5 space-y-4 transition-all ${isDismissed ? "opacity-60 bg-[var(--bg-elevated)]" : "hover:border-[var(--border-control)] hover:shadow-2xs"}`}
    >
              {
      /* Top Bar: Support Tier & Status */
    }
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-[var(--border-decorative)]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${tierColor}`}>
                      {int.supportTier}
                    </span>
                    <span className="text-[11px] font-mono text-[var(--text-secondary)] bg-[var(--bg-elevated)] px-2 py-0.5 rounded border border-[var(--border-decorative)]">
                      {getTeacherStatusLabel(canonicalDecision)}
                    </span>
                  </div>
                  <h3 className="mt-1.5 text-base font-bold text-[var(--text-primary)] tracking-tight">
                    {int.title}
                  </h3>
                </div>

                <button
      type="button"
      onClick={() => handleCopy(int)}
      className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-md transition shrink-0 border border-[var(--border-decorative)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)]"
      title="Copy intervention text"
      aria-label="Copy intervention text"
    >
                  {copiedId === int.interventionId ? <Check size={14} className="text-[var(--status-success)]" /> : <Copy size={14} />}
                </button>
              </div>

              {
      /* Linked Misconception Relationship Box */
    }
              <div className="rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-decorative)] p-3 text-xs space-y-1">
                <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider block">
                  Targeted Learning Need:
                </span>
                <div className="flex items-center justify-between text-[var(--text-primary)] font-medium">
                  <span>{int.targetMisconceptionTitle}</span>
                  {matchingCluster && <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                      {matchingCluster.studentCount} students affected
                    </span>}
                </div>
              </div>

              {
      /* Rationale */
    }
              <div className="text-xs space-y-1">
                <span className="font-semibold text-[var(--text-primary)] uppercase tracking-wider text-[10px] block">
                  Instructional Rationale:
                </span>
                <p className="text-[var(--text-secondary)] leading-relaxed">
                  {int.rationale}
                </p>
              </div>

              {
      /* Suggested Activity & Teacher Script */
    }
              <div className="space-y-3 pt-2 text-xs">
                <div className="rounded-lg bg-[var(--status-info-bg)] border border-[var(--status-info-border)] p-3 space-y-1">
                  <span className="font-semibold text-[var(--status-info-fg)] text-[11px] block">
                    Suggested Classroom Activity:
                  </span>
                  <p className="text-[var(--text-primary)] leading-relaxed">
                    {int.suggestedActivity}
                  </p>
                </div>

                <div className="rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-decorative)] p-3 space-y-1">
                  <span className="font-semibold text-[var(--text-primary)] text-[11px] block">
                    Teacher Script / Actionable Prompt:
                  </span>
                  <p className="text-[var(--text-primary)] italic pl-2 border-l-2 border-[var(--border-control)]">
                    &quot;{int.teacherScript}&quot;
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg border border-[var(--border-decorative)] bg-[var(--bg-surface)]">
                    <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase block mb-0.5">
                      Diagnostic Question:
                    </span>
                    <p className="text-[var(--text-primary)] text-[11px] leading-snug">
                      {int.exampleQuestion}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg border border-[var(--border-decorative)] bg-[var(--bg-surface)]">
                    <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase block mb-0.5">
                      Quick Exit Ticket:
                    </span>
                    <p className="text-[var(--text-primary)] text-[11px] leading-snug">
                      {int.exitTicketQuestion}
                    </p>
                  </div>
                </div>
              </div>

              {
      /* Teacher Decision Actions */
    }
              <div className="pt-3 border-t border-[var(--border-decorative)] flex items-center justify-between text-xs">
                <span className="text-[11px] text-[var(--text-secondary)]">
                  Educator review:
                </span>
                <div className="flex items-center gap-2">
                  <button
      type="button"
      onClick={() => onUpdateStatus?.(int.interventionId, "accepted")}
      className={`inline-flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold transition ${canonicalDecision === "accepted" ? "bg-emerald-600 text-[var(--action-primary-fg)] shadow-2xs" : "border border-[var(--border-control)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"}`}
    >
                    <Check size={12} />
                    <span>Accept</span>
                  </button>

                  <button
      type="button"
      onClick={() => onUpdateStatus?.(int.interventionId, "dismissed")}
      className={`inline-flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold transition ${canonicalDecision === "dismissed" ? "bg-[var(--bg-elevated)] text-[var(--action-primary-fg)] shadow-2xs" : "border border-[var(--border-control)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"}`}
    >
                    <X size={12} />
                    <span>Dismiss</span>
                  </button>
                </div>
              </div>
            </div>;
  })}
      </div>
    </div>;
};
export {
  DifferentiatedInterventions
};
