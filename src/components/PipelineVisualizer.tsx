import React, { useEffect, useState, useRef } from 'react';
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileText,
  Eye,
  Activity,
  Calculator,
  Compass,
  ShieldCheck,
  CheckCheck,
  XCircle,
  Cpu,
} from 'lucide-react';
import { LotusIcon } from './icons/LotusIcon';

export interface ObservatoryStage {
  id: number;
  label: string;
  name: string;
  subhead: string;
  icon: React.ElementType;
  engine: 'data' | 'gemini' | 'code' | 'gemini_verifier' | 'system';
}

export const OBSERVATORY_STAGES: ObservatoryStage[] = [
  {
    id: 1,
    label: '01',
    name: 'Source Evidence',
    subhead: 'Evidence ingestion & multimodal artifact loading',
    icon: FileText,
    engine: 'data',
  },
  {
    id: 2,
    label: '02',
    name: 'Gemini Observer',
    subhead: 'Evidence extraction & handwriting OCR transcription',
    icon: Eye,
    engine: 'gemini',
  },
  {
    id: 3,
    label: '03',
    name: 'Gemini Diagnosis',
    subhead: 'Class-wide misconception synthesis & root causes',
    icon: Activity,
    engine: 'gemini',
  },
  {
    id: 4,
    label: '04',
    name: 'Deterministic Validation',
    subhead: 'Code verification: coverage, cluster math & exact quotes',
    icon: Calculator,
    engine: 'code',
  },
  {
    id: 5,
    label: '05',
    name: 'Gemini Teaching Strategist',
    subhead: 'Differentiated scaffolds & 25-minute lesson sequence',
    icon: Compass,
    engine: 'gemini',
  },
  {
    id: 6,
    label: '06',
    name: 'Gemini Verification',
    subhead: 'Adversarial grounding audit & claim verification',
    icon: ShieldCheck,
    engine: 'gemini_verifier',
  },
  {
    id: 7,
    label: '07',
    name: 'Complete',
    subhead: 'Diagnostic assessment ready for teacher review & decision',
    icon: CheckCheck,
    engine: 'system',
  },
];

interface PipelineVisualizerProps {
  currentStage: number; // 1 to 7
  currentDetail?: string;
  errorMessage?: string;
  onRetry?: () => void;
  onCancel?: () => void;
}

export const PipelineVisualizer: React.FC<PipelineVisualizerProps> = ({
  currentStage,
  currentDetail,
  errorMessage,
  onRetry,
  onCancel,
}) => {
  const [elapsedSec, setElapsedSec] = useState(0);
  const [stageDurations, setStageDurations] = useState<Record<number, number>>({});
  const lastStageRef = useRef<number>(currentStage);
  const stageStartTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (errorMessage) return;
    const timer = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [errorMessage]);

  // Track completion duration when stage changes
  useEffect(() => {
    if (currentStage > lastStageRef.current) {
      const prevStage = lastStageRef.current;
      const durationSeconds = Math.max(0.3, Math.round(((Date.now() - stageStartTimeRef.current) / 100) / 10));
      setStageDurations((prev) => ({
        ...prev,
        [prevStage]: durationSeconds,
      }));
      lastStageRef.current = currentStage;
      stageStartTimeRef.current = Date.now();
    }
  }, [currentStage]);

  const progressPercent = Math.min(
    100,
    errorMessage
      ? Math.round(((currentStage - 1) / 7) * 100)
      : Math.round((currentStage / 7) * 100)
  );

  return (
    <div className="py-10 px-4 sm:px-6 max-w-5xl mx-auto space-y-6">
      {/* Light Outer Intro Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 uppercase tracking-wider">
            <span>AI Pipeline Observatory</span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-500 font-mono">Visible Intelligence</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Multi-Stage Gemini Reasoning Engine
          </h1>
          <p className="text-xs text-slate-500">
            Real-time execution of server-side Gemini 3.8 Flash, hybrid deterministic code checks, and adversarial verification.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-mono text-slate-600 shadow-2xs">
            <Cpu size={14} className="text-indigo-600" />
            <span>Time Elapsed: {elapsedSec}s</span>
          </div>
        </div>
      </div>

      {/* DEEP NAVY CONTAINED OBSERVATORY PANEL */}
      <div className="rounded-2xl border border-slate-800 bg-[#0B132B] p-6 sm:p-8 text-white shadow-xl space-y-6 relative overflow-hidden">
        {/* Subtle Ambient Background Gradient */}
        <div
          className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-indigo-600/15 blur-3xl pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-teal-600/15 blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        {/* Observatory Panel Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-800 gap-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 border border-slate-700/80 text-rose-400 shadow-inner">
              <LotusIcon size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-indigo-400">
                  Live Stage Execution
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-[11px] font-mono text-slate-400">gemini-3.8-flash</span>
              </div>
              <h2 className="text-base font-bold text-white tracking-tight">
                {errorMessage
                  ? 'Pipeline Execution Halted'
                  : currentStage >= 7
                  ? 'All 7 Stages Verified · Preparing Diagnostic Results'
                  : `Active Stage ${currentStage} of 7: ${OBSERVATORY_STAGES[currentStage - 1]?.name}`}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {errorMessage ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/80 border border-rose-700 text-rose-200 text-xs font-semibold">
                <XCircle size={14} className="text-rose-400" />
                <span>Error at Stage {currentStage}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-950/80 border border-indigo-700/80 text-indigo-200 text-xs font-mono font-semibold">
                <Loader2 size={13} className="animate-spin text-indigo-400" />
                <span>Processing Stage {currentStage} of 7</span>
              </span>
            )}
          </div>
        </div>

        {/* Real-time Progress Bar */}
        <div className="space-y-2 relative z-10">
          <div className="flex justify-between text-xs font-mono text-slate-400">
            <span>PIPELINE PROGRESS (7-STAGE OBSERVATORY)</span>
            <span className={errorMessage ? 'text-rose-400' : 'text-indigo-400 font-bold'}>
              {errorMessage ? 'Halted' : `${progressPercent}%`}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full transition-all duration-500 ease-out ${
                errorMessage
                  ? 'bg-rose-500'
                  : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-teal-400'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {currentDetail && !errorMessage && (
            <p className="text-xs text-slate-300 font-mono italic pt-1">
              &gt; {currentDetail}
            </p>
          )}
        </div>

        {/* SEVEN STAGE OBSERVATORY CARDS WITH GLOWING-EDGE TREATMENT */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 relative z-10 pt-2">
          {OBSERVATORY_STAGES.map((st) => {
            const Icon = st.icon;
            const isCurrent = currentStage === st.id && !errorMessage;
            const isCompleted = currentStage > st.id;
            const isFailed = errorMessage && currentStage === st.id;
            const duration = stageDurations[st.id];

            // Visible glowing-edge styling for active stage (blue -> indigo -> violet glow)
            let borderClass = 'border-slate-800/80 bg-slate-900/60 text-slate-400';
            let glowStyle: React.CSSProperties = {};

            if (isCurrent) {
              borderClass = 'border-indigo-400 bg-gradient-to-br from-indigo-950/90 via-slate-900 to-indigo-950/70 text-white';
              glowStyle = {
                boxShadow: '0 0 0 1.5px #818cf8, 0 0 24px -2px rgba(99, 102, 241, 0.55), inset 0 0 16px -4px rgba(99, 102, 241, 0.35)',
              };
            } else if (isCompleted) {
              borderClass = 'border-teal-500/50 bg-teal-950/20 text-slate-300';
              glowStyle = {
                boxShadow: '0 0 12px -2px rgba(20, 184, 166, 0.25)',
              };
            } else if (isFailed) {
              borderClass = 'border-rose-500 bg-rose-950/40 text-white';
              glowStyle = {
                boxShadow: '0 0 20px -2px rgba(244, 63, 94, 0.6)',
              };
            }

            return (
              <div
                key={st.id}
                style={glowStyle}
                className={`rounded-xl border p-4 space-y-3 transition-all duration-300 relative ${borderClass}`}
              >
                {/* Active pulsating beacon indicator */}
                {isCurrent && (
                  <span className="absolute top-2 right-2 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
                  </span>
                )}

                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold text-slate-400">
                    STAGE {st.label}
                  </span>
                  <div
                    className={`p-1.5 rounded-lg ${
                      isCurrent
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : isCompleted
                        ? 'bg-teal-500/20 text-teal-400'
                        : isFailed
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <Icon size={14} />
                  </div>
                </div>

                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span>{st.name}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug line-clamp-2 mt-0.5">
                    {st.subhead}
                  </p>
                </div>

                {/* Status Row with Real Stage Duration */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-500 text-[10px]">
                    {st.engine === 'code'
                      ? 'Deterministic Code'
                      : st.engine === 'gemini_verifier'
                      ? 'Adversarial Pass'
                      : st.engine === 'data'
                      ? 'Source Ingestion'
                      : st.engine === 'system'
                      ? 'Ready for Decision'
                      : 'Gemini 3.8 Flash'}
                  </span>

                  <div>
                    {isCurrent && (
                      <span className="text-indigo-400 font-semibold flex items-center gap-1 text-[11px]">
                        <Loader2 size={11} className="animate-spin" />
                        <span>Active</span>
                      </span>
                    )}
                    {isCompleted && (
                      <span className="text-teal-400 font-semibold flex items-center gap-1 text-[11px]">
                        <CheckCircle2 size={12} />
                        <span>{duration ? `${duration}s` : 'Completed'}</span>
                      </span>
                    )}
                    {isFailed && (
                      <span className="text-rose-400 font-semibold flex items-center gap-1 text-[11px]">
                        <AlertTriangle size={12} />
                        <span>Failed</span>
                      </span>
                    )}
                    {!isCurrent && !isCompleted && !isFailed && (
                      <span className="text-slate-500 text-[11px]">Queued</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Error Details & Controlled Retry */}
        {errorMessage && (
          <div className="rounded-xl border border-rose-600 bg-rose-950/60 p-4 space-y-3 relative z-10 text-xs">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-bold text-rose-200">
                  Stage {currentStage} Failure: {OBSERVATORY_STAGES[currentStage - 1]?.name}
                </h4>
                <p className="text-rose-300 leading-relaxed font-mono text-[11px]">
                  {errorMessage}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 px-4 py-2 text-xs font-semibold text-white transition shadow-sm"
                >
                  <RefreshCw size={13} />
                  <span>Retry Stage</span>
                </button>
              )}
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="text-xs font-medium text-slate-400 hover:text-white transition px-2 py-1"
                >
                  Cancel to Wizard
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
