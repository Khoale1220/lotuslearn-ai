import React, { useState } from 'react';
import { NextLessonPlan, LessonPhase } from '../../types';
import { Clock, Copy, Check, MessageSquare, Package, Edit3, Save, RotateCcw, CheckCircle2 } from 'lucide-react';

interface NextLessonTimelineProps {
  plan: NextLessonPlan;
  onUpdatePlan?: (updated: NextLessonPlan) => void;
}

export const NextLessonTimeline: React.FC<NextLessonTimelineProps> = ({
  plan,
  onUpdatePlan,
}) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedPlan, setEditedPlan] = useState<NextLessonPlan>(plan);
  const [hasTeacherEdits, setHasTeacherEdits] = useState(false);

  const handleCopyPlan = () => {
    const activePlan = hasTeacherEdits ? editedPlan : plan;
    const text = `NEXT LESSON PLAN (25-Minute Formative Sequence)\nObjective: ${
      activePlan.targetObjective
    }\n\n${activePlan.phases
      .map(
        (p) =>
          `[${p.timeRange}] ${p.phaseTitle}\n- Description: ${p.description}\n- Teacher Prompt: "${p.actionableTeacherPrompt}"\n- Materials: ${p.materials}\n`
      )
      .join('\n')}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePhaseChange = (idx: number, field: keyof LessonPhase, value: string) => {
    const newPhases = [...editedPlan.phases];
    newPhases[idx] = {
      ...newPhases[idx],
      [field]: value,
    };
    setEditedPlan({
      ...editedPlan,
      phases: newPhases,
    });
  };

  const handleSaveEdits = () => {
    setIsEditing(false);
    setHasTeacherEdits(true);
    onUpdatePlan?.(editedPlan);
  };

  const handleResetToAI = () => {
    setEditedPlan(plan);
    setIsEditing(false);
    setHasTeacherEdits(false);
    onUpdatePlan?.(plan);
  };

  const displayPlan = isEditing || hasTeacherEdits ? editedPlan : plan;

  return (
    <div id="lesson-plan-container" className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider block">
              Tomorrow&apos;s Lesson Plan
            </span>
            {hasTeacherEdits && (
              <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 size={11} />
                <span>Edited by Teacher</span>
              </span>
            )}
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 font-heading">
            25-Minute Targeted Intervention Sequence
          </h2>
          <p className="text-xs text-slate-500">
            Actionable lesson phases formatted for classroom delivery with explicit prompts, materials, and check for understanding.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg font-mono">
            <Clock size={13} className="text-slate-500" />
            <span>Duration: {displayPlan.totalDuration}</span>
          </div>

          {!isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition shadow-2xs"
            >
              <Edit3 size={13} />
              <span>Edit Plan</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveEdits}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 text-xs font-semibold transition shadow-2xs"
              >
                <Save size={13} />
                <span>Save Edits</span>
              </button>
              <button
                type="button"
                onClick={handleResetToAI}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 px-2.5 py-1.5 text-xs transition"
                title="Reset to AI Original"
              >
                <RotateCcw size={12} />
                <span>Reset</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleCopyPlan}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
          >
            {copied ? (
              <>
                <Check size={14} className="text-emerald-600" />
                <span>Copied Sequence</span>
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
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 text-xs space-y-1">
        <span className="font-semibold text-indigo-950 block">Target Lesson Objective:</span>
        {isEditing ? (
          <input
            type="text"
            value={editedPlan.targetObjective}
            onChange={(e) =>
              setEditedPlan({ ...editedPlan, targetObjective: e.target.value })
            }
            className="w-full text-xs text-slate-900 bg-white border border-slate-300 rounded-lg p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
          />
        ) : (
          <p className="text-slate-800 leading-relaxed font-medium">{displayPlan.targetObjective}</p>
        )}
      </div>

      {/* Timeline Sequence */}
      <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
        {displayPlan.phases.map((phase, idx) => (
          <div key={idx} className="relative group">
            {/* Timeline node */}
            <div className="absolute -left-6 sm:-left-8 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white border-2 border-indigo-600 text-[10px] font-bold text-indigo-600 shadow-2xs">
              {idx + 1}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3 hover:border-slate-300 transition">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs pb-2 border-b border-slate-100">
                {isEditing ? (
                  <input
                    type="text"
                    value={phase.phaseTitle}
                    onChange={(e) => handlePhaseChange(idx, 'phaseTitle', e.target.value)}
                    className="font-bold text-sm text-slate-900 bg-white border border-slate-300 rounded px-2 py-1 w-full max-w-sm"
                  />
                ) : (
                  <span className="font-bold text-sm text-slate-900">
                    {phase.phaseTitle}
                  </span>
                )}
                <span className="font-mono text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 self-start sm:self-center">
                  {phase.timeRange}
                </span>
              </div>

              {isEditing ? (
                <textarea
                  rows={2}
                  value={phase.description}
                  onChange={(e) => handlePhaseChange(idx, 'description', e.target.value)}
                  className="w-full text-xs text-slate-800 bg-white border border-slate-300 rounded p-2"
                />
              ) : (
                <p className="text-xs text-slate-700 leading-relaxed">
                  {phase.description}
                </p>
              )}

              {/* Actionable Prompt */}
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs space-y-1">
                <span className="font-semibold text-slate-900 text-[11px] flex items-center gap-1.5">
                  <MessageSquare size={13} className="text-indigo-600" />
                  What the Teacher Says:
                </span>
                {isEditing ? (
                  <input
                    type="text"
                    value={phase.actionableTeacherPrompt}
                    onChange={(e) => handlePhaseChange(idx, 'actionableTeacherPrompt', e.target.value)}
                    className="w-full text-xs text-slate-800 italic bg-white border border-slate-300 rounded p-1.5"
                  />
                ) : (
                  <p className="text-slate-800 italic pl-5">
                    &quot;{phase.actionableTeacherPrompt}&quot;
                  </p>
                )}
              </div>

              {/* Materials */}
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1">
                <Package size={12} className="text-slate-400" />
                <span>Materials needed: {phase.materials}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
