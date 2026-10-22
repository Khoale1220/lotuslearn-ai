import React, { useRef } from 'react';
import { X, ShieldCheck, UserCheck, Lock } from 'lucide-react';
import { LotusIcon } from './icons/LotusIcon';
import { useModalFocus } from '../utils/useModalFocus';

interface ResponsibleAIModalProps {
  onClose: () => void;
}

export const ResponsibleAIModal: React.FC<ResponsibleAIModalProps> = ({ onClose }) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useModalFocus<HTMLDivElement>({
    onClose,
    initialFocusRef: closeButtonRef,
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="responsible-ai-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-2xl rounded-2xl bg-white p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto border border-slate-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200">
              <ShieldCheck size={22} />
            </div>
            <div>
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider block mb-0.5">
                Ethical Governance &amp; Human-Centered AI
              </span>
              <h2 id="responsible-ai-title" className="text-lg font-bold text-slate-900">
                LotusLearn Responsible AI Charter
              </h2>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            aria-label="Close charter modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Human in the loop statement */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 text-xs text-blue-900 space-y-2">
          <span className="font-bold flex items-center gap-1.5 text-sm">
            <UserCheck size={16} className="text-blue-700" />
            Human-in-the-Loop Decision Support Principle
          </span>
          <p className="leading-relaxed text-blue-800">
            <strong>LotusLearn assists teacher decision-making; it does not replace educator judgment.</strong>{' '}
            Teachers explicitly review generated misconceptions and interventions before adopting them, with one-click actions to Accept, Edit, or Dismiss each recommendation. Formative groupings, lesson phases, and technical verification checks remain transparently inspectable.
          </p>
        </div>

        {/* Strict Ethical Guardrails Grid */}
        <div className="space-y-4 text-xs">
          <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
            Ethical Guardrails Enforced Across the Architecture:
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="rounded-lg border border-slate-200 p-3 space-y-1 bg-slate-50/50">
              <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                <span className="text-rose-600 font-bold" aria-hidden="true">✕</span>
                <span>Zero Permanent Ability Labels</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                The system prohibits static categorization such as &quot;slow&quot;, &quot;gifted&quot;, or &quot;low ability&quot;. All cohorts are formative and dynamic (&quot;Needs Concept Clarification&quot;, &quot;Ready for Extension&quot;).
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 p-3 space-y-1 bg-slate-50/50">
              <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                <span className="text-rose-600 font-bold" aria-hidden="true">✕</span>
                <span>No Student Ranking or Tracking</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                LotusLearn does not rank students or generate comparative scores. The architecture focuses strictly on identifying collective misconception clusters and formative remedies.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 p-3 space-y-1 bg-slate-50/50">
              <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                <span className="text-emerald-600 font-bold" aria-hidden="true">✓</span>
                <span>Deterministic Code Verification</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                AI outputs are audited by deterministic software code checks to verify student coverage, arithmetic consistency, and exact quote grounding against student submissions.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 p-3 space-y-1 bg-slate-50/50">
              <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                <Lock size={13} className="text-blue-600" aria-hidden="true" />
                <span>Local Device Storage</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Saved sessions are archived locally in your browser storage. Session data is never persisted to unauthorized public databases or external tracking brokers.
              </p>
            </div>

            <div className="rounded-lg border border-blue-200 p-3 space-y-1 bg-blue-50/40 sm:col-span-2">
              <div className="flex items-center gap-1.5 font-semibold text-blue-950">
                <ShieldCheck size={14} className="text-blue-700" aria-hidden="true" />
                <span>Google Cloud Sensitive Data Protection Gateway</span>
              </div>
              <p className="text-blue-900 leading-relaxed">
                Student submissions pass through a pre-AI privacy boundary before model ingestion. Identifying information (names, email addresses, phone numbers) is de-identified and replaced with privacy tokens. The system operates on a fail-closed basis: if privacy checks cannot complete, AI analysis is aborted and teacher inputs are safely preserved.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition"
          >
            Close Charter
          </button>
        </div>
      </div>
    </div>
  );
};
