import React from 'react';
import { Menu, PlusCircle } from 'lucide-react';
import { NavigationTarget } from './Sidebar';

interface TopBarProps {
  currentView: string;
  onNavigate: (view: NavigationTarget) => void;
  onToggleSidebarMobile: () => void;
  onQuickDemo: () => void;
  onOpenResponsibleAI: () => void;
  hasActiveResult: boolean;
  activeLessonTitle?: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentView,
  onNavigate,
  onToggleSidebarMobile,
  onOpenResponsibleAI,
  hasActiveResult,
  activeLessonTitle = 'Grade 10 English - Diagnostic Unit',
}) => {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-200 bg-white">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Mobile Menu & Breadcrumb Context */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onToggleSidebarMobile}
            className="lg:hidden p-1.5 text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            aria-label="Open navigation menu"
          >
            <Menu size={18} />
          </button>

          <div className="flex items-center gap-2 text-xs min-w-0">
            <span className="font-semibold text-slate-900 truncate">
              {activeLessonTitle}
            </span>
            <span className="text-slate-300 hidden sm:inline" aria-hidden="true">/</span>
            <span className="text-slate-500 hidden sm:inline">
              Formative Diagnosis
            </span>
          </div>
        </div>

        {/* Right: Focused Header Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {hasActiveResult && currentView !== 'results' && (
            <button
              onClick={() => onNavigate('results')}
              className="text-xs text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-md hover:bg-slate-100 transition"
            >
              View Active Results
            </button>
          )}

          <button
            onClick={onOpenResponsibleAI}
            className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1.5 rounded-md transition hidden md:inline-block"
          >
            Audit and Governance
          </button>

          {/* Primary Action Button */}
          {currentView !== 'new-analysis' && (
            <button
              onClick={() => onNavigate('new-analysis')}
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 text-xs font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
            >
              <PlusCircle size={14} />
              <span>Analyze Work</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
