import React from 'react';
import { Users, BookOpen, PlusCircle, Sparkles, Clock, CheckCircle2, ArrowRight } from 'lucide-react';
import { ClassAnalysisResult } from '../../types';

interface ClassesViewProps {
  onStartAnalysis: () => void;
  onTryDemo: () => void;
  onSelectSavedAnalysis: (analysis: ClassAnalysisResult) => void;
  savedAnalyses: ClassAnalysisResult[];
}

export const ClassesView: React.FC<ClassesViewProps> = ({
  onStartAnalysis,
  onTryDemo,
  onSelectSavedAnalysis,
  savedAnalyses,
}) => {
  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-heading">
            Classroom Roster &amp; Cohorts
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600">
            Manage your teaching cohorts and review longitudinal formative diagnostic history.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onTryDemo}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-2xs transition"
          >
            <Sparkles size={14} className="text-amber-500" />
            <span>Load Demo Class</span>
          </button>
          <button
            onClick={onStartAnalysis}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs font-semibold text-white shadow-2xs transition"
          >
            <PlusCircle size={14} />
            <span>Analyze Assignment</span>
          </button>
        </div>
      </div>

      {/* Primary Class Card: Grade 10A1 English */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono text-[11px] font-bold">
                CLASS 10A1
              </span>
              <span className="text-xs text-slate-500">English Language Arts / Academic Year 2026</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 font-heading">
              Grade 10 - High School English
            </h2>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
              <CheckCircle2 size={13} />
              <span>Active Curriculum Unit</span>
            </span>
          </div>
        </div>

        {/* 3 Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Enrolled Students
            </span>
            <div className="text-2xl font-bold text-slate-900 font-mono">12</div>
            <p className="text-[11px] text-slate-500">Pseudonymized roster keys (Student 01 to 12)</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Current Target Standard
            </span>
            <div className="text-base font-bold text-slate-900 truncate">
              Present Perfect vs. Past Simple
            </div>
            <p className="text-[11px] text-slate-500">Unit 3: Travel, Experiences &amp; Past Time</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Completed Analyses
            </span>
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {savedAnalyses.length > 0 ? savedAnalyses.length : '1 Benchmark'}
            </div>
            <p className="text-[11px] text-slate-500">Diagnostic exit tickets examined</p>
          </div>
        </div>

        {/* Action Row */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
          <span className="text-xs text-slate-500">
            Teacher: <strong>Ms. Nguyen Lan Anh</strong>, Room 304
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onTryDemo}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
            >
              <span>View Latest Diagnostic</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Historical Sessions Section */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-slate-900 font-heading">
          Class Diagnostic Sessions
        </h3>

        {savedAnalyses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-500">
            No session records stored yet. Click &quot;Load Demo Class&quot; to test the Grade 10 English diagnostic.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
            {savedAnalyses.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectSavedAnalysis(item)}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-slate-50 cursor-pointer transition gap-2"
              >
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {item.context.lessonTitle}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {item.context.learningObjective}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono text-slate-600 shrink-0">
                  <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                  <span className="font-semibold text-indigo-600">Inspect &rarr;</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
