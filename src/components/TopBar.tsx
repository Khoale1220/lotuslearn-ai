import React from 'react';
import { Menu, Moon, PlusCircle, Sun } from 'lucide-react';
import { NavigationTarget } from './Sidebar';
import { useTheme } from '../context/ThemeContext';

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
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 transition-colors">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Mobile Menu & Breadcrumb Context */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onToggleSidebarMobile}
            className="lg:hidden p-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            aria-label="Open navigation menu"
          >
            <Menu size={18} />
          </button>

          <div className="flex items-center gap-2 text-xs min-w-0">
            <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
              {activeLessonTitle}
            </span>
            <span className="text-slate-300 dark:text-slate-700 hidden sm:inline" aria-hidden="true">/</span>
            <span className="text-slate-500 dark:text-slate-400 hidden sm:inline">
              Formative Diagnosis
            </span>
          </div>
        </div>

        {/* Right: Focused Header Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {hasActiveResult && currentView !== 'results' && (
            <button
              onClick={() => onNavigate('results')}
              className="text-xs text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white px-2.5 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              View Active Results
            </button>
          )}

          <button
            onClick={onOpenResponsibleAI}
            className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 px-2 py-1.5 rounded-md transition hidden md:inline-block"
          >
            Audit and Governance
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            aria-label={resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {resolvedTheme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          {/* Primary Action Button */}
          {currentView !== 'new-analysis' && (
            <button
              onClick={() => onNavigate('new-analysis')}
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
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
