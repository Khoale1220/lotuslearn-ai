import React from 'react';
import { PlusCircle, Sparkles, BookOpen, Users, AlertCircle, Lightbulb, ArrowUpRight, Clock, HardDrive } from 'lucide-react';
import { ClassAnalysisResult } from '../types';
import { getCanonicalTeacherDecision } from '../utils/verificationDisplay';

interface DashboardProps {
  onNewAnalysis: () => void;
  onTryDemo: () => void;
  onSelectSavedAnalysis: (analysis: ClassAnalysisResult) => void;
  savedAnalyses: ClassAnalysisResult[];
}

export const Dashboard: React.FC<DashboardProps> = ({
  onNewAnalysis,
  onTryDemo,
  onSelectSavedAnalysis,
  savedAnalyses,
}) => {
  // Aggregate stats across real sessions
  const totalClasses = savedAnalyses.length;
  const totalSamples = savedAnalyses.reduce(
    (acc, cur) => acc + (cur.studentObservations?.length || cur.classSnapshot?.totalSubmissions || 0),
    0
  );
  const totalMisconceptions = savedAnalyses.reduce(
    (acc, cur) => acc + (cur.misconceptionClusters?.length || 0),
    0
  );
  const totalInterventions = savedAnalyses.reduce(
    (acc, cur) => acc + (cur.interventions?.length || 0),
    0
  );

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
      {/* Top Banner & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Formative Assessment Dashboard
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600">
            Evidence-backed diagnostic insights and instructional interventions for your classes.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onTryDemo}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-800 shadow-2xs transition hover:bg-slate-50 hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 active:scale-98"
          >
            <Sparkles size={16} className="text-rose-500" />
            <span>Try Demo Classroom</span>
          </button>
          <button
            onClick={onNewAnalysis}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-2xs transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 active:scale-98"
          >
            <PlusCircle size={16} />
            <span>New Analysis</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Cards (Zero-pill discipline, decision-oriented metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Classes Analyzed</span>
            <BookOpen size={18} className="text-blue-600" aria-hidden="true" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{totalClasses}</span>
            <span className="text-xs text-slate-500">sessions</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">Formative assessment sessions processed</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Student Responses</span>
            <Users size={18} className="text-indigo-600" aria-hidden="true" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{totalSamples}</span>
            <span className="text-xs text-slate-500">submissions</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">Worksheets &amp; exit tickets examined</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Diagnosed Patterns</span>
            <AlertCircle size={18} className="text-rose-600" aria-hidden="true" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{totalMisconceptions}</span>
            <span className="text-xs text-slate-500">clusters</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">Systemic class-wide patterns identified</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Teaching Scaffolds</span>
            <Lightbulb size={18} className="text-amber-600" aria-hidden="true" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{totalInterventions}</span>
            <span className="text-xs text-slate-500">action plans</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">Differentiated lesson scaffolds prepared</p>
        </div>
      </div>

      {/* Saved Analyses Section */}
      <section aria-labelledby="saved-analyses-heading" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1">
          <div>
            <h2 id="saved-analyses-heading" className="text-lg font-bold text-slate-900">
              Saved Analyses
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
              <HardDrive size={13} className="text-slate-400" />
              <span>Saved locally on this device</span>
            </div>
          </div>
          <span className="text-xs text-slate-500">Click any session to view evidence and next-lesson plan</span>
        </div>

        {savedAnalyses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <BookOpen size={22} />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-slate-900">No saved analyses yet</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              When you analyze student responses, your diagnostic summaries, evidence quotes, and next-lesson plans will be saved here on your device.
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                onClick={onTryDemo}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 transition"
              >
                <span>Try Demo Classroom</span>
                <ArrowUpRight size={14} />
              </button>
              <button
                onClick={onNewAnalysis}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                <span>Start New Analysis</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
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
                  className="w-full text-left flex flex-col sm:flex-row sm:items-center justify-between p-5 hover:bg-slate-50/80 transition-colors gap-4 focus-visible:outline-none focus-visible:bg-blue-50/50"
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
                    <h3 className="text-base font-semibold text-slate-900">
                      {analysis.context.lessonTitle}
                    </h3>
                    <p className="text-xs text-slate-600 line-clamp-1 max-w-2xl">
                      {analysis.context.learningObjective}
                    </p>
                  </div>

                  <div className="flex items-center gap-6 self-start sm:self-center shrink-0">
                    <div className="text-right text-xs">
                      <span className="font-medium text-slate-900">
                        {analysis.classSnapshot?.misconceptionCount || analysis.misconceptionClusters?.length || 0}
                      </span>{' '}
                      <span className="text-slate-500">patterns</span>
                      <span className="mx-2 text-slate-300">|</span>
                      <span className="font-medium text-slate-900">
                        {analysis.studentObservations?.length || analysis.classSnapshot?.totalSubmissions || 0}
                      </span>{' '}
                      <span className="text-slate-500">students</span>
                    </div>

                    <span className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800">
                      Inspect <ArrowUpRight size={14} className="ml-1" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Human-in-the-Loop Pedagogical Principle Notice */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-600 flex items-start gap-3">
        <div className="h-2 w-2 rounded-full bg-blue-500 mt-1 shrink-0" aria-hidden="true" />
        <p className="leading-relaxed">
          <strong className="text-slate-800">Human-in-the-Loop Decision Support:</strong>{' '}
          LotusLearn supports teacher decision-making. AI-generated insights, groupings, and next-lesson plans are suggestions designed to be reviewed and approved by the educator before classroom instruction.
        </p>
      </div>
    </div>
  );
};
