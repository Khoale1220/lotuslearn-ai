import { PlusCircle, Play, CheckCircle2, ArrowRight } from "lucide-react";
const ClassesView = ({
  onStartAnalysis,
  onTryDemo,
  onSelectSavedAnalysis,
  savedAnalyses
}) => {
  return <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
      {
    /* Header */
  }
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[var(--border-default)] gap-4 transition-colors">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)]  font-heading">
            Classroom Roster &amp; Cohorts
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[var(--text-secondary)] ">
            Manage your teaching cohorts and review longitudinal formative diagnostic history.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
    onClick={onTryDemo}
    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--action-secondary-bg)]  hover:bg-[var(--action-secondary-hover)]  px-3.5 py-2 text-xs font-semibold text-[var(--action-secondary-fg)]  shadow-2xs transition"
  >
            <Play size={14} className="text-[var(--action-secondary-fg)] " />
            <span>Load Demo Class</span>
          </button>
          <button
    onClick={onStartAnalysis}
    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--action-primary-bg)]  hover:bg-[var(--action-primary-hover)]  px-4 py-2 text-xs font-semibold text-[var(--action-primary-text)] shadow-2xs transition"
  >
            <PlusCircle size={14} />
            <span>Analyze Assignment</span>
          </button>
        </div>
      </div>

      {
    /* Primary Class Card: Grade 10A1 English */
  }
      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)]  p-6 sm:p-7 shadow-2xs space-y-5 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[var(--border-subtle)] gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-[var(--bg-elevated)]  border border-[var(--border-brand)] text-[var(--status-info-fg)]  font-mono text-[11px] font-bold">
                CLASS 10A1
              </span>
              <span className="text-xs text-[var(--text-secondary)] ">English Language Arts / Academic Year 2026</span>
            </div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]  font-heading">
              Grade 10 - High School English
            </h2>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="text-xs font-medium text-[var(--status-success-fg)]  bg-[var(--status-success-bg)]  border border-[var(--status-success-border)]  px-2.5 py-1 rounded-lg flex items-center gap-1">
              <CheckCircle2 size={13} />
              <span>Active Curriculum Unit</span>
            </span>
          </div>
        </div>

        {
    /* 3 Metrics Cards */
  }
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)]  p-4 space-y-1 transition-colors">
            <span className="text-[11px] font-semibold text-[var(--text-secondary)]  uppercase tracking-wider block">
              Enrolled Students
            </span>
            <div className="text-2xl font-bold text-[var(--text-primary)]  font-mono">12</div>
            <p className="text-[11px] text-[var(--text-secondary)] ">Pseudonymized roster keys (Student 01 to 12)</p>
          </div>

          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)]  p-4 space-y-1 transition-colors">
            <span className="text-[11px] font-semibold text-[var(--text-secondary)]  uppercase tracking-wider block">
              Current Target Standard
            </span>
            <div className="text-base font-bold text-[var(--text-primary)]  truncate">
              Present Perfect vs. Past Simple
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] ">Unit 3: Travel, Experiences &amp; Past Time</p>
          </div>

          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)]  p-4 space-y-1 transition-colors">
            <span className="text-[11px] font-semibold text-[var(--text-secondary)]  uppercase tracking-wider block">
              Completed Analyses
            </span>
            <div className="text-2xl font-bold text-[var(--text-primary)]  font-mono">
              {savedAnalyses.length > 0 ? savedAnalyses.length : "1 Benchmark"}
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] ">Diagnostic exit tickets examined</p>
          </div>
        </div>

        {
    /* Action Row */
  }
        <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)]">
          <span className="text-xs text-[var(--text-secondary)] ">
            Teacher: <strong className="text-[var(--text-primary)] ">Ms. Nguyen Lan Anh</strong>, Room 304
          </span>
          <div className="flex items-center gap-2">
            <button
    onClick={onTryDemo}
    className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--status-info-fg)]  hover:text-[var(--text-primary)]  transition"
  >
              <span>View Latest Diagnostic</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {
    /* Historical Sessions Section */
  }
      <div className="space-y-4">
        <h3 className="text-base font-bold text-[var(--text-primary)]  font-heading">
          Class Diagnostic Sessions
        </h3>

        {savedAnalyses.length === 0 ? <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)]  p-8 text-center text-xs text-[var(--text-secondary)]  transition-colors">
            No session records stored yet. Click &quot;Load Demo Class&quot; to test the Grade 10 English diagnostic.
          </div> : <div className="divide-y divide-[var(--border-subtle)]  rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)]  overflow-hidden shadow-2xs transition-colors">
            {savedAnalyses.map((item) => <div
    key={item.id}
    onClick={() => onSelectSavedAnalysis(item)}
    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-[var(--bg-elevated)]  cursor-pointer transition gap-2"
  >
                <div>
                  <h4 className="text-sm font-bold text-[var(--text-primary)] ">
                    {item.context.lessonTitle}
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)]  mt-0.5">
                    {item.context.learningObjective}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono text-[var(--text-secondary)]  shrink-0">
                  <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                  <span className="font-semibold text-[var(--status-info-fg)] ">Inspect &rarr;</span>
                </div>
              </div>)}
          </div>}
      </div>
    </div>;
};
export {
  ClassesView
};
