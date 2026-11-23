import {
  Home,
  Users,
  UserRound,
  FileText,
  ShieldCheck,
  PlusCircle,
  HelpCircle,
  X
} from "lucide-react";
import { LotusIcon } from "./icons/LotusIcon";
const Sidebar = ({
  activeView,
  onNavigate,
  onQuickDemo,
  onOpenResponsibleAI,
  onOpenHowItWorks,
  hasActiveResult,
  isOpenMobile,
  onCloseMobile
}) => {
  const handleNav = (target) => {
    onNavigate(target);
    onCloseMobile();
  };
  const isCurrent = (target) => activeView === target;
  return <>
      {
    /* Mobile Backdrop */
  }
      {isOpenMobile && <div
    className="fixed inset-0 z-40 bg-[var(--overlay-backdrop)] backdrop-blur-xs lg:hidden"
    onClick={onCloseMobile}
    aria-hidden="true"
  />}

      {
    /* Persistent Sidebar */
  }
      <aside
    className={`fixed top-0 bottom-0 left-0 z-50 w-70 bg-[var(--shell-bg)] text-[var(--shell-text-muted)] flex flex-col border-r border-[var(--shell-border)] transition-transform duration-200 ease-in-out lg:translate-x-0 ${isOpenMobile ? "translate-x-0" : "-translate-x-full"}`}
    aria-label="Main Navigation"
  >
        {
    /* Brand Header */
  }
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--shell-border)]">
          <button
    onClick={() => handleNav("overview")}
    className="flex items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] rounded-md p-1"
  >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--shell-surface)] text-[var(--shell-text)] border border-[var(--shell-border)]">
              <LotusIcon size={18} className="text-[var(--shell-text)]" />
            </div>
            <div>
              <span className="text-sm font-semibold tracking-tight text-[var(--shell-text)] block">
                LotusLearn
              </span>
              <span className="text-[11px] text-[var(--shell-text-muted)] block">
                Formative Diagnostics
              </span>
            </div>
          </button>

          <button
    onClick={onCloseMobile}
    className="lg:hidden p-1.5 text-[var(--shell-text-muted)] hover:text-[var(--shell-text)] rounded-md hover:bg-[var(--shell-surface)] transition"
    aria-label="Close menu"
  >
            <X size={18} />
          </button>
        </div>

        {
    /* Primary Page Action */
  }
        <div className="p-3">
          <button
    onClick={() => handleNav("new-analysis")}
    className={`w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] ${isCurrent("new-analysis") ? "bg-[var(--shell-action-bg)] text-[var(--shell-action-fg)] shadow-xs" : "bg-[var(--shell-action-bg)] hover:bg-[var(--shell-action-hover)] text-[var(--shell-action-fg)]"}`}
  >
            <PlusCircle size={15} />
            <span>Analyze Student Work</span>
          </button>
        </div>

        {
    /* Navigation Sections */
  }
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1 text-xs" aria-label="Durable areas">
          <button
    onClick={() => handleNav("overview")}
    aria-current={isCurrent("overview") ? "page" : void 0}
    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition font-medium ${isCurrent("overview") ? "bg-[var(--shell-surface)] text-[var(--shell-text)] font-semibold border-l-2 border-[var(--shell-active-indicator)] pl-2.5" : "text-[var(--shell-text-muted)] hover:bg-[var(--shell-surface)] hover:text-[var(--shell-text)]"}`}
  >
            <Home size={15} className={isCurrent("overview") ? "text-[var(--shell-active-indicator)]" : "text-[var(--shell-text-muted)]"} />
            <span>Overview</span>
          </button>

          <button
    onClick={() => handleNav("classes")}
    aria-current={isCurrent("classes") ? "page" : void 0}
    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition font-medium ${isCurrent("classes") ? "bg-[var(--shell-surface)] text-[var(--shell-text)] font-semibold border-l-2 border-[var(--shell-active-indicator)] pl-2.5" : "text-[var(--shell-text-muted)] hover:bg-[var(--shell-surface)] hover:text-[var(--shell-text)]"}`}
  >
            <Users size={15} className={isCurrent("classes") ? "text-[var(--shell-active-indicator)]" : "text-[var(--shell-text-muted)]"} />
            <span>Classes</span>
          </button>

          <button
    onClick={() => handleNav("students")}
    aria-current={isCurrent("students") ? "page" : void 0}
    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition font-medium ${isCurrent("students") ? "bg-[var(--shell-surface)] text-[var(--shell-text)] font-semibold border-l-2 border-[var(--shell-active-indicator)] pl-2.5" : "text-[var(--shell-text-muted)] hover:bg-[var(--shell-surface)] hover:text-[var(--shell-text)]"}`}
  >
            <UserRound size={15} className={isCurrent("students") ? "text-[var(--shell-active-indicator)]" : "text-[var(--shell-text-muted)]"} />
            <span>Students</span>
          </button>

          {hasActiveResult && <button
    onClick={() => handleNav("results")}
    aria-current={isCurrent("results") ? "page" : void 0}
    className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition font-medium ${isCurrent("results") ? "bg-[var(--shell-surface)] text-[var(--shell-text)] font-semibold border-l-2 border-[var(--shell-active-indicator)] pl-2.5" : "text-[var(--shell-text-muted)] hover:bg-[var(--shell-surface)] hover:text-[var(--shell-text)]"}`}
  >
              <div className="flex items-center gap-2.5">
                <FileText size={15} className={isCurrent("results") ? "text-[var(--shell-active-indicator)]" : "text-[var(--shell-text-muted)]"} />
                <span>Results</span>
              </div>
              <span className="text-[10px] text-[var(--shell-text-muted)] bg-[var(--shell-surface)] px-1.5 py-0.5 rounded border border-[var(--shell-border)]">
                Current
              </span>
            </button>}

          <div className="pt-4 pb-1">
            <span className="px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--shell-text-muted)]">
              System
            </span>
          </div>

          <button
    onClick={() => handleNav("privacy")}
    aria-current={isCurrent("privacy") ? "page" : void 0}
    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition font-medium ${isCurrent("privacy") ? "bg-[var(--shell-surface)] text-[var(--shell-text)] font-semibold border-l-2 border-[var(--shell-active-indicator)] pl-2.5" : "text-[var(--shell-text-muted)] hover:bg-[var(--shell-surface)] hover:text-[var(--shell-text)]"}`}
  >
            <ShieldCheck size={15} className={isCurrent("privacy") ? "text-[var(--shell-active-indicator)]" : "text-[var(--shell-text-muted)]"} />
            <span>Privacy and Boundaries</span>
          </button>
        <button
  onClick={() => handleNav("classroom-world")}
  aria-current={isCurrent("classroom-world") ? "page" : void 0}
  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition font-medium ${isCurrent("classroom-world") ? "bg-[var(--shell-surface)] text-[var(--shell-text)] font-semibold border-l-2 border-[var(--shell-active-indicator)] pl-2.5" : "text-[var(--shell-text-muted)] hover:bg-[var(--shell-surface)] hover:text-[var(--shell-text)]"}`}
>
  <span
    aria-hidden="true"
    className={`w-[15px] text-center text-[9px] font-black ${isCurrent("classroom-world") ? "text-[var(--shell-active-indicator)]" : "text-[var(--shell-text-muted)]"}`}
  >
    3D
  </span>
  <span>Classroom World</span>
</button>
        </nav>

        {
    /* Secondary Sample Exploration */
  }
        <div className="p-3 border-t border-[var(--shell-border)] space-y-2">
          <button
    onClick={onQuickDemo}
    className="w-full flex items-center justify-between px-3 py-2 rounded-md text-xs text-[var(--shell-text-muted)] bg-[var(--shell-surface)] hover:bg-[var(--shell-surface)] border border-[var(--shell-border)] hover:text-[var(--shell-text)] transition"
  >
            <span>Load Demo Dataset</span>
            <span className="text-[10px] text-[var(--shell-text-muted)]">12 items</span>
          </button>

          <div className="flex items-center justify-between px-1 text-[11px] text-[var(--shell-text-muted)] pt-1">
            <button
    onClick={onOpenHowItWorks}
    className="flex items-center gap-1 hover:text-[var(--shell-text)] transition"
  >
              <HelpCircle size={12} />
              <span>Methodology</span>
            </button>
            <button
    onClick={onOpenResponsibleAI}
    className="hover:text-[var(--shell-text)] transition underline underline-offset-2"
  >
              Charter
            </button>
          </div>

          {
    /* Compact Teacher Identity */
  }
          <div className="flex items-center gap-2.5 pt-1 px-1">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--shell-surface)] text-[var(--shell-text-muted)] font-semibold text-[10px] border border-[var(--shell-border)]">
              LA
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-[var(--shell-text)] truncate">
                Ms. Lan Anh
              </p>
              <p className="text-[10px] text-[var(--shell-text-muted)] truncate">
                Grade 10 English
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>;
};
export {
  Sidebar
};
