import React from 'react';
import { Sparkles, ArrowRight, Edit3, Clock, CheckCircle2, Layers } from 'lucide-react';
import { NextLessonPlan, MisconceptionCluster, InstructionalGroup } from '../../types';

interface NextLessonHeroCardProps {
  plan: NextLessonPlan;
  misconceptions: MisconceptionCluster[];
  groups: InstructionalGroup[];
  gradeLevel?: string;
  onReviewPlan: () => void;
  onEditPlan?: () => void;
}

export const NextLessonHeroCard: React.FC<NextLessonHeroCardProps> = ({
  plan,
  misconceptions,
  groups,
  gradeLevel = 'Grade 10 English',
  onReviewPlan,
  onEditPlan,
}) => {
  const topFocus = misconceptions[0]?.misconceptionTitle || 'Tense consistency and evidence structure';
  const groupCount = groups.length || 3;
  const patternCount = misconceptions.length || 4;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#4F46E5] to-[#3730A3] text-white p-6 sm:p-8 lg:p-9 shadow-lg shadow-indigo-950/20 border border-indigo-400/20">
      {/* Decorative ambient subtle light rings */}
      <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-white/10 blur-2xl pointer-events-none" />
      <div className="absolute -bottom-24 left-1/4 w-64 h-64 rounded-full bg-indigo-300/10 blur-2xl pointer-events-none" />

      <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Actionable Value & CTAs */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-indigo-200">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-md text-white border border-white/20">
              <Sparkles size={13} className="text-amber-300" />
              <span>Tomorrow&apos;s intervention is ready</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>25-minute targeted sequence</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight font-heading">
            Turn diagnostic findings into tomorrow&apos;s 25-minute lesson
          </h2>

          <p className="text-xs sm:text-sm text-indigo-100/90 leading-relaxed max-w-xl">
            Targeted instruction addressing <strong className="text-white font-semibold">{topFocus}</strong>. Derived directly from student responses with 3 differentiated cohorts.
          </p>

          {/* Quick Context Summary Pills */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-indigo-200 pt-1">
            <span className="flex items-center gap-1">
              <Layers size={13} className="text-indigo-300" />
              <span>{groupCount} instructional groups</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>{patternCount} diagnosed patterns</span>
            <span aria-hidden="true">·</span>
            <span>{gradeLevel}</span>
          </div>

          {/* Action CTAs */}
          <div className="pt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={onReviewPlan}
              className="inline-flex items-center gap-2 rounded-xl bg-white hover:bg-indigo-50 text-indigo-900 px-5 py-3 text-xs sm:text-sm font-bold shadow-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-98"
            >
              <span>Review Lesson Plan</span>
              <ArrowRight size={15} />
            </button>

            {onEditPlan && (
              <button
                onClick={onEditPlan}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/25 px-4 py-3 text-xs sm:text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-98"
              >
                <Edit3 size={15} />
                <span>Edit Plan</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Glass Schedule Breakdown Panel */}
        <div className="lg:col-span-5">
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-5 space-y-3.5 shadow-md">
            <div className="flex items-center justify-between pb-2.5 border-b border-white/15 text-xs">
              <span className="font-bold tracking-wider uppercase text-[11px] text-indigo-200">
                Instructional Flow
              </span>
              <span className="flex items-center gap-1 font-mono font-semibold text-white">
                <Clock size={12} />
                <span>25 minutes</span>
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              {plan.phases.slice(0, 4).map((phase, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-black/15 hover:bg-black/25 transition border border-white/10"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold text-white font-mono">
                      {idx + 1}
                    </span>
                    <span className="font-medium text-white truncate">
                      {phase.phaseTitle}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-indigo-200 shrink-0 font-semibold bg-white/10 px-2 py-0.5 rounded">
                    {phase.timeRange}
                  </span>
                </div>
              ))}

              {plan.phases.length === 0 && (
                <>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-black/15">
                    <span className="font-medium">1. Whole-Class Mini Lesson</span>
                    <span className="font-mono text-[11px] text-indigo-200">8 min</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-black/15">
                    <span className="font-medium">2. Differentiated Group Work</span>
                    <span className="font-mono text-[11px] text-indigo-200">10 min</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-black/15">
                    <span className="font-medium">3. Targeted Synthesis</span>
                    <span className="font-mono text-[11px] text-indigo-200">5 min</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-black/15">
                    <span className="font-medium">4. Formative Exit Ticket</span>
                    <span className="font-mono text-[11px] text-indigo-200">2 min</span>
                  </div>
                </>
              )}
            </div>

            <div className="pt-1 flex items-center justify-between text-[11px] text-indigo-200/90">
              <span className="flex items-center gap-1">
                <CheckCircle2 size={12} className="text-emerald-300" />
                <span>Zero extra prep required</span>
              </span>
              <span className="underline cursor-pointer hover:text-white" onClick={onReviewPlan}>
                Inspect prompts
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
