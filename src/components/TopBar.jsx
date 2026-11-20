import { Menu, Moon, PlusCircle, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
const TopBar = ({
  currentView,
  onNavigate,
  onToggleSidebarMobile,
  onOpenResponsibleAI,
  hasActiveResult,
  activeLessonTitle = "Grade 10 English - Diagnostic Unit"
}) => {
  const { resolvedTheme, toggleTheme } = useTheme();
  return <header className="sticky top-0 z-30 w-full border-b border-[var(--border-decorative)] bg-[var(--bg-surface)] transition-colors">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
        {
    /* Left: Mobile Menu & Breadcrumb Context */
  }
        <div className="flex items-center gap-3 min-w-0">
          <button
    onClick={onToggleSidebarMobile}
    className="lg:hidden p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-md hover:bg-[var(--bg-elevated)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
    aria-label="Open navigation menu"
  >
            <Menu size={18} />
          </button>

          <div className="flex items-center gap-2 text-xs min-w-0">
            <span className="font-semibold text-[var(--text-primary)] truncate">
              {activeLessonTitle}
            </span>
            <span className="text-[var(--border-decorative)] hidden sm:inline" aria-hidden="true">/</span>
            <span className="text-[var(--text-secondary)] hidden sm:inline">
              Formative Diagnosis
            </span>
          </div>
        </div>

        {
    /* Right: Focused Header Actions */
  }
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {hasActiveResult && currentView !== "results" && <button
    onClick={() => onNavigate("results")}
    className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-2.5 py-1.5 rounded-md hover:bg-[var(--bg-elevated)] transition"
  >
              View Active Results
            </button>}

          <button
    onClick={onOpenResponsibleAI}
    className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-2 py-1.5 rounded-md transition hidden md:inline-block"
  >
            Audit and Governance
          </button>

          {
    /* Theme Toggle Button */
  }
          <button
    onClick={toggleTheme}
    className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-md hover:bg-[var(--bg-elevated)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
    aria-label={resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
    title={resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
  >
            {resolvedTheme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          {
    /* Primary Action Button */
  }
          {currentView !== "new-analysis" && <button
    onClick={() => onNavigate("new-analysis")}
    className="inline-flex items-center gap-1.5 rounded-md bg-[var(--action-primary-bg)] hover:bg-[var(--action-primary-hover)] px-3 py-1.5 text-xs font-semibold text-[var(--action-primary-fg)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2"
  >
              <PlusCircle size={14} />
              <span>Analyze Work</span>
            </button>}
        </div>
      </div>
    </header>;
};
export {
  TopBar
};
