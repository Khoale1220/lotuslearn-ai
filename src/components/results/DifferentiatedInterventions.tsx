import React, { useState } from 'react';
import { DifferentiatedIntervention, MisconceptionCluster, TeacherDecision } from '../../types';
import { Copy, Check, X, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { getTeacherStatusLabel, getCanonicalTeacherDecision } from '../../utils/verificationDisplay';

interface DifferentiatedInterventionsProps {
  interventions: DifferentiatedIntervention[];
  misconceptions?: MisconceptionCluster[];
  totalStudents?: number;
  verificationStatus?: 'verified' | 'partially_verified' | 'needs_review';
  onAdjustIntervention: (
    intervention: DifferentiatedIntervention,
    action: 'simplify' | 'challenge' | 'exit_ticket'
  ) => Promise<void>;
  onUpdateStatus?: (interventionId: string, status: TeacherDecision) => void;
}

export const DifferentiatedInterventions: React.FC<DifferentiatedInterventionsProps> = ({
  interventions,
  misconceptions = [],
  totalStudents = 12,
  verificationStatus = 'verified',
  onAdjustIntervention,
  onUpdateStatus,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handleCopy = (int: DifferentiatedIntervention) => {
    const text = `INTERVENTION: ${int.title} (${int.supportTier})\nTarget Misconception: ${
      int.targetMisconceptionTitle
    }\nRationale: ${int.rationale}\nActivity: ${int.suggestedActivity}\nTeacher Prompt: "${
      int.teacherScript
    }"\nDiagnostic Question: "${int.exampleQuestion}"\nExit Ticket: "${
      int.exitTicketQuestion
    }"`;
    navigator.clipboard.writeText(text);
    setCopiedId(int.interventionId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAction = async (
    int: DifferentiatedIntervention,
    action: 'simplify' | 'challenge' | 'exit_ticket'
  ) => {
    setLoadingAction(`${int.interventionId}_${action}`);
    try {
      await onAdjustIntervention(int, action);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-2">
        <div>
          <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider block mb-1">
            Differentiated Teaching Scaffolds
          </span>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Targeted Micro-Interventions
          </h2>
          <p className="text-xs text-slate-500">
            Actionable scaffolds tailored to diagnosed misconception clusters with classroom-ready scripts and exit tickets.
          </p>
        </div>
        <div className="text-xs text-slate-600 font-mono">
          <span className="font-bold text-slate-900">{interventions.length}</span> intervention cards
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {interventions.map((int) => {
          const canonicalDecision = getCanonicalTeacherDecision(int);
          const isDismissed = canonicalDecision === 'dismissed';
          const isProcessingThis = loadingAction?.startsWith(int.interventionId);

          const tierColor =
            int.supportTier === 'Ready for Extension'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : int.supportTier === 'Concept Clarification'
              ? 'bg-blue-50 text-blue-800 border-blue-200'
              : 'bg-amber-50 text-amber-800 border-amber-200';

          const matchingCluster = misconceptions.find(
            (c) => (int.clusterId && c.clusterId === int.clusterId) ||
              c.misconceptionTitle.toLowerCase() === int.targetMisconceptionTitle.toLowerCase()
          );

          return (
            <div
              key={int.interventionId}
              className={`rounded-xl border border-slate-200 bg-white p-5 space-y-4 transition-all ${
                isDismissed ? 'opacity-60 bg-slate-50' : 'hover:border-slate-300 hover:shadow-2xs'
              }`}
            >
              {/* Top Bar: Support Tier & Status */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${tierColor}`}>
                      {int.supportTier}
                    </span>
                    <span className="text-[11px] font-mono text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                      {getTeacherStatusLabel(canonicalDecision)}
                    </span>
                  </div>
                  <h3 className="mt-1.5 text-base font-bold text-slate-900 tracking-tight">
                    {int.title}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy(int)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md transition shrink-0 border border-slate-200 bg-white hover:bg-slate-50"
                  title="Copy intervention text"
                  aria-label="Copy intervention text"
                >
                  {copiedId === int.interventionId ? (
                    <Check size={14} className="text-emerald-600" />
                  ) : (
                    <Copy size={14} />
                  )}
                </button>
              </div>

              {/* Linked Misconception Relationship Box */}
              <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-3 text-xs space-y-1">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Targeted Learning Need:
                </span>
                <div className="flex items-center justify-between text-slate-800 font-medium">
                  <span>{int.targetMisconceptionTitle}</span>
                  {matchingCluster && (
                    <span className="font-mono text-[11px] text-slate-500">
                      {matchingCluster.studentCount} students affected
                    </span>
                  )}
                </div>
              </div>

              {/* Rationale */}
              <div className="text-xs space-y-1">
                <span className="font-semibold text-slate-700 uppercase tracking-wider text-[10px] block">
                  Instructional Rationale:
                </span>
                <p className="text-slate-600 leading-relaxed">
                  {int.rationale}
                </p>
              </div>

              {/* Suggested Activity & Teacher Script */}
              <div className="space-y-3 pt-2 text-xs">
                <div className="rounded-lg bg-blue-50/40 border border-blue-100 p-3 space-y-1">
                  <span className="font-semibold text-blue-900 text-[11px] block">
                    Suggested Classroom Activity:
                  </span>
                  <p className="text-slate-700 leading-relaxed">
                    {int.suggestedActivity}
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1">
                  <span className="font-semibold text-slate-800 text-[11px] block">
                    Teacher Script / Actionable Prompt:
                  </span>
                  <p className="text-slate-800 italic pl-2 border-l-2 border-slate-300">
                    &quot;{int.teacherScript}&quot;
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase block mb-0.5">
                      Diagnostic Question:
                    </span>
                    <p className="text-slate-800 text-[11px] leading-snug">
                      {int.exampleQuestion}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase block mb-0.5">
                      Quick Exit Ticket:
                    </span>
                    <p className="text-slate-800 text-[11px] leading-snug">
                      {int.exitTicketQuestion}
                    </p>
                  </div>
                </div>
              </div>

              {/* Teacher Decision Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-500">
                  Educator review:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onUpdateStatus?.(int.interventionId, 'accepted')}
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold transition ${
                      canonicalDecision === 'accepted'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Check size={12} />
                    <span>Accept</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onUpdateStatus?.(int.interventionId, 'dismissed')}
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold transition ${
                      canonicalDecision === 'dismissed'
                        ? 'bg-slate-700 text-white shadow-2xs'
                        : 'border border-slate-300 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                    }`}
                  >
                    <X size={12} />
                    <span>Dismiss</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
