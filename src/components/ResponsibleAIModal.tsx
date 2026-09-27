import React from 'react';
import { X, ShieldCheck, Check, AlertOctagon, UserCheck, Lock } from 'lucide-react';
import { LotusIcon } from './icons/LotusIcon';

interface ResponsibleAIModalProps {
  onClose: () => void;
}

export const ResponsibleAIModal: React.FC<ResponsibleAIModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                  Ethical Governance &amp; Trust
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-xs text-slate-500">Google Cloud AI Builder Cup 2026</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                LotusLearn Responsible AI Charter
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
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
            <strong>LotusLearn supports teacher decision-making. AI-generated insights should be reviewed by the teacher before instructional use.</strong>{' '}
            Educators retain full instructional agency and can Accept, Edit, or Dismiss any diagnosed misconception or intervention card with a single click.
          </p>
        </div>

        {/* Strict Ethical Guardrails Grid */}
        <div className="space-y-4 text-xs">
          <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
            Strict Ethical Guardrails Enforced at the Prompt &amp; System Level:
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="rounded-lg border border-slate-200 p-3 space-y-1 bg-slate-50/50">
              <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                <span className="text-rose-600 font-bold">✕</span>
                <span>Zero Permanent Ability Labels</span>
              </div>
              <p className="text-slate-600">
                System strictly prohibits terms such as &quot;weak&quot;, &quot;smart&quot;, &quot;low ability&quot;, or &quot;gifted&quot;. Only dynamic formative terms (&quot;Ready for Extension&quot;, &quot;Needs Guided Practice&quot;) are generated.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 p-3 space-y-1 bg-slate-50/50">
              <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                <span className="text-rose-600 font-bold">✕</span>
                <span>No Student Ranking or Tracking</span>
              </div>
              <p className="text-slate-600">
                LotusLearn does not rank students or generate comparative scores. The focus is exclusively on identifying collective misconceptions and immediate instructional remedies.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 p-3 space-y-1 bg-slate-50/50">
              <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                <span className="text-rose-600 font-bold">✕</span>
                <span>Zero Extraneous Inferences</span>
              </div>
              <p className="text-slate-600">
                The model is explicitly forbidden from inferring intelligence, psychological state, medical condition, socio-economic status, or protected personal characteristics.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 p-3 space-y-1 bg-slate-50/50">
              <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                <Check size={14} className="text-emerald-600" />
                <span>Strict Anonymization &amp; Privacy</span>
              </div>
              <p className="text-slate-600">
                Submissions utilize anonymized identifiers (e.g., &quot;Student 01&quot;, &quot;Student 02&quot;). No personally identifiable student records (PII) are stored or transmitted.
              </p>
            </div>
          </div>
        </div>

        {/* Verification and Grounding */}
        <div className="rounded-lg border border-slate-200 p-4 text-xs text-slate-700 space-y-1 bg-white">
          <span className="font-semibold text-slate-900 flex items-center gap-1.5">
            <Lock size={13} className="text-slate-500" />
            Adversarial Verifier &amp; Anti-Hallucination
          </span>
          <p className="text-slate-600 leading-relaxed">
            Every diagnostic claim and instructional group is cross-audited by Stage 4 against raw student text before presentation. If a claim lacks direct textual citation, it is flagged for teacher review.
          </p>
        </div>

        <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            LotusLearn AI · Team TTKK (Vietnam)
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition"
          >
            I Understand &amp; Agree
          </button>
        </div>
      </div>
    </div>
  );
};
