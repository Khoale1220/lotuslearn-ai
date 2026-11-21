import { useRef } from "react";
import { X, ShieldCheck, Eye, Brain, CheckCheck, BookOpen, UserCheck, Cpu } from "lucide-react";
import { useModalFocus } from "../utils/useModalFocus";
const HowItWorksModal = ({ onClose }) => {
  const closeButtonRef = useRef(null);
  const modalRef = useModalFocus({
    onClose,
    initialFocusRef: closeButtonRef
  });
  const stages = [
    {
      num: "01",
      title: "Protect - Privacy Before Inference",
      provider: "Sensitive Data Protection",
      desc: "Sensitive identifiers (names, emails, phones) are de-identified before model ingestion. Images have sensitive rectangles redacted.",
      icon: ShieldCheck,
      color: "text-[var(--text-primary)] bg-[var(--bg-elevated)] border-[var(--border-brand)]"
    },
    {
      num: "02",
      title: "Observe - Structured Student Profiles",
      provider: "Gemini 3.8 Flash",
      desc: "Extracts factual observations and anchors exact student quotes. Dissects each student submission against the learning rubric without premature labels.",
      icon: Eye,
      color: "text-[var(--text-primary)] bg-[var(--bg-elevated)] border-[var(--border-brand)]"
    },
    {
      num: "03",
      title: "Diagnose - Shared Pattern Clustering",
      provider: "Gemini 3.8 Flash",
      desc: "Synthesizes observations into systemic class-wide misconceptions, affected student counts, and instructional urgency ratings.",
      icon: Brain,
      color: "text-[var(--text-primary)] bg-[var(--bg-elevated)] border-[var(--border-brand)]"
    },
    {
      num: "04",
      title: "Validate - Deterministic Code Auditing",
      provider: "Independent Software Code",
      desc: "Validates roster math, student identity contracts, and verifies verbatim quotation presence in student work to prevent hallucinated citations.",
      icon: CheckCheck,
      color: "text-[var(--text-primary)] bg-[var(--bg-elevated)] border-[var(--border-brand)]"
    },
    {
      num: "05",
      title: "Plan - Targeted Next-Lesson Scaffolds",
      provider: "Gemini 3.8 Flash",
      desc: "Builds a 25-minute lesson sequence, dynamic instructional cohorts (Ready to Extend, Reinforce, Targeted Support), and exit tickets.",
      icon: BookOpen,
      color: "text-[var(--text-primary)] bg-[var(--bg-elevated)] border-[var(--border-brand)]"
    },
    {
      num: "06",
      title: "Verify - Educator Decision Sovereignty",
      provider: "Gemini Verifier + Teacher Authority",
      desc: "Independent semantic auditing checks recommendation plausibility. The teacher retains final authority: Accept, Edit, or Dismiss each recommendation.",
      icon: UserCheck,
      color: "text-[var(--text-primary)] bg-[var(--bg-elevated)] border-[var(--border-brand)]"
    }
  ];
  return <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="how-it-works-title"
    className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-scrim)] p-4 backdrop-blur-xs"
    onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}
  >
      <div
    ref={modalRef}
    className="relative w-full max-w-2xl rounded-3xl bg-[var(--bg-surface)] text-[var(--text-primary)] p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto border border-[var(--border-default)]"
  >
        {
    /* Header */
  }
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border-default)]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-brand)]">
              <Cpu size={22} />
            </div>
            <div>
              <span className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider block mb-0.5">
                Technical Architecture
              </span>
              <h2 id="how-it-works-title" className="text-xl font-bold text-[var(--text-primary)] font-heading">
                How LotusLearn Works: The 6-Stage Pipeline
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
    /* Value Statement */
  }
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          LotusLearn is not a generic chatbot wrapper. It is a multi-stage evidence-verifiable pipeline combining Google Cloud Sensitive Data Protection, Gemini multi-stage reasoning, and deterministic programmatic validation.
        </p>

        {
    /* 6 Stages Grid */
  }
        <div className="space-y-3">
          {stages.map((stage) => <div
    key={stage.num}
    className="rounded-2xl border border-[var(--border-default)] bg-[var(--overlay-scrim)] p-4 space-y-2 hover:bg-[var(--bg-elevated)] transition"
  >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[var(--text-primary)]">
                      {stage.num}
                    </span>
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">
                      {stage.title}
                    </h3>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${stage.color}`}>
                    {stage.provider}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed pl-6">
                  {stage.desc}
                </p>
              </div>)}
        </div>

        {
    /* Close Button */
  }
        <div className="pt-2 border-t border-[var(--border-default)] flex justify-end">
          <button
    type="button"
    onClick={onClose}
    className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition"
  >
            Done Inspecting
          </button>
        </div>
      </div>
    </div>;
};
export {
  HowItWorksModal
};
