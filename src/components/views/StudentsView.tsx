import React, { useState } from 'react';
import {
  UserRound,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ShieldCheck,
  Table as TableIcon,
  LayoutGrid,
  FileCheck,
} from 'lucide-react';
import { ClassAnalysisResult } from '../../types';

interface StudentsViewProps {
  analysis?: ClassAnalysisResult | null;
  onInspectStudent?: (studentId: string) => void;
  onTryDemo: () => void;
}

export const StudentsView: React.FC<StudentsViewProps> = ({
  analysis,
  onInspectStudent,
  onTryDemo,
}) => {
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const observations = analysis?.studentObservations || [];
  const groups = analysis?.instructionalGroups || [];

  // Helper to format pseudonymous ID e.g., "Student 01" -> "S-01"
  const formatPseudonym = (studentId: string) => {
    const match = studentId.match(/\d+/);
    return match ? `S-${match[0].padStart(2, '0')}` : studentId;
  };

  // Helper to resolve recommended group for a student
  const getRecommendedGroup = (studentId: string) => {
    const found = groups.find((g) => g.studentIds.includes(studentId));
    return found ? found.groupName : 'Core Practice Group';
  };

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-heading">
            Student Roster &amp; Profiles
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600">
            Formative observations anchored directly to de-identified student submissions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
            <ShieldCheck size={15} className="text-emerald-600 shrink-0" />
            <span>Pseudonymized roster keys (S-01 to S-12)</span>
          </div>

          {observations.length > 0 && (
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition ${
                  viewMode === 'table'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TableIcon size={13} />
                <span>Table</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition ${
                  viewMode === 'cards'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid size={13} />
                <span>Cards</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {observations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <UserRound size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 font-heading">
              No active student observations loaded
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Run an analysis or load the Grade 10 English demo classroom to see individual student profiles, verbatim evidence excerpts, and formative diagnoses.
            </p>
          </div>
          <button
            onClick={onTryDemo}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 text-xs font-semibold shadow-2xs transition"
          >
            <span>Load Demo Classroom</span>
            <ArrowUpRight size={14} />
          </button>
        </div>
      ) : viewMode === 'table' ? (
        /* Section 74: Student review table */
        <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th scope="col" className="py-3.5 px-4 sm:px-6">Pseudonymous Student ID</th>
                  <th scope="col" className="py-3.5 px-4">Evidence Status</th>
                  <th scope="col" className="py-3.5 px-4">Identified Need</th>
                  <th scope="col" className="py-3.5 px-4">Recommended Group</th>
                  <th scope="col" className="py-3.5 px-4 sm:px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {observations.map((obs) => {
                  const pseudoId = formatPseudonym(obs.studentId);
                  const quoteCount = obs.supportingEvidence?.length || 0;
                  const hasMisconceptions = obs.misconceptions && obs.misconceptions.length > 0;
                  const primaryNeed = hasMisconceptions
                    ? obs.misconceptions[0]
                    : 'Target rubric criteria mastered';
                  const recGroup = getRecommendedGroup(obs.studentId);

                  return (
                    <tr
                      key={obs.studentId}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/70 px-2 py-0.5 rounded text-xs">
                            {pseudoId}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                            ({obs.studentId})
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-700">
                        <span className="inline-flex items-center gap-1.5 font-medium text-[11px] text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                          <FileCheck size={13} className="text-emerald-600" />
                          <span>{quoteCount} quote{quoteCount === 1 ? '' : 's'} anchored</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-800 max-w-xs md:max-w-md">
                        {hasMisconceptions ? (
                          <div className="flex items-start gap-1.5">
                            <AlertCircle size={13} className="text-amber-600 shrink-0 mt-0.5" />
                            <span className="line-clamp-2 leading-relaxed">{primaryNeed}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-emerald-700">
                            <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                            <span>{primaryNeed}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-700 font-medium">
                        <span className="inline-block bg-slate-50 border border-slate-200 px-2.5 py-1 rounded text-[11px] text-slate-700">
                          {recGroup}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 sm:px-6 text-right">
                        {onInspectStudent ? (
                          <button
                            type="button"
                            onClick={() => onInspectStudent(obs.studentId)}
                            className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-800 transition text-xs"
                          >
                            <span>Inspect Quotes</span>
                            <ArrowUpRight size={13} />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {observations.map((obs) => {
            const hasMisconceptions = obs.misconceptions && obs.misconceptions.length > 0;
            const pseudoId = formatPseudonym(obs.studentId);
            const recGroup = getRecommendedGroup(obs.studentId);

            return (
              <div
                key={obs.studentId}
                className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-2xs hover:border-slate-300 hover:shadow-xs transition"
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 font-mono font-bold text-xs">
                      {pseudoId}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 font-mono">
                        {pseudoId} <span className="text-[11px] text-slate-400 font-normal">({obs.studentId})</span>
                      </h3>
                      <span className="text-[10px] text-slate-500 font-medium">{recGroup}</span>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      hasMisconceptions
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    {hasMisconceptions ? `${obs.misconceptions.length} Need(s)` : 'Mastered'}
                  </span>
                </div>

                {/* Demonstrated Understandings */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 size={11} />
                    Demonstrated Strengths
                  </span>
                  <div className="space-y-1">
                    {obs.demonstratedUnderstanding.slice(0, 2).map((u, idx) => (
                      <p key={idx} className="text-xs text-slate-700 leading-snug">
                        - {u}
                      </p>
                    ))}
                    {obs.demonstratedUnderstanding.length === 0 && (
                      <p className="text-xs text-slate-500 italic">No specific strengths recorded.</p>
                    )}
                  </div>
                </div>

                {/* Misconceptions */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1">
                    <AlertCircle size={11} />
                    Target Misconceptions
                  </span>
                  <div className="space-y-1">
                    {obs.misconceptions.slice(0, 2).map((m, idx) => (
                      <p
                        key={idx}
                        className="text-xs text-slate-800 bg-slate-50 border border-slate-100 rounded-lg p-2 leading-snug"
                      >
                        {m}
                      </p>
                    ))}
                    {obs.misconceptions.length === 0 && (
                      <p className="text-xs text-emerald-700 bg-emerald-50/60 border border-emerald-100 rounded-lg p-2">
                        Complete accuracy on target rubric standard.
                      </p>
                    )}
                  </div>
                </div>

                {/* Evidence Quote Link */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400 text-[11px] font-mono">
                    {obs.supportingEvidence?.length || 0} quotes anchored
                  </span>
                  {onInspectStudent && (
                    <button
                      type="button"
                      onClick={() => onInspectStudent(obs.studentId)}
                      className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-800 transition"
                    >
                      <span>Inspect Quotes</span>
                      <ArrowUpRight size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
