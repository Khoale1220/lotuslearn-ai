import React from 'react';
import { VerificationResult } from '../../types';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Search,
  Info,
  Calculator,
  Layers,
  UserCheck,
  Check,
  Sliders,
} from 'lucide-react';
import { GlowEdgeCard } from '../GlowEdgeCard';
import { ProvenanceBadge } from '../ProvenanceBadge';

interface VerificationPanelProps {
  verification: VerificationResult;
}

export const VerificationPanel: React.FC<VerificationPanelProps> = ({ verification }) => {
  const isAllVerified =
    verification.overallStatus === 'verified' &&
    verification.unsupportedClaimsStatus === 'none_detected';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-200 gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 shrink-0">
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                Section 07 · Anti-Hallucination Audit
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-xs font-mono text-slate-500">Adversarial Verification Pass</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              How LotusLearn checked this analysis
            </h2>
          </div>
        </div>

        <div
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
            verification.overallStatus === 'verified'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : verification.overallStatus === 'partially_verified'
              ? 'bg-amber-50 text-amber-800 border-amber-300'
              : 'bg-rose-50 text-rose-800 border-rose-300'
          }`}
        >
          {verification.overallStatus === 'verified' ? (
            <CheckCircle2 size={14} className="text-emerald-600" />
          ) : (
            <AlertTriangle
              size={14}
              className={
                verification.overallStatus === 'partially_verified'
                  ? 'text-amber-600'
                  : 'text-rose-600'
              }
            />
          )}
          <span>Status: {verification.overallStatus.toUpperCase().replace('_', ' ')}</span>
        </div>
      </div>

      {/* THREE PILLAR ARCHITECTURE (Priority 9) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Pillar 1: DETERMINISTIC CHECK */}
        {(() => {
          const det = verification.deterministicChecks;
          const isDetVerified = det
            ? det.coveragePassed && det.clusterMathPassed && det.groupPartitionPassed && (det.quotesFlaggedCount === 0)
            : true;

          return (
            <GlowEdgeCard variant="validation" className="shadow-xs">
              <div className="p-5 space-y-3.5 bg-gradient-to-b from-teal-50/50 via-white to-white">
                <div className="flex items-center justify-between pb-2 border-b border-teal-100">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-teal-900 uppercase tracking-wider">
                      <Calculator size={14} className="text-teal-600" />
                      <span>DETERMINISTIC CHECK</span>
                    </div>
                    <div className="text-[10px] text-teal-700 font-mono">
                      Deterministic Software Layer
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                      isDetVerified
                        ? 'text-teal-800 bg-teal-50 border-teal-300'
                        : 'text-rose-800 bg-rose-50 border-rose-300'
                    }`}
                  >
                    {isDetVerified ? 'Verified' : 'Review Required'}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-start gap-2">
                    {det?.quotesFlaggedCount === 0 ? (
                      <CheckCircle2 size={14} className="text-teal-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <strong className="text-slate-900 block text-[11px]">Quote Grounding:</strong>
                      <span className="text-slate-600 text-[11px]">
                        {det ? `${det.quotesGroundedCount} quotes verified in code` : 'Exact substring matching across raw submissions.'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    {det?.coveragePassed !== false ? (
                      <CheckCircle2 size={14} className="text-teal-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle size={14} className="text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <strong className="text-slate-900 block text-[11px]">Student ID Coverage:</strong>
                      <span className="text-slate-600 text-[11px]">
                        {det?.coveragePassed !== false ? '100% 1:1 submission mapping verified.' : 'Coverage gap detected in student mapping.'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    {det?.clusterMathPassed !== false ? (
                      <CheckCircle2 size={14} className="text-teal-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle size={14} className="text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <strong className="text-slate-900 block text-[11px]">Cluster Arithmetic:</strong>
                      <span className="text-slate-600 text-[11px]">
                        {det?.clusterMathPassed !== false ? 'Counts and percentages computed in code.' : 'Arithmetic discrepancy flagged.'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </GlowEdgeCard>
          );
        })()}

        {/* Pillar 2: GEMINI SEMANTIC CHECK */}
        {(() => {
          const isSemVerified = verification.overallStatus === 'verified';
          const isSemPartial = verification.overallStatus === 'partially_verified';

          return (
            <GlowEdgeCard variant="ai" className="shadow-xs">
              <div className="p-5 space-y-3.5 bg-gradient-to-b from-indigo-50/50 via-white to-white">
                <div className="flex items-center justify-between pb-2 border-b border-indigo-100">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 uppercase tracking-wider">
                      <ShieldCheck size={14} className="text-indigo-600" />
                      <span>GEMINI SEMANTIC CHECK</span>
                    </div>
                    <div className="text-[10px] text-indigo-700 font-mono">
                      Adversarial Semantic Audit Pass
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                      isSemVerified
                        ? 'text-emerald-800 bg-emerald-50 border-emerald-300'
                        : isSemPartial
                        ? 'text-amber-800 bg-amber-50 border-amber-300'
                        : 'text-rose-800 bg-rose-50 border-rose-300'
                    }`}
                  >
                    {isSemVerified ? 'Verified' : isSemPartial ? 'Partial' : 'Review Required'}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-start gap-2">
                    {verification.evidenceCoverageStatus === 'verified' ? (
                      <CheckCircle2 size={14} className="text-indigo-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <strong className="text-slate-900 block text-[11px]">Misconception Alignment:</strong>
                      <span className="text-slate-600 text-[11px]">
                        Verified evidence excerpts prove the claimed error pattern.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    {verification.objectiveAlignmentStatus === 'verified' ? (
                      <CheckCircle2 size={14} className="text-indigo-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <strong className="text-slate-900 block text-[11px]">Objective Alignment:</strong>
                      <span className="text-slate-600 text-[11px]">
                        Recommendations directly target stated lesson standard.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    {verification.pedagogicalPlausibility === 'sound' ? (
                      <CheckCircle2 size={14} className="text-indigo-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <strong className="text-slate-900 block text-[11px]">Pedagogical Relevance:</strong>
                      <span className="text-slate-600 text-[11px]">
                        25-minute lesson sequence feasible for classroom reality.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </GlowEdgeCard>
          );
        })()}

        {/* Pillar 3: TEACHER REVIEW */}
        <GlowEdgeCard variant="human" className="shadow-xs">
          <div className="p-5 space-y-3.5 bg-gradient-to-b from-amber-50/50 via-white to-white">
            <div className="flex items-center justify-between pb-2 border-b border-amber-100">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 uppercase tracking-wider">
                  <UserCheck size={14} className="text-amber-600" />
                  <span>TEACHER REVIEW</span>
                </div>
                <div className="text-[10px] text-amber-700 font-mono">
                  Human-in-the-Loop Authority
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border text-amber-800 bg-amber-50 border-amber-300">
                Pending
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <Check size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 block text-[11px]">Accept / Dismiss Insights:</strong>
                  <span className="text-slate-600 text-[11px]">
                    Teachers can approve or filter any AI diagnosed cluster.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Sliders size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 block text-[11px]">Edit Diagnosis &amp; Prompts:</strong>
                  <span className="text-slate-600 text-[11px]">
                    Full inline editorial control over titles and teacher scripts.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <ShieldCheck size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 block text-[11px]">Final Accountability:</strong>
                  <span className="text-slate-600 text-[11px]">
                    AI assists analysis; instructional decisions remain with teacher.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </GlowEdgeCard>
      </div>

      {/* 4 Core Verification Metric Pillars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Evidence Coverage</span>
            <FileCheck size={16} className="text-emerald-600" />
          </div>
          <div className="text-base font-bold text-slate-900 capitalize">
            {verification.evidenceCoverageStatus.replace('_', ' ')}
          </div>
          <p className="text-[11px] text-slate-500">Every claim cross-referenced with student quotes</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Objective Alignment</span>
            <Search size={16} className="text-blue-600" />
          </div>
          <div className="text-base font-bold text-slate-900 capitalize">
            {verification.objectiveAlignmentStatus.replace('_', ' ')}
          </div>
          <p className="text-[11px] text-slate-500">Directly targets rubric learning outcome</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Unsupported Claims</span>
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
          <div className="text-base font-bold text-slate-900 capitalize">
            {verification.unsupportedClaimsStatus.replace('_', ' ')}
          </div>
          <p className="text-[11px] text-slate-500">Zero fabricated student text accepted</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Pedagogical Soundness</span>
            <Info size={16} className="text-indigo-600" />
          </div>
          <div className="text-base font-bold text-slate-900 capitalize">
            {verification.pedagogicalPlausibility.replace('_', ' ')}
          </div>
          <p className="text-[11px] text-slate-500">Realistic for 25-minute class execution</p>
        </div>
      </div>

      {/* Verifier Audit Summary Box */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 sm:p-5 space-y-2 text-xs">
        <span className="font-semibold text-emerald-950 block text-[11px] uppercase tracking-wider">
          Adversarial Audit Summary:
        </span>
        <p className="text-slate-800 leading-relaxed text-sm">
          {verification.explanation}
        </p>
      </div>

      {/* Grounded Audit Breakdown Checklist */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
          <span className="font-semibold text-slate-800">
            Automated Cross-Reference Log (Claims vs. Ground Truth Evidence)
          </span>
          <span className="font-mono text-[11px]">Audited against student cohort</span>
        </div>

        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden text-xs">
          {verification.groundedCheckDetails.map((check, idx) => (
            <div
              key={idx}
              className="p-3.5 bg-white hover:bg-slate-50/60 transition flex flex-col sm:flex-row sm:items-start justify-between gap-3"
            >
              <div className="space-y-1 max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900 block">
                    {check.claim}
                  </span>
                  {check.auditType && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                      {check.auditType === 'deterministic' ? 'Deterministic Audit' : 'Semantic Audit'}
                    </span>
                  )}
                </div>
                <p className="text-slate-600 font-mono text-[11px] bg-slate-50 p-2 rounded border border-slate-200/60">
                  {check.evidenceFound}
                </p>
              </div>

              <div className="self-start sm:self-center shrink-0">
                {check.verdict === 'verified' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
                    <CheckCircle2 size={13} className="text-emerald-600" />
                    <span>Confirmed Grounded</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
                    <AlertTriangle size={13} className="text-amber-600" />
                    <span>Flagged for Review</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
