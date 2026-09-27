import React, { useState } from 'react';
import { NextLessonPlan } from '../../types';
import { Clock, Calendar, Copy, Check, MessageSquare, Package } from 'lucide-react';
import { GlowEdgeCard } from '../GlowEdgeCard';
import { ProvenanceBadge } from '../ProvenanceBadge';

interface NextLessonTimelineProps {
  plan: NextLessonPlan;
}

export const NextLessonTimeline: React.FC<NextLessonTimelineProps> = ({ plan }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyPlan = () => {
    const text = `NEXT LESSON PLAN (25-Minute Formative Sequence)\nObjective: ${
      plan.targetObjective
    }\n\n${plan.phases
      .map(
        (p) =>
          `[${p.timeRange}] ${p.phaseTitle}\n- Description: ${p.description}\n- Teacher Prompt: "${p.actionableTeacherPrompt}"\n- Materials: ${p.materials}\n`
      )
      .join('\n')}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
              Section 05 · Tomorrow&apos;s Action
            </span>
            <span className="text-slate-300">·</span>
            <ProvenanceBadge type="gemini" label="Pedagogical Plan" size="sm" />
            <ProvenanceBadge type="human" label="Teacher Paced" size="sm" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 mt-1">
            25-Minute Next Lesson Timeline
          </h2>
          <p className="text-xs text-slate-500">
            Targeted intervention sequence ready for immediate instructional delivery.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg font-mono">
            <Clock size={13} className="text-slate-500" />
            <span>Total: {plan.totalDuration}</span>
          </div>

          <button
            onClick={handleCopyPlan}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
          >
            {copied ? (
              <>
                <Check size={14} className="text-emerald-600" />
                <span>Copied Lesson</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span>Copy Sequence</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Target Focus Banner */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 text-xs">
        <span className="font-semibold text-blue-900 block mb-0.5">Lesson Focus Goal:</span>
        <p className="text-slate-800">{plan.targetObjective}</p>
      </div>

      {/* Timeline Sequence */}
      <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
        {plan.phases.map((phase, idx) => (
          <div key={idx} className="relative group">
            {/* Timeline node */}
            <div className="absolute -left-6 sm:-left-8 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white border-2 border-blue-600 text-[10px] font-bold text-blue-600 shadow-2xs">
              {idx + 1}
            </div>

            <GlowEdgeCard
              variant="ai"
              className="hover:shadow-xs transition"
            >
              <div className="p-4 sm:p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs pb-2 border-b border-slate-100">
                  <span className="font-bold text-sm text-slate-900">
                    {phase.phaseTitle}
                  </span>
                  <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 self-start sm:self-center">
                    {phase.timeRange}
                  </span>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed">
                  {phase.description}
                </p>

                {/* Actionable Prompt */}
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs space-y-1">
                  <span className="font-semibold text-slate-900 text-[11px] flex items-center gap-1.5">
                    <MessageSquare size={13} className="text-blue-600" />
                    What the Teacher Says:
                  </span>
                  <p className="text-slate-800 italic pl-5">
                    &quot;{phase.actionableTeacherPrompt}&quot;
                  </p>
                </div>

                {/* Materials */}
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1">
                  <Package size={12} className="text-slate-400" />
                  <span>Materials: {phase.materials}</span>
                </div>
              </div>
            </GlowEdgeCard>
          </div>
        ))}
      </div>
    </div>
  );
};
