import React from 'react';
import { LotusIcon } from './icons/LotusIcon';
import { Sparkles, ShieldCheck, PlusCircle } from 'lucide-react';

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
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/90 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand and Product Identity */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => onNavigate('landing')}
            className="flex items-center gap-3 text-left transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 rounded-lg p-1"
            aria-label="LotusLearn AI Home"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-rose-400 shadow-xs">
              <LotusIcon size={24} className="text-rose-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold tracking-tight text-slate-900">
                  LotusLearn <span className="text-rose-600 font-extrabold">AI</span>
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-500 hidden sm:block">
                Formative Assessment &amp; Teaching Decisions
              </p>
            </div>
          </button>
        </div>

        {/* Right Navigation & Task Actions */}
        <nav aria-label="Main Navigation" className="flex items-center gap-1.5 sm:gap-2.5">
          <button
            onClick={onOpenResponsibleAI}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            title="Responsible AI & Human-in-the-Loop Philosophy"
          >
            <ShieldCheck size={15} className="text-emerald-600" />
            <span className="hidden md:inline">Responsible AI</span>
          </button>

          {hasActiveResult && (
            <button
              onClick={onViewResults}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                currentView === 'results'
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              Current Analysis
            </button>
          )}

          <button
            onClick={() => onNavigate('dashboard')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
              currentView === 'dashboard'
                ? 'bg-slate-100 text-slate-900 font-semibold'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Saved Analyses
          </button>

          <button
            onClick={onQuickDemo}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-2xs transition hover:bg-slate-50 hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 active:scale-98"
            title="Load Grade 10 English demo classroom with 12 pre-loaded submissions"
          >
            <Sparkles size={14} className="text-rose-500" />
            <span className="hidden sm:inline">Try Demo</span>
            <span className="sm:hidden">Demo</span>
          </button>

          <button
            onClick={() => onNavigate('new-analysis')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 active:scale-98"
          >
            <PlusCircle size={14} />
            <span>New Analysis</span>
          </button>
        </nav>
      </div>
    </header>
  );
};

