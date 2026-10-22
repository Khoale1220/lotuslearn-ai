import React from 'react';
import {
  ArrowRight,
  Sparkles,
  FileText,
  Camera,
  FileCheck,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Brain,
  Users,
  HardDrive,
  ArrowUpRight,
  PlusCircle,
  HelpCircle,
} from 'lucide-react';
import { ClassAnalysisResult } from '../types';
import { getCanonicalTeacherDecision } from '../utils/verificationDisplay';

interface OverviewDashboardProps {
  onStartAnalysis: () => void;
  onTryDemo: () => void;
  onSelectSavedAnalysis: (analysis: ClassAnalysisResult) => void;
  savedAnalyses: ClassAnalysisResult[];
  onOpenHowItWorks: () => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  onStartAnalysis,
  onTryDemo,
  onSelectSavedAnalysis,
  savedAnalyses,
  onOpenHowItWorks,
}) => {
  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-10">
      {/* ========================================================================= */}
      {/* 1. HERO SECTION (Answers value in < 10 seconds: Action before Analytics) */}
      {/* ========================================================================= */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-10 shadow-xs relative overflow-hidden">
        {/* Ambient subtle background glow */}
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-96 h-96 rounded-full bg-indigo-50/70 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/3 -mb-16 w-64 h-64 rounded-full bg-blue-50/50 blur-2xl pointer-events-none" />

        <div className="relative max-w-3xl space-y-5">
          {/* Friendly Greeting Kicker */}
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700">
            <span className="text-base" role="img" aria-label="waving hand">👋</span>
            <span>Good morning, Ms. Lan Anh</span>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span className="text-slate-500 font-medium">Grade 10 English Assessment Copilot</span>
          </div>

          {/* Primary Proposition */}
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.15] font-heading">
              Turn student work into a verifiable next-lesson plan.
            </h1>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl">
              Upload worksheets, written responses or classroom artifacts. LotusLearn identifies shared learning needs, shows the evidence, and helps teachers plan what happens next.
            </p>
          </div>

          {/* Action CTAs: Primary Try Demo Class, Secondary Analyze Student Work */}
          <div className="pt-2 flex flex-wrap items-center gap-3 sm:gap-4">
            <button
              onClick={onTryDemo}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-6 py-3.5 text-sm font-semibold text-white shadow-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 active:scale-98"
            >
              <Sparkles size={16} className="text-amber-300" />
              <span>Try Demo Class</span>
            </button>

            <button
              onClick={onStartAnalysis}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 hover:border-slate-400 px-5 py-3.5 text-sm font-semibold text-slate-800 shadow-2xs transition active:scale-98"
            >
              <span>Analyze Student Work</span>
              <ArrowRight size={16} />
            </button>
          </div>

          {/* Trust line */}
          <div className="pt-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
            <ShieldCheck size={15} className="text-emerald-600 shrink-0" />
            <span>Privacy before inference • Evidence-grounded insights • Teacher-controlled decisions</span>
          </div>

          {/* Supported Artifact Indicators */}
          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">Supported artifacts:</span>
            <span className="inline-flex items-center gap-1.5">
              <FileText size={14} className="text-indigo-600" />
              <span>Written responses</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Camera size={14} className="text-indigo-600" />
              <span>Worksheet photos</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <FileCheck size={14} className="text-indigo-600" />
              <span>PDF assessments</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span>Exit tickets</span>
            </span>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. THE THREE FOUNDATIONAL PILLARS (Innovation & Trust Differentiation)    */}
      {/* ========================================================================= */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md font-mono">
              01 · PRIVACY FIRST
            </span>
            <ShieldCheck size={20} className="text-emerald-600" />
          </div>
          <h3 className="text-base font-bold text-slate-900 font-heading">
            Privacy Before Inference
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Student names, emails, and phone numbers are de-identified via Google Cloud Sensitive Data Protection before content ever reaches Gemini. Zero raw student PII in prompts or persistent logs.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-md font-mono">
              02 · EVIDENCE GROUNDED
            </span>
            <FileCheck size={20} className="text-teal-600" />
          </div>
          <h3 className="text-base font-bold text-slate-900 font-heading">
            Verifiable Evidence Citations
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Every diagnosed misconception links directly to verbatim student quotes. Deterministic code cross-checks student IDs and quotation existence to prevent hallucinated diagnostic claims.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-md font-mono">
              03 · TEACHER AGENCY
            </span>
            <CheckCircle2 size={20} className="text-amber-600" />
          </div>
          <h3 className="text-base font-bold text-slate-900 font-heading">
            Educator Decision Authority
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            AI recommends; teachers decide. Accept, edit, or dismiss any grouping or lesson phase. No permanent ability labels or static student tracking. Human judgment remains sovereign.
          </p>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. RECENT ANALYSES & SAVED SESSIONS                                       */}
      {/* ========================================================================= */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1">
          <div>
            <h2 className="text-lg font-bold text-slate-900 font-heading">
              Recent Class Analyses
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
              <HardDrive size={13} className="text-slate-400" />
              <span>Cached locally on this device · Zero external database tracking</span>
            </div>
          </div>
          <button
            onClick={onOpenHowItWorks}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1 self-start sm:self-auto"
          >
            <HelpCircle size={13} />
            <span>How the 6-stage pipeline works</span>
          </button>
        </div>

        {savedAnalyses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <Brain size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-900">
                No class analyses yet
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                When you analyze student responses, your diagnostic summaries, verbatim evidence quotes, and next-lesson plans will be saved here.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={onTryDemo}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs font-semibold text-white shadow-2xs transition"
              >
                <span>Try Demo Classroom</span>
                <ArrowUpRight size={14} />
              </button>
              <button
                onClick={onStartAnalysis}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 transition"
              >
                <PlusCircle size={14} />
                <span>Start New Analysis</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
            {savedAnalyses.map((analysis) => {
              const clusters = analysis.misconceptionClusters || [];
              const acceptedCount = clusters.filter(
                (c) => getCanonicalTeacherDecision(c) === 'accepted'
              ).length;
              const pendingCount = clusters.filter(
                (c) => getCanonicalTeacherDecision(c) === 'pending'
              ).length;

              return (
                <button
                  key={analysis.id}
                  onClick={() => onSelectSavedAnalysis(analysis)}
                  className="w-full text-left flex flex-col sm:flex-row sm:items-center justify-between p-5 hover:bg-slate-50/80 transition-colors gap-4 focus-visible:outline-none focus-visible:bg-indigo-50/40"
                  aria-label={`Open session ${analysis.context.lessonTitle}`}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-slate-900">{analysis.context.subject}</span>
                      <span aria-hidden="true">·</span>
                      <span>{analysis.context.gradeLevel}</span>
                      <span aria-hidden="true">·</span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(analysis.timestamp).toLocaleDateString()}
                      </span>
                      {acceptedCount > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-emerald-700 font-medium">
                            {acceptedCount} accepted
                          </span>
                        </>
                      )}
                      {pendingCount > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-amber-700 font-medium">
                            {pendingCount} review pending
                          </span>
                        </>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      {analysis.context.lessonTitle}
                    </h3>
                    <p className="text-xs text-slate-600 line-clamp-1 max-w-2xl">
                      {analysis.context.learningObjective}
                    </p>
                  </div>

                  <div className="flex items-center gap-6 self-start sm:self-center shrink-0">
                    <div className="text-right text-xs">
                      <span className="font-bold text-slate-900 font-mono">
                        {analysis.classSnapshot?.misconceptionCount || clusters.length}
                      </span>{' '}
                      <span className="text-slate-500">patterns</span>
                      <span className="mx-2 text-slate-300">|</span>
                      <span className="font-bold text-slate-900 font-mono">
                        {analysis.studentObservations?.length || analysis.classSnapshot?.totalSubmissions || 0}
                      </span>{' '}
                      <span className="text-slate-500">students</span>
                    </div>

                    <span className="inline-flex items-center text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                      Open Results <ArrowUpRight size={14} className="ml-1" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
