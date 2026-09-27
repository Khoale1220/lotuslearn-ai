import React from 'react';
import { ArrowRight, Sparkles, CheckCircle2, Layers, Search, Cpu, Users, CalendarCheck, Shield } from 'lucide-react';
import { LotusIcon } from './icons/LotusIcon';

interface HeroProps {
  onStartAnalysis: () => void;
  onTryDemo: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onStartAnalysis, onTryDemo }) => {
  return (
    <div className="relative overflow-hidden bg-white pt-8 pb-16 lg:pb-24">
      {/* Subtle Background Accent */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 right-1/4 h-96 w-96 rounded-full bg-blue-50/60 blur-3xl" />
        <div className="absolute top-1/3 -left-20 h-80 w-80 rounded-full bg-rose-50/50 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Subtle Tagline kicker */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-6">
          <span className="font-semibold text-slate-900 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
            Google Cloud AI Builder Cup 2026
          </span>
          <span aria-hidden="true">·</span>
          <span>Powered by Hack2skill</span>
          <span aria-hidden="true">·</span>
          <span>TTKK • Vietnam</span>
        </div>

        {/* Main Hero Header */}
        <div className="max-w-4xl">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.12]">
            Understand your class.{' '}
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-indigo-700 to-rose-600">
              Decide what to teach next.
            </span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl leading-relaxed">
            LotusLearn AI turns student work into evidence-backed instructional
            decisions using Gemini. From raw student exit tickets to targeted
            differentiated intervention in 60 seconds.
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              onClick={onStartAnalysis}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow active:scale-98"
            >
              <span>Analyze a Class</span>
              <ArrowRight size={16} />
            </button>

            <button
              onClick={onTryDemo}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3.5 text-sm font-semibold text-slate-800 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-400 active:scale-98"
            >
              <Sparkles size={16} className="text-rose-500" />
              <span>Try Demo Classroom (Grade 10 English)</span>
            </button>
          </div>

          {/* Under-CTA Meta */}
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-600" />
              12 Pre-loaded Student Submissions
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-600" />
              Real Server-Side Gemini Workflow
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-600" />
              Zero Hard-Coded AI Summaries
            </span>
          </div>
        </div>

        {/* 4-Stage Architecture Pipeline Card */}
        <div className="mt-14 rounded-2xl border border-slate-200/90 bg-slate-900 text-white p-6 sm:p-8 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-800 gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-rose-400 uppercase tracking-wider">
                <LotusIcon size={18} className="text-rose-400" />
                <span>The Core Differentiator</span>
              </div>
              <h2 className="mt-1 text-xl font-bold text-white tracking-tight">
                Not a Chatbot: A 4-Stage Multi-Model Reasoning Architecture
              </h2>
            </div>
            <div className="text-xs text-slate-400">
              Built with Gemini + Google Cloud · Server-Side Execution
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-mono text-blue-400">
                <Search size={14} />
                <span>01. OBSERVER</span>
              </div>
              <h3 className="text-sm font-semibold text-white">Individual Evidence Extraction</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Ingests raw student typed text, handwriting, or worksheets. Evaluates against rubric and extracts exact quotation anchors.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-mono text-indigo-400">
                <Cpu size={14} />
                <span>02. DIAGNOSIS</span>
              </div>
              <h3 className="text-sm font-semibold text-white">Class Pattern Discovery</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Gemini reasons across the full cohort to detect shared misconception clusters, prevalence percentage, and priority ranking.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
                <Users size={14} />
                <span>03. STRATEGIST</span>
              </div>
              <h3 className="text-sm font-semibold text-white">Instructional Grouping &amp; Plan</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Creates non-stigmatizing instructional cohorts, differentiated micro-interventions, and a realistic 25-minute tomorrow lesson.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-mono text-rose-400">
                <Shield size={14} />
                <span>04. VERIFIER</span>
              </div>
              <h3 className="text-sm font-semibold text-white">Independent Grounding Audit</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                An adversarial verification stage cross-references every AI claim against ground-truth student submissions to prevent hallucination.
              </p>
            </div>
          </div>
        </div>

        {/* The Teacher Pain Point / Contrast Section */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-6 sm:p-8">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              The Reality in Classrooms
            </span>
            <h3 className="mt-2 text-lg font-bold text-slate-900">
              Why Formative Assessment Breaks Down
            </h3>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              Teachers in Vietnam and globally collect dozens of exit tickets, handwritten worksheets, and quiz paragraphs every week. Sifting through 35+ responses to identify systemic root causes takes hours — meaning feedback arrives too late for the very next morning's lesson.
            </p>
            <div className="mt-4 pt-4 border-t border-slate-200/80 text-xs text-slate-500 space-y-1.5">
              <p className="flex items-center gap-2 text-rose-600">
                <span>✕</span> Single-response AI tools don't spot class-wide trends.
              </p>
              <p className="flex items-center gap-2 text-rose-600">
                <span>✕</span> Generic AI prompts return ungrounded pedagogy clichés.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-6 sm:p-8">
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
              The LotusLearn Promise
            </span>
            <h3 className="mt-2 text-lg font-bold text-slate-900">
              From Student Work to Actionable Strategy
            </h3>
            <p className="mt-3 text-sm text-slate-700 leading-relaxed">
              LotusLearn transforms messy raw classroom evidence into an evidence-grounded instructional decision map: what the class mastered, which misconceptions are urgent, which students share exact learning needs, and what to teach in the first 25 minutes tomorrow.
            </p>
            <div className="mt-4 pt-4 border-t border-blue-200/80 text-xs text-slate-600 space-y-1.5">
              <p className="flex items-center gap-2 text-emerald-700 font-medium">
                <span>✓</span> Whole-class pattern synthesis backed by verbatim quotes.
              </p>
              <p className="flex items-center gap-2 text-emerald-700 font-medium">
                <span>✓</span> Formative groups without permanent ability labels.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
