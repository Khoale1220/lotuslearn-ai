import { Calendar, ArrowRight, Edit3, Clock, CheckCircle2, Layers } from "lucide-react";
const NextLessonHeroCard = ({
  plan,
  misconceptions,
  groups,
  gradeLevel = "Grade 10 English",
  onReviewPlan,
  onEditPlan
}) => {
  const topFocus = misconceptions[0]?.misconceptionTitle || "Tense consistency and evidence structure";
  const groupCount = groups.length || 3;
  const patternCount = misconceptions.length || 4;
  return <div className="ui-hero relative overflow-hidden rounded-3xl p-6 sm:p-8 lg:p-9 shadow-lg">
      {
    /* Decorative ambient subtle light rings */
  }
      <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full ui-hero-glass blur-2xl pointer-events-none border-0" />
      <div className="absolute -bottom-24 left-1/4 w-64 h-64 rounded-full ui-hero-glass blur-2xl pointer-events-none border-0" />

      <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {
    /* Left Column: Actionable Value & CTAs */
  }
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold ui-hero-muted">
            <span className="ui-hero-glass inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-md">
              <Calendar size={13} className="text-[var(--shell-text)]" />
              <span>Tomorrow&apos;s intervention sequence</span>
            </span>
            <span className="ui-hero-muted">/</span>
            <span>25-minute targeted sequence</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--shell-text)] leading-tight font-heading">
            Turn diagnostic findings into tomorrow&apos;s 25-minute lesson
          </h2>

          <p className="text-xs sm:text-sm text-[var(--shell-text-muted)] leading-relaxed max-w-xl">
            Targeted instruction addressing <strong className="text-[var(--shell-text)] font-semibold">{topFocus}</strong>. Derived directly from student responses with 3 differentiated cohorts.
          </p>

          {
    /* Quick Context Summary Pills */
  }
          <div className="flex flex-wrap items-center gap-3 text-xs ui-hero-muted pt-1">
            <span className="flex items-center gap-1">
              <Layers size={13} className="ui-hero-muted" />
              <span>{groupCount} instructional groups</span>
            </span>
            <span className="ui-hero-muted">/</span>
            <span>{patternCount} diagnosed patterns</span>
            <span className="ui-hero-muted">/</span>
            <span>{gradeLevel}</span>
          </div>

          {
    /* Action CTAs */
  }
          <div className="pt-3 flex flex-wrap items-center gap-3">
            <button
    onClick={onReviewPlan}
    className="ui-btn ui-hero-primary gap-2 rounded-xl px-5 py-3 text-xs sm:text-sm font-bold shadow-md active:scale-98"
  >
              <span>Review Lesson Plan</span>
              <ArrowRight size={15} />
            </button>

            {onEditPlan && <button
    onClick={onEditPlan}
    className="ui-btn ui-hero-secondary gap-2 rounded-xl px-4 py-3 text-xs sm:text-sm font-semibold active:scale-98"
  >
                <Edit3 size={15} />
                <span>Edit Plan</span>
              </button>}
          </div>
        </div>

        {
    /* Right Column: Glass Schedule Breakdown Panel */
  }
        <div className="lg:col-span-5">
          <div className="ui-hero-glass rounded-2xl backdrop-blur-md p-5 space-y-3.5 shadow-md">
            <div className="flex items-center justify-between pb-2.5 border-b border-[color:color-mix(in_srgb,var(--fog-200)_18%,transparent)] text-xs">
              <span className="font-bold tracking-wider uppercase text-[11px] ui-hero-muted">
                Instructional Flow
              </span>
              <span className="flex items-center gap-1 font-mono font-semibold text-[var(--shell-text)]">
                <Clock size={12} />
                <span>25 minutes</span>
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              {plan.phases.slice(0, 4).map((phase, idx) => <div
    key={idx}
    className="ui-hero-row flex items-center justify-between p-2.5 rounded-xl transition"
  >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <span className="ui-hero-glass flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-[var(--shell-text)] font-mono">
                      {idx + 1}
                    </span>
                    <span className="font-medium text-[var(--shell-text)] truncate">
                      {phase.phaseTitle}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono ui-hero-muted shrink-0 font-semibold ui-hero-glass px-2 py-0.5 rounded">
                    {phase.timeRange}
                  </span>
                </div>)}

              {plan.phases.length === 0 && <>
                  <div className="ui-hero-row flex items-center justify-between p-2 rounded-xl">
                    <span className="font-medium">1. Whole-Class Mini Lesson</span>
                    <span className="font-mono text-[11px] ui-hero-muted">8 min</span>
                  </div>
                  <div className="ui-hero-row flex items-center justify-between p-2 rounded-xl">
                    <span className="font-medium">2. Differentiated Group Work</span>
                    <span className="font-mono text-[11px] ui-hero-muted">10 min</span>
                  </div>
                  <div className="ui-hero-row flex items-center justify-between p-2 rounded-xl">
                    <span className="font-medium">3. Targeted Synthesis</span>
                    <span className="font-mono text-[11px] ui-hero-muted">5 min</span>
                  </div>
                  <div className="ui-hero-row flex items-center justify-between p-2 rounded-xl">
                    <span className="font-medium">4. Formative Exit Ticket</span>
                    <span className="font-mono text-[11px] ui-hero-muted">2 min</span>
                  </div>
                </>}
            </div>

            <div className="pt-1 flex items-center justify-between text-[11px] ui-hero-muted/90">
              <span className="flex items-center gap-1">
                <CheckCircle2 size={12} className="text-[var(--status-success)]" />
                <span>Zero extra prep required</span>
              </span>
              <span className="underline cursor-pointer hover:text-[var(--fog-200)]" onClick={onReviewPlan}>
                Inspect prompts
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>;
};
export {
  NextLessonHeroCard
};
