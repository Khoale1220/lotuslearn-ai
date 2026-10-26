import React from 'react';
import {
  Home,
  Users,
  UserRound,
  FileText,
  ShieldCheck,
  PlusCircle,
  HelpCircle,
  X,
} from 'lucide-react';
import { LotusIcon } from './icons/LotusIcon';

export type NavigationTarget =
  | 'overview'
  | 'new-analysis'
  | 'classes'
  | 'students'
  | 'results'
  | 'privacy';

interface SidebarProps {
  activeView: string;
  onNavigate: (view: NavigationTarget) => void;
  onQuickDemo: () => void;
  onOpenResponsibleAI: () => void;
  onOpenHowItWorks: () => void;
  hasActiveResult: boolean;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onNavigate,
  onQuickDemo,
  onOpenResponsibleAI,
  onOpenHowItWorks,
  hasActiveResult,
  isOpenMobile,
  onCloseMobile,
}) => {
  const handleNav = (target: NavigationTarget) => {
    onNavigate(target);
    onCloseMobile();
  };

  const isCurrent = (target: string) => activeView === target;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Persistent Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-70 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Main Navigation"
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <button
            onClick={() => handleNav('overview')}
            className="flex items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 rounded-md p-1"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-100 border border-slate-700">
              <LotusIcon size={18} className="text-slate-100" />
            </div>
            <div>
              <span className="text-sm font-semibold tracking-tight text-white block">
                LotusLearn
              </span>
              <span className="text-[11px] text-slate-400 block">
                Formative Diagnostics
              </span>
            </div>
          </button>

          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Primary Page Action */}
        <div className="p-3">
          <button
            onClick={() => handleNav('new-analysis')}
            className={`w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 ${
              isCurrent('new-analysis')
                ? 'bg-slate-100 text-slate-900 shadow-xs'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
          >
            <PlusCircle size={15} />
            <span>Analyze Student Work</span>
          </button>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1 text-xs" aria-label="Durable areas">
          <button
            onClick={() => handleNav('overview')}
            aria-current={isCurrent('overview') ? 'page' : undefined}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition font-medium ${
              isCurrent('overview')
                ? 'bg-slate-800 text-white font-semibold border-l-2 border-indigo-400 pl-2.5'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <Home size={15} className={isCurrent('overview') ? 'text-indigo-400' : 'text-slate-400'} />
            <span>Overview</span>
          </button>

          <button
            onClick={() => handleNav('classes')}
            aria-current={isCurrent('classes') ? 'page' : undefined}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition font-medium ${
              isCurrent('classes')
                ? 'bg-slate-800 text-white font-semibold border-l-2 border-indigo-400 pl-2.5'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <Users size={15} className={isCurrent('classes') ? 'text-indigo-400' : 'text-slate-400'} />
            <span>Classes</span>
          </button>

          <button
            onClick={() => handleNav('students')}
            aria-current={isCurrent('students') ? 'page' : undefined}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition font-medium ${
              isCurrent('students')
                ? 'bg-slate-800 text-white font-semibold border-l-2 border-indigo-400 pl-2.5'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <UserRound size={15} className={isCurrent('students') ? 'text-indigo-400' : 'text-slate-400'} />
            <span>Students</span>
          </button>

          {hasActiveResult && (
            <button
              onClick={() => handleNav('results')}
              aria-current={isCurrent('results') ? 'page' : undefined}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition font-medium ${
                isCurrent('results')
                  ? 'bg-slate-800 text-white font-semibold border-l-2 border-indigo-400 pl-2.5'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileText size={15} className={isCurrent('results') ? 'text-indigo-400' : 'text-slate-400'} />
                <span>Results</span>
              </div>
              <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                Current
              </span>
            </button>
          )}

          <div className="pt-4 pb-1">
            <span className="px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              System
            </span>
          </div>

          <button
            onClick={() => handleNav('privacy')}
            aria-current={isCurrent('privacy') ? 'page' : undefined}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition font-medium ${
              isCurrent('privacy')
                ? 'bg-slate-800 text-white font-semibold border-l-2 border-indigo-400 pl-2.5'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <ShieldCheck size={15} className={isCurrent('privacy') ? 'text-indigo-400' : 'text-slate-400'} />
            <span>Privacy and Boundaries</span>
          </button>
        </nav>

        {/* Secondary Sample Exploration */}
        <div className="p-3 border-t border-slate-800 space-y-2">
          <button
            onClick={onQuickDemo}
            className="w-full flex items-center justify-between px-3 py-2 rounded-md text-xs text-slate-300 bg-slate-800/70 hover:bg-slate-800 border border-slate-700/80 hover:text-white transition"
          >
            <span>Load Demo Dataset</span>
            <span className="text-[10px] text-slate-400">12 items</span>
          </button>

          <div className="flex items-center justify-between px-1 text-[11px] text-slate-400 pt-1">
            <button
              onClick={onOpenHowItWorks}
              className="flex items-center gap-1 hover:text-white transition"
            >
              <HelpCircle size={12} />
              <span>Methodology</span>
            </button>
            <button
              onClick={onOpenResponsibleAI}
              className="hover:text-white transition underline underline-offset-2"
            >
              Charter
            </button>
          </div>

          {/* Compact Teacher Identity */}
          <div className="flex items-center gap-2.5 pt-1 px-1">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-slate-300 font-semibold text-[10px] border border-slate-700">
              LA
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-200 truncate">
                Ms. Lan Anh
              </p>
              <p className="text-[10px] text-slate-500 truncate">
                Grade 10 English
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
