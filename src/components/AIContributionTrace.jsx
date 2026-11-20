import React from "react";
import {
  Eye,
  Activity,
  Calculator,
  Compass,
  ShieldCheck,
  UserCheck,
  ChevronRight,
  X,
  Cpu
} from "lucide-react";
import { GlowEdgeCard } from "./GlowEdgeCard";
import { ProvenanceBadge } from "./ProvenanceBadge";
import { useModalFocus } from "../utils/useModalFocus";
import { formatStageLatency, getCanonicalTeacherDecision } from "../utils/verificationDisplay";
const AIContributionTrace = ({
  result,
  onOpenDrawer,
  className = ""
}) => {
  const metadata = result.executionMetadata;
  const isDemo = metadata?.executionMode === "demo_resilience";
  const totalSubmissions = result.classSnapshot.totalSubmissions || result.studentObservations.length;
  const totalQuotes = result.studentObservations.reduce(
    (acc, o) => acc + (o.supportingEvidence?.length || 0),
    0
  );
  const clusterCount = result.misconceptionClusters.length;
  const groupCount = result.instructionalGroups.length;
  const interventionCount = result.interventions.length;
  const detChecks = result.verification.deterministicChecks;
  const acceptedClusters = result.misconceptionClusters.filter(
    (c) => getCanonicalTeacherDecision(c) === "accepted"
  ).length;
  const editedClusters = result.misconceptionClusters.filter(
    (c) => getCanonicalTeacherDecision(c) === "edited"
  ).length;
  const dismissedClusters = result.misconceptionClusters.filter(
    (c) => getCanonicalTeacherDecision(c) === "dismissed"
  ).length;
  const pendingClusters = result.misconceptionClusters.filter(
    (c) => getCanonicalTeacherDecision(c) === "pending"
  ).length;
  const acceptedInterventions = result.interventions.filter(
    (i) => getCanonicalTeacherDecision(i) === "accepted"
  ).length;
  const editedInterventions = result.interventions.filter(
    (i) => getCanonicalTeacherDecision(i) === "edited"
  ).length;
  const dismissedInterventions = result.interventions.filter(
    (i) => getCanonicalTeacherDecision(i) === "dismissed"
  ).length;
  const pendingInterventions = result.interventions.filter(
    (i) => getCanonicalTeacherDecision(i) === "pending"
  ).length;
  const totalAccepted = acceptedClusters + acceptedInterventions;
  const totalEdited = editedClusters + editedInterventions;
  const totalDismissed = dismissedClusters + dismissedInterventions;
  const totalPending = pendingClusters + pendingInterventions;
  const isGoogleSDP = Boolean(
    result.privacyAudit?.providerVersionOrPolicyId?.startsWith("google-sdp")
  );
  const privacyModeBadge = isGoogleSDP ? "Google Cloud SDP" : "Demo privacy mode";
  const stages = [
    {
      step: "01",
      name: "Privacy & Ingestion",
      badge: result.privacyAudit?.status === "passed" ? isGoogleSDP ? "SDP Sanitized" : "Demo Sanitized" : "Privacy Gateway",
      icon: ShieldCheck,
      color: "text-[var(--text-primary)]",
      bg: "bg-[var(--bg-surface)]",
      stat: result.privacyAudit ? `${result.privacyAudit.findingCount} PII tokens removed` : `${totalSubmissions} submissions`,
      detail: result.privacyAudit?.sanitizationApplied ? "Sensitive identifiers removed" : "Checked & verified clean"
    },
    {
      step: "02",
      name: "Gemini Observer",
      badge: "Gemini 3.8 Flash",
      icon: Eye,
      color: "text-[var(--text-primary)]",
      bg: "bg-[var(--bg-surface)]",
      stat: `${totalQuotes} quotes extracted`,
      detail: `${totalSubmissions} observations`
    },
    {
      step: "03",
      name: "Gemini Diagnosis",
      badge: "Pattern Synthesis",
      icon: Activity,
      color: "text-[var(--text-primary)]",
      bg: "bg-[var(--bg-surface)]",
      stat: `${clusterCount} diagnosed clusters`,
      detail: "Whole-cohort reasoning"
    },
    {
      step: "04",
      name: "Code Validation",
      badge: "Deterministic Code",
      icon: Calculator,
      color: "text-teal-600",
      bg: "bg-teal-50",
      stat: detChecks ? detChecks.coveragePassed && detChecks.clusterMathPassed ? "Coverage & Math Verified" : detChecks.coveragePassed ? "Coverage Confirmed" : "Discrepancy Flagged" : "Not recorded",
      detail: detChecks ? `${detChecks.quotesGroundedCount} grounded quotes` : "-"
    },
    {
      step: "05",
      name: "Gemini Strategist",
      badge: "Pedagogical Design",
      icon: Compass,
      color: "text-[var(--text-primary)]",
      bg: "bg-[var(--bg-surface)]",
      stat: `${groupCount} cohorts, ${interventionCount} scaffolds`,
      detail: "25-min lesson timeline"
    },
    {
      step: "06",
      name: "Gemini Verification",
      badge: "Adversarial Pass",
      icon: ShieldCheck,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      stat: `Status: ${result.verification.overallStatus.replace("_", " ")}`,
      detail: "Cross-reference audit"
    },
    {
      step: "07",
      name: "Teacher Decision",
      badge: totalAccepted > 0 || totalEdited > 0 || totalDismissed > 0 ? "Human Agency" : "Teacher Review Pending",
      icon: UserCheck,
      color: "text-amber-600",
      bg: "bg-amber-50",
      stat: totalAccepted > 0 || totalEdited > 0 ? `${totalAccepted} accepted, ${totalEdited} edited` : totalDismissed > 0 ? `${totalDismissed} dismissed` : "Teacher Review Pending",
      detail: totalPending > 0 ? `${totalPending} items pending review` : totalDismissed > 0 ? `${totalDismissed} dismissed` : "All items reviewed"
    }
  ];
  return <div className={`space-y-3 ${className}`}>
      {
    /* Horizontal Compact Pipeline Overview Wrapped in GlowEdgeCard */
  }
      <GlowEdgeCard variant="ai" className="shadow-xs">
        <div className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-brand)]">
                <Cpu size={16} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[var(--text-primary)]">
                    Model Trace
                  </span>
                  <span className="text-[var(--text-secondary)]">/</span>
                  <span className="text-[11px] font-mono text-[var(--text-primary)] bg-[var(--bg-surface)] px-2 py-0.5 rounded border border-[var(--border-brand)] font-semibold">
                    7-Stage Provenance Flow
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Full lineage connecting source student work → Gemini extraction → code verification → pedagogical strategy → teacher decision.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isDemo ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  mode: demo_resilience
                </span> : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  mode: live_gemini ({Math.round((metadata?.totalDurationMs || 0) / 1e3)}s)
                </span>}

              {onOpenDrawer && <button
    onClick={onOpenDrawer}
    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-brand)] bg-[var(--action-primary-bg)] hover:bg-[var(--action-primary-hover)] px-3 py-1.5 text-xs font-semibold text-[var(--action-primary-text)] transition shadow-2xs"
    aria-label="Open detailed Model Trace Drawer"
  >
                  <Cpu size={13} className="text-[var(--action-primary-text)]" />
                  <span>View Model Trace</span>
                  <ChevronRight size={13} />
                </button>}
            </div>
          </div>

          {
    /* 7-Step Horizontal Provenance Flow */
  }
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 relative">
            {stages.map((st, i) => {
    const Icon = st.icon;
    return <div
      key={i}
      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5 space-y-1.5 hover:bg-white hover:border-[var(--border-brand)] hover:shadow-2xs transition relative"
    >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold text-[var(--text-secondary)]">
                      {st.step}
                    </span>
                    <div className={`p-1 rounded ${st.bg} ${st.color}`}>
                      <Icon size={12} />
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-bold text-[var(--text-primary)] leading-tight">
                      {st.name}
                    </div>
                    <div className="text-[10px] text-[var(--text-secondary)] truncate font-mono">
                      {st.badge}
                    </div>
                  </div>

                  <div className="pt-1 border-t border-[var(--border-subtle)]">
                    <div className="text-[11px] font-semibold text-[var(--text-primary)] leading-snug">
                      {st.stat}
                    </div>
                    <div className="text-[10px] text-[var(--text-secondary)] truncate">
                      {st.detail}
                    </div>
                  </div>
                </div>;
  })}
          </div>
        </div>
      </GlowEdgeCard>
    </div>;
};
const AITraceDrawer = ({
  isOpen,
  onClose,
  result
}) => {
  if (!isOpen) return null;
  const metadata = result.executionMetadata;
  const isDemo = metadata?.executionMode === "demo_resilience";
  const totalSubmissions = result.classSnapshot.totalSubmissions || result.studentObservations.length;
  const totalQuotes = result.studentObservations.reduce(
    (acc, o) => acc + (o.supportingEvidence?.length || 0),
    0
  );
  const clusterCount = result.misconceptionClusters.length;
  const groupCount = result.instructionalGroups.length;
  const interventionCount = result.interventions.length;
  const detChecks = result.verification.deterministicChecks;
  const acceptedClusters = result.misconceptionClusters.filter(
    (c) => getCanonicalTeacherDecision(c) === "accepted"
  ).length;
  const editedClusters = result.misconceptionClusters.filter(
    (c) => getCanonicalTeacherDecision(c) === "edited"
  ).length;
  const dismissedClusters = result.misconceptionClusters.filter(
    (c) => getCanonicalTeacherDecision(c) === "dismissed"
  ).length;
  const pendingClusters = result.misconceptionClusters.filter(
    (c) => getCanonicalTeacherDecision(c) === "pending"
  ).length;
  const acceptedInterventions = result.interventions.filter(
    (i) => getCanonicalTeacherDecision(i) === "accepted"
  ).length;
  const editedInterventions = result.interventions.filter(
    (i) => getCanonicalTeacherDecision(i) === "edited"
  ).length;
  const dismissedInterventions = result.interventions.filter(
    (i) => getCanonicalTeacherDecision(i) === "dismissed"
  ).length;
  const pendingInterventions = result.interventions.filter(
    (i) => getCanonicalTeacherDecision(i) === "pending"
  ).length;
  const totalAccepted = acceptedClusters + acceptedInterventions;
  const totalEdited = editedClusters + editedInterventions;
  const totalDismissed = dismissedClusters + dismissedInterventions;
  const totalPending = pendingClusters + pendingInterventions;
  const isGoogleSDP = Boolean(
    result.privacyAudit?.providerVersionOrPolicyId?.startsWith("google-sdp")
  );
  const privacyModeBadge = isGoogleSDP ? "Google Cloud SDP" : "Demo privacy mode";
  const closeButtonRef = React.useRef(null);
  const drawerRef = useModalFocus({
    isOpen,
    onClose,
    initialFocusRef: closeButtonRef
  });
  return <div
    className="fixed inset-0 z-50 flex justify-end bg-[var(--action-primary-bg)] backdrop-blur-xs transition-opacity"
    onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}
  >
      <div
    ref={drawerRef}
    className="w-full max-w-2xl bg-white bg-[var(--bg-surface)] text-[var(--text-primary)] h-full shadow-2xl overflow-y-auto flex flex-col border-l border-[var(--border-subtle)] animate-in slide-in-from-right duration-300"
    role="dialog"
    aria-modal="true"
    aria-labelledby="trace-drawer-title"
  >
        {
    /* Drawer Header */
  }
        <div className="p-6 border-b border-[var(--border-subtle)] flex items-center justify-between sticky top-0 bg-white/95 bg-[var(--bg-surface)] backdrop-blur-md z-20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-brand)]">
              <Cpu size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  Technical Transparency Log
                </span>
                <span className="text-[var(--text-secondary)]">/</span>
                <span className="text-[11px] font-mono text-[var(--text-secondary)]">
                  Visible Intelligence
                </span>
              </div>
              <h2 id="trace-drawer-title" className="text-lg font-bold text-[var(--text-primary)]">
                Full Model Trace
              </h2>
            </div>
          </div>

          <button
    ref={closeButtonRef}
    onClick={onClose}
    className="p-2 text-[var(--action-primary-text)] hover:text-[var(--action-primary-text)] rounded-lg hover:bg-[var(--action-primary-hover)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
    aria-label="Close Trace Drawer"
  >
            <X size={18} />
          </button>
        </div>

        {
    /* Drawer Body */
  }
        <div className="p-6 space-y-6 flex-1 text-xs">
          {
    /* Executive Overview Box */
  }
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 space-y-2">
            <div className="flex items-center justify-between font-mono text-[11px] text-[var(--text-secondary)] pb-2 border-b border-[var(--border-subtle)]">
              <span>EXECUTION PROFILE</span>
              <span className={isDemo ? "text-amber-700 font-semibold" : "text-emerald-700 font-semibold"}>
                {isDemo ? "DEMO RESILIENCE MODE" : "LIVE GEMINI ENGINE"}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-[var(--text-primary)]">
              <div>
                <span className="text-[10px] text-[var(--text-secondary)] block uppercase">Primary Model</span>
                <span className="font-mono font-bold text-[var(--text-secondary)]">{metadata?.primaryModel || (isDemo ? "demo_fallback_cache" : "gemini-3.8-flash")}</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-secondary)] block uppercase">Submissions</span>
                <span className="font-bold text-[var(--text-primary)]">{totalSubmissions} Student Samples</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-secondary)] block uppercase">Pipeline Passes</span>
                <span className="font-bold text-[var(--text-primary)]">4 Sequential AI Stages</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-secondary)] block uppercase">Total Latency</span>
                <span className="font-mono font-bold text-[var(--text-secondary)]">
                  {isDemo ? "Cached Benchmark" : metadata?.totalDurationMs ? `${(metadata.totalDurationMs / 1e3).toFixed(1)}s` : "Not recorded"}
                </span>
              </div>
            </div>
          </div>

          {
    /* Detailed Sequential Trace Stages */
  }
          <div className="space-y-4">
            {
    /* Stage 1: Input Evidence & Privacy Gateway */
  }
            <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-bold text-[var(--text-secondary)]">STAGE 01</span>
                  <span className="text-[var(--text-secondary)]">/</span>
                  <h3 className="font-bold text-[var(--text-primary)]">Privacy Gateway &amp; Ingestion</h3>
                </div>
                <ProvenanceBadge type="code" label={privacyModeBadge} size="sm" />
              </div>
              <ul className="list-disc list-inside space-y-1 text-[var(--text-secondary)] pl-1 text-[11px]">
                <li><strong>{totalSubmissions} Student Submissions:</strong> Ingested educator-provided student work.</li>
                <li><strong>Pre-AI Privacy Boundary:</strong> {isGoogleSDP ? "Scanned via Google Cloud Sensitive Data Protection (PERSON_NAME, EMAIL_ADDRESS, PHONE_NUMBER)." : "Deterministic local privacy filter (PERSON_NAME, EMAIL_ADDRESS, PHONE_NUMBER)."}</li>
                <li><strong>De-identification Status:</strong> {result.privacyAudit ? `${result.privacyAudit.findingCount} sensitive identifiers removed. Raw sensitive values stored in privacy audit: No.` : "Verified clean."}</li>
                <li><strong>Multimodal Ingestion:</strong> Formats mapped to normalized source layer with image PII redaction.</li>
                <li><strong>Stage Latency:</strong> {formatStageLatency(metadata?.stageDurationsMs, "Stage 1: Privacy Gateway", isDemo)}</li>
              </ul>
            </div>

            {
    /* Stage 2: Observer */
  }
            <div className="rounded-xl border border-[var(--border-brand)] bg-[var(--bg-surface)] p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-bold text-[var(--text-primary)]">STAGE 02</span>
                  <span className="text-[var(--text-secondary)]">/</span>
                  <h3 className="font-bold text-[var(--text-primary)]">Gemini Observer (Individual Analysis)</h3>
                </div>
                <ProvenanceBadge type="gemini" label="Gemini 3.8 Flash" size="sm" />
              </div>
              <ul className="list-disc list-inside space-y-1 text-[var(--text-primary)] pl-1 text-[11px]">
                <li><strong>{result.studentObservations.length} Structured Student Profiles:</strong> Dissected individual student work against lesson rubric.</li>
                <li><strong>{totalQuotes} Verbatim Evidence Citations:</strong> Extracted direct quotes to substantiate every observed strength or misconception.</li>
                <li><strong>Zero Extraneous Inferences:</strong> Prompt enforced passive error analysis without psychological or personality claims.</li>
                <li><strong>Stage Latency:</strong> {formatStageLatency(metadata?.stageDurationsMs, "Stage 2: Gemini Observer", isDemo)}</li>
              </ul>
            </div>

            {
    /* Stage 3: Diagnosis */
  }
            <div className="rounded-xl border border-[var(--border-brand)] bg-[var(--bg-surface)] p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-bold text-[var(--text-primary)]">STAGE 03</span>
                  <span className="text-[var(--text-secondary)]">/</span>
                  <h3 className="font-bold text-[var(--text-primary)]">Gemini Diagnosis (Whole-Class Synthesis)</h3>
                </div>
                <ProvenanceBadge type="gemini" label="Cohort Pattern Synthesis" size="sm" />
              </div>
              <ul className="list-disc list-inside space-y-1 text-[var(--text-primary)] pl-1 text-[11px]">
                <li><strong>{clusterCount} Class-Wide Misconception Clusters:</strong> Clustered individual errors into cohesive instructional patterns.</li>
                <li><strong>Top Need Identified:</strong> {result.classSnapshot.highestPriorityNeed}</li>
                <li><strong>Strongest Foundation:</strong> {result.classSnapshot.strongestConcept}</li>
                <li><strong>Stage Latency:</strong> {formatStageLatency(metadata?.stageDurationsMs, "Stage 3: Gemini Diagnosis", isDemo)}</li>
              </ul>
            </div>

            {
    /* Stage 4: Deterministic Validator */
  }
            <div className="rounded-xl border border-teal-200 bg-teal-50/20 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-bold text-teal-700">STAGE 04</span>
                  <span className="text-[var(--text-secondary)]">/</span>
                  <h3 className="font-bold text-[var(--text-primary)]">Deterministic Software Validation</h3>
                </div>
                <ProvenanceBadge
    type="code"
    label={metadata?.deterministicAuditPassed ? "Code Verified" : "Code Review Required"}
    size="sm"
  />
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="p-2 rounded bg-white border border-teal-100 flex items-center justify-between">
                  <span>Student ID Coverage:</span>
                  <span className={`font-bold ${detChecks?.coveragePassed ? "text-teal-700" : "text-rose-700"}`}>
                    {detChecks?.coveragePassed ? `PASS (${totalSubmissions}/${totalSubmissions})` : "REVIEW REQUIRED"}
                  </span>
                </div>
                <div className="p-2 rounded bg-white border border-teal-100 flex items-center justify-between">
                  <span>Group Partition:</span>
                  <span className={`font-bold ${detChecks?.groupPartitionPassed ? "text-teal-700" : "text-rose-700"}`}>
                    {detChecks?.groupPartitionPassed ? "PASS" : "REVIEW REQUIRED"}
                  </span>
                </div>
                <div className="p-2 rounded bg-white border border-teal-100 flex items-center justify-between">
                  <span>Prevalence Arithmetic:</span>
                  <span className={`font-bold ${detChecks?.clusterMathPassed ? "text-teal-700" : "text-rose-700"}`}>
                    {detChecks?.clusterMathPassed ? "COMPUTED IN CODE" : "FLAGGED DISCREPANCY"}
                  </span>
                </div>
                <div className="p-2 rounded bg-white border border-teal-100 flex items-center justify-between">
                  <span>Quote Grounding:</span>
                  <span className="font-bold text-teal-700">
                    {detChecks ? `${detChecks.quotesGroundedCount} GROUNDED` : `${totalQuotes} EXTRACTED`}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)]">
                <strong>Stage Latency:</strong> {formatStageLatency(metadata?.stageDurationsMs, "Stage 4: Deterministic Validation", isDemo)}
              </p>
            </div>

            {
    /* Stage 5: Teaching Strategist */
  }
            <div className="rounded-xl border border-[var(--border-brand)] bg-[var(--bg-surface)] p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-bold text-[var(--text-primary)]">STAGE 05</span>
                  <span className="text-[var(--text-secondary)]">/</span>
                  <h3 className="font-bold text-[var(--text-primary)]">Teaching Strategist (Instructional Design)</h3>
                </div>
                <ProvenanceBadge type="gemini" label="Pedagogical Design" size="sm" />
              </div>
              <ul className="list-disc list-inside space-y-1 text-[var(--text-primary)] pl-1 text-[11px]">
                <li><strong>{groupCount} Non-Stigmatizing Instructional Cohorts:</strong> Grouped students dynamically by shared instructional need rather than permanent ability labels.</li>
                <li><strong>{interventionCount} Differentiated Micro-Interventions:</strong> Concrete activities with sample teacher scripts and exit ticket questions.</li>
                <li><strong>25-Minute Lesson Timeline:</strong> 5 timed phases (Diagnostic Warm-up, Misconception Debrief, Guided Practice, Differentiated Task, Exit Ticket).</li>
                <li><strong>Stage Latency:</strong> {formatStageLatency(metadata?.stageDurationsMs, "Stage 5: Gemini Teaching Strategist", isDemo)}</li>
              </ul>
            </div>

            {
    /* Stage 6: Adversarial Verifier Pass */
  }
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/20 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-bold text-emerald-700">STAGE 06</span>
                  <span className="text-[var(--text-secondary)]">/</span>
                  <h3 className="font-bold text-[var(--text-primary)]">Adversarial Gemini Verification Pass</h3>
                </div>
                <ProvenanceBadge
    type="verified"
    label={result.verification.overallStatus === "verified" ? "Gemini Verified" : "Gemini Review: Partial"}
    size="sm"
  />
              </div>
              <ul className="list-disc list-inside space-y-1 text-[var(--text-primary)] pl-1 text-[11px]">
                <li><strong>Cross-Reference Audit:</strong> Audited all claims against ground-truth submissions with conservative fail-closed defaults.</li>
                <li><strong>Evidence Coverage Status:</strong> {result.verification.evidenceCoverageStatus.toUpperCase()}</li>
                <li><strong>Objective Alignment:</strong> {result.verification.objectiveAlignmentStatus.toUpperCase()}</li>
                <li><strong>Overall Verification Status:</strong> {result.verification.overallStatus.toUpperCase()}</li>
                <li><strong>Stage Latency:</strong> {formatStageLatency(metadata?.stageDurationsMs, "Stage 6: Gemini Verification", isDemo)}</li>
              </ul>
            </div>

            {
    /* Stage 7: Teacher Agency */
  }
            <div className="rounded-xl border border-amber-200 bg-amber-50/20 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-bold text-amber-700">STAGE 07</span>
                  <span className="text-[var(--text-secondary)]">/</span>
                  <h3 className="font-bold text-[var(--text-primary)]">Teacher Decision &amp; Human-in-the-Loop Agency</h3>
                </div>
                <ProvenanceBadge
    type="human"
    label={totalAccepted > 0 || totalEdited > 0 || totalDismissed > 0 ? "Teacher Reviewed" : "Teacher Review Pending"}
    size="sm"
  />
              </div>
              <p className="text-[11px] text-[var(--text-secondary)]">
                {totalAccepted > 0 || totalEdited > 0 || totalDismissed > 0 ? "LotusLearn provides decision support; teachers retain ultimate authority. Every AI artifact can be accepted, edited, or dismissed." : "Teacher Review Pending: AI-generated clusters and interventions require explicit teacher acceptance, edit, or dismissal before being considered approved."}
              </p>
              <div className="grid grid-cols-4 gap-2 font-mono text-[11px] text-center">
                <div className="p-2 rounded bg-white border border-[var(--border-subtle)]">
                  <span className="text-[var(--text-primary)] font-bold block">{totalPending}</span>
                  <span className="text-[10px] text-[var(--text-secondary)] uppercase">Pending</span>
                </div>
                <div className="p-2 rounded bg-white border border-amber-200">
                  <span className="text-emerald-700 font-bold block">{totalAccepted}</span>
                  <span className="text-[10px] text-[var(--text-secondary)] uppercase">Accepted</span>
                </div>
                <div className="p-2 rounded bg-white border border-amber-200">
                  <span className="text-amber-700 font-bold block">{totalEdited}</span>
                  <span className="text-[10px] text-[var(--text-secondary)] uppercase">Edited</span>
                </div>
                <div className="p-2 rounded bg-white border border-amber-200">
                  <span className="text-[var(--text-secondary)] font-bold block">{totalDismissed}</span>
                  <span className="text-[10px] text-[var(--text-secondary)] uppercase">Dismissed</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {
    /* Drawer Footer */
  }
        <div className="p-4 border-t border-[var(--border-brand)] bg-[var(--action-primary-bg)] flex items-center justify-between text-[11px] text-[var(--action-primary-text)]">
          <span>LotusLearn - Technical Analysis Trace</span>
          <button
    onClick={onClose}
    className="px-4 py-2 bg-[var(--action-primary-bg)] text-[var(--action-primary-text)] font-semibold rounded-lg hover:bg-[var(--action-primary-hover)] transition"
  >
            Done Inspecting
          </button>
        </div>
      </div>
    </div>;
};
export {
  AIContributionTrace,
  AITraceDrawer
};
