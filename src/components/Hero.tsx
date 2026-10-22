import React from 'react';
import { ArrowRight, Sparkles, CheckCircle2, FileText, CheckCheck, Compass } from 'lucide-react';
import { LotusIcon } from './icons/LotusIcon';

interface HeroProps {
  onStartAnalysis: () => void;
  onTryDemo: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onStartAnalysis, onTryDemo }) => {
  return (
    <div className="relative overflow-hidden bg-white pt-10 pb-16 lg:pb-24">
      {/* Subtle, restrained ambient accent */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 right-1/4 h-96 w-96 rounded-full bg-blue-50/50 blur-3xl" />
        <div className="absolute top-1/3 -left-20 h-80 w-80 rounded-full bg-slate-100/60 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Value-oriented kicker */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 mb-6">
          <span className="flex items-center gap-1.5 text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600" aria-hidden="true" />
            Evidence-Grounded Formative Assessment
          </span>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <span>From student responses to trusted teaching decisions</span>
        </div>

        {/* Main Hero Header */}
        <div className="max-w-3xl">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.12]">
            Turn student work into a verifiable next-lesson plan.
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl">
            Upload worksheets, written responses or classroom artifacts. LotusLearn identifies shared learning needs, shows the evidence, and helps teachers plan what happens next.
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              onClick={onTryDemo}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 active:scale-98"
            >
              <Sparkles size={16} className="text-amber-300" />
              <span>Try Demo Class</span>
            </button>

            <button
              onClick={onStartAnalysis}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3.5 text-sm font-semibold text-slate-800 shadow-2xs transition hover:bg-slate-50 hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 active:scale-98"
            >
              <span>Analyze Student Work</span>
              <ArrowRight size={16} />
            </button>
          </div>

          {/* Trust line */}
          <div className="mt-7 flex items-center gap-2 text-xs font-semibold text-slate-600">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            <span>Privacy before inference • Evidence-grounded insights • Teacher-controlled decisions</span>
          </div>
        </div>

        {/* 3-Step Teacher Workflow Cards */}
        <div className="mt-14 pt-10 border-t border-slate-200">
          <div className="max-w-2xl mb-8">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              How LotusLearn Works in Your Teaching Workflow
            </h2>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              An evidence-centered architecture that maintains strict boundaries between AI synthesis, code verification, and human judgment.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded">
                  STEP 01
                </span>
                <FileText size={18} className="text-slate-400" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Collect &amp; Ingest Student Work
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Add typed exit ticket responses or photographed worksheet pages. Individual evidence quotes are extracted and anchored directly to each student.
              </p>
            </div>

            {/* Step 2 */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-teal-700 bg-teal-100/70 px-2 py-0.5 rounded">
                  STEP 02
                </span>
                <CheckCheck size={18} className="text-slate-400" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Ground Evidence with Code Verification
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Deterministic code verifies roster arithmetic, class coverage, and verbatim quotation matches before independent semantic review audits claim plausibility.
              </p>
            </div>

            {/* Step 3 */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded">
                  STEP 03
                </span>
                <Compass size={18} className="text-slate-400" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Review &amp; Deliver Targeted Next Steps
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Access a 25-minute lesson plan, differentiated teaching scaffolds, and non-stigmatizing cohorts. Accept, edit, or dismiss any recommendation with a click.
              </p>
            </div>
          </div>
        </div>

        {/* Formative Assessment Reality vs LotusLearn Solution */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-6">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              The Reality in Classrooms
            </span>
            <h3 className="mt-2 text-base font-bold text-slate-900">
              Why Formative Assessment Often Breaks Down
            </h3>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              Collecting dozens of exit tickets and worksheets creates immense diagnostic overhead. Manually synthesizing 30+ responses to pinpoint root misconceptions takes hours, often arriving after the opportune instructional window has passed.
            </p>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-6">
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider block">
              The LotusLearn Promise
            </span>
            <h3 className="mt-2 text-base font-bold text-slate-900">
              From Student Work to Actionable Strategy
            </h3>
            <p className="mt-2 text-xs text-slate-700 leading-relaxed">
              LotusLearn transforms messy raw classroom evidence into an evidence-grounded instructional decision map: what the class mastered, which misconceptions are urgent, which students share exact learning needs, and what to teach in the next lesson.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
