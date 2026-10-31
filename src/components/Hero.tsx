import React from 'react';
import { ArrowRight, Play, FileText, CheckCheck, Compass } from 'lucide-react';

interface HeroProps {
  onStartAnalysis: () => void;
  onTryDemo: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onStartAnalysis, onTryDemo }) => {
  return (
    <div className="bg-white dark:bg-slate-900 pt-8 pb-14 border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl space-y-4">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Evidence-Grounded Formative Assessment
          </span>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-tight">
            Turn student work into a verifiable next-lesson plan.
          </h1>

          <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
            Upload student written responses or photographed worksheets. LotusLearn groups shared learning needs, anchors findings to verbatim student evidence, and drafts targeted instructional interventions.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={onTryDemo}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 dark:bg-indigo-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 dark:hover:bg-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
            >
              <Play size={15} />
              <span>Try Demo Class</span>
            </button>

            <button
              onClick={onStartAnalysis}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-3 text-sm font-semibold text-slate-800 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-750 hover:border-slate-400 dark:hover:border-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            >
              <span>Analyze Student Work</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {/* 3-Step Teacher Workflow */}
        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-6">
            Workflow Architecture
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 p-5 space-y-2 transition-colors">
              <div className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400">
                <span>01</span>
                <FileText size={16} className="text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Ingest &amp; Sanitize Work
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Student submissions are de-identified via Sensitive Data Protection prior to inference.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 p-5 space-y-2 transition-colors">
              <div className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400">
                <span>02</span>
                <CheckCheck size={16} className="text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Diagnose &amp; Validate
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Gemini identifies misconception patterns while deterministic code verifies student ID coverage and quote provenance.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 p-5 space-y-2 transition-colors">
              <div className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400">
                <span>03</span>
                <Compass size={16} className="text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Educator Review
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Review suggested groupings and lesson phases. Findings initialize in a pending state awaiting teacher decision.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
