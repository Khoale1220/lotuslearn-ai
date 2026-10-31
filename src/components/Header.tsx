import React from 'react';
import { LotusIcon } from './icons/LotusIcon';
import { ShieldCheck, PlusCircle, Play } from 'lucide-react';

interface HeaderProps {
  currentView: 'landing' | 'dashboard' | 'new-analysis' | 'processing' | 'results';
  onNavigate: (view: 'landing' | 'dashboard' | 'new-analysis') => void;
  onOpenResponsibleAI: () => void;
  onQuickDemo: () => void;
  hasActiveResult?: boolean;
  onViewResults?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigate,
  onOpenResponsibleAI,
  onQuickDemo,
  hasActiveResult,
  onViewResults,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md transition-colors">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand and Product Identity */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => onNavigate('landing')}
            className="flex items-center gap-3 text-left transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 rounded-lg p-1"
            aria-label="LotusLearn Home"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-rose-400 shadow-xs border border-slate-800">
              <LotusIcon size={24} className="text-rose-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  LotusLearn
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hidden sm:block">
                Formative Assessment &amp; Teaching Decisions
              </p>
            </div>
          </button>
        </div>

        {/* Right Navigation & Task Actions */}
        <nav aria-label="Main Navigation" className="flex items-center gap-1.5 sm:gap-2.5">
          <button
            onClick={onOpenResponsibleAI}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            title="Responsible AI & Human-in-the-Loop Philosophy"
          >
            <ShieldCheck size={15} className="text-emerald-600 dark:text-emerald-400" />
            <span className="hidden md:inline">Responsible AI</span>
          </button>

          {hasActiveResult && (
            <button
              onClick={onViewResults}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                currentView === 'results'
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Current Analysis
            </button>
          )}

          <button
            onClick={() => onNavigate('dashboard')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
              currentView === 'dashboard'
                ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white font-semibold'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Saved Analyses
          </button>

          <button
            onClick={onQuickDemo}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 shadow-2xs transition hover:bg-slate-50 dark:hover:bg-slate-750 hover:border-slate-400 dark:hover:border-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 active:scale-98"
            title="Load Grade 10 English demo classroom with 12 pre-loaded submissions"
          >
            <Play size={13} className="text-indigo-600 dark:text-indigo-400" />
            <span className="hidden sm:inline">Try Demo</span>
            <span className="sm:hidden">Demo</span>
          </button>

          <button
            onClick={() => onNavigate('new-analysis')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 active:scale-98"
          >
            <PlusCircle size={14} />
            <span>New Analysis</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
