import { ShieldCheck, Lock, CheckCircle2, Cpu } from "lucide-react";
const PrivacyTrustView = ({ onOpenCharter }) => {
  return <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-10">
      {
    /* Page Header */
  }
      <div className="space-y-3 pb-6 border-b border-[var(--border-default)]  transition-colors">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--bg-elevated)]  text-[var(--status-info-fg)]  border border-[var(--status-info-border)]  text-xs font-semibold">
          <ShieldCheck size={14} className="text-[var(--status-info-fg)] " />
          <span>Pre-Inference Data Governance Architecture</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--text-primary)]  font-heading">
          Privacy Before Inference &amp; AI Boundary
        </h1>
        <p className="text-sm sm:text-base text-[var(--text-secondary)]  leading-relaxed max-w-3xl">
          Student content is de-identified before it is sent to Gemini for analysis. LotusLearn operates on a fail-closed basis: if privacy checks cannot complete, AI inference is halted and teacher inputs remain safely preserved on the educator&apos;s device.
        </p>
      </div>

      {
    /* 5-Step Privacy Pipeline */
  }
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-[var(--text-primary)]  font-heading">
          The 5-Step Privacy &amp; Verification Journey
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
          <div className="rounded-2xl border border-[var(--border-default)]  bg-[var(--bg-surface)]  p-5 space-y-2 shadow-2xs transition-colors">
            <span className="text-[11px] font-mono font-bold text-[var(--text-primary)]  bg-[var(--bg-elevated)]  px-2 py-0.5 rounded">
              STEP 1
            </span>
            <h3 className="text-sm font-bold text-[var(--text-primary)] ">
              Artifact Submission
            </h3>
            <p className="text-xs text-[var(--text-secondary)]  leading-relaxed">
              Teacher submits student exit tickets or photographed worksheets.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border-default)]  bg-[var(--bg-surface)]  p-5 space-y-2 shadow-2xs transition-colors">
            <span className="text-[11px] font-mono font-bold text-[var(--text-primary)]  bg-[var(--bg-elevated)]  px-2 py-0.5 rounded">
              STEP 2
            </span>
            <h3 className="text-sm font-bold text-[var(--text-primary)] ">
              PII Gateway
            </h3>
            <p className="text-xs text-[var(--text-secondary)]  leading-relaxed">
              Sensitive Data Protection scans for names, emails, and phone numbers.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border-default)]  bg-[var(--bg-surface)]  p-5 space-y-2 shadow-2xs transition-colors">
            <span className="text-[11px] font-mono font-bold text-[var(--text-primary)]  bg-[var(--bg-elevated)]  px-2 py-0.5 rounded">
              STEP 3
            </span>
            <h3 className="text-sm font-bold text-[var(--text-primary)] ">
              Pseudonymization
            </h3>
            <p className="text-xs text-[var(--text-secondary)]  leading-relaxed">
              Roster IDs map to stable tokens (Student 01, Student 02).
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border-default)]  bg-[var(--bg-surface)]  p-5 space-y-2 shadow-2xs transition-colors">
            <span className="text-[11px] font-mono font-bold text-[var(--text-primary)]  bg-[var(--bg-elevated)]  px-2 py-0.5 rounded">
              STEP 4
            </span>
            <h3 className="text-sm font-bold text-[var(--text-primary)] ">
              Gemini Reasoning
            </h3>
            <p className="text-xs text-[var(--text-secondary)]  leading-relaxed">
              Only sanitized instructional text is transmitted to Gemini.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border-default)]  bg-[var(--bg-surface)]  p-5 space-y-2 shadow-2xs transition-colors">
            <span className="text-[11px] font-mono font-bold text-[var(--text-primary)]  bg-[var(--bg-elevated)]  px-2 py-0.5 rounded">
              STEP 5
            </span>
            <h3 className="text-sm font-bold text-[var(--text-primary)] ">
              Code Verification
            </h3>
            <p className="text-xs text-[var(--text-secondary)]  leading-relaxed">
              Deterministic code audits roster math &amp; quotation grounding.
            </p>
          </div>
        </div>
      </div>

      {
    /* Technical Disclosures & Guardrails */
  }
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-[var(--border-default)]  bg-[var(--bg-surface)]  p-6 space-y-4 shadow-2xs transition-colors">
          <div className="flex items-center gap-2">
            <Lock size={18} className="text-[var(--status-info-fg)] " />
            <h3 className="text-base font-bold text-[var(--text-primary)]  font-heading">
              Zero Raw PII Persistence
            </h3>
          </div>
          <ul className="space-y-2.5 text-xs text-[var(--text-secondary)]  leading-relaxed">
            <li className="flex items-start gap-2">
              <CheckCircle2 size={14} className="text-[var(--status-success-fg)]  mt-0.5 shrink-0" />
              <span><strong>Privacy Audit Objects:</strong> Contain finding counts and infoType totals only. Zero raw student names or contact data are stored.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={14} className="text-[var(--status-success-fg)]  mt-0.5 shrink-0" />
              <span><strong>Server &amp; Console Logs:</strong> Scrubbed of sensitive student text. Logs record durations, error taxonomy, and safe counts only.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={14} className="text-[var(--status-success-fg)]  mt-0.5 shrink-0" />
              <span><strong>Local Device Caching:</strong> Saved sessions reside in browser local storage. Data is never synced to tracking brokers.</span>
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-[var(--border-default)]  bg-[var(--bg-surface)]  p-6 space-y-4 shadow-2xs transition-colors">
          <div className="flex items-center gap-2">
            <Cpu size={18} className="text-[var(--status-info-fg)] " />
            <h3 className="text-base font-bold text-[var(--text-primary)]  font-heading">
              Provider Transparency &amp; Fail-Closed
            </h3>
          </div>
          <ul className="space-y-2.5 text-xs text-[var(--text-secondary)]  leading-relaxed">
            <li className="flex items-start gap-2">
              <CheckCircle2 size={14} className="text-[var(--status-success-fg)]  mt-0.5 shrink-0" />
              <span><strong>Fail-Closed Guarantee:</strong> If the privacy provider encounters a network timeout, quota exhaustion, or outage, the pipeline aborts immediately. Zero un-sanitized content reaches Gemini.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={14} className="text-[var(--status-success-fg)]  mt-0.5 shrink-0" />
              <span><strong>Hermetic Deterministic Engine:</strong> Offline unit test suites execute against a deterministic policy provider matching Google Cloud SDP REST v2 schemas.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={14} className="text-[var(--status-success-fg)]  mt-0.5 shrink-0" />
              <span><strong>Teacher Form Preservation:</strong> In the event of any scan failure, teacher inputs remain safely stored in the browser form for retry.</span>
            </li>
          </ul>
        </div>
      </div>

      {
    /* Charter CTA */
  }
      <div className="rounded-2xl bg-[var(--shell-bg)]  text-[var(--shell-text)] p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-[var(--shell-border)]  transition-colors">
        <div className="space-y-1">
          <h3 className="text-lg font-bold font-heading">
            LotusLearn Responsible AI Charter
          </h3>
          <p className="text-xs text-[var(--shell-text-muted)] max-w-xl leading-relaxed">
            Read our full ethical commitments including zero ability labeling, human-in-the-loop decision sovereignty, and non-stigmatizing cohorts.
          </p>
        </div>
        <button
    onClick={onOpenCharter}
    className="px-5 py-2.5 rounded-xl bg-[var(--shell-action-bg)] text-[var(--shell-action-fg)] hover:bg-[var(--shell-action-hover)] font-semibold text-xs shadow-xs transition shrink-0"
  >
          View Responsible AI Charter
        </button>
      </div>
    </div>;
};
export {
  PrivacyTrustView
};
