import React from 'react';
import { StudentObservation, StudentSubmission } from '../../types';
import { X, User, CheckCircle, AlertTriangle, BookOpen, Quote } from 'lucide-react';

interface StudentDetailModalProps {
  studentId: string;
  observation?: StudentObservation;
  submission?: StudentSubmission;
  onClose: () => void;
}

export const StudentDetailModal: React.FC<StudentDetailModalProps> = ({
  studentId,
  observation,
  submission,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700 font-mono font-bold text-sm">
              <User size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 font-mono">{studentId}</h3>
                <span className="text-slate-400">·</span>
                <span className="text-xs text-slate-500 capitalize">
                  {observation?.recommendedSupportLevel.replace('_', ' ') || 'Formative Evaluation'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Individual Evidence &amp; Observer Stage Diagnosis
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Verbatim Raw Work */}
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Raw Student Submission:
          </span>
          {submission?.studentText ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs font-mono text-slate-800 relative">
              <Quote size={16} className="text-slate-400 absolute top-3 right-3 opacity-30" />
              <p className="leading-relaxed">&quot;{submission.studentText}&quot;</p>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 flex items-start gap-2.5">
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Source evidence unavailable</span>
                <span className="text-amber-700">
                  Verbatim source submission was not archived with this session record. Demo evidence is never substituted for missing session data.
                </span>
              </div>
            </div>
          )}
        </div>

        {observation ? (
          <div className="space-y-4 text-xs">
            {/* Demonstrated Understanding */}
            <div className="space-y-1.5">
              <span className="font-semibold text-emerald-800 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                <CheckCircle size={14} className="text-emerald-600" />
                Demonstrated Understanding:
              </span>
              <ul className="list-disc list-inside space-y-1 text-slate-700 pl-2">
                {observation.demonstratedUnderstanding.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            {/* Identified Misconceptions */}
            {observation.misconceptions.length > 0 && (
              <div className="space-y-1.5">
                <span className="font-semibold text-rose-800 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                  <AlertTriangle size={14} className="text-rose-600" />
                  Identified Misconceptions / Error Patterns:
                </span>
                <ul className="list-disc list-inside space-y-1 text-slate-700 pl-2">
                  {observation.misconceptions.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Supporting Evidence Breakdown */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="font-semibold text-slate-900 block text-xs uppercase tracking-wider">
                Extracted Grounding Citations:
              </span>
              <div className="space-y-2">
                {observation.supportingEvidence.map((ev, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-blue-50/50 border border-blue-100 space-y-1">
                    <span className="font-medium text-blue-900 block italic">
                      &quot;{ev.quoteOrDetail}&quot;
                    </span>
                    <p className="text-slate-600">{ev.interpretation}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Rubric Alignment & Confidence */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-slate-500">
              <span>Rubric: {observation.rubricAlignment}</span>
              <span className="font-mono">
                Observer Confidence: {Math.round(observation.confidence * 100)}%
              </span>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-500 italic">
            Observer data loading or pending for this submission.
          </div>
        )}

        <div className="pt-4 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition"
          >
            Close Drilldown
          </button>
        </div>
      </div>
    </div>
  );
};
