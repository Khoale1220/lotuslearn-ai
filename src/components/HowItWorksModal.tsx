import React, { useRef } from 'react';
import { X, ShieldCheck, Eye, Brain, CheckCheck, BookOpen, UserCheck, Cpu, ArrowRight } from 'lucide-react';
import { useModalFocus } from '../utils/useModalFocus';

interface HowItWorksModalProps {
  onClose: () => void;
}

export const HowItWorksModal: React.FC<HowItWorksModalProps> = ({ onClose }) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useModalFocus<HTMLDivElement>({
    onClose,
    initialFocusRef: closeButtonRef,
  });

  const stages = [
    {
      num: '01',
      title: 'Protect · Privacy Before Inference',
      provider: 'Google Cloud SDP',
      desc: 'Sensitive identifiers (names, emails, phones) are de-identified before model ingestion. Images have sensitive rectangles redacted.',
      icon: ShieldCheck,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    },
    {
      num: '02',
      title: 'Observe · Structured Student Profiles',
      provider: 'Gemini 3.8 Flash',
      desc: 'Extracts factual observations and anchors exact student quotes. Dissects each student submission against the learning rubric without premature labels.',
      icon: Eye,
      color: 'text-blue-600 bg-blue-50 border-blue-200',
    },
    {
      num: '03',
      title: 'Diagnose · Shared Pattern Clustering',
      provider: 'Gemini 3.8 Flash',
      desc: 'Synthesizes observations into systemic class-wide misconceptions, affected student counts, and instructional urgency ratings.',
      icon: Brain,
      color: 'text-purple-600 bg-purple-50 border-purple-200',
    },
    {
      num: '04',
      title: 'Validate · Deterministic Code Auditing',
      provider: 'Independent Software Code',
      desc: 'Validates roster math, student identity contracts, and verifies verbatim quotation presence in student work to prevent hallucinated citations.',
      icon: CheckCheck,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    },
    {
      num: '05',
      title: 'Plan · Targeted Next-Lesson Scaffolds',
      provider: 'Gemini 3.8 Flash',
      desc: 'Builds a 25-minute lesson sequence, dynamic instructional cohorts (Ready to Extend, Reinforce, Targeted Support), and exit tickets.',
      icon: BookOpen,
      color: 'text-amber-600 bg-amber-50 border-amber-200',
    },
    {
      num: '06',
      title: 'Verify · Educator Decision Sovereignty',
      provider: 'Gemini Verifier + Teacher Authority',
      desc: 'Independent semantic auditing checks recommendation plausibility. The teacher retains final authority: Accept, Edit, or Dismiss each recommendation.',
      icon: UserCheck,
      color: 'text-rose-600 bg-rose-50 border-rose-200',
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="how-it-works-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-2xl rounded-3xl bg-white p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto border border-slate-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200">
              <Cpu size={22} />
            </div>
            <div>
              <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider block mb-0.5">
                Technical Architecture
              </span>
              <h2 id="how-it-works-title" className="text-xl font-bold text-slate-900 font-heading">
                How LotusLearn Works: The 6-Stage Pipeline
              </h2>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Value Statement */}
        <p className="text-xs text-slate-600 leading-relaxed">
          LotusLearn is not a generic chatbot wrapper. It is a multi-stage evidence-verifiable pipeline combining Google Cloud Sensitive Data Protection, Gemini multi-stage reasoning, and deterministic programmatic validation.
        </p>

        {/* 6 Stages Grid */}
        <div className="space-y-3">
          {stages.map((stage) => {
            const Icon = stage.icon;
            return (
              <div
                key={stage.num}
                className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-2 hover:bg-slate-50 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-400">
                      {stage.num}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">
                      {stage.title}
                    </h3>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${stage.color}`}>
                    {stage.provider}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pl-6">
                  {stage.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* Close Button */}
        <div className="pt-2 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition"
          >
            Done Inspecting
          </button>
        </div>
      </div>
    </div>
  );
};
