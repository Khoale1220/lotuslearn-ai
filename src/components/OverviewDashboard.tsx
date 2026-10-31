import React from 'react';
import {
  ArrowRight,
  Play,
  Clock,
  ArrowUpRight,
  PlusCircle,
  FolderOpen,
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
  const totalSubmissions = savedAnalyses.reduce(
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
      {/* Header & Primary Actions */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 transition-colors">
        <div className="max-w-3xl space-y-3">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Diagnostic Assessment Workspace
          </span>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Formative Assessment &amp; Misconception Diagnosis
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
            Ingest student responses, review anchored evidence citations, and evaluate suggested instructional groupings for tomorrow’s lesson.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={onTryDemo}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
            >
              <Play size={14} />
              <span>Try Demo Class</span>
            </button>

            <button
              onClick={onStartAnalysis}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 transition"
            >
              <span>Analyze Submissions</span>
              <ArrowRight size={15} />
            </button>

            <button
              onClick={onOpenHowItWorks}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium px-2 py-2 ml-auto"
            >
              Pipeline architecture
            </button>
          </div>
        </div>
      </section>

      {/* Operational Metrics */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 transition-colors">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Analysis Sessions</span>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">
            {savedAnalyses.length}
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-500 mt-1 block">Completed runs</span>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 transition-colors">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Submissions Processed</span>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">
            {totalSubmissions}
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-500 mt-1 block">De-identified &amp; analyzed</span>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 transition-colors">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Diagnosed Clusters</span>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">
            {totalMisconceptions}
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-500 mt-1 block">Anchored to student quotes</span>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 transition-colors">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Draft Interventions</span>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">
            {totalInterventions}
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-500 mt-1 block">Subject to teacher review</span>
        </div>
      </section>

      {/* Recent Runs */}
      <section className="space-y-3">
        <div className="flex items-center justify-between pb-1">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Recent Analysis Runs
          </h2>
        </div>

        {savedAnalyses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center space-y-3 transition-colors">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              <FolderOpen size={20} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">No session runs yet</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Run an analysis on sample or custom student work to view diagnostic findings.
              </p>
            </div>
            <div className="pt-2 flex justify-center gap-3">
              <button
                onClick={onTryDemo}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white transition"
              >
                <span>Try Demo Class</span>
                <ArrowUpRight size={14} />
              </button>
              <button
                onClick={onStartAnalysis}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition"
              >
                <PlusCircle size={14} />
                <span>New Analysis</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden transition-colors">
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
                  className="w-full text-left flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors gap-3 focus-visible:outline-none focus-visible:bg-slate-50 dark:focus-visible:bg-slate-800"
                  aria-label={`Open session ${analysis.context.lessonTitle}`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{analysis.context.subject}</span>
                      <span>{analysis.context.gradeLevel}</span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(analysis.timestamp).toLocaleDateString()}
                      </span>
                      {acceptedCount > 0 && (
                        <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                          {acceptedCount} accepted
                        </span>
                      )}
                      {pendingCount > 0 && (
                        <span className="text-amber-700 dark:text-amber-400 font-medium">
                          {pendingCount} pending review
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {analysis.context.lessonTitle}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xl">
                      {analysis.context.learningObjective}
                    </p>
                  </div>

                  <div className="flex items-center gap-6 shrink-0 self-start sm:self-center">
                    <div className="text-right text-xs text-slate-500 dark:text-slate-400 space-x-3">
                      <span>
                        <strong className="text-slate-800 dark:text-slate-200 font-mono">
                          {analysis.classSnapshot?.misconceptionCount || clusters.length}
                        </strong>{' '}
                        clusters
                      </span>
                      <span>
                        <strong className="text-slate-800 dark:text-slate-200 font-mono">
                          {analysis.studentObservations?.length || analysis.classSnapshot?.totalSubmissions || 0}
                        </strong>{' '}
                        submissions
                      </span>
                    </div>

                    <span className="inline-flex items-center text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300">
                      Review findings <ArrowUpRight size={14} className="ml-0.5" />
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
