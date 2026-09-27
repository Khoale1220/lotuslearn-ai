import React from 'react';
import { LotusIcon } from './icons/LotusIcon';
import { Sparkles, ShieldCheck, HelpCircle } from 'lucide-react';

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
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand and Logo */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => onNavigate('landing')}
            className="flex items-center gap-3 text-left transition-opacity hover:opacity-90"
            aria-label="LotusLearn AI Home"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-rose-500 shadow-sm">
              <LotusIcon size={24} className="text-rose-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-slate-900">
                  LotusLearn <span className="text-rose-600 font-extrabold">AI</span>
                </span>
                <span className="hidden text-xs text-slate-500 sm:inline" aria-hidden="true">
                  ·
                </span>
                <span className="hidden text-xs font-medium text-slate-500 sm:inline">
                  Google Cloud AI Builder Cup 2026
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Formative Assessment &amp; Teaching Decision Support
              </p>
            </div>
          </button>
        </div>

        {/* Center / Context Meta */}
        <div className="hidden items-center gap-3 text-xs text-slate-500 md:flex">
          <span className="flex items-center gap-1 font-medium text-slate-600">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
            Gemini 3.8 Flash Engine
          </span>
          <span aria-hidden="true">·</span>
          <span>TTKK • Vietnam</span>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onOpenResponsibleAI}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
            title="Responsible AI & Human-in-the-Loop Philosophy"
          >
            <ShieldCheck size={15} className="text-emerald-600" />
            <span className="hidden sm:inline">Responsible AI</span>
          </button>

          {hasActiveResult && (
            <button
              onClick={onViewResults}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
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
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              currentView === 'dashboard'
                ? 'bg-slate-100 text-slate-900 font-semibold'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Dashboard
          </button>

          <button
            onClick={onQuickDemo}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-400 active:scale-98"
          >
            <Sparkles size={14} className="text-rose-500" />
            <span>Demo Classroom</span>
          </button>

          <button
            onClick={() => onNavigate('new-analysis')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:bg-blue-700 active:scale-98"
          >
            <span>New Analysis</span>
          </button>
        </div>
      </div>
    </header>
  );
};
