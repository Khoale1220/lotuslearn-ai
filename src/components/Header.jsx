import { LotusIcon } from "./icons/LotusIcon";
import { ShieldCheck, PlusCircle, Play } from "lucide-react";
const Header = ({
  currentView,
  onNavigate,
  onOpenResponsibleAI,
  onQuickDemo,
  hasActiveResult,
  onViewResults
}) => {
  return <header className="sticky top-0 z-40 w-full border-b border-[var(--border-decorative)]/90 bg-[var(--bg-surface)]/95 backdrop-blur-md transition-colors">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {
    /* Brand and Product Identity */
  }
        <div className="flex items-center gap-6">
          <button
    onClick={() => onNavigate("landing")}
    className="flex items-center gap-3 text-left transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 rounded-lg p-1"
    aria-label="LotusLearn Home"
  >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--bg-surface)] text-[var(--accent-fg)] shadow-xs border border-[var(--border-decorative)]">
              <LotusIcon size={24} className="text-[var(--accent-fg)]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold tracking-tight text-[var(--text-primary)] ">
                  LotusLearn
                </span>
              </div>
              <p className="text-[11px] font-medium text-[var(--text-secondary)] hidden sm:block">
                Formative Assessment &amp; Teaching Decisions
              </p>
            </div>
          </button>
        </div>

        {
    /* Right Navigation & Task Actions */
  }
        <nav aria-label="Main Navigation" className="flex items-center gap-1.5 sm:gap-2.5">
          <button
    onClick={onOpenResponsibleAI}
    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-interactive)] rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
    title="Responsible AI & Human-in-the-Loop Philosophy"
  >
            <ShieldCheck size={15} className="text-[var(--accent-fg)] " />
            <span className="hidden md:inline">Responsible AI</span>
          </button>

          {hasActiveResult && <button
    onClick={onViewResults}
    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] ${currentView === "results" ? "bg-[var(--accent-subtle)] text-[var(--accent-fg)] font-semibold" : "text-[var(--text-secondary)] hover:bg-[var(--bg-interactive)] hover:text-[var(--text-primary)] "}`}
  >
              Current Analysis
            </button>}

          <button
    onClick={() => onNavigate("dashboard")}
    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] ${currentView === "dashboard" ? "bg-[var(--bg-interactive)] text-[var(--text-primary)] font-semibold" : "text-[var(--text-secondary)] hover:bg-[var(--bg-interactive)] hover:text-[var(--text-primary)] "}`}
  >
            Saved Analyses
          </button>

          <button
    onClick={onQuickDemo}
    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-control)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] shadow-2xs transition hover:bg-[var(--bg-interactive)] hover:border-[var(--border-control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] active:scale-98"
    title="Load Grade 10 English demo classroom with 12 pre-loaded submissions"
  >
            <Play size={13} className="text-[var(--accent-fg)] " />
            <span className="hidden sm:inline">Try Demo</span>
            <span className="sm:hidden">Demo</span>
          </button>

          <button
    onClick={() => onNavigate("new-analysis")}
    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--action-primary-bg)] hover:bg-[var(--action-primary-hover)] px-3.5 py-1.5 text-xs font-semibold text-[var(--action-primary-fg)] shadow-2xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 active:scale-98"
  >
            <PlusCircle size={14} />
            <span>New Analysis</span>
          </button>
        </nav>
      </div>
    </header>;
};
export {
  Header
};
