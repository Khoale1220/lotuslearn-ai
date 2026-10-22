import React from 'react';
import { Menu, Sparkles, PlusCircle, ShieldCheck, FileCheck, CheckCircle2 } from 'lucide-react';
import { NavigationTarget } from './Sidebar';

interface TopBarProps {
  currentView: NavigationTarget;
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
  onQuickDemo,
  onOpenResponsibleAI,
  hasActiveResult,
  activeLessonTitle = 'Grade 10 English · Diagnostic Unit',
}) => {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-200/90 bg-white/95 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Mobile Menu & Breadcrumb Context */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebarMobile}
            className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>

          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-900 truncate max-w-[200px] sm:max-w-xs md:max-w-md">
              {activeLessonTitle}
            </span>
            <span className="text-slate-300 hidden sm:inline" aria-hidden="true">/</span>
            <span className="text-slate-500 hidden sm:inline">
              Diagnostic Assessment
            </span>
          </div>
        </div>

        {/* Right: Functional Context & Quick Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {hasActiveResult && (
            <button
              onClick={() => onNavigate('results')}
              className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                currentView === 'results'
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <FileCheck size={14} className="text-indigo-600" />
              <span>Current Results</span>
            </button>
          )}

          {/* Responsible AI Quick Pill */}
          <button
            onClick={onOpenResponsibleAI}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            title="Inspect Responsible AI Charter and human-in-the-loop governance"
          >
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>Charter</span>
          </button>

          {/* One-Click Golden Demo Button */}
          <button
            onClick={onQuickDemo}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs hover:bg-slate-50 hover:border-slate-400 transition active:scale-98"
            title="Load Grade 10 English demo classroom with 12 real student submissions"
          >
            <Sparkles size={14} className="text-amber-500" />
            <span className="hidden sm:inline">Try Demo Class</span>
            <span className="sm:hidden">Demo</span>
          </button>

          {/* Primary Action Button */}
          <button
            onClick={() => onNavigate('new-analysis')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs transition active:scale-98"
          >
            <PlusCircle size={14} />
            <span className="hidden sm:inline">Analyze Work</span>
            <span className="sm:hidden">Analyze</span>
          </button>
        </div>
      </div>
    </header>
  );
};
