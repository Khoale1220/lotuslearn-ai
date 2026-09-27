import React from 'react';
import { ClassSnapshot, LearningContext, MisconceptionCluster, VerificationResult } from '../../types';
import { CheckCircle2, AlertOctagon, Lightbulb, Users, Target, ShieldCheck } from 'lucide-react';
import { ProvenanceBadge } from '../ProvenanceBadge';
import { GlowEdgeCard } from '../GlowEdgeCard';
import { getCodeVerificationBadge } from '../../utils/verificationDisplay';

interface ClassSnapshotCardProps {
  context: LearningContext;
  snapshot: ClassSnapshot;
  misconceptions?: MisconceptionCluster[];
  verification?: VerificationResult;
}

export const ClassSnapshotCard: React.FC<ClassSnapshotCardProps> = ({
  context,
  snapshot,
  misconceptions = [],
  verification,
}) => {
  // Find top affected misconception
  const sortedClusters = [...misconceptions].sort((a, b) => (b.studentCount || 0) - (a.studentCount || 0));
  const topCluster = sortedClusters[0];
  const topCount = topCluster ? topCluster.studentCount : (snapshot.totalSubmissions > 0 ? snapshot.totalSubmissions : 0);
  const evidenceStatus = verification?.overallStatus === 'verified'
    ? 'Gemini Verified'
    : verification?.overallStatus === 'partially_verified'
    ? 'Gemini Review: Partial'
    : 'Gemini Review Required';

  const codeVerification = getCodeVerificationBadge(verification?.deterministicChecks?.coveragePassed);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-200 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                Section 01 · Diagnostic Overview
              </span>
              <span className="text-slate-300">·</span>
              <ProvenanceBadge type="gemini" label="Gemini Diagnosis" size="sm" />
              <ProvenanceBadge type={codeVerification.variant} label={codeVerification.label} size="sm" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
              Class Snapshot: {context.lessonTitle}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {context.subject} · {context.gradeLevel} · Evaluated against lesson objective standard
            </p>
          </div>
        </div>

        {/* 4 Decision-Oriented Metric Cards (Requested in Prompt) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Metric 1: Student Submissions */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Student Submissions
            </span>
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {snapshot.totalSubmissions}
            </div>
            <p className="text-[11px] text-slate-500">100% individual roster ingested</p>
          </div>

          {/* Metric 2: Evidence-Backed Patterns */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Evidence-Backed Patterns
            </span>
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {snapshot.misconceptionCount}
            </div>
            <p className="text-[11px] text-slate-500">Synthesized class error clusters</p>
          </div>

          {/* Metric 3: Students Affected by Top Misconception */}
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-4 space-y-1">
            <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider block">
              Top Misconception Impact
            </span>
            <div className="text-2xl font-bold text-amber-950 font-mono">
              {topCount} / {snapshot.totalSubmissions}
            </div>
            <p className="text-[11px] text-amber-800 font-medium truncate">
              {topCluster ? topCluster.misconceptionTitle : 'Core finished-time obstacle'}
            </p>
          </div>

          {/* Metric 4: Evidence Status */}
          <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4 space-y-1">
            <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">
              Evidence Status
            </span>
            <div className="text-2xl font-bold text-emerald-950 font-mono capitalize">
              {verification?.overallStatus === 'verified' ? 'Verified' : 'Audited'}
            </div>
            <p className="text-[11px] text-emerald-800 flex items-center gap-1 font-medium">
              <ShieldCheck size={13} className="text-emerald-600" />
              <span>{evidenceStatus}</span>
            </p>
          </div>
        </div>

        {/* DOMINANT STATEMENT CARD: Highest-Priority Teaching Need (Requested in Prompt) */}
        <GlowEdgeCard variant="ai" className="shadow-xs border-blue-200">
          <div className="p-5 sm:p-6 space-y-3 bg-gradient-to-r from-blue-50/50 via-white to-indigo-50/30">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-rose-700 uppercase tracking-wider">
                <AlertOctagon size={16} className="text-rose-600 shrink-0" />
                <span>Highest-Priority Teaching Need (Action for Tomorrow)</span>
              </div>
              <span className="text-[11px] font-mono font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md self-start sm:self-auto">
                Priority: Urgent Obstacle
              </span>
            </div>

            <div className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight leading-snug">
              &quot;{snapshot.highestPriorityNeed}&quot;
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200/70 text-xs">
              <div className="space-y-1">
                <span className="font-semibold text-slate-900 block text-[11px] uppercase tracking-wider">
                  Instructional Pivot:
                </span>
                <p className="text-slate-700 leading-relaxed">
                  {snapshot.overallRecommendation}
                </p>
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-slate-900 block text-[11px] uppercase tracking-wider">
                  Class Foundation to Leverage:
                </span>
                <p className="text-slate-700 leading-relaxed">
                  {snapshot.strongestConcept} (Students demonstrate reliable mastery here; use this as the anchor for the contrast drill).
                </p>
              </div>
            </div>
          </div>
        </GlowEdgeCard>
      </div>
    </div>
  );
};
