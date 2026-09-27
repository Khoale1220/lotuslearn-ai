import React from 'react';
import { MisconceptionCluster, LearningContext } from '../../types';
import { X, HelpCircle, ArrowRight, User } from 'lucide-react';
import { ProvenanceBadge } from '../ProvenanceBadge';
import { getDeterministicMatchDisplay } from '../../utils/verificationDisplay';

interface WhyThisInsightModalProps {
  cluster: MisconceptionCluster | null;
  context: LearningContext;
  totalStudents: number;
  onClose: () => void;
  onInspectStudent?: (studentId: string) => void;
}

export const WhyThisInsightModal: React.FC<WhyThisInsightModalProps> = ({
  cluster,
  context,
  totalStudents,
  onClose,
  onInspectStudent,
}) => {
  if (!cluster) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="why-insight-title"
    >
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto border border-slate-200">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-200 gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200 shrink-0">
              <HelpCircle size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
                  Evidence Provenance Breakdown
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-[11px] font-mono text-slate-500">
                  Visible Intelligence
                </span>
              </div>
              <h2 id="why-insight-title" className="text-lg font-bold text-slate-900">
                Why this insight was diagnosed: &quot;{cluster.misconceptionTitle}&quot;
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* 5-Step Provenance Pipeline Bar */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
          <span className="text-[10px] font-mono font-semibold uppercase text-slate-500 tracking-wider block">
            End-to-End Verification Pipeline
          </span>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="px-2 py-0.5 rounded bg-white border border-slate-200 font-mono font-medium text-slate-700">
              01 Raw Work
            </span>
            <ArrowRight size={12} className="text-slate-400" />
            <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 font-medium text-indigo-800">
              02 Observer Quotes
            </span>
            <ArrowRight size={12} className="text-slate-400" />
            <span className="px-2 py-0.5 rounded bg-teal-50 border border-teal-200 font-medium text-teal-800">
              03 Code Validated
            </span>
            <ArrowRight size={12} className="text-slate-400" />
            <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 font-medium text-blue-800">
              04 Diagnosis Inferred
            </span>
            <ArrowRight size={12} className="text-slate-400" />
            <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 font-medium text-emerald-800">
              05 Verifier Audited
            </span>
          </div>
        </div>

        {/* Core Content Blocks */}
        <div className="space-y-4 text-xs">
          {/* 1. Observed Pattern */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-1.5">
            <span className="font-semibold text-slate-900 block text-[11px] uppercase tracking-wider text-indigo-700">
              Observed Cognitive Pattern:
            </span>
            <p className="text-slate-700 leading-relaxed text-sm">
              {cluster.explanation}
            </p>
          </div>

          {/* 2. Affected Student Cohort */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900 block text-[11px] uppercase tracking-wider text-indigo-700">
                Affected Students ({cluster.studentCount} of {totalStudents} students · {cluster.percentageAffected}%):
              </span>
              <span className="font-mono text-[11px] text-slate-500">
                Priority: {cluster.teachingPriority.toUpperCase()}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {cluster.affectedStudentIds.map((id) => (
                <button
                  key={id}
                  onClick={() => {
                    onInspectStudent?.(id);
                    onClose();
                  }}
                  className="font-mono text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded transition flex items-center gap-1"
                >
                  <User size={11} />
                  <span>{id}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Supporting Evidence Excerpts */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <span className="font-semibold text-slate-900 block text-[11px] uppercase tracking-wider text-indigo-700">
              Grounded Evidence Citations (Raw Student Work):
            </span>
            <div className="space-y-2">
              {cluster.evidenceExamples.map((ex, idx) => {
                const matchDisplay = getDeterministicMatchDisplay(ex.deterministicMatch, ex.sourceType);
                return (
                  <div
                    key={idx}
                    className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-3 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold text-slate-700">{ex.studentId}</span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${matchDisplay.badgeClass}`}>
                        {matchDisplay.label}
                      </span>
                    </div>
                    <p className="font-serif italic text-slate-900 bg-white p-2 rounded border border-slate-200/60 text-xs">
                      &quot;{ex.excerpt}&quot;
                    </p>
                    <p className="text-slate-600 text-[11px] pt-1">
                      <strong className="text-slate-800">Grounding Reason:</strong> {ex.groundingReason}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Objective Relationship (Cluster-Specific) */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
            <span className="font-semibold text-slate-900 block text-[11px] uppercase tracking-wider text-indigo-700">
              Relationship to Lesson Learning Objective:
            </span>
            <div className="space-y-1.5 text-xs text-slate-700">
              <p>
                <strong className="text-slate-900 font-mono">Target Standard:</strong> {context.learningObjective}
              </p>
              {context.expectedAnswerRubric && (
                <p>
                  <strong className="text-slate-900 font-mono">Expected Rubric:</strong> {context.expectedAnswerRubric}
                </p>
              )}
              <p className="text-slate-600 leading-relaxed pt-1">
                <strong>Pedagogical Impact:</strong> The diagnosed pattern &quot;{cluster.misconceptionTitle}&quot; prevents students from reaching full criterion mastery on this objective. Resolving this pattern clears the core cognitive obstacle identified across {cluster.studentCount} student responses.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ProvenanceBadge type="gemini" label="Gemini Diagnosis" size="sm" />
            <ProvenanceBadge type="code" label="Code Verified" size="sm" />
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition"
          >
            Close Provenance
          </button>
        </div>
      </div>
    </div>
  );
};
