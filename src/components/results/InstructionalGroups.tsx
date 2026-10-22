import React from 'react';
import { InstructionalGroup } from '../../types';
import { Users, Clock, Target, BookOpen, CheckCircle } from 'lucide-react';

interface InstructionalGroupsProps {
  groups: InstructionalGroup[];
  onInspectStudent?: (studentId: string) => void;
}

export const InstructionalGroups: React.FC<InstructionalGroupsProps> = ({
  groups,
  onInspectStudent,
}) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-2">
        <div>
          <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider block mb-1">
            Dynamic Cohorts
          </span>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Formative Instructional Groups
          </h2>
          <p className="text-xs text-slate-500">
            Targeted student cohorts derived directly from diagnostic error patterns. Zero permanent ability labels.
          </p>
        </div>
        <div className="text-xs text-slate-600 font-mono">
          <span className="font-bold text-slate-900">{groups.length}</span> targeted cohorts
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {groups.map((group, idx) => {
          const isExtension = group.groupName.toLowerCase().includes('extension');
          const isClarification = group.groupName.toLowerCase().includes('clarification');

          const headerColor = isExtension
            ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
            : isClarification
            ? 'text-blue-800 bg-blue-50 border-blue-200'
            : 'text-amber-800 bg-amber-50 border-amber-200';

          return (
            <div
              key={group.groupId || idx}
              className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 hover:border-slate-300 hover:shadow-2xs transition"
            >
              {/* Group Name & Duration */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${headerColor}`}>
                    Cohort #{idx + 1}
                  </span>
                  <h3 className="mt-1.5 text-base font-bold text-slate-900 tracking-tight">
                    {group.groupName}
                  </h3>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500 shrink-0">
                  <Clock size={12} />
                  <span>{group.estimatedDuration}</span>
                </div>
              </div>

              {/* Student IDs in this cohort */}
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Assigned Students ({group.studentIds.length}):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {group.studentIds.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onInspectStudent?.(id)}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-blue-100 text-slate-800 hover:text-blue-900 text-xs font-mono font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                      aria-label={`Inspect ${id} profile`}
                    >
                      {id}
                    </button>
                  ))}
                </div>
              </div>

              {/* Common Learning Need */}
              <div className="rounded-lg bg-slate-50 p-3 text-xs space-y-1">
                <span className="font-semibold text-slate-900 text-[11px] uppercase tracking-wider block">
                  Common Learning Need:
                </span>
                <p className="text-slate-700 leading-relaxed">
                  {group.commonLearningNeed}
                </p>
              </div>

              {/* Suggested Activity & Facilitation Instructions */}
              <div className="space-y-2 text-xs">
                <div>
                  <span className="font-semibold text-slate-900 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                    <BookOpen size={13} className="text-blue-600" />
                    Targeted Activity:
                  </span>
                  <p className="text-slate-700 mt-1 leading-relaxed pl-5">
                    {group.suggestedActivity}
                  </p>
                </div>

                <div>
                  <span className="font-semibold text-slate-900 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                    <Target size={13} className="text-blue-600" />
                    Teacher Facilitation Note:
                  </span>
                  <p className="text-slate-700 mt-1 leading-relaxed pl-5">
                    {group.teacherInstructions}
                  </p>
                </div>
              </div>

              {/* Example Question & Success Criterion */}
              <div className="pt-3 border-t border-slate-100 text-xs space-y-2">
                <div className="bg-blue-50/50 p-2.5 rounded-lg border border-blue-100">
                  <span className="font-semibold text-blue-900 text-[11px] block">
                    Diagnostic Practice Prompt:
                  </span>
                  <p className="text-slate-800 mt-0.5 italic">
                    &quot;{group.exampleQuestion}&quot;
                  </p>
                </div>

                <div className="flex items-start gap-1.5 text-[11px] text-slate-600">
                  <CheckCircle size={13} className="text-emerald-600 mt-0.5 shrink-0" />
                  <span>
                    <strong className="text-slate-800">Success Criterion:</strong> {group.successCriterion}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
