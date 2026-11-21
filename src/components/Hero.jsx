import { ArrowRight, Play, FileText, CheckCheck, Compass } from "lucide-react";
const Hero = ({ onStartAnalysis, onTryDemo }) => {
  return <div className="bg-[var(--bg-surface)] pt-8 pb-14 border-b border-[var(--border-default)] transition-colors">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl space-y-4">
          <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            Evidence-Grounded Formative Assessment
          </span>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[var(--text-primary)] leading-tight">
            Turn student work into a verifiable next-lesson plan.
          </h1>

          <p className="text-base text-[var(--text-secondary)] leading-relaxed max-w-2xl">
            Upload student written responses or photographed worksheets. LotusLearn groups shared learning needs, anchors findings to verbatim student evidence, and drafts targeted instructional interventions.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
    onClick={onTryDemo}
    className="inline-flex items-center gap-2 rounded-lg bg-[var(--action-primary-bg)] px-5 py-3 text-sm font-semibold text-[var(--action-primary-text)] transition hover:bg-[var(--action-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2"
  >
              <Play size={15} />
              <span>Try Demo Class</span>
            </button>

            <button
    onClick={onStartAnalysis}
    className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--action-secondary-bg)] px-5 py-3 text-sm font-semibold text-[var(--action-secondary-fg)] transition hover:bg-[var(--action-secondary-hover)] hover:border-[var(--border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
  >
              <span>Analyze Student Work</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {
    /* 3-Step Teacher Workflow */
  }
        <div className="mt-12 pt-8 border-t border-[var(--border-subtle)]">
          <h2 className="text-base font-bold text-[var(--text-primary)] mb-6">
            Workflow Architecture
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 space-y-2 transition-colors">
              <div className="flex items-center justify-between text-xs font-mono text-[var(--text-secondary)]">
                <span>01</span>
                <FileText size={16} className="text-[var(--text-secondary)]" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Ingest &amp; Sanitize Work
              </h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Student submissions are de-identified via Sensitive Data Protection prior to inference.
              </p>
            </div>

            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 space-y-2 transition-colors">
              <div className="flex items-center justify-between text-xs font-mono text-[var(--text-secondary)]">
                <span>02</span>
                <CheckCheck size={16} className="text-[var(--text-secondary)]" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Diagnose &amp; Validate
              </h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Gemini identifies misconception patterns while deterministic code verifies student ID coverage and quote provenance.
              </p>
            </div>

            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 space-y-2 transition-colors">
              <div className="flex items-center justify-between text-xs font-mono text-[var(--text-secondary)]">
                <span>03</span>
                <Compass size={16} className="text-[var(--text-secondary)]" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Educator Review
              </h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Review suggested groupings and lesson phases. Findings initialize in a pending state awaiting teacher decision.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>;
};
export {
  Hero
};
