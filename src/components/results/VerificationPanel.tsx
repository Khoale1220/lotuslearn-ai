import React from 'react';
import {
  VerificationResult,
  MisconceptionCluster,
  DifferentiatedIntervention,
} from '../../types';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Info,
  Calculator,
  UserCheck,
  Check,
  Clock,
} from 'lucide-react';
import {
  isAnalysisFullyVerified,
  getCanonicalTeacherDecision,
} from '../../utils/verificationDisplay';

interface VerificationPanelProps {
  verification: VerificationResult;
  misconceptions?: MisconceptionCluster[];
  interventions?: DifferentiatedIntervention[];
}

export const VerificationPanel: React.FC<VerificationPanelProps> = ({
  verification,
  misconceptions = [],
  interventions = [],
}) => {
  const det = verification.deterministicChecks;
  const isDetChecked = Boolean(det);
  const isDetVerified = det
    ? det.coveragePassed === true &&
      det.clusterMathPassed === true &&
      det.groupPartitionPassed === true &&
      det.evidenceValidationPassed === true
    : false;

  const isGeminiVerified = verification.overallStatus === 'verified';
  const isGeminiPartial = verification.overallStatus === 'partially_verified';

  // Compute canonical teacher decision status across all items
  const allTeacherDecisions = [
    ...misconceptions.map((c) => getCanonicalTeacherDecision(c)),
    ...interventions.map((i) => getCanonicalTeacherDecision(i)),
  ];
  const acceptedCount = allTeacherDecisions.filter((d) => d === 'accepted').length;
  const editedCount = allTeacherDecisions.filter((d) => d === 'edited').length;
  const dismissedCount = allTeacherDecisions.filter((d) => d === 'dismissed').length;
  const pendingCount = allTeacherDecisions.filter((d) => d === 'pending').length;
  const totalItems = allTeacherDecisions.length;

  const technicalFullyVerified = isAnalysisFullyVerified({
    deterministicAuditPassed: isDetVerified,
    overallStatus: verification.overallStatus,
    coveragePassed: det?.coveragePassed,
    clusterMathPassed: det?.clusterMathPassed,
    groupPartitionPassed: det?.groupPartitionPassed,
    evidenceValidationPassed: det?.evidenceValidationPassed,
  });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-200 gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-700 border border-teal-200 shrink-0">
            <ShieldCheck size={22} />
          </div>
          <div>
            <span className="text-xs font-semibold text-teal-700 uppercase tracking-wider block mb-1">
              Multi-Layer Verification &amp; Trust Boundaries
            </span>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              System Verification &amp; Educator Agency
            </h2>
            <p className="text-xs text-slate-500">
              Explicit separation between AI reasoning, deterministic code checks, independent audit, and human decision.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-semibold ${
              technicalFullyVerified
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-amber-50 text-amber-800 border-amber-300'
            }`}
          >
            {technicalFullyVerified ? (
              <CheckCircle2 size={14} className="text-emerald-600" />
            ) : (
              <AlertTriangle size={14} className="text-amber-600" />
            )}
            <span>
              {technicalFullyVerified
                ? 'Technical Checks: Passed'
                : 'Technical Checks: Review Required'}
            </span>
          </span>
        </div>
      </div>

      {/* THREE PILLAR ARCHITECTURE */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Pillar 1: DETERMINISTIC CODE CHECK */}
        <div className="rounded-xl border border-teal-200 bg-teal-50/20 p-5 space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-teal-100">
            <div>
              <span className="text-xs font-bold text-teal-900 uppercase tracking-wider flex items-center gap-1.5">
                <Calculator size={14} className="text-teal-600" />
                Pillar 1: Code Check
              </span>
              <span className="text-[10px] text-teal-700 font-mono block">
                Deterministic Software Layer
              </span>
            </div>
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                !isDetChecked
                  ? 'text-slate-700 bg-slate-100 border-slate-300'
                  : isDetVerified
                  ? 'text-teal-800 bg-teal-50 border-teal-300'
                  : 'text-amber-800 bg-amber-50 border-amber-300'
              }`}
            >
              {!isDetChecked ? 'Not Checked' : isDetVerified ? 'Code Verified' : 'Check Flagged'}
            </span>
          </div>

          <div className="space-y-2 text-xs text-slate-700">
            <div className="flex items-center justify-between py-1 border-b border-teal-100/60 font-mono text-[11px]">
              <span>Roster Coverage:</span>
              <span className={det?.coveragePassed ? 'text-teal-800 font-bold' : 'text-amber-700'}>
                {det?.coveragePassed ? 'Coverage Complete' : 'Incomplete'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-teal-100/60 font-mono text-[11px]">
              <span>Cluster Arithmetic:</span>
              <span className={det?.clusterMathPassed ? 'text-teal-800 font-bold' : 'text-amber-700'}>
                {det?.clusterMathPassed ? 'Math Sound' : 'Discrepancy'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-teal-100/60 font-mono text-[11px]">
              <span>Student Partition:</span>
              <span className={det?.groupPartitionPassed ? 'text-teal-800 font-bold' : 'text-amber-700'}>
                {det?.groupPartitionPassed ? 'Disjoint & Complete' : 'Overlap'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-teal-100/60 font-mono text-[11px]">
              <span>Evidence Validation:</span>
              <span className={det?.evidenceValidationPassed === true ? 'text-teal-800 font-bold' : det?.evidenceValidationPassed === false ? 'text-rose-700 font-bold' : 'text-slate-500'}>
                {det?.evidenceValidationPassed === true ? 'Passed' : det?.evidenceValidationPassed === false ? 'Review Required' : 'Not Checked'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 font-mono text-[11px]">
              <span>Grounded Citations:</span>
              <span className="text-slate-900 font-semibold">
                {det?.quotesGroundedCount || 0} grounded / {det?.quotesFlaggedCount || 0} flagged
              </span>
            </div>
          </div>
        </div>

        {/* Pillar 2: INDEPENDENT SEMANTIC AUDIT */}
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/20 p-5 space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-indigo-100">
            <div>
              <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-indigo-600" />
                Pillar 2: Semantic Audit
              </span>
              <span className="text-[10px] text-indigo-700 font-mono block">
                Gemini Verification Engine
              </span>
            </div>
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                isGeminiVerified
                  ? 'text-indigo-800 bg-indigo-50 border-indigo-300'
                  : isGeminiPartial
                  ? 'text-amber-800 bg-amber-50 border-amber-300'
                  : 'text-slate-700 bg-slate-100 border-slate-300'
              }`}
            >
              {isGeminiVerified ? 'Audit Passed' : isGeminiPartial ? 'Partial Audit' : 'Review Required'}
            </span>
          </div>

          <div className="space-y-2 text-xs text-slate-700">
            <div className="flex items-center justify-between py-1 border-b border-indigo-100/60 font-mono text-[11px]">
              <span>Objective Alignment:</span>
              <span className="text-indigo-900 font-semibold">
                {verification.objectiveAlignmentStatus ? verification.objectiveAlignmentStatus.toUpperCase() : 'CHECKED'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-indigo-100/60 font-mono text-[11px]">
              <span>Evidence Coverage:</span>
              <span className="text-indigo-900 font-semibold">
                {verification.evidenceCoverageStatus ? verification.evidenceCoverageStatus.toUpperCase() : 'CHECKED'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-indigo-100/60 font-mono text-[11px]">
              <span>Unsupported Claims:</span>
              <span className="text-indigo-900 font-semibold">
                {verification.unsupportedClaimsStatus === 'none_detected' ? 'None Detected' : 'Flagged'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 font-mono text-[11px]">
              <span>Pedagogical Plausibility:</span>
              <span className="text-indigo-900 font-semibold">
                {verification.pedagogicalPlausibility ? verification.pedagogicalPlausibility.toUpperCase() : 'CHECKED'}
              </span>
            </div>
          </div>
        </div>

        {/* Pillar 3: HUMAN EDUCATOR AGENCY */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/20 p-5 space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-amber-100">
            <div>
              <span className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck size={14} className="text-amber-600" />
                Pillar 3: Teacher Review
              </span>
              <span className="text-[10px] text-amber-700 font-mono block">
                Educator Decision Authority
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border text-amber-900 bg-amber-50 border-amber-300">
              {pendingCount > 0 ? `${pendingCount} Review Pending` : 'All Reviewed'}
            </span>
          </div>

          <div className="space-y-2 text-xs text-slate-700">
            <div className="flex items-center justify-between py-1 border-b border-amber-100/60 font-mono text-[11px]">
              <span>Accepted by Teacher:</span>
              <span className="text-emerald-700 font-bold">{acceptedCount} items</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-amber-100/60 font-mono text-[11px]">
              <span>Edited by Teacher:</span>
              <span className="text-blue-700 font-bold">{editedCount} items</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-amber-100/60 font-mono text-[11px]">
              <span>Dismissed by Teacher:</span>
              <span className="text-slate-600 font-bold">{dismissedCount} items</span>
            </div>
            <div className="flex items-center justify-between py-1 font-mono text-[11px]">
              <span>Awaiting Review:</span>
              <span className={pendingCount > 0 ? 'text-amber-800 font-bold' : 'text-emerald-700'}>
                {pendingCount} items
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Cross-Dimension Trust Matrix Disclosure */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs">
        <span className="font-semibold text-slate-800 block">
          Trust Dimension Independence Guarantee:
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-600">
          <div className="rounded-lg bg-white p-3 border border-slate-200">
            <span className="font-semibold text-slate-800 block mb-0.5">
              Technical Pass ≠ Human Approval
            </span>
            <p className="leading-relaxed text-[11px]">
              When deterministic code and Gemini verification pass, the item is labeled <em>&quot;Code Verified · Teacher Review Pending&quot;</em> until the educator explicitly reviews and accepts it.
            </p>
          </div>
          <div className="rounded-lg bg-white p-3 border border-slate-200">
            <span className="font-semibold text-slate-800 block mb-0.5">
              Teacher Acceptance ≠ Technical Pass
            </span>
            <p className="leading-relaxed text-[11px]">
              If an educator accepts an insight that had an arithmetic or evidence grounding discrepancy, the human decision is honored but the technical check remains flagged as failed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
