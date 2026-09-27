import React, { useState } from 'react';
import { DifferentiatedIntervention, MisconceptionCluster } from '../../types';
import { Copy, Check, Sparkles, Sliders, ArrowUpRight, CheckCircle2, X, Compass, Loader2 } from 'lucide-react';
import { GlowEdgeCard } from '../GlowEdgeCard';
import { ProvenanceBadge } from '../ProvenanceBadge';
import { getTeacherStatusLabel } from '../../utils/verificationDisplay';

interface DifferentiatedInterventionsProps {
  interventions: DifferentiatedIntervention[];
  misconceptions?: MisconceptionCluster[];
  totalStudents?: number;
  verificationStatus?: 'verified' | 'partially_verified' | 'needs_review';
  onAdjustIntervention: (
    intervention: DifferentiatedIntervention,
    action: 'simplify' | 'challenge' | 'exit_ticket'
  ) => Promise<void>;
  onUpdateStatus?: (interventionId: string, status: 'accepted' | 'edited' | 'dismissed') => void;
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
    <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider">
              Section 06 · Micro-Interventions
            </span>
            <span className="text-slate-300">·</span>
            <ProvenanceBadge type="gemini" label="Teaching Strategist" size="sm" />
            <ProvenanceBadge type="human" label="Teacher Configurable" size="sm" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 mt-1">
            Differentiated Teaching Scaffolds
          </h2>
          <p className="text-xs text-slate-500">
            High-yield instructional actions tailored directly to diagnosed misconception tiers with live AI adjustment.
          </p>
        </div>
        <div className="text-xs text-slate-500 font-mono">
          <span className="font-semibold text-slate-900">{interventions.length}</span> actionable intervention cards
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {interventions.map((int) => {
          const isDismissed = int.status === 'dismissed';
          const isProcessingThis = loadingAction?.startsWith(int.interventionId);

          const tierColor =
            int.supportTier === 'Ready for Extension'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : int.supportTier === 'Concept Clarification'
              ? 'bg-blue-50 text-blue-800 border-blue-200'
              : 'bg-amber-50 text-amber-800 border-amber-200';

          return (
            <GlowEdgeCard
              key={int.interventionId}
              variant="ai"
              className={`transition-all ${isDismissed ? 'opacity-60 bg-slate-50/70' : 'hover:shadow-xs'}`}
            >
              <div className="p-5 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${tierColor}`}>
                        {int.supportTier}
                      </span>
                      {int.status && (
                        <span className="text-[10px] font-mono text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          Teacher {int.status}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-1.5 text-base font-bold text-slate-900 tracking-tight">
                      {int.title}
                    </h3>
                  </div>

                  <button
                    onClick={() => handleCopy(int)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded transition shrink-0"
                    title="Copy full intervention text"
                  >
                    {copiedId === int.interventionId ? (
                      <Check size={16} className="text-emerald-600" />
                    ) : (
                      <Copy size={16} />
                    )}
                  </button>
                </div>

                {/* TARGETS & PROVENANCE BOX (Requested in Prompt) */}
                {(() => {
                  const matchingCluster = misconceptions.find(
                    (c) =>
                      c.misconceptionTitle.toLowerCase() === int.targetMisconceptionTitle.toLowerCase()
                  );
                  const hasLinkedCluster = !!matchingCluster;
                  const affectedCount = matchingCluster ? matchingCluster.studentCount : null;

                  let verLabel = 'Verified Grounding';
                  let verColor = 'text-emerald-700';
                  if (verificationStatus === 'partially_verified') {
                    verLabel = 'Partially Verified Grounding';
                    verColor = 'text-amber-700';
                  } else if (verificationStatus === 'needs_review') {
                    verLabel = 'Review Required Grounding';
                    verColor = 'text-rose-700';
                  }

                  const teacherStatusText = getTeacherStatusLabel(int.status);

                  return (
                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-[11px] font-mono space-y-1.5">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-200/60">
                        TARGETS &amp; PROVENANCE
                      </div>
                      <div className="space-y-1 text-slate-700">
                        <div>
                          <span className="text-slate-400">Generated by:</span>{' '}
                          <span className="font-semibold text-indigo-700">Gemini Teaching Strategist</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Targets:</span>{' '}
                          <span className="font-semibold text-slate-900">
                            {int.targetMisconceptionTitle}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">Evidence:</span>{' '}
                          {hasLinkedCluster && affectedCount !== null ? (
                            <span className="font-semibold text-blue-800">
                              {affectedCount} / {totalStudents} students ({Math.round((affectedCount / totalStudents) * 100)}%)
                            </span>
                          ) : (
                            <span className="font-semibold text-slate-500">Not linked</span>
                          )}
                        </div>
                        <div>
                          <span className="text-slate-400">Verification:</span>{' '}
                          <span className={`font-semibold ${verColor}`}>{verLabel}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Teacher status:</span>{' '}
                          <span
                            className={`font-semibold ${
                              int.status === 'accepted'
                                ? 'text-emerald-700'
                                : int.status === 'edited'
                                ? 'text-amber-800'
                                : int.status === 'dismissed'
                                ? 'text-slate-600'
                                : 'text-slate-500'
                            }`}
                          >
                            {teacherStatusText}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Rationale & Activity */}
                <div className="space-y-3 text-xs text-slate-700">
                  <div>
                    <span className="font-semibold text-slate-900 text-[11px] uppercase tracking-wider block mb-1">
                      Pedagogical Rationale:
                    </span>
                    <p className="leading-relaxed text-slate-600">{int.rationale}</p>
                  </div>

                  <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 space-y-1">
                    <span className="font-semibold text-slate-900 text-[11px] uppercase tracking-wider block">
                      Suggested Action / Micro-Activity:
                    </span>
                    <p className="leading-relaxed">{int.suggestedActivity}</p>
                  </div>

                  {/* Teacher Script */}
                  <div className="rounded-lg bg-blue-50/50 p-3 border border-blue-100 space-y-1">
                    <span className="font-semibold text-blue-900 text-[11px] uppercase tracking-wider block">
                      Teacher Facilitation Prompt:
                    </span>
                    <p className="text-slate-800 italic font-serif">&quot;{int.teacherScript}&quot;</p>
                  </div>

                  {/* Exit Ticket Question */}
                  <div className="rounded-lg bg-rose-50/40 p-3 border border-rose-100 space-y-1">
                    <span className="font-semibold text-rose-900 text-[11px] uppercase tracking-wider block">
                      1-Item Exit Ticket Diagnostic:
                    </span>
                    <p className="text-slate-900 font-mono text-[11px]">{int.exitTicketQuestion}</p>
                  </div>
                </div>

                {/* Live AI Adjustment Controls */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="flex items-center gap-1 font-semibold text-slate-700">
                      <Sliders size={12} className="text-indigo-600" />
                      Live Gemini Adjustment:
                    </span>
                    {isProcessingThis && (
                      <span className="text-indigo-600 font-mono flex items-center gap-1">
                        <Loader2 size={11} className="animate-spin" /> Adjusting...
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      disabled={!!loadingAction}
                      onClick={() => handleAction(int, 'simplify')}
                      className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition disabled:opacity-50"
                    >
                      Simplify Scaffolding
                    </button>
                    <button
                      disabled={!!loadingAction}
                      onClick={() => handleAction(int, 'challenge')}
                      className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition disabled:opacity-50"
                    >
                      Make More Challenging
                    </button>
                    <button
                      disabled={!!loadingAction}
                      onClick={() => handleAction(int, 'exit_ticket')}
                      className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition disabled:opacity-50"
                    >
                      New Exit Ticket
                    </button>
                  </div>
                </div>

                {/* Human-in-the-Loop Decision Buttons */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-400 font-mono">TEACHER ACTION</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onUpdateStatus?.(int.interventionId, 'accepted')}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs transition ${
                        int.status === 'accepted'
                          ? 'bg-emerald-100 text-emerald-800 font-semibold'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Check size={11} /> Accept
                    </button>
                    <button
                      onClick={() =>
                        onUpdateStatus?.(
                          int.interventionId,
                          isDismissed ? 'accepted' : 'dismissed'
                        )
                      }
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs transition ${
                        isDismissed
                          ? 'text-amber-700 bg-amber-50 font-medium'
                          : 'text-slate-400 hover:text-rose-600 hover:bg-slate-100'
                      }`}
                    >
                      <X size={11} /> {isDismissed ? 'Restore' : 'Dismiss'}
                    </button>
                  </div>
                </div>
              </div>
            </GlowEdgeCard>
          );
        })}
      </div>
    </div>
  );
};
