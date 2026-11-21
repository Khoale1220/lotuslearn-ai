import { useState } from "react";
import { ClassSnapshotCard } from "./results/ClassSnapshotCard";
import { MisconceptionMap } from "./results/MisconceptionMap";
import { EvidencePanel } from "./results/EvidencePanel";
import { InstructionalGroups } from "./results/InstructionalGroups";
import { NextLessonTimeline } from "./results/NextLessonTimeline";
import { DifferentiatedInterventions } from "./results/DifferentiatedInterventions";
import { VerificationPanel } from "./results/VerificationPanel";
import { StudentDetailModal } from "./results/StudentDetailModal";
import { WhyThisInsightModal } from "./results/WhyThisInsightModal";
import { AIContributionTrace, AITraceDrawer } from "./AIContributionTrace";
import { NextLessonHeroCard } from "./results/NextLessonHeroCard";
import { ClassReadinessDonut } from "./results/ClassReadinessDonut";
import {
  ArrowLeft,
  Download,
  Printer,
  PlusCircle,
  Cpu,
  Info,
  CheckCircle2,
  AlertTriangle,
  ChevronDown
} from "lucide-react";
import { getCanonicalTeacherDecision, isAnalysisFullyVerified } from "../utils/verificationDisplay";
const ResultsView = ({
  result,
  sanitizedSubmissions,
  rawSubmissions,
  onBackToDashboard,
  onNewAnalysis,
  onAdjustIntervention,
  onUpdateMisconceptionStatus,
  onUpdateInterventionStatus
}) => {
  const [selectedClusterId, setSelectedClusterId] = useState(
    result.misconceptionClusters[0]?.clusterId || null
  );
  const [inspectedStudentId, setInspectedStudentId] = useState(null);
  const [whyInsightCluster, setWhyInsightCluster] = useState(null);
  const [isTraceDrawerOpen, setIsTraceDrawerOpen] = useState(false);
  const [showVerifiedTooltip, setShowVerifiedTooltip] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(null);
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const [activeSection, setActiveSection] = useState("snapshot");
  const scrollToSection = (sectionId) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  const handleExportMarkdown = () => {
    const md = `# LotusLearn Diagnostic Assessment Report
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
${result.misconceptionClusters.map(
      (c) => `### ${c.misconceptionTitle}
- Teaching Priority: ${c.teachingPriority.toUpperCase()} (${c.studentCount} students / ${c.percentageAffected}%)
- Teacher Decision: ${getCanonicalTeacherDecision(c)}
- Explanation: ${c.explanation}
- Recommended Response: ${c.recommendedInstructionalResponse}
- Affected Students: ${c.affectedStudentIds.join(", ")}
`
    ).join("\n")}

---
## 3. Grounded Evidence Citations
${result.misconceptionClusters.map(
      (c) => `### Citations for: ${c.misconceptionTitle}
${c.evidenceExamples.map(
        (e) => `- Student ${e.studentId}: "${e.excerpt}" (Match: ${e.deterministicMatch || "checked"}) - ${e.groundingReason}`
      ).join("\n")}
`
    ).join("\n")}

---
## 4. Next Lesson Plan (25-Minute Sequence)
${result.nextLessonPlan.phases.map((p) => `- **${p.timeRange} - ${p.phaseTitle}**: ${p.description} (Teacher Prompt: "${p.actionableTeacherPrompt}")`).join("\n")}

---
## 5. Differentiated Interventions
${result.interventions.map(
      (i) => `### ${i.title} (${i.supportTier})
- Target Misconception: ${i.targetMisconceptionTitle}
- Teacher Decision: ${getCanonicalTeacherDecision(i)}
- Rationale: ${i.rationale}
- Suggested Activity: ${i.suggestedActivity}
- Teacher Script: "${i.teacherScript}"
- Diagnostic Question: "${i.exampleQuestion}"
- Exit Ticket: "${i.exitTicketQuestion}"
`
    ).join("\n")}

---
## 6. Instructional Groups
${result.instructionalGroups.map(
      (g) => `### ${g.groupName} (${g.estimatedDuration})
- Students: ${g.studentIds.join(", ")}
- Common Need: ${g.commonLearningNeed}
- Activity: ${g.suggestedActivity}
`
    ).join("\n")}

---
## 7. Verification Status & Trust Boundaries
- Roster Coverage Check: ${result.verification.deterministicChecks ? result.verification.deterministicChecks.coveragePassed ? "Passed" : "Failed" : "Not Checked"}
- Cluster Math Check: ${result.verification.deterministicChecks ? result.verification.deterministicChecks.clusterMathPassed ? "Passed" : "Failed" : "Not Checked"}
- Group Partition Check: ${result.verification.deterministicChecks ? result.verification.deterministicChecks.groupPartitionPassed ? "Passed" : "Failed" : "Not Checked"}
- Evidence Validation Check: ${result.verification.deterministicChecks ? result.verification.deterministicChecks.evidenceValidationPassed === true ? "Passed" : result.verification.deterministicChecks.evidenceValidationPassed === false ? "Review Required" : "Not Checked" : "Not Checked"}
- Gemini Semantic Verification: ${result.verification.overallStatus === "verified" ? "Passed" : result.verification.overallStatus === "partially_verified" ? "Partially Verified" : result.verification.overallStatus === "needs_review" ? "Review Required" : "Not Checked"}
- Execution Mode: ${result.executionMetadata?.fallbackUsed ? "Demo Benchmark Fallback Disclosed" : result.executionMetadata?.executionMode || "Standard"}
- Decision Authority: Educator Review (Human-in-the-loop sovereign decision)
`;
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lotuslearn-report-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const inspectedObservation = result.studentObservations.find(
    (o) => o.studentId === inspectedStudentId
  );
  const effectiveSubmissions = sanitizedSubmissions || rawSubmissions || [];
  const inspectedSubmission = effectiveSubmissions.find(
    (s) => s.studentId === inspectedStudentId
  );
  const metadata = result.executionMetadata;
  const isDemo = metadata?.executionMode === "demo_resilience";
  const isFallback = metadata?.fallbackUsed === true;
  const isFullyVerified = isAnalysisFullyVerified({
    deterministicAuditPassed: result.executionMetadata?.deterministicAuditPassed,
    overallStatus: result.verification?.overallStatus,
    coveragePassed: result.verification?.deterministicChecks?.coveragePassed,
    clusterMathPassed: result.verification?.deterministicChecks?.clusterMathPassed,
    groupPartitionPassed: result.verification?.deterministicChecks?.groupPartitionPassed,
    evidenceValidationPassed: Boolean(
      result.verification?.deterministicChecks?.evidenceValidationPassed
    )
  });
  const isReviewRequired = result.verification?.overallStatus === "needs_review" || result.verification?.overallStatus === "partially_verified" || result.verification?.deterministicChecks?.coveragePassed === false || result.verification?.deterministicChecks?.clusterMathPassed === false || result.verification?.deterministicChecks?.groupPartitionPassed === false;
  const verificationBadgeConfig = isFullyVerified ? {
    label: "Verified",
    ariaLabel: "Analysis verified: all technical and semantic checks passed",
    bgClass: "ui-status-success focus-visible:ring-[var(--status-success)]",
    icon: <CheckCircle2 size={13} className="text-[var(--status-success)]" />,
    tooltip: "Evidence references, group consistency and recommendation structure passed LotusLearn's validation pipeline."
  } : isReviewRequired ? {
    label: "Needs review",
    ariaLabel: "Analysis needs review: some evidence citations or model claims require attention",
    bgClass: "ui-status-warning focus-visible:ring-[var(--status-warning)]",
    icon: <AlertTriangle size={13} className="text-[var(--status-warning)]" />,
    tooltip: "Some evidence citations or model claims require educator review before acting on recommendations."
  } : {
    label: "Analysis complete",
    ariaLabel: "Analysis complete",
    bgClass: "ui-status-neutral focus-visible:ring-[var(--border-focus)]",
    icon: <Info size={13} className="text-[var(--text-secondary)]" />,
    tooltip: "Multi-stage assessment finished. Technical verification checks are recorded in the verification panel."
  };
  return <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
      {
    /* Top Header & Actions */
  }
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-[var(--border-decorative)] gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] mb-1">
            <button
    onClick={onBackToDashboard}
    className="inline-flex items-center gap-1 hover:text-[var(--text-primary)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] rounded"
  >
              <ArrowLeft size={13} /> Saved Analyses
            </button>
            <span aria-hidden="true">/</span>
            <span className="text-[var(--text-primary)] font-medium">Diagnostic Results</span>
            <span aria-hidden="true">/</span>
            <span>{new Date(result.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              {result.context.lessonTitle}
            </h1>

            {
    /* Subtle Verification Trust Badge */
  }
            <div className="relative inline-block">
              <button
    type="button"
    onClick={() => setShowVerifiedTooltip((prev) => !prev)}
    onMouseEnter={() => setShowVerifiedTooltip(true)}
    onMouseLeave={() => setShowVerifiedTooltip(false)}
    onFocus={() => setShowVerifiedTooltip(true)}
    onBlur={() => setShowVerifiedTooltip(false)}
    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border shadow-2xs transition cursor-help focus-visible:outline-none focus-visible:ring-2 ${verificationBadgeConfig.bgClass}`}
    aria-label={verificationBadgeConfig.ariaLabel}
    aria-expanded={showVerifiedTooltip}
  >
                {verificationBadgeConfig.icon}
                <span>{verificationBadgeConfig.label}</span>
              </button>

              {showVerifiedTooltip && <div
    role="tooltip"
    className="ui-card absolute left-0 sm:left-auto top-full mt-1.5 z-40 w-72 p-3 text-xs rounded-xl shadow-lg leading-relaxed font-normal"
  >
                  <div className="flex items-start gap-2">
                    {verificationBadgeConfig.icon}
                    <p>{verificationBadgeConfig.tooltip}</p>
                  </div>
                </div>}
            </div>
          </div>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            {result.context.subject} / {result.context.gradeLevel} / {result.studentObservations.length} student submissions
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <button
    onClick={() => setIsTraceDrawerOpen(true)}
    className="ui-btn ui-btn-secondary gap-1.5 px-3 py-1.5 text-xs shadow-2xs"
  >
            <Cpu size={14} className="text-[var(--text-secondary)]" />
            <span>Analysis Details</span>
          </button>

          <button
    onClick={handleExportMarkdown}
    className="ui-btn ui-btn-secondary gap-1.5 px-3 py-1.5 text-xs shadow-2xs"
  >
            <Download size={14} />
            <span>Export Report</span>
          </button>

          <button
    onClick={() => window.print()}
    className="ui-btn ui-btn-secondary gap-1.5 px-3 py-1.5 text-xs shadow-2xs"
  >
            <Printer size={14} />
            <span>Print</span>
          </button>

          <button
    onClick={onNewAnalysis}
    className="ui-btn ui-btn-primary gap-1.5 px-3.5 py-1.5 text-xs shadow-2xs"
  >
            <PlusCircle size={14} />
            <span>New Analysis</span>
          </button>
        </div>
      </div>

      {
    /* Disclosed Fallback / Execution Strip */
  }
      {isFallback ? <div className="ui-status-warning rounded-xl p-3.5 px-4 text-xs flex items-center gap-2.5">
          <Info size={16} className="text-[var(--status-warning)] shrink-0" />
          <p className="leading-relaxed">
            <strong>Demo Fallback Disclosed:</strong> Live analysis was temporarily unavailable, so LotusLearn loaded the pre-validated benchmark demo result. (Custom classroom analyses never substitute demo data).
          </p>
        </div> : isDemo ? <div className="ui-card-elevated rounded-xl p-3 px-4 text-xs flex flex-wrap items-center justify-between gap-2 text-[var(--text-secondary)]">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="font-bold text-[var(--text-primary)] bg-[var(--bg-surface)] border border-[var(--border-decorative)] px-2 py-0.5 rounded">
              DEMO CLASSROOM
            </span>
            <span>Grade 10 English Benchmark</span>
            <span className="text-[var(--border-decorative)]">/</span>
            <span>12 Submissions Analyzed</span>
          </div>
          <span className="text-[var(--text-secondary)] text-[11px]">
            Educator Review Authority: All insights remain editable
          </span>
        </div> : <div className="ui-card-elevated rounded-xl p-3 px-4 text-xs flex flex-wrap items-center justify-between gap-2 text-[var(--text-secondary)]">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="font-bold text-[var(--text-primary)] bg-[var(--bg-elevated)] border border-[var(--border-control)] px-2 py-0.5 rounded">
              LIVE GEMINI ANALYSIS
            </span>
            <span>{result.studentObservations.length} Submissions Processed</span>
            {metadata?.totalDurationMs ? <>
                <span className="text-[var(--border-decorative)]">/</span>
                <span>{(metadata.totalDurationMs / 1e3).toFixed(1)}s elapsed</span>
              </> : null}
          </div>
          <span className="text-[var(--text-secondary)] text-[11px]">
            Educator Review Authority: All insights remain editable
          </span>
        </div>}

      {
    /* Local Section Jump Navigation Bar */
  }
      <nav aria-label="Results sections" className="ui-card sticky top-14 z-20 flex items-center gap-1.5 p-1.5 rounded-lg overflow-x-auto text-xs font-medium">
        <button
    onClick={() => scrollToSection("section-summary")}
    className={`px-3 py-1.5 rounded-md transition shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] ${activeSection === "section-summary" ? "bg-[var(--action-primary-bg)] text-[var(--action-primary-fg)] font-semibold" : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"}`}
  >
          Summary
        </button>

        <button
    onClick={() => scrollToSection("section-evidence")}
    className={`px-3 py-1.5 rounded-md transition shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] ${activeSection === "section-evidence" ? "bg-[var(--action-primary-bg)] text-[var(--action-primary-fg)] font-semibold" : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"}`}
  >
          Evidence
        </button>

        <button
    onClick={() => scrollToSection("section-groups")}
    className={`px-3 py-1.5 rounded-md transition shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] ${activeSection === "section-groups" ? "bg-[var(--action-primary-bg)] text-[var(--action-primary-fg)] font-semibold" : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"}`}
  >
          Groups
        </button>

        <button
    onClick={() => scrollToSection("section-plan")}
    className={`px-3 py-1.5 rounded-md transition shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] ${activeSection === "section-plan" ? "bg-[var(--action-primary-bg)] text-[var(--action-primary-fg)] font-semibold" : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"}`}
  >
          Plan
        </button>

        <button
    onClick={() => scrollToSection("section-review")}
    className={`px-3 py-1.5 rounded-md transition shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] ${activeSection === "section-review" ? "bg-[var(--action-primary-bg)] text-[var(--action-primary-fg)] font-semibold" : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"}`}
  >
          Review
        </button>

        <button
    onClick={() => setIsTraceDrawerOpen(true)}
    className="ui-btn ui-btn-ghost ml-auto px-2.5 py-1.5 text-xs shrink-0 gap-1"
  >
          <Cpu size={13} className="text-[var(--text-secondary)]" />
          <span>Technical Trace</span>
        </button>
      </nav>

      {
    /* ========================================================================= */
  }
      {
    /* 1. SUMMARY (Class Snapshot, Readiness Distribution & Misconceptions)       */
  }
      {
    /* ========================================================================= */
  }
      <section id="section-summary" className="scroll-mt-28 space-y-6">
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
      scrollToSection("section-evidence");
    }}
    onUpdateStatus={onUpdateMisconceptionStatus}
    onInspectStudent={(studentId) => setInspectedStudentId(studentId)}
    onOpenWhyInsight={(cluster) => setWhyInsightCluster(cluster)}
  />
      </section>

      {
    /* ========================================================================= */
  }
      {
    /* 2. EVIDENCE (Grounded Evidence Excerpts & Verbatim Student Provenance)     */
  }
      {
    /* ========================================================================= */
  }
      <section id="section-evidence" className="scroll-mt-28">
        <EvidencePanel
    clusters={result.misconceptionClusters}
    selectedClusterId={selectedClusterId}
    observations={result.studentObservations}
    onInspectStudent={(studentId) => setInspectedStudentId(studentId)}
  />
      </section>

      {
    /* ========================================================================= */
  }
      {
    /* 3. GROUPS (Instructional Groups & Differentiated Interventions)           */
  }
      {
    /* ========================================================================= */
  }
      <section id="section-groups" className="scroll-mt-28 space-y-6">
        <InstructionalGroups
    groups={result.instructionalGroups}
    onInspectStudent={(studentId) => setInspectedStudentId(studentId)}
  />

        <DifferentiatedInterventions
    interventions={result.interventions}
    misconceptions={result.misconceptionClusters}
    totalStudents={result.classSnapshot.totalSubmissions || result.studentObservations.length}
    verificationStatus={result.verification.overallStatus}
    onAdjustIntervention={onAdjustIntervention}
    onUpdateStatus={onUpdateInterventionStatus}
  />
      </section>

      {
    /* ========================================================================= */
  }
      {
    /* 4. PLAN (Tomorrow's Lesson Plan Document & Timeline)                      */
  }
      {
    /* ========================================================================= */
  }
      <section id="section-plan" className="scroll-mt-28 space-y-6">
        <NextLessonHeroCard
    plan={result.nextLessonPlan}
    misconceptions={result.misconceptionClusters}
    groups={result.instructionalGroups}
    gradeLevel={`${result.context.gradeLevel} ${result.context.subject}`}
    onReviewPlan={() => scrollToSection("section-plan")}
    onEditPlan={() => {
      scrollToSection("section-plan");
      setTimeout(() => {
        document.getElementById("lesson-plan-container")?.scrollIntoView({ behavior: "smooth" });
      }, 200);
    }}
  />

        <NextLessonTimeline plan={result.nextLessonPlan} />
      </section>

      {
    /* ========================================================================= */
  }
      {
    /* 5. REVIEW (Verification Checks, Grounding Audit & Teacher Sovereign Notes) */
  }
      {
    /* ========================================================================= */
  }
      <section id="section-review" className="scroll-mt-28 space-y-6">
        <VerificationPanel
    verification={result.verification}
    misconceptions={result.misconceptionClusters}
    interventions={result.interventions}
  />

        {
    /* Teacher Feedback Loop (Section 76) */
  }
        <div className="ui-card rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)] font-heading">
                Was this recommendation useful?
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Your evaluation helps refine future instructional grouping and next-lesson pacing.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
    type="button"
    onClick={() => {
      setFeedbackRating("yes");
      setFeedbackSaved(true);
    }}
    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${feedbackRating === "yes" ? "ui-status-success shadow-2xs" : "ui-btn-secondary"}`}
  >
                Yes
              </button>
              <button
    type="button"
    onClick={() => {
      setFeedbackRating("partly");
      setFeedbackSaved(true);
    }}
    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${feedbackRating === "partly" ? "ui-status-warning shadow-2xs" : "ui-btn-secondary"}`}
  >
                Partly
              </button>
              <button
    type="button"
    onClick={() => {
      setFeedbackRating("no");
      setFeedbackSaved(true);
    }}
    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${feedbackRating === "no" ? "ui-status-error shadow-2xs" : "ui-btn-secondary"}`}
  >
                No
              </button>
            </div>
          </div>

          {feedbackRating && <div className="pt-3 border-t border-[var(--border-decorative)] space-y-3">
              <label htmlFor="teacher-feedback-notes" className="ui-label block text-xs">
                Optional: What would you change?
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
    id="teacher-feedback-notes"
    type="text"
    value={feedbackNotes}
    onChange={(e) => setFeedbackNotes(e.target.value)}
    placeholder="e.g. adjust 5-minute warm-up pacing, combine Group 1 & 2"
    className="ui-input flex-1 rounded-lg px-3 py-1.5 text-xs"
  />
                <button
    type="button"
    onClick={() => setFeedbackSaved(true)}
    className="ui-btn ui-btn-primary px-3.5 py-1.5 text-xs"
  >
                  Save Note
                </button>
              </div>

              {feedbackSaved && <p className="text-[11px] text-[var(--status-success)] font-medium flex items-center gap-1.5 pt-1">
                  <CheckCircle2 size={13} className="text-[var(--status-success)] shrink-0" />
                  <span>Feedback saved. Thank you for contributing educator guidance to the system.</span>
                </p>}
            </div>}
        </div>
      </section>

      {
    /* ========================================================================= */
  }
      {
    /* 4. WHAT NEEDS MY REVIEW? (Verification, Three Pillars & Teacher Review)   */
  }
      {
    /* ========================================================================= */
  }
      <section id="section-review-trust" className="scroll-mt-32">
        <VerificationPanel
    verification={result.verification}
    misconceptions={result.misconceptionClusters}
    interventions={result.interventions}
  />
      </section>

      {
    /* ========================================================================= */
  }
      {
    /* 5. ANALYSIS DETAILS (Progressive disclosure inline trace)                */
  }
      {
    /* ========================================================================= */
  }
      <section id="section-analysis-details" className="pt-4 border-t border-[var(--border-decorative)]">
        <details className="group ui-card rounded-2xl p-6 shadow-2xs">
          <summary className="cursor-pointer flex items-center justify-between font-bold text-base text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] rounded">
            <div className="flex items-center gap-2">
              <Cpu size={18} className="text-[var(--text-secondary)]" />
              <span>Technical Analysis Details &amp; Provenance Trace</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-normal text-[var(--text-secondary)]">
              <span>Click to expand architecture details</span>
              <ChevronDown size={16} className="text-[var(--text-secondary)] group-open:rotate-180 transition-transform" />
            </div>
          </summary>
          <div className="mt-6 pt-6 border-t border-[var(--border-decorative)]">
            <AIContributionTrace
    result={result}
    onOpenDrawer={() => setIsTraceDrawerOpen(true)}
  />
          </div>
        </details>
      </section>

      {
    /* Modals & Full Technical Drawer */
  }
      {inspectedStudentId && <StudentDetailModal
    studentId={inspectedStudentId}
    observation={inspectedObservation}
    submission={inspectedSubmission}
    onClose={() => setInspectedStudentId(null)}
  />}

      {whyInsightCluster && <WhyThisInsightModal
    cluster={whyInsightCluster}
    context={result.context}
    totalStudents={result.classSnapshot.totalSubmissions || result.studentObservations.length}
    onClose={() => setWhyInsightCluster(null)}
    onInspectStudent={(studentId) => {
      setWhyInsightCluster(null);
      setInspectedStudentId(studentId);
    }}
  />}

      {isTraceDrawerOpen && <AITraceDrawer
    isOpen={isTraceDrawerOpen}
    result={result}
    onClose={() => setIsTraceDrawerOpen(false)}
  />}
    </div>;
};
export {
  ResultsView
};
