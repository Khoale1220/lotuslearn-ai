import React from 'react';
import { MisconceptionCluster, StudentObservation } from '../../types';
import { Quote, User, AlertCircle, ChevronDown, CheckCircle2, AlertTriangle } from 'lucide-react';
import { getEvidenceDisplay, getDeterministicMatchDisplay } from '../../utils/verificationDisplay';

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
    <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
              Student Evidence &amp; Citations
            </span>
            <span className="text-slate-300" aria-hidden="true">/</span>
            {(() => {
              if (!activeCluster?.evidenceExamples || activeCluster.evidenceExamples.length === 0) {
                return (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">
                    Evidence Not Checked
                  </span>
                );
              }
              const allSupported = activeCluster.evidenceExamples.every(
                (e) =>
                  e.deterministicMatch === 'exact_match' ||
                  e.deterministicMatch === 'exact_quote_found' ||
                  e.deterministicMatch === 'normalized_exact_match' ||
                  e.deterministicMatch === 'image_transcription_verified'
              );
              return (
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded border flex items-center gap-1 ${
                    allSupported
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-amber-50 text-amber-800 border-amber-300'
                  }`}
                >
                  {allSupported ? (
                    <>
                      <CheckCircle2 size={12} className="text-emerald-600" />
                      <span>Evidence Grounded</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={12} className="text-amber-600" />
                      <span>Evidence Review Required</span>
                    </>
                  )}
                </span>
              );
            })()}
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 mt-1">
            Grounded Evidence Panel
          </h2>
          <p className="text-xs text-slate-500">
            Every diagnosed pattern is anchored directly to verbatim student excerpts and checked for grounded support.
          </p>
        </div>

        {activeCluster && (
          <div className="text-xs text-slate-700 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-mono self-start sm:self-auto">
            <span className="text-slate-500">Selected:</span>
            <span className="font-bold text-slate-900 truncate max-w-xs">{activeCluster.misconceptionTitle}</span>
          </div>
        )}
      </div>

      {!activeCluster ? (
        <div className="text-xs text-slate-500 text-center py-8">
          Select a misconception cluster above to view supporting student evidence.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Diagnostic Claim Context Banner */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-blue-800 bg-blue-100/70 px-2 py-0.5 rounded border border-blue-200">
                  DIAGNOSED PATTERN
                </span>
                <span className="font-bold text-slate-900 text-sm">
                  {activeCluster.misconceptionTitle}
                </span>
              </div>
              <div className="font-mono text-xs text-slate-600 bg-white px-2.5 py-1 rounded border border-slate-200 font-medium">
                Impact: {activeCluster.studentCount} / {observations.length} Students ({activeCluster.percentageAffected}%)
              </div>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              {activeCluster.explanation}
            </p>
          </div>

          {/* Evidence Citations Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeCluster.evidenceExamples.map((item, idx) => {
              const display = getEvidenceDisplay(item.deterministicMatch, item.sourceType);
              const legacyDisplay = getDeterministicMatchDisplay(item.deterministicMatch, item.sourceType);

              return (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200 bg-white p-5 space-y-3.5 shadow-2xs hover:border-slate-300 transition"
                >
                  {/* Top line: Student ID & Grounding Match Status */}
                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => onInspectStudent(item.studentId)}
                      className="font-mono font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded-md transition flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                      aria-label={`Inspect ${item.studentId} submission`}
                    >
                      <User size={13} />
                      <span>{item.studentId}</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${display.badgeClass}`}>
                        {display.label}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">#{idx + 1}</span>
                    </div>
                  </div>

                  {/* Student Work Excerpt */}
                  <div className="relative pl-3.5 border-l-2 border-blue-600 bg-slate-50/80 p-3 rounded-r-lg">
                    <Quote size={14} className="text-slate-400 absolute top-2 right-2 opacity-30" aria-hidden="true" />
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                      Student Work Excerpt ({item.sourceType === 'image_transcription' ? 'Photographed Worksheet' : 'Typed Response'}):
                    </span>
                    <blockquote className="text-xs font-medium text-slate-900 italic font-serif leading-relaxed">
                      &quot;{item.excerpt}&quot;
                    </blockquote>
                  </div>

                  {/* Diagnostic Justification */}
                  <div className="rounded-lg bg-blue-50/50 border border-blue-100 p-3 text-xs text-slate-800 space-y-1">
                    <span className="font-semibold text-blue-950 text-[11px] block uppercase tracking-wider">
                      Why this excerpt was cited:
                    </span>
                    <p className="text-slate-700 leading-relaxed text-xs">
                      {item.groundingReason}
                    </p>
                  </div>

                  {/* Progressive Disclosure: How this evidence was checked */}
                  <details className="group rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs">
                    <summary className="cursor-pointer font-semibold text-slate-700 flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded">
                      <span className="text-[11px] text-slate-600">Verification Details &amp; Grounding</span>
                      <ChevronDown size={13} className="text-slate-400 group-open:rotate-180 transition-transform" />
                    </summary>
                    <div className="mt-2 pt-2 border-t border-slate-200 text-[11px] space-y-1.5 text-slate-600 font-mono">
                      <p>
                        <strong>Source Format:</strong> {item.sourceType === 'image_transcription' ? 'Handwritten Image (OCR)' : 'Direct Typed Text'}
                      </p>
                      <p>
                        <strong>Deterministic Match:</strong> {item.deterministicMatch || 'not_checked'}
                      </p>
                      <p>
                        <strong>Explanation:</strong> {display.explanation}
                      </p>
                      <p>
                        <strong>Support Status:</strong>{' '}
                        <span className={display.isSupported ? 'text-emerald-700 font-bold' : 'text-amber-800 font-bold'}>
                          {display.isSupported ? 'Supported & Grounded' : 'Review Required'}
                        </span>
                      </p>
                    </div>
                  </details>
                </div>
              );
            })}
          </div>

          {/* Student Roster Drill-Down Bar */}
          <div className="pt-4 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 text-xs gap-1">
              <span className="font-semibold text-slate-800">
                All Student Responses in Cohort ({observations.length} Students)
              </span>
              <span className="text-slate-500">Click any student to view their complete individual profile</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {observations.map((obs) => {
                const isAffected = activeCluster.affectedStudentIds.includes(obs.studentId);
                return (
                  <button
                    key={obs.studentId}
                    type="button"
                    onClick={() => onInspectStudent(obs.studentId)}
                    className={`p-2.5 rounded-lg border text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                      isAffected
                        ? 'border-blue-300 bg-blue-50/70 hover:bg-blue-100 text-blue-950 font-semibold shadow-2xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                    aria-label={`Inspect ${obs.studentId} profile ${isAffected ? '(affected by this pattern)' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono">{obs.studentId}</span>
                      {isAffected && (
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-600" aria-label="Affected student" />
                      )}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500 truncate">
                      {obs.recommendedSupportLevel ? obs.recommendedSupportLevel.replace('_', ' ') : 'Review'}
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
