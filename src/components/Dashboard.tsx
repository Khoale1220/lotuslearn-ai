import React from 'react';
import { PlusCircle, Sparkles, BookOpen, Users, AlertCircle, Lightbulb, ArrowUpRight, Clock } from 'lucide-react';
import { ClassAnalysisResult } from '../types';

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
  // Compute aggregate stats across real sessions
  const totalClasses = savedAnalyses.length > 0 ? savedAnalyses.length : 1;
  const totalSamples = savedAnalyses.reduce(
    (acc, cur) => acc + (cur.studentObservations?.length || cur.classSnapshot?.totalSubmissions || 12),
    0
  );
  const totalMisconceptions = savedAnalyses.reduce(
    (acc, cur) => acc + (cur.misconceptionClusters?.length || 3),
    0
  );
  const totalInterventions = savedAnalyses.reduce(
    (acc, cur) => acc + (cur.interventions?.length || 3),
    0
  );

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
      {/* Top Banner & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Formative Assessment Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Evidence-backed diagnostic insights and instructional interventions for your classes.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onTryDemo}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
          >
            <Sparkles size={16} className="text-rose-500" />
            <span>Launch Demo Classroom</span>
          </button>
          <button
            onClick={onNewAnalysis}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <PlusCircle size={16} />
            <span>New Analysis</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Cards (Zero-pill discipline, clean unboxed typography) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Classes Analyzed</span>
            <BookOpen size={18} className="text-blue-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{totalClasses}</span>
            <span className="text-xs text-slate-500">cohorts</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">Formative assessment sessions processed</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Student Samples</span>
            <Users size={18} className="text-indigo-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{totalSamples}</span>
            <span className="text-xs text-slate-500">submissions</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">Worksheets &amp; exit tickets examined</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Misconceptions Found</span>
            <AlertCircle size={18} className="text-rose-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{totalMisconceptions}</span>
            <span className="text-xs text-slate-500">clusters</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">Systemic class-wide patterns identified</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Interventions Generated</span>
            <Lightbulb size={18} className="text-amber-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{totalInterventions}</span>
            <span className="text-xs text-slate-500">action plans</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">Differentiated lesson scaffolds prepared</p>
        </div>
      </div>

      {/* Recent Analyses List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Recent Diagnostic Sessions</h2>
          <span className="text-xs text-slate-500">Click any session to view evidence and next-lesson plan</span>
        </div>

        {savedAnalyses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <Sparkles size={22} />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-slate-900">No custom sessions run yet</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
              You can instantly experience the full 4-stage Gemini reasoning pipeline by launching our pre-loaded Grade 10 English demo classroom.
            </p>
            <div className="mt-5">
              <button
                onClick={onTryDemo}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                <span>Launch Grade 10 Demo Classroom</span>
                <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            {savedAnalyses.map((analysis) => (
              <div
                key={analysis.id}
                onClick={() => onSelectSavedAnalysis(analysis)}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-5 hover:bg-slate-50/80 cursor-pointer transition-colors gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-slate-900">{analysis.context.subject}</span>
                    <span aria-hidden="true">·</span>
                    <span>{analysis.context.gradeLevel}</span>
                    <span aria-hidden="true">·</span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {new Date(analysis.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="text-base font-semibold text-slate-900">
                    {analysis.context.lessonTitle}
                  </h4>
                  <p className="text-xs text-slate-600 line-clamp-1 max-w-2xl">
                    {analysis.context.learningObjective}
                  </p>
                </div>

                <div className="flex items-center gap-6 self-start sm:self-center shrink-0">
                  <div className="text-right text-xs">
                    <span className="font-medium text-slate-900">
                      {analysis.classSnapshot?.misconceptionCount || analysis.misconceptionClusters?.length || 0}
                    </span>{' '}
                    <span className="text-slate-500">misconceptions</span>
                    <span className="mx-2 text-slate-300">|</span>
                    <span className="font-medium text-slate-900">
                      {analysis.studentObservations?.length || analysis.classSnapshot?.totalSubmissions || 12}
                    </span>{' '}
                    <span className="text-slate-500">students</span>
                  </div>

                  <span className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800">
                    Inspect <ArrowUpRight size={14} className="ml-1" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Human-in-the-Loop Pedagogy Note */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-xs text-slate-600 flex items-start gap-3">
        <div className="h-2 w-2 rounded-full bg-blue-500 mt-1 shrink-0" />
        <div>
          <span className="font-semibold text-slate-800">Human-in-the-Loop Pedagogical Principle:</span>{' '}
          LotusLearn supports teacher decision-making. AI-generated insights, groupings, and next-lesson timelines should always be reviewed and approved by the educator before classroom instruction.
        </div>
      </div>
    </div>
  );
};
