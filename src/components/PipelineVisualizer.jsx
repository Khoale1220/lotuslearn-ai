import { useEffect, useState, useRef } from "react";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  Clock,
  ArrowLeft
} from "lucide-react";
import { getPipelineErrorDisplay } from "../utils/verificationDisplay";
const USER_FACING_STAGES = [
  {
    id: 1,
    label: "01",
    name: "Checking student privacy & preparing work",
    subhead: "Sensitive information is checked and removed before AI analysis",
    technicalName: "Stage 1: Privacy Gateway & Source Ingestion",
    engine: "data"
  },
  {
    id: 2,
    label: "02",
    name: "Isolating student evidence",
    subhead: "Transcribing handwriting and extracting verbatim quotes against rubric",
    technicalName: "Stage 2: Gemini Observer",
    engine: "gemini"
  },
  {
    id: 3,
    label: "03",
    name: "Identifying learning patterns",
    subhead: "Synthesizing class-wide misconception clusters and priority rankings",
    technicalName: "Stage 3: Gemini Diagnosis",
    engine: "gemini"
  },
  {
    id: 4,
    label: "04",
    name: "Checking evidence & arithmetic (Code)",
    subhead: "Deterministic code checks: roster coverage, cluster math, and exact quotations",
    technicalName: "Stage 4: Deterministic Validation",
    engine: "code"
  },
  {
    id: 5,
    label: "05",
    name: "Preparing teaching recommendations",
    subhead: "Formulating a 25-minute lesson sequence and differentiated scaffolds",
    technicalName: "Stage 5: Teaching Strategist",
    engine: "gemini"
  },
  {
    id: 6,
    label: "06",
    name: "Running independent verification audit",
    subhead: "Auditing claims and grounding evidence to ensure pedagogical plausibility",
    technicalName: "Stage 6: Gemini Verification",
    engine: "gemini_verifier"
  },
  {
    id: 7,
    label: "07",
    name: "Analysis ready for teacher review",
    subhead: "Diagnostic assessment complete and formatted for educator review & decisions",
    technicalName: "Stage 7: Output Finalization",
    engine: "system"
  }
];
const PipelineVisualizer = ({
  currentStage,
  currentDetail,
  errorMessage,
  onRetry,
  onCancel
}) => {
  const [elapsedSec, setElapsedSec] = useState(0);
  const [stageDurations, setStageDurations] = useState({});
  const lastStageRef = useRef(currentStage);
  const stageStartTimeRef = useRef(Date.now());
  useEffect(() => {
    if (errorMessage) return;
    const timer = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1e3);
    return () => clearInterval(timer);
  }, [errorMessage]);
  useEffect(() => {
    if (currentStage > lastStageRef.current) {
      const prevStage = lastStageRef.current;
      const durationSeconds = Math.max(0.2, Math.round((Date.now() - stageStartTimeRef.current) / 100 / 10));
      setStageDurations((prev) => ({
        ...prev,
        [prevStage]: durationSeconds
      }));
      lastStageRef.current = currentStage;
      stageStartTimeRef.current = Date.now();
    }
  }, [currentStage]);
  const activeStageObj = USER_FACING_STAGES[currentStage - 1] || USER_FACING_STAGES[0];
  const errorDisplay = errorMessage ? getPipelineErrorDisplay(errorMessage) : null;
  return <div className="py-10 px-4 sm:px-6 max-w-4xl mx-auto space-y-8">
      {
    /* Polite live region for screen readers */
  }
      <div role="status" aria-live="polite" className="sr-only">
        {errorMessage ? `Analysis halted at step ${currentStage}: ${errorDisplay?.title}. ${errorDisplay?.message}` : `Step ${currentStage} of 7: ${activeStageObj.name}. ${currentDetail || activeStageObj.subhead}`}
      </div>

      {
    /* Main Status Header */
  }
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--accent-subtle)] text-[var(--accent-fg)] text-xs font-semibold border border-[var(--border-brand)]">
          <Loader2 size={13} className="animate-spin text-[var(--accent-fg)]" />
          <span>Analyzing Student Work</span>
          <span className="text-[var(--text-secondary)]" aria-hidden="true">/</span>
          <span>Step {currentStage} of 7</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          {activeStageObj.name}
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
          {currentDetail || activeStageObj.subhead}
        </p>
        <div className="pt-1 flex items-center justify-center gap-2 text-xs font-mono text-[var(--text-secondary)]">
          <Clock size={13} className="text-[var(--text-secondary)]" />
          <span>Time elapsed: {elapsedSec}s</span>
        </div>
      </div>

      {
    /* Semantic Ordered Progress List */
  }
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-2xs">
        <h2 className="sr-only">Analysis Progress Steps</h2>
        <ol className="divide-y divide-[var(--border-subtle)]">
          {USER_FACING_STAGES.map((st) => {
    const isCurrent = currentStage === st.id && !errorMessage;
    const isCompleted = currentStage > st.id;
    const isFailed = currentStage === st.id && Boolean(errorMessage);
    const duration = stageDurations[st.id];
    return <li
      key={st.id}
      aria-current={isCurrent ? "step" : void 0}
      className={`py-3.5 flex items-center justify-between gap-4 transition-colors ${isCurrent ? "bg-[var(--bg-interactive)] -mx-6 px-6" : ""}`}
    >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold shrink-0 transition-colors ${isCompleted ? "bg-[var(--status-success-bg)] text-[var(--status-success)] border border-[var(--status-success-border)]" : isCurrent ? "bg-[var(--accent-fg)] text-[var(--action-primary-fg)] shadow-xs ring-4 ring-[var(--accent-subtle)]" : isFailed ? "bg-[var(--status-error-bg)] text-[var(--status-error)] border border-[var(--status-error-border)]" : "bg-[var(--bg-interactive)] text-[var(--text-secondary)] border border-[var(--border-default)]"}`}
    >
                    {isCompleted ? <CheckCircle2 size={16} className="text-[var(--status-success)]" /> : isCurrent ? <Loader2 size={15} className="animate-spin" /> : isFailed ? <AlertTriangle size={15} className="text-[var(--status-error)]" /> : <span>{st.id}</span>}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold truncate ${isCurrent ? "text-[var(--accent-fg)] font-bold" : isCompleted ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>
                        {st.name}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] truncate hidden sm:block">
                      {st.subhead}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0 text-xs">
                  {isCompleted && <span className="font-mono text-[var(--status-success)] font-medium">
                      {duration ? `${duration}s` : "Done"}
                    </span>}
                  {isCurrent && <span className="text-[var(--accent-fg)] font-semibold flex items-center gap-1 font-mono">
                      In progress
                    </span>}
                  {isFailed && <span className="text-[var(--status-error)] font-semibold font-mono">
                      Issue detected
                    </span>}
                  {!isCompleted && !isCurrent && !isFailed && <span className="text-[var(--text-secondary)] font-mono">Queued</span>}
                </div>
              </li>;
  })}
        </ol>
      </div>

      {
    /* Controlled Error Display with Human-Oriented Recovery Paths */
  }
      {errorDisplay && <div
    role="alert"
    className="rounded-xl border border-[var(--status-error-border)] bg-[var(--status-error-bg)] p-6 space-y-4 text-xs"
  >
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-[var(--status-error)] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[var(--status-error)]">
                {errorDisplay.title}
              </h3>
              <p className="text-[var(--status-error)] leading-relaxed">
                {errorDisplay.message}
              </p>
              <p className="text-[var(--status-error)] font-medium pt-1">
                {errorDisplay.recommendedAction}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-[var(--status-error-border)]">
            {errorDisplay.retryAllowed && onRetry && <button
    type="button"
    onClick={onRetry}
    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--action-primary-bg)] hover:bg-[var(--action-primary-hover)] px-4 py-2 text-xs font-semibold text-[var(--action-primary-fg)] shadow-2xs transition active:scale-98"
  >
                <RefreshCw size={13} />
                <span>Retry Analysis</span>
              </button>}
            {onCancel && <button
    type="button"
    onClick={onCancel}
    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-control)] bg-[var(--bg-surface)] hover:bg-[var(--bg-interactive)] px-3.5 py-2 text-xs font-semibold text-[var(--action-secondary-fg)] shadow-2xs transition"
  >
                <ArrowLeft size={13} />
                <span>Return to Wizard</span>
              </button>}
          </div>
        </div>}

      {
    /* Progressive Technical Disclosure for Judges / Engineers */
  }
      <details className="group rounded-xl border border-[var(--border-default)] bg-[var(--bg-interactive)] p-4 text-xs">
        <summary className="cursor-pointer font-semibold text-[var(--action-secondary-fg)] flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] rounded">
          <span>Technical Architecture &amp; Engine Details</span>
          <ChevronDown size={14} className="text-[var(--text-secondary)] group-open:rotate-180 transition-transform" />
        </summary>
        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] space-y-2 text-[var(--text-secondary)] font-mono text-[11px]">
          <p>
            <strong>Active Pipeline Stage:</strong> {activeStageObj.technicalName}
          </p>
          <p>
            <strong>Primary Model:</strong> Gemini 3.8 Flash (server-side proxy)
          </p>
          <p>
            <strong>Verification Architecture:</strong> Dual-layer (Deterministic TypeScript validation + Independent Gemini Verifier)
          </p>
          <p>
            <strong>Decision Authority:</strong> Human Educator (All recommendations start with teacherDecision: &apos;pending&apos;)
          </p>
        </div>
      </details>
    </div>;
};
export {
  PipelineVisualizer,
  USER_FACING_STAGES
};
