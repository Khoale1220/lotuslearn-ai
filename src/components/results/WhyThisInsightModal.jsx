import { useRef } from "react";
import { X, HelpCircle, ArrowRight, User } from "lucide-react";
import { getEvidenceDisplay } from "../../utils/verificationDisplay";
import { useModalFocus } from "../../utils/useModalFocus";
const WhyThisInsightModal = ({
  cluster,
  context: _context,
  totalStudents,
  onClose,
  onInspectStudent
}) => {
  const closeButtonRef = useRef(null);
  const modalRef = useModalFocus({
    isOpen: Boolean(cluster),
    onClose,
    initialFocusRef: closeButtonRef
  });
  if (!cluster) return null;
  return <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-interactive)] p-4 backdrop-blur-xs"
    role="dialog"
    aria-modal="true"
    aria-labelledby="why-insight-title"
    onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}
  >
      <div
    ref={modalRef}
    className="relative w-full max-w-2xl rounded-2xl bg-[var(--bg-surface)] p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto border border-[var(--border-decorative)]"
  >
        {
    /* Header */
  }
        <div className="flex items-start justify-between pb-4 border-b border-[var(--border-decorative)] gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--status-info-bg)] text-[var(--status-info-fg)] border border-[var(--status-info-border)] shrink-0">
              <HelpCircle size={20} />
            </div>
            <div>
              <span className="text-[11px] font-bold text-[var(--status-info-fg)] uppercase tracking-wider block mb-0.5">
                Evidence Grounding Breakdown
              </span>
              <h2 id="why-insight-title" className="text-lg font-bold text-[var(--text-primary)]">
                Why this pattern was diagnosed: &quot;{cluster.misconceptionTitle}&quot;
              </h2>
            </div>
          </div>

          <button
    ref={closeButtonRef}
    type="button"
    onClick={onClose}
    className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-elevated)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
    aria-label="Close modal"
  >
            <X size={18} />
          </button>
        </div>

        {
    /* 5-Step Provenance Sequence */
  }
        <div className="rounded-xl border border-[var(--border-decorative)] bg-[var(--bg-elevated)] p-3.5 space-y-2">
          <span className="text-[10px] font-mono font-semibold uppercase text-[var(--text-secondary)] tracking-wider block">
            End-to-End Grounding Chain
          </span>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-decorative)] font-mono font-medium text-[var(--text-primary)]">
              01 Raw Work
            </span>
            <ArrowRight size={12} className="text-[var(--text-secondary)]" />
            <span className="px-2 py-0.5 rounded bg-[var(--status-info-bg)] border border-[var(--status-info-border)] font-medium text-[var(--status-info-fg)]">
              02 Observer Quotes
            </span>
            <ArrowRight size={12} className="text-[var(--text-secondary)]" />
            <span className="px-2 py-0.5 rounded bg-teal-50 border border-teal-200 font-medium text-teal-800">
              03 Code Validated
            </span>
            <ArrowRight size={12} className="text-[var(--text-secondary)]" />
            <span className="px-2 py-0.5 rounded bg-[var(--status-info-bg)] border border-[var(--status-info-border)] font-medium text-[var(--status-info-fg)]">
              04 Diagnosis Inferred
            </span>
            <ArrowRight size={12} className="text-[var(--text-secondary)]" />
            <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 font-medium text-emerald-800">
              05 Verifier Audited
            </span>
          </div>
        </div>

        {
    /* Content Blocks */
  }
        <div className="space-y-4 text-xs">
          {
    /* 1. Observed Pattern */
  }
          <div className="rounded-xl border border-[var(--border-decorative)] bg-[var(--bg-surface)] p-4 space-y-1.5">
            <span className="font-semibold text-[var(--text-primary)] block text-[11px] uppercase tracking-wider text-[var(--status-info-fg)]">
              Diagnosed Learning Need:
            </span>
            <p className="text-[var(--text-primary)] leading-relaxed text-sm">
              {cluster.explanation}
            </p>
          </div>

          {
    /* 2. Affected Student Cohort */
  }
          <div className="rounded-xl border border-[var(--border-decorative)] bg-[var(--bg-surface)] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[var(--text-primary)] block text-[11px] uppercase tracking-wider text-[var(--status-info-fg)]">
                Affected Students ({cluster.studentCount} of {totalStudents} students, {cluster.percentageAffected}%):
              </span>
              <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                Priority: {cluster.teachingPriority.toUpperCase()}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {cluster.affectedStudentIds.map((id) => <button
    key={id}
    type="button"
    onClick={() => {
      onInspectStudent?.(id);
      onClose();
    }}
    className="font-mono text-[11px] font-semibold text-[var(--status-info-fg)] bg-[var(--status-info-bg)] hover:bg-[var(--status-info-bg)] border border-[var(--status-info-border)] px-2 py-1 rounded transition flex items-center gap-1"
  >
                  <User size={11} />
                  <span>{id}</span>
                </button>)}
            </div>
          </div>

          {
    /* 3. Supporting Evidence Excerpts */
  }
          <div className="rounded-xl border border-[var(--border-decorative)] bg-[var(--bg-surface)] p-4 space-y-3">
            <span className="font-semibold text-[var(--text-primary)] block text-[11px] uppercase tracking-wider text-[var(--status-info-fg)]">
              Supporting Citations from Student Work:
            </span>
            <div className="space-y-2">
              {cluster.evidenceExamples.map((ex, idx) => {
    const display = getEvidenceDisplay(ex.deterministicMatch, ex.sourceType);
    return <div
      key={idx}
      className="rounded-lg border border-[var(--border-decorative)] bg-[var(--bg-elevated)] p-3 space-y-1.5"
    >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono font-bold text-[var(--text-primary)]">
                        {ex.studentId}
                      </span>
                      <span className={`px-2 py-0.5 rounded font-semibold border ${display.badgeClass}`}>
                        {display.label}
                      </span>
                    </div>
                    <blockquote className="text-[var(--text-primary)] italic font-serif text-xs leading-relaxed">
                      &quot;{ex.excerpt}&quot;
                    </blockquote>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      <strong>Grounding Justification:</strong> {ex.groundingReason}
                    </p>
                  </div>;
  })}
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-[var(--border-decorative)] flex justify-end">
          <button
    type="button"
    onClick={onClose}
    className="px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--bg-interactive)] text-white hover:bg-[var(--bg-interactive)] transition"
  >
            Close
          </button>
        </div>
      </div>
    </div>;
};
export {
  WhyThisInsightModal
};
