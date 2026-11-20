import { useRef } from "react";
import { X, ShieldCheck, UserCheck, Lock } from "lucide-react";
import { useModalFocus } from "../utils/useModalFocus";
const ResponsibleAIModal = ({ onClose }) => {
  const closeButtonRef = useRef(null);
  const modalRef = useModalFocus({
    onClose,
    initialFocusRef: closeButtonRef
  });
  return <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="responsible-ai-title"
    className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-scrim)] p-4 backdrop-blur-xs"
    onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}
  >
      <div
    ref={modalRef}
    className="relative w-full max-w-2xl rounded-2xl bg-[var(--bg-surface)] p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto border border-[var(--border-default)] text-[var(--text-primary)]"
  >
        {
    /* Header */
  }
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border-default)]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--status-info-bg)] text-[var(--status-info-fg)] border border-[var(--status-info-border)]">
              <ShieldCheck size={22} />
            </div>
            <div>
              <span className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider block mb-0.5">
                Ethical Governance and Human-Centered AI
              </span>
              <h2 id="responsible-ai-title" className="text-lg font-bold text-[var(--text-primary)]">
                Model Governance
              </h2>
            </div>
          </div>

          <button
    ref={closeButtonRef}
    type="button"
    onClick={onClose}
    className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-canvas)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
    aria-label="Close governance modal"
  >
            <X size={18} />
          </button>
        </div>

        {
    /* Human in the loop statement */
  }
        <div className="rounded-xl border border-[var(--status-info-border)] bg-[var(--status-info-bg)] p-4 text-xs text-[var(--status-info-fg)] space-y-2">
          <span className="font-bold flex items-center gap-1.5 text-sm text-[var(--status-info-fg)]">
            <UserCheck size={16} className="text-[var(--status-info-fg)]" />
            Human-in-the-Loop Decision Support Principle
          </span>
          <p className="leading-relaxed text-[var(--status-info-fg)]">
            <strong>LotusLearn assists teacher decision-making; it does not replace educator judgment.</strong>{" "}
            Teachers explicitly review generated misconceptions and interventions before adopting them, with one-click actions to Accept, Edit, or Dismiss each recommendation. Formative groupings, lesson phases, and technical verification checks remain transparently inspectable.
          </p>
        </div>

        {
    /* Strict Ethical Guardrails Grid */
  }
        <div className="space-y-4 text-xs">
          <h3 className="font-bold text-[var(--text-primary)] uppercase tracking-wider text-[11px]">
            Ethical Guardrails Enforced Across the Architecture:
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="rounded-lg border border-[var(--border-default)] p-3 space-y-1 bg-[var(--bg-canvas)]">
              <div className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                <span className="text-[var(--status-error-fg)] font-bold" aria-hidden="true">✕</span>
                <span>Zero Permanent Ability Labels</span>
              </div>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                The system prohibits static categorization such as &quot;slow&quot;, &quot;gifted&quot;, or &quot;low ability&quot;. All cohorts are formative and dynamic (&quot;Needs Concept Clarification&quot;, &quot;Ready for Extension&quot;).
              </p>
            </div>

            <div className="rounded-lg border border-[var(--border-default)] p-3 space-y-1 bg-[var(--bg-canvas)]">
              <div className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                <span className="text-[var(--status-error-fg)] font-bold" aria-hidden="true">✕</span>
                <span>No Student Ranking or Tracking</span>
              </div>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                LotusLearn does not rank students or generate comparative scores. The architecture focuses strictly on identifying collective misconception clusters and formative remedies.
              </p>
            </div>

            <div className="rounded-lg border border-[var(--border-default)] p-3 space-y-1 bg-[var(--bg-canvas)]">
              <div className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                <span className="text-[var(--status-success-fg)] font-bold" aria-hidden="true">✓</span>
                <span>Deterministic Code Verification</span>
              </div>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                AI outputs are audited by deterministic software code checks to verify student coverage, arithmetic consistency, and exact quote grounding against student submissions.
              </p>
            </div>

            <div className="rounded-lg border border-[var(--border-default)] p-3 space-y-1 bg-[var(--bg-canvas)]">
              <div className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                <Lock size={13} className="text-[var(--status-info-fg)]" aria-hidden="true" />
                <span>Local Device Storage</span>
              </div>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                Saved sessions are archived locally in your browser storage. Session data is never persisted to unauthorized public databases or external tracking brokers.
              </p>
            </div>

            <div className="rounded-lg border border-[var(--status-info-border)] p-3 space-y-1 bg-[var(--status-info-bg)] sm:col-span-2">
              <div className="flex items-center gap-1.5 font-semibold text-[var(--status-info-fg)]">
                <ShieldCheck size={14} className="text-[var(--status-info-fg)]" aria-hidden="true" />
                <span>Sensitive Data Protection Gateway</span>
              </div>
              <p className="text-[var(--status-info-fg)] leading-relaxed">
                Student submissions pass through a pre-AI privacy boundary before model ingestion. Identifying information (names, email addresses, phone numbers) is de-identified and replaced with privacy tokens. The system operates on a fail-closed basis: if privacy checks cannot complete, AI analysis is aborted and teacher inputs are safely preserved.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-[var(--border-default)] flex justify-end">
          <button
    type="button"
    onClick={onClose}
    className="px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--action-primary-bg)] text-[var(--action-primary-text)] hover:bg-[var(--action-primary-hover)] transition"
  >
            Close Governance
          </button>
        </div>
      </div>
    </div>;
};
export {
  ResponsibleAIModal
};
