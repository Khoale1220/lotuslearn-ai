import React from 'react';
import { ClassSnapshot, LearningContext, MisconceptionCluster, VerificationResult, PrivacyAudit } from '../../types';
import { Target, Users, AlertCircle, Clock, ShieldCheck } from 'lucide-react';
import { getCanonicalTeacherDecision, getPrivacyStatusDisplay } from '../../utils/verificationDisplay';

interface ClassSnapshotCardProps {
  context: LearningContext;
  snapshot: ClassSnapshot;
  misconceptions?: MisconceptionCluster[];
  verification?: VerificationResult;
  privacyAudit?: PrivacyAudit;
}

export const ClassSnapshotCard: React.FC<ClassSnapshotCardProps> = ({
  context,
  snapshot,
  misconceptions = [],
  verification,
  privacyAudit,
}) => {
  // Sort clusters by student count to find top impacted pattern
  const sortedClusters = [...misconceptions].sort((a, b) => (b.studentCount || 0) - (a.studentCount || 0));
  const topCluster = sortedClusters[0];
  const topCount = topCluster ? topCluster.studentCount : 0;
  const isCoverageVerified = verification?.deterministicChecks?.coveragePassed === true;
  const privacyDisplay = getPrivacyStatusDisplay(privacyAudit);

  // Calculate items requiring teacher review
  const pendingTeacherReviews = misconceptions.filter(
    (c) => getCanonicalTeacherDecision(c) === 'pending'
  ).length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-200 gap-4">
        <div>
          <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider block mb-1">
            Executive Diagnostic Summary
          </span>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Class Snapshot: {context.lessonTitle}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {context.subject} / {context.gradeLevel} / Evaluated against lesson objective standard
          </p>
        </div>

        {/* Privacy Boundary Status Badge */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border ${privacyDisplay.badgeClass}`}
            title={privacyDisplay.description}
          >
            <ShieldCheck size={14} aria-hidden="true" />
            <span>{privacyDisplay.label}</span>
          </span>
        </div>
      </div>

      {/* 4 Decision-Oriented Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Metric 1: Student Submissions */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Student Submissions
          </span>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {snapshot.totalSubmissions}
          </div>
          <p className="text-[11px] text-slate-500">
            {isCoverageVerified ? 'Complete roster coverage verified' : `${snapshot.totalSubmissions} submissions analyzed`}
          </p>
        </div>

        {/* Metric 2: Evidence-Backed Patterns */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Diagnosed Patterns
          </span>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {snapshot.misconceptionCount}
          </div>
          <p className="text-[11px] text-slate-500">Shared class misconception clusters</p>
        </div>

        {/* Metric 3: Students Affected by Top Misconception */}
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-4 space-y-1">
          <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider block">
            Top Pattern Impact
          </span>
          <div className="text-2xl font-bold text-amber-950 font-mono">
            {topCluster ? `${topCount} / ${snapshot.totalSubmissions}` : 'None'}
          </div>
          <p className="text-[11px] text-amber-800 font-medium truncate">
            {topCluster ? topCluster.misconceptionTitle : 'No priority misconception identified'}
          </p>
        </div>

        {/* Metric 4: Teacher Review Status */}
        <div className="rounded-xl border border-blue-200/80 bg-blue-50/40 p-4 space-y-1">
          <span className="text-[11px] font-semibold text-blue-800 uppercase tracking-wider block">
            Teacher Decisions
          </span>
          <div className="text-2xl font-bold text-blue-950 font-mono">
            {pendingTeacherReviews > 0 ? `${pendingTeacherReviews} Pending` : 'All Reviewed'}
          </div>
          <p className="text-[11px] text-blue-800 font-medium truncate">
            {pendingTeacherReviews > 0 ? 'Educator review required' : 'Decisions recorded'}
          </p>
        </div>
      </div>

      {/* 3 Executive Takeaway Boxes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-1">
          <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block">
            Strongest Concept Mastered:
          </span>
          <p className="text-xs text-slate-800 font-medium leading-relaxed">
            {snapshot.strongestConcept}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-1">
          <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block">
            Highest Priority Need:
          </span>
          <p className="text-xs text-slate-800 font-medium leading-relaxed">
            {snapshot.highestPriorityNeed}
          </p>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-1">
          <span className="text-[11px] font-semibold text-blue-900 uppercase tracking-wider block">
            Recommended Action:
          </span>
          <p className="text-xs text-blue-950 font-medium leading-relaxed">
            {snapshot.overallRecommendation}
          </p>
        </div>
      </div>
    </div>
  );
};
