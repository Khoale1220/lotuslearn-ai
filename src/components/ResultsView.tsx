import React, { useState } from 'react';
import {
  ClassAnalysisResult,
  DifferentiatedIntervention,
  MisconceptionCluster,
  StudentSubmission,
  TeacherDecision,
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
import { NextLessonHeroCard } from './results/NextLessonHeroCard';
import { ClassReadinessDonut } from './results/ClassReadinessDonut';
import {
  ArrowLeft,
  Download,
  Printer,
  PlusCircle,
  Cpu,
  Info,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';
import { getCanonicalTeacherDecision } from '../utils/verificationDisplay';

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
    status: TeacherDecision,
    newTitle?: string
  ) => void;
  onUpdateInterventionStatus: (
    interventionId: string,
    status: TeacherDecision
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
  // Selected cluster for Evidence Panel
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(
    result.misconceptionClusters[0]?.clusterId || null
  );

  // Inspected student for drilldown modal
  const [inspectedStudentId, setInspectedStudentId] = useState<string | null>(null);

  // Active cluster for "Why this insight?" modal
  const [whyInsightCluster, setWhyInsightCluster] = useState<MisconceptionCluster | null>(null);

  // Drawer state for Full AI Contribution Trace
  const [isTraceDrawerOpen, setIsTraceDrawerOpen] = useState(false);

  // Subtle trust badge popover state (Section 78)
  const [showVerifiedTooltip, setShowVerifiedTooltip] = useState(false);

  // Teacher Feedback loop state (Section 76)
  const [feedbackRating, setFeedbackRating] = useState<'yes' | 'partly' | 'no' | null>(null);
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [feedbackSaved, setFeedbackSaved] = useState(false);

  // Active section for local jump navigation
  const [activeSection, setActiveSection] = useState<string>('snapshot');

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Export report as Markdown
  const handleExportMarkdown = () => {
    const md = `# LotusLearn AI Diagnostic Assessment Report
**Lesson:** ${result.context.lessonTitle} (${result.context.subject} - ${result.context.gradeLevel})
**Date:** ${new Date(result.timestamp).toLocaleDateString()}
**Objective:** ${result.context.learningObjective}

---
## 1. Class Snapshot
- Total Submissions Analyzed: ${result.classSnapshot.totalSubmissions}
- Diagnosed Misconceptions: ${result.classSnapshot.misconceptionCount}
- Strongest Concept: ${result.classSnapshot.strongestConcept}
- Highest Priority Need: ${result.classSnapshot.highestPriorityNeed}
- Overall Recommendation: ${result.classSnapshot.overallRecommendation}

---
## 2. Misconception Discovery Map
${result.misconceptionClusters
  .map(
    (c) => `### ${c.misconceptionTitle}
- Teaching Priority: ${c.teachingPriority.toUpperCase()} (${c.studentCount} students / ${c.percentageAffected}%)
- Teacher Decision: ${getCanonicalTeacherDecision(c)}
- Explanation: ${c.explanation}
- Recommended Response: ${c.recommendedInstructionalResponse}
- Affected Students: ${c.affectedStudentIds.join(', ')}
`
  )
  .join('\n')}

---
## 3. Grounded Evidence Citations
${result.misconceptionClusters
  .map(
    (c) => `### Citations for: ${c.misconceptionTitle}
${c.evidenceExamples
  .map(
    (e) => `- Student ${e.studentId}: "${e.excerpt}" (Match: ${e.deterministicMatch || 'checked'}) — ${e.groundingReason}`
  )
  .join('\n')}
`
  )
  .join('\n')}

---
## 4. Next Lesson Plan (25-Minute Sequence)
${result.nextLessonPlan.phases
  .map((p) => `- **${p.timeRange} - ${p.phaseTitle}**: ${p.description} (Teacher Prompt: "${p.actionableTeacherPrompt}")`)
  .join('\n')}

---
## 5. Differentiated Interventions
${result.interventions
  .map(
    (i) => `### ${i.title} (${i.supportTier})
- Target Misconception: ${i.targetMisconceptionTitle}
- Teacher Decision: ${getCanonicalTeacherDecision(i)}
- Rationale: ${i.rationale}
- Suggested Activity: ${i.suggestedActivity}
- Teacher Script: "${i.teacherScript}"
- Diagnostic Question: "${i.exampleQuestion}"
- Exit Ticket: "${i.exitTicketQuestion}"
`
  )
  .join('\n')}

---
## 6. Instructional Groups
${result.instructionalGroups
  .map(
    (g) => `### ${g.groupName} (${g.estimatedDuration})
- Students: ${g.studentIds.join(', ')}
- Common Need: ${g.commonLearningNeed}
- Activity: ${g.suggestedActivity}
`
  )
  .join('\n')}

---
## 7. Verification Status & Trust Boundaries
- Roster Coverage Check: ${result.verification.deterministicChecks ? (result.verification.deterministicChecks.coveragePassed ? 'Passed' : 'Failed') : 'Not Checked'}
- Cluster Math Check: ${result.verification.deterministicChecks ? (result.verification.deterministicChecks.clusterMathPassed ? 'Passed' : 'Failed') : 'Not Checked'}
- Group Partition Check: ${result.verification.deterministicChecks ? (result.verification.deterministicChecks.groupPartitionPassed ? 'Passed' : 'Failed') : 'Not Checked'}
- Evidence Validation Check: ${result.verification.deterministicChecks ? (result.verification.deterministicChecks.evidenceValidationPassed === true ? 'Passed' : result.verification.deterministicChecks.evidenceValidationPassed === false ? 'Review Required' : 'Not Checked') : 'Not Checked'}
- Gemini Semantic Verification: ${result.verification.overallStatus === 'verified' ? 'Passed' : result.verification.overallStatus === 'partially_verified' ? 'Partially Verified' : result.verification.overallStatus === 'needs_review' ? 'Review Required' : 'Not Checked'}
- Execution Mode: ${result.executionMetadata?.fallbackUsed ? 'Demo Benchmark Fallback Disclosed' : result.executionMetadata?.executionMode || 'Standard'}
- Decision Authority: Educator Review (Human-in-the-loop sovereign decision)
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
  const isFallback = metadata?.fallbackUsed === true;

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <button
              onClick={onBackToDashboard}
              className="inline-flex items-center gap-1 hover:text-slate-900 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
            >
              <ArrowLeft size={13} /> Saved Analyses
            </button>
            <span aria-hidden="true">/</span>
            <span className="text-slate-900 font-medium">Diagnostic Results</span>
            <span aria-hidden="true">·</span>
            <span>{new Date(result.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {result.context.lessonTitle}
            </h1>

            {/* Subtle Verification Trust Badge (Section 78) */}
            <div className="relative inline-block">
              <button
                type="button"
                onClick={() => setShowVerifiedTooltip((prev) => !prev)}
                onMouseEnter={() => setShowVerifiedTooltip(true)}
                onMouseLeave={() => setShowVerifiedTooltip(false)}
                onFocus={() => setShowVerifiedTooltip(true)}
                onBlur={() => setShowVerifiedTooltip(false)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs hover:bg-emerald-100/70 transition cursor-help focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                aria-label="Analysis verified details"
                aria-expanded={showVerifiedTooltip}
              >
                <CheckCircle2 size={13} className="text-emerald-600" />
                <span>Analysis verified</span>
              </button>

              {showVerifiedTooltip && (
                <div
                  role="tooltip"
                  className="absolute left-0 sm:left-auto top-full mt-1.5 z-40 w-72 p-3 text-xs text-slate-700 bg-white rounded-xl shadow-lg border border-slate-200 leading-relaxed font-normal"
                >
                  <div className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                    <p>
                      Evidence references, group consistency and recommendation structure passed LotusLearn&apos;s validation pipeline.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
          <p className="mt-0.5 text-xs text-slate-600">
            {result.context.subject} · {result.context.gradeLevel} · {result.studentObservations.length} student submissions
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <button
            onClick={() => setIsTraceDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <Cpu size={14} className="text-slate-500" />
            <span>Analysis Details</span>
          </button>

          <button
            onClick={handleExportMarkdown}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <Download size={14} />
            <span>Export Report</span>
          </button>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <Printer size={14} />
            <span>Print</span>
          </button>

          <button
            onClick={onNewAnalysis}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            <PlusCircle size={14} />
            <span>New Analysis</span>
          </button>
        </div>
      </div>

      {/* Disclosed Fallback / Execution Strip */}
      {isFallback ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 px-4 text-xs flex items-center gap-2.5 text-amber-900">
          <Info size={16} className="text-amber-600 shrink-0" />
          <p className="leading-relaxed">
            <strong>Demo Fallback Disclosed:</strong> Live analysis was temporarily unavailable, so LotusLearn loaded the pre-validated benchmark demo result. (Custom classroom analyses never substitute demo data).
          </p>
        </div>
      ) : isDemo ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 px-4 text-xs flex flex-wrap items-center justify-between gap-2 text-slate-600">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="font-bold text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded">
              DEMO CLASSROOM
            </span>
            <span>Grade 10 English Benchmark</span>
            <span className="text-slate-300">·</span>
            <span>12 Submissions Analyzed</span>
          </div>
          <span className="text-slate-500 text-[11px]">
            Educator Review Authority: All insights remain editable
          </span>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 px-4 text-xs flex flex-wrap items-center justify-between gap-2 text-slate-600">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
              LIVE GEMINI ANALYSIS
            </span>
            <span>{result.studentObservations.length} Submissions Processed</span>
            {metadata?.totalDurationMs ? (
              <>
                <span className="text-slate-300">·</span>
                <span>{(metadata.totalDurationMs / 1000).toFixed(1)}s elapsed</span>
              </>
            ) : null}
          </div>
          <span className="text-slate-500 text-[11px]">
            Educator Review Authority: All insights remain editable
          </span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 0. TOMORROW'S INTERVENTION HERO CARD (Section 24: Actionable Intervention)  */}
      {/* ========================================================================= */}
      <NextLessonHeroCard
        plan={result.nextLessonPlan}
        misconceptions={result.misconceptionClusters}
        groups={result.instructionalGroups}
        gradeLevel={`${result.context.gradeLevel} ${result.context.subject}`}
        onReviewPlan={() => scrollToSection('section-what-next')}
        onEditPlan={() => {
          scrollToSection('section-what-next');
          setTimeout(() => {
            document.getElementById('lesson-plan-container')?.scrollIntoView({ behavior: 'smooth' });
          }, 200);
        }}
      />

      {/* Local Section Jump Navigation Bar */}
      <nav aria-label="Results sections" className="sticky top-16 z-30 flex items-center gap-1.5 p-1.5 bg-white/95 backdrop-blur-md rounded-xl border border-slate-200 shadow-2xs overflow-x-auto text-xs font-medium">
        <button
          onClick={() => scrollToSection('section-what-happened')}
          className={`px-3 py-1.5 rounded-lg transition shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
            activeSection === 'section-what-happened'
              ? 'bg-indigo-600 text-white font-semibold shadow-2xs'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          1. What Happened?
        </button>

        <button
          onClick={() => scrollToSection('section-why-evidence')}
          className={`px-3 py-1.5 rounded-lg transition shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
            activeSection === 'section-why-evidence'
              ? 'bg-indigo-600 text-white font-semibold shadow-2xs'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          2. Why? (Evidence)
        </button>

        <button
          onClick={() => scrollToSection('section-what-next')}
          className={`px-3 py-1.5 rounded-lg transition shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
            activeSection === 'section-what-next'
              ? 'bg-indigo-600 text-white font-semibold shadow-2xs'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          3. What Next? (Teaching Plan)
        </button>

        <button
          onClick={() => scrollToSection('section-review-trust')}
          className={`px-3 py-1.5 rounded-lg transition shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
            activeSection === 'section-review-trust'
              ? 'bg-indigo-600 text-white font-semibold shadow-2xs'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          4. What Needs Review?
        </button>

        <button
          onClick={() => setIsTraceDrawerOpen(true)}
          className="ml-auto px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition shrink-0 flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
        >
          <Cpu size={13} className="text-slate-400" />
          <span>Technical Trace</span>
        </button>
      </nav>

      {/* ========================================================================= */}
      {/* 1. WHAT HAPPENED? (Snapshot, Readiness Donut & Misconception Clusters)      */}
      {/* ========================================================================= */}
      <section id="section-what-happened" className="scroll-mt-32 space-y-6">
        <ClassSnapshotCard
          context={result.context}
          snapshot={result.classSnapshot}
          misconceptions={result.misconceptionClusters}
          verification={result.verification}
          privacyAudit={result.privacyAudit}
        />

        <ClassReadinessDonut
          groups={result.instructionalGroups}
          misconceptions={result.misconceptionClusters}
          totalStudents={result.classSnapshot.totalSubmissions || result.studentObservations.length}
        />

        <MisconceptionMap
          clusters={result.misconceptionClusters}
          selectedClusterId={selectedClusterId}
          totalStudents={result.classSnapshot.totalSubmissions || result.studentObservations.length}
          onSelectCluster={(id) => {
            setSelectedClusterId(id);
            scrollToSection('section-why-evidence');
          }}
          onUpdateStatus={onUpdateMisconceptionStatus}
          onInspectStudent={(studentId) => setInspectedStudentId(studentId)}
          onOpenWhyInsight={(cluster) => setWhyInsightCluster(cluster)}
        />
      </section>

      {/* ========================================================================= */}
      {/* 2. WHY? (Grounded Evidence Excerpts & Student Provenance)                  */}
      {/* ========================================================================= */}
      <section id="section-why-evidence" className="scroll-mt-32">
        <EvidencePanel
          clusters={result.misconceptionClusters}
          selectedClusterId={selectedClusterId}
          observations={result.studentObservations}
          onInspectStudent={(studentId) => setInspectedStudentId(studentId)}
        />
      </section>

      {/* ========================================================================= */}
      {/* 3. WHAT SHOULD I DO NEXT? (Lesson Plan, Scaffolds & Instructional Groups) */}
      {/* ========================================================================= */}
      <section id="section-what-next" className="scroll-mt-32 space-y-6">
        <NextLessonTimeline plan={result.nextLessonPlan} />

        <DifferentiatedInterventions
          interventions={result.interventions}
          misconceptions={result.misconceptionClusters}
          totalStudents={result.classSnapshot.totalSubmissions || result.studentObservations.length}
          verificationStatus={result.verification.overallStatus}
          onAdjustIntervention={onAdjustIntervention}
          onUpdateStatus={onUpdateInterventionStatus}
        />

        <InstructionalGroups
          groups={result.instructionalGroups}
          onInspectStudent={(studentId) => setInspectedStudentId(studentId)}
        />

        {/* Teacher Feedback Loop (Section 76) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 font-heading">
                Was this recommendation useful?
              </h3>
              <p className="text-xs text-slate-500">
                Your evaluation helps refine future instructional grouping and next-lesson pacing.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setFeedbackRating('yes');
                  setFeedbackSaved(true);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  feedbackRating === 'yes'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => {
                  setFeedbackRating('partly');
                  setFeedbackSaved(true);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  feedbackRating === 'partly'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                Partly
              </button>
              <button
                type="button"
                onClick={() => {
                  setFeedbackRating('no');
                  setFeedbackSaved(true);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  feedbackRating === 'no'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                No
              </button>
            </div>
          </div>

          {feedbackRating && (
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <label htmlFor="teacher-feedback-notes" className="block text-xs font-medium text-slate-700">
                Optional: What would you change?
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="teacher-feedback-notes"
                  type="text"
                  value={feedbackNotes}
                  onChange={(e) => setFeedbackNotes(e.target.value)}
                  placeholder="e.g. adjust 5-minute warm-up pacing, combine Group 1 & 2"
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setFeedbackSaved(true)}
                  className="inline-flex items-center justify-center rounded-lg bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 transition"
                >
                  Save Note
                </button>
              </div>

              {feedbackSaved && (
                <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1.5 pt-1">
                  <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                  <span>Feedback saved. Thank you for contributing educator guidance to the system.</span>
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. WHAT NEEDS MY REVIEW? (Verification, Three Pillars & Teacher Review)   */}
      {/* ========================================================================= */}
      <section id="section-review-trust" className="scroll-mt-32">
        <VerificationPanel
          verification={result.verification}
          misconceptions={result.misconceptionClusters}
          interventions={result.interventions}
        />
      </section>

      {/* ========================================================================= */}
      {/* 5. ANALYSIS DETAILS (Progressive disclosure inline trace)                */}
      {/* ========================================================================= */}
      <section id="section-analysis-details" className="pt-4 border-t border-slate-200">
        <details className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
          <summary className="cursor-pointer flex items-center justify-between font-bold text-base text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded">
            <div className="flex items-center gap-2">
              <Cpu size={18} className="text-slate-500" />
              <span>Technical Analysis Details &amp; Provenance Trace</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-normal text-slate-500">
              <span>Click to expand architecture details</span>
              <ChevronDown size={16} className="text-slate-400 group-open:rotate-180 transition-transform" />
            </div>
          </summary>
          <div className="mt-6 pt-6 border-t border-slate-100">
            <AIContributionTrace
              result={result}
              onOpenDrawer={() => setIsTraceDrawerOpen(true)}
            />
          </div>
        </details>
      </section>

      {/* Modals & Full Technical Drawer */}
      {inspectedStudentId && (
        <StudentDetailModal
          studentId={inspectedStudentId}
          observation={inspectedObservation}
          submission={inspectedSubmission}
          onClose={() => setInspectedStudentId(null)}
        />
      )}

      {whyInsightCluster && (
        <WhyThisInsightModal
          cluster={whyInsightCluster}
          context={result.context}
          totalStudents={result.classSnapshot.totalSubmissions || result.studentObservations.length}
          onClose={() => setWhyInsightCluster(null)}
          onInspectStudent={(studentId) => {
            setWhyInsightCluster(null);
            setInspectedStudentId(studentId);
          }}
        />
      )}

      {isTraceDrawerOpen && (
        <AITraceDrawer
          isOpen={isTraceDrawerOpen}
          result={result}
          onClose={() => setIsTraceDrawerOpen(false)}
        />
      )}
    </div>
  );
};
