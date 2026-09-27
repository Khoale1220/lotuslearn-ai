import React, { useState } from 'react';
import {
  ClassAnalysisResult,
  DifferentiatedIntervention,
  MisconceptionCluster,
  StudentSubmission,
} from '../types';
import { ClassSnapshotCard } from './results/ClassSnapshotCard';
import { MisconceptionMap } from './results/MisconceptionMap';
import { EvidencePanel } from './results/EvidencePanel';
import { InstructionalGroups } from './results/InstructionalGroups';
import { NextLessonTimeline } from './results/NextLessonTimeline';
import { DifferentiatedInterventions } from './results/DifferentiatedInterventions';
import { VerificationPanel } from './results/VerificationPanel';
import { StudentDetailModal } from './results/StudentDetailModal';
import { WhyThisInsightModal } from './results/WhyThisInsightModal';
import { AIContributionTrace, AITraceDrawer } from './AIContributionTrace';
import {
  ArrowLeft,
  Download,
  Printer,
  Sparkles,
  Cpu,
  Layers,
  FileCheck,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { ProvenanceBadge } from './ProvenanceBadge';

interface ResultsViewProps {
  result: ClassAnalysisResult;
  rawSubmissions: StudentSubmission[];
  onBackToDashboard: () => void;
  onNewAnalysis: () => void;
  onAdjustIntervention: (
    intervention: DifferentiatedIntervention,
    action: 'simplify' | 'challenge' | 'exit_ticket'
  ) => Promise<void>;
  onUpdateMisconceptionStatus: (
    clusterId: string,
    status: 'accepted' | 'edited' | 'dismissed'
  ) => void;
  onUpdateInterventionStatus: (
    interventionId: string,
    status: 'accepted' | 'edited' | 'dismissed'
  ) => void;
}

export const ResultsView: React.FC<ResultsViewProps> = ({
  result,
  rawSubmissions,
  onBackToDashboard,
  onNewAnalysis,
  onAdjustIntervention,
  onUpdateMisconceptionStatus,
  onUpdateInterventionStatus,
}) => {
  // Active selected misconception cluster for the Evidence Panel
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(
    result.misconceptionClusters[0]?.clusterId || null
  );

  // Inspected student ID for drilldown modal
  const [inspectedStudentId, setInspectedStudentId] = useState<string | null>(null);

  // Active cluster for "Why this insight?" modal
  const [whyInsightCluster, setWhyInsightCluster] = useState<MisconceptionCluster | null>(null);

  // Drawer state for Full AI Contribution Trace
  const [isTraceDrawerOpen, setIsTraceDrawerOpen] = useState(false);

  // Active section quick-jump tab
  const [activeTab, setActiveTab] = useState<
    'all' | 'snapshot' | 'trace' | 'misconceptions' | 'evidence' | 'groups' | 'lesson' | 'interventions' | 'verification'
  >('all');

  // Handle Export Markdown Report
  const handleExportMarkdown = () => {
    const md = `# LotusLearn AI Diagnostic Assessment Report
**Lesson:** ${result.context.lessonTitle} (${result.context.subject} - ${result.context.gradeLevel})
**Date:** ${new Date(result.timestamp).toLocaleDateString()}
**Objective:** ${result.context.learningObjective}

---
## 1. Class Snapshot
- Total Submissions Analyzed: ${result.classSnapshot.totalSubmissions}
- Misconceptions Found: ${result.classSnapshot.misconceptionCount}
- Strongest Concept: ${result.classSnapshot.strongestConcept}
- Highest Priority Need: ${result.classSnapshot.highestPriorityNeed}
- Overall Recommendation: ${result.classSnapshot.overallRecommendation}

---
## 2. Misconception Discovery Map
${result.misconceptionClusters
  .map(
    (c) => `### ${c.misconceptionTitle} (${c.teachingPriority.toUpperCase()} Priority - ${c.studentCount} students / ${c.percentageAffected}%)
${c.explanation}
- Recommended Response: ${c.recommendedInstructionalResponse}
- Affected Students: ${c.affectedStudentIds.join(', ')}
`
  )
  .join('\n')}

---
## 3. Instructional Groups (Non-stigmatizing)
${result.instructionalGroups
  .map(
    (g) => `### ${g.groupName} (${g.estimatedDuration})
- Students: ${g.studentIds.join(', ')}
- Common Need: ${g.commonLearningNeed}
- Activity: ${g.suggestedActivity}
- Teacher Prompt: "${g.exampleQuestion}"
- Success Criterion: ${g.successCriterion}
`
  )
  .join('\n')}

---
## 4. Next Lesson Plan (25-Minute Sequence)
${result.nextLessonPlan.phases
  .map((p) => `- **${p.timeRange} - ${p.phaseTitle}**: ${p.description} (Prompt: "${p.actionableTeacherPrompt}")`)
  .join('\n')}

---
## 5. Verification Status
- Status: ${result.verification.overallStatus.toUpperCase()}
- Evidence Coverage: ${result.verification.evidenceCoverageStatus}
- Objective Alignment: ${result.verification.objectiveAlignmentStatus}
- Unsupported Claims: ${result.verification.unsupportedClaimsStatus}
- Explanation: ${result.verification.explanation}
`;

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lotuslearn-report-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const inspectedObservation = result.studentObservations.find(
    (o) => o.studentId === inspectedStudentId
  );
  const inspectedSubmission = rawSubmissions.find(
    (s) => s.studentId === inspectedStudentId
  );

  const metadata = result.executionMetadata;
  const isDemo = metadata?.executionMode === 'demo_resilience';

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <button
              onClick={onBackToDashboard}
              className="inline-flex items-center gap-1 hover:text-slate-900 transition"
            >
              <ArrowLeft size={13} /> Dashboard
            </button>
            <span>/</span>
            <span className="text-slate-900 font-medium">Session Results</span>
            <span>/</span>
            <span>{new Date(result.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {result.context.lessonTitle}
            </h1>
            {isDemo ? (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Demo Resilience Mode · Verified Benchmark Cache
              </span>
            ) : (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Live Gemini Engine · 4-Stage Sequential Pass
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={() => setIsTraceDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100/80 px-3 py-1.5 text-xs font-semibold text-indigo-900 transition shadow-2xs"
          >
            <Cpu size={14} className="text-indigo-600" />
            <span>View AI Contribution Trace</span>
          </button>

          <button
            onClick={handleExportMarkdown}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
          >
            <Download size={14} />
            <span>Export Report</span>
          </button>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
          >
            <Printer size={14} />
            <span>Print Sheet</span>
          </button>

          <button
            onClick={onNewAnalysis}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-2xs"
          >
            <Sparkles size={14} />
            <span>New Analysis</span>
          </button>
        </div>
      </div>

      {/* Restrained Technical Execution Strip (Real Backend Metadata) */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 px-4 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded font-mono text-[11px] font-bold uppercase tracking-wider ${
              isDemo
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isDemo ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
            />
            {isDemo ? 'DEMO RESILIENCE' : 'LIVE GEMINI'}
          </span>
          <span className="text-slate-700 font-medium font-mono text-xs">
            {isDemo ? (
              <>
                <span>Verified Benchmark Cache</span>
                <span className="text-slate-300 mx-1.5">·</span>
                <span>{metadata?.submissionCount || result.studentObservations.length} submissions</span>
                <span className="text-slate-300 mx-1.5">·</span>
                <span>Deterministic Code Verified</span>
                {metadata?.totalDurationMs ? (
                  <>
                    <span className="text-slate-300 mx-1.5">·</span>
                    <span>{(metadata.totalDurationMs / 1000).toFixed(1)} sec</span>
                  </>
                ) : null}
              </>
            ) : (
              <>
                <span>{metadata?.primaryModel || 'Gemini 3.8 Flash'}</span>
                <span className="text-slate-300 mx-1.5">·</span>
                <span>{metadata?.submissionCount || result.studentObservations.length} submissions</span>
                <span className="text-slate-300 mx-1.5">·</span>
                <span>4 AI passes</span>
                {metadata?.totalDurationMs ? (
                  <>
                    <span className="text-slate-300 mx-1.5">·</span>
                    <span>{(metadata.totalDurationMs / 1000).toFixed(1)} sec</span>
                  </>
                ) : null}
              </>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 shrink-0">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
          <span><strong>Teacher Agency:</strong> All insights and interventions are reviewable.</span>
        </div>
      </div>

      {/* Quick Navigation Segmented Tabs (Zero-pill discipline) */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto text-xs font-medium">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3 py-1.5 rounded-md transition ${
            activeTab === 'all'
              ? 'bg-white text-slate-900 shadow-2xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          All Sections
        </button>
        <button
          onClick={() => setActiveTab('snapshot')}
          className={`px-3 py-1.5 rounded-md transition ${
            activeTab === 'snapshot'
              ? 'bg-white text-slate-900 shadow-2xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          1. Class Snapshot
        </button>
        <button
          onClick={() => setActiveTab('trace')}
          className={`px-3 py-1.5 rounded-md transition ${
            activeTab === 'trace'
              ? 'bg-white text-slate-900 shadow-2xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          2. AI Contribution Trace
        </button>
        <button
          onClick={() => setActiveTab('misconceptions')}
          className={`px-3 py-1.5 rounded-md transition ${
            activeTab === 'misconceptions'
              ? 'bg-white text-slate-900 shadow-2xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          3. Misconception Map
        </button>
        <button
          onClick={() => setActiveTab('evidence')}
          className={`px-3 py-1.5 rounded-md transition ${
            activeTab === 'evidence'
              ? 'bg-white text-slate-900 shadow-2xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          4. Grounded Evidence
        </button>
        <button
          onClick={() => setActiveTab('groups')}
          className={`px-3 py-1.5 rounded-md transition ${
            activeTab === 'groups'
              ? 'bg-white text-slate-900 shadow-2xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          5. Instructional Groups
        </button>
        <button
          onClick={() => setActiveTab('lesson')}
          className={`px-3 py-1.5 rounded-md transition ${
            activeTab === 'lesson'
              ? 'bg-white text-slate-900 shadow-2xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          6. Next Lesson (25 min)
        </button>
        <button
          onClick={() => setActiveTab('interventions')}
          className={`px-3 py-1.5 rounded-md transition ${
            activeTab === 'interventions'
              ? 'bg-white text-slate-900 shadow-2xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          7. Scaffolds
        </button>
        <button
          onClick={() => setActiveTab('verification')}
          className={`px-3 py-1.5 rounded-md transition ${
            activeTab === 'verification'
              ? 'bg-white text-slate-900 shadow-2xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          8. Trust &amp; Verification
        </button>
      </div>

      {/* SECTION 1: CLASS SNAPSHOT */}
      {(activeTab === 'all' || activeTab === 'snapshot') && (
        <section id="section-snapshot">
          <ClassSnapshotCard
            context={result.context}
            snapshot={result.classSnapshot}
            misconceptions={result.misconceptionClusters}
            verification={result.verification}
          />
        </section>
      )}

      {/* SECTION 2: AI CONTRIBUTION TRACE SUMMARY (Requested Feature) */}
      {(activeTab === 'all' || activeTab === 'trace') && (
        <section id="section-ai-trace">
          <AIContributionTrace
            result={result}
            onOpenDrawer={() => setIsTraceDrawerOpen(true)}
          />
        </section>
      )}

      {/* SECTION 3: MISCONCEPTION MAP */}
      {(activeTab === 'all' || activeTab === 'misconceptions') && (
        <section id="section-misconceptions">
          <MisconceptionMap
            clusters={result.misconceptionClusters}
            selectedClusterId={selectedClusterId}
            totalStudents={result.classSnapshot.totalSubmissions || 12}
            onSelectCluster={(id) => {
              setSelectedClusterId(id);
              if (activeTab === 'misconceptions') setActiveTab('evidence');
            }}
            onUpdateStatus={onUpdateMisconceptionStatus}
            onInspectStudent={(studentId) => setInspectedStudentId(studentId)}
            onOpenWhyInsight={(cluster) => setWhyInsightCluster(cluster)}
          />
        </section>
      )}

      {/* SECTION 4: EVIDENCE PANEL */}
      {(activeTab === 'all' || activeTab === 'evidence') && (
        <section id="section-evidence">
          <EvidencePanel
            clusters={result.misconceptionClusters}
            selectedClusterId={selectedClusterId}
            observations={result.studentObservations}
            onInspectStudent={(studentId) => setInspectedStudentId(studentId)}
          />
        </section>
      )}

      {/* SECTION 5: INSTRUCTIONAL GROUPS */}
      {(activeTab === 'all' || activeTab === 'groups') && (
        <section id="section-groups">
          <InstructionalGroups
            groups={result.instructionalGroups}
            onInspectStudent={(studentId) => setInspectedStudentId(studentId)}
          />
        </section>
      )}

      {/* SECTION 6: NEXT LESSON PLAN */}
      {(activeTab === 'all' || activeTab === 'lesson') && (
        <section id="section-lesson">
          <NextLessonTimeline plan={result.nextLessonPlan} />
        </section>
      )}

      {/* SECTION 7: DIFFERENTIATED INTERVENTIONS */}
      {(activeTab === 'all' || activeTab === 'interventions') && (
        <section id="section-interventions">
          <DifferentiatedInterventions
            interventions={result.interventions}
            misconceptions={result.misconceptionClusters}
            totalStudents={result.classSnapshot.totalSubmissions || 12}
            verificationStatus={result.verification.overallStatus}
            onAdjustIntervention={onAdjustIntervention}
            onUpdateStatus={onUpdateInterventionStatus}
          />
        </section>
      )}

      {/* SECTION 8: VERIFICATION */}
      {(activeTab === 'all' || activeTab === 'verification') && (
        <section id="section-verification">
          <VerificationPanel verification={result.verification} />
        </section>
      )}

      {/* Individual Student Detail Modal */}
      {inspectedStudentId && (
        <StudentDetailModal
          studentId={inspectedStudentId}
          observation={inspectedObservation}
          submission={inspectedSubmission}
          onClose={() => setInspectedStudentId(null)}
        />
      )}

      {/* "Why This Insight?" Evidence Provenance Modal */}
      {whyInsightCluster && (
        <WhyThisInsightModal
          cluster={whyInsightCluster}
          context={result.context}
          totalStudents={result.classSnapshot.totalSubmissions || 12}
          onClose={() => setWhyInsightCluster(null)}
          onInspectStudent={(studentId) => setInspectedStudentId(studentId)}
        />
      )}

      {/* Full AI Contribution Trace Drawer */}
      <AITraceDrawer
        isOpen={isTraceDrawerOpen}
        onClose={() => setIsTraceDrawerOpen(false)}
        result={result}
      />
    </div>
  );
};
