import React from 'react';
import { MisconceptionCluster, StudentObservation } from '../../types';
import { Quote, Search, User, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, Check } from 'lucide-react';
import { ProvenanceBadge } from '../ProvenanceBadge';
import { GlowEdgeCard } from '../GlowEdgeCard';
import { getDeterministicMatchDisplay } from '../../utils/verificationDisplay';

interface EvidencePanelProps {
  clusters: MisconceptionCluster[];
  selectedClusterId: string | null;
  observations: StudentObservation[];
  onInspectStudent: (studentId: string) => void;
}

export const EvidencePanel: React.FC<EvidencePanelProps> = ({
  clusters,
  selectedClusterId,
  observations,
  onInspectStudent,
}) => {
  const activeCluster =
    clusters.find((c) => c.clusterId === selectedClusterId) || clusters[0] || null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
              Section 03 · Verbatim Grounding &amp; Provenance
            </span>
            <span className="text-slate-300">·</span>
            <ProvenanceBadge type="verified" label="Evidence Grounded" size="sm" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 mt-1">
            Grounded Evidence Panel
          </h2>
          <p className="text-xs text-slate-500">
            Every diagnosed pattern is anchored in verified student excerpts with an observable end-to-end provenance chain.
          </p>
        </div>

        {activeCluster && (
          <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-mono">
            <span className="text-slate-400">Cluster:</span>
            <span className="font-bold text-slate-900">{activeCluster.misconceptionTitle}</span>
          </div>
        )}
      </div>

      {!activeCluster ? (
        <div className="text-xs text-slate-500 text-center py-6">
          Select a misconception cluster above to view supporting student evidence.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Diagnostic Claim Banner (Requested Feature) */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold text-indigo-700 uppercase tracking-wider bg-white px-2 py-0.5 rounded border border-indigo-200">
                  DIAGNOSTIC CLAIM
                </span>
                <span className="font-bold text-slate-900 text-sm">
                  {activeCluster.misconceptionTitle}
                </span>
              </div>
              <div className="font-mono text-[11px] text-slate-600 font-semibold bg-white px-2.5 py-0.5 rounded border border-slate-200">
                AFFECTED: {activeCluster.studentCount} / {observations.length} Students ({activeCluster.percentageAffected}%)
              </div>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              {activeCluster.explanation}
            </p>
          </div>

          {/* Evidence Citations Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeCluster.evidenceExamples.map((item, idx) => (
              <GlowEdgeCard
                key={idx}
                variant="validation"
                className="hover:shadow-xs transition"
              >
                <div className="p-4 space-y-3">
                  {/* Header */}
                  {(() => {
                    const matchDisplay = getDeterministicMatchDisplay(item.deterministicMatch, item.sourceType);
                    return (
                      <div className="flex items-center justify-between text-xs">
                        <button
                          onClick={() => onInspectStudent(item.studentId)}
                          className="font-mono font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded transition flex items-center gap-1.5"
                        >
                          <User size={12} />
                          <span>{item.studentId}</span>
                        </button>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${matchDisplay.badgeClass}`}>
                            {matchDisplay.label}
                          </span>
                          <span className="text-[11px] text-slate-400">#{idx + 1}</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Excerpt Quote */}
                  <div className="relative pl-3 border-l-2 border-rose-500 bg-white p-3 rounded-r-lg shadow-2xs">
                    <Quote size={14} className="text-slate-400 absolute top-2 right-2 opacity-40" />
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      Student Work Excerpt:
                    </span>
                    <p className="text-xs font-medium text-slate-900 italic font-serif">
                      &quot;{item.excerpt}&quot;
                    </p>
                  </div>

                  {/* Pedagogical Grounding */}
                  <div className="rounded-lg bg-blue-50/60 border border-blue-100 p-3 text-xs text-slate-800 space-y-1">
                    <span className="font-semibold text-blue-900 text-[11px] block uppercase tracking-wider">
                      Diagnostic Justification:
                    </span>
                    <p className="text-slate-700 leading-relaxed text-xs">
                      {item.groundingReason}
                    </p>
                  </div>

                  {/* VISUAL PROVENANCE CHAIN (Requested in Prompt) */}
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-2">
                    <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block">
                      Factual Provenance Chain:
                    </span>
                    <div className="space-y-1.5 text-[11px] font-mono">
                      {/* Step 1: Source Evidence */}
                      <div className="flex items-center justify-between bg-white px-2 py-1 rounded border border-slate-200/80">
                        <span className="text-slate-500">1. Source Evidence</span>
                        <span className="font-semibold text-slate-800">
                          {item.sourceType === 'image_transcription' ? 'Handwritten Image' : 'Typed Response'}
                        </span>
                      </div>
                      <div className="text-center text-slate-400 text-[10px] leading-none">↓</div>

                      {/* Step 2: Gemini Observer Extraction */}
                      <div className="flex items-center justify-between bg-white px-2 py-1 rounded border border-slate-200/80">
                        <span className="text-slate-500">2. Gemini Observer Extraction</span>
                        <span className="font-semibold text-indigo-700">Verbatim Excerpt Isolated</span>
                      </div>
                      <div className="text-center text-slate-400 text-[10px] leading-none">↓</div>

                      {/* Step 3: Code Grounding Check */}
                      {(() => {
                        const match = getDeterministicMatchDisplay(item.deterministicMatch, item.sourceType);
                        return (
                          <>
                            <div className="flex items-center justify-between bg-white px-2 py-1 rounded border border-slate-200/80">
                              <span className="text-slate-500">3. Code Grounding Check</span>
                              <span className="font-semibold text-teal-700">
                                {match.label}
                              </span>
                            </div>
                            <div className="text-center text-slate-400 text-[10px] leading-none">↓</div>

                            {/* Step 4: Gemini Diagnosis */}
                            <div className="flex items-center justify-between bg-white px-2 py-1 rounded border border-slate-200/80">
                              <span className="text-slate-500">4. Gemini Diagnosis</span>
                              <span className="font-semibold text-blue-700">Root-Cause Synthesized</span>
                            </div>
                            <div className="text-center text-slate-400 text-[10px] leading-none">↓</div>

                            {/* Step 5: Verification Status */}
                            <div className="flex items-center justify-between bg-white px-2 py-1 rounded border border-slate-200/80">
                              <span className="text-slate-500">5. Verification Status</span>
                              <span className={`font-semibold ${match.isSupported ? 'text-emerald-700' : 'text-rose-700'}`}>
                                {match.isSupported ? 'Supported & Grounded' : 'Unsupported Citation · Review Required'}
                              </span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </GlowEdgeCard>
            ))}
          </div>

          {/* Quick Roster Drilldown */}
          <div className="mt-6 pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="font-semibold text-slate-800">
                All Student Work Submissions in Cohort ({observations.length} Students)
              </span>
              <span className="text-slate-500">Click any student for complete diagnostic profile</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {observations.map((obs) => {
                const isAffected = activeCluster.affectedStudentIds.includes(obs.studentId);
                return (
                  <button
                    key={obs.studentId}
                    onClick={() => onInspectStudent(obs.studentId)}
                    className={`p-2.5 rounded-lg border text-left text-xs transition ${
                      isAffected
                        ? 'border-rose-300 bg-rose-50/50 hover:bg-rose-100/70 text-rose-950 font-semibold'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono">{obs.studentId}</span>
                      {isAffected && <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500 truncate">
                      {obs.recommendedSupportLevel.replace('_', ' ')}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
