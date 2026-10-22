import React, { useRef } from 'react';
import { StudentObservation, StudentSubmission } from '../../types';
import { X, User, CheckCircle, AlertTriangle, Quote } from 'lucide-react';
import { useModalFocus } from '../../utils/useModalFocus';

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
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useModalFocus<HTMLDivElement>({
    onClose,
    initialFocusRef: closeButtonRef,
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-detail-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-2xl rounded-2xl bg-white p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto border border-slate-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700 font-mono font-bold text-sm">
              <User size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="student-detail-title" className="text-lg font-bold text-slate-900 font-mono">
                  {studentId}
                </h3>
                <span className="text-slate-400">·</span>
                <span className="text-xs text-slate-600 capitalize font-medium">
                  {observation?.recommendedSupportLevel ? observation.recommendedSupportLevel.replace('_', ' ') : 'Formative Evaluation'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Individual Student Observation &amp; Evidence Grounding
              </p>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            aria-label="Close student details modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Verbatim Raw Work */}
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">
            Original Student Submission:
          </span>
          {submission?.studentText ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs font-mono text-slate-800 relative">
              <Quote size={16} className="text-slate-400 absolute top-3 right-3 opacity-30" aria-hidden="true" />
              <blockquote className="leading-relaxed">&quot;{submission.studentText}&quot;</blockquote>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 flex items-start gap-2.5">
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <strong className="block text-amber-900">Source evidence unavailable</strong>
                <p className="text-amber-800 leading-relaxed">
                  This saved analysis does not include the original student submission. Verification cannot be reconstructed from source evidence. (Demo evidence is never substituted for missing session data).
                </p>
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
                <span className="font-semibold text-amber-800 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                  <AlertTriangle size={14} className="text-amber-600" />
                  Identified Error Patterns:
                </span>
                <ul className="list-disc list-inside space-y-1 text-slate-700 pl-2">
                  {observation.misconceptions.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Extracted Supporting Evidence */}
            {observation.supportingEvidence && observation.supportingEvidence.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="font-semibold text-slate-700 uppercase tracking-wider text-[11px] block">
                  Citations Extracted from Work:
                </span>
                <div className="space-y-2">
                  {observation.supportingEvidence.map((ev, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-1"
                    >
                      <p className="font-medium text-slate-900 italic font-serif">
                        &quot;{ev.quoteOrDetail}&quot;
                      </p>
                      <p className="text-slate-600 text-[11px]">
                        <strong>Interpretation:</strong> {ev.interpretation}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">
            No detailed observation record found for this student.
          </p>
        )}

        <div className="pt-3 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
