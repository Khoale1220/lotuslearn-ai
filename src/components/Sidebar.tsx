import React from 'react';
import {
  Home,
  FileSearch,
  Users,
  UserRound,
  Brain,
  UsersRound,
  BookOpen,
  FileCheck,
  ShieldCheck,
  HelpCircle,
  Sparkles,
  ChevronRight,
  GraduationCap,
  X,
} from 'lucide-react';
import { LotusIcon } from './icons/LotusIcon';

export type NavigationTarget =
  | 'overview'
  | 'new-analysis'
  | 'classes'
  | 'students'
  | 'results'
  | 'misconceptions'
  | 'interventions'
  | 'lesson-plans'
  | 'evidence'
  | 'privacy';

interface SidebarProps {
  activeView: NavigationTarget;
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

  const isCurrent = (target: NavigationTarget) => activeView === target;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Persistent Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-70 bg-[#0F172A] text-slate-300 flex flex-col border-r border-slate-800 transition-transform duration-250 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Application Sidebar"
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800/80">
          <button
            onClick={() => handleNav('overview')}
            className="flex items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-lg p-1"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-md shadow-indigo-950/50">
              <LotusIcon size={22} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold tracking-tight text-white font-heading">
                  LotusLearn
                </span>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  AI
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-400">
                Diagnostic Assessment Platform
              </p>
            </div>
          </button>

          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Primary Action Button (Prominent Analyze Work CTA) */}
        <div className="p-4 pb-2">
          <button
            onClick={() => handleNav('new-analysis')}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white text-xs font-semibold shadow-md shadow-indigo-950/60 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            <FileSearch size={16} />
            <span>Analyze Student Work</span>
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-6 text-xs">
          {/* Section: Product */}
          <div className="space-y-1">
            <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Product
            </span>

            <button
              onClick={() => handleNav('overview')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors font-medium ${
                isCurrent('overview')
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Home size={16} className={isCurrent('overview') ? 'text-indigo-400' : 'text-slate-400'} />
                <span>Overview</span>
              </div>
            </button>

            <button
              onClick={() => handleNav('classes')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors font-medium ${
                isCurrent('classes')
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Users size={16} className={isCurrent('classes') ? 'text-indigo-400' : 'text-slate-400'} />
                <span>Classes</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded">
                Grade 10
              </span>
            </button>

            <button
              onClick={() => handleNav('students')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors font-medium ${
                isCurrent('students')
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <UserRound size={16} className={isCurrent('students') ? 'text-indigo-400' : 'text-slate-400'} />
                <span>Students</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded">
                12 active
              </span>
            </button>
          </div>

          {/* Section: Insights (Active Analysis) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Insights
              </span>
              {hasActiveResult && (
                <span className="inline-flex items-center gap-1 text-[9px] font-mono font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-1.5 py-0.5 rounded">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Active
                </span>
              )}
            </div>

            <button
              onClick={() => handleNav('misconceptions')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors font-medium ${
                isCurrent('misconceptions')
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Brain size={16} className={isCurrent('misconceptions') ? 'text-indigo-400' : 'text-slate-400'} />
                <span>Misconceptions</span>
              </div>
            </button>

            <button
              onClick={() => handleNav('interventions')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors font-medium ${
                isCurrent('interventions')
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <UsersRound size={16} className={isCurrent('interventions') ? 'text-indigo-400' : 'text-slate-400'} />
                <span>Intervention Groups</span>
              </div>
            </button>

            <button
              onClick={() => handleNav('lesson-plans')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors font-medium ${
                isCurrent('lesson-plans')
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <BookOpen size={16} className={isCurrent('lesson-plans') ? 'text-indigo-400' : 'text-slate-400'} />
                <span>Lesson Plans</span>
              </div>
              <span className="text-[10px] font-mono text-indigo-300 bg-indigo-950/60 px-1.5 py-0.5 rounded">
                25 min
              </span>
            </button>
          </div>

          {/* Section: Trust & Governance */}
          <div className="space-y-1">
            <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Trust &amp; Governance
            </span>

            <button
              onClick={() => handleNav('evidence')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors font-medium ${
                isCurrent('evidence')
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileCheck size={16} className={isCurrent('evidence') ? 'text-emerald-400' : 'text-slate-400'} />
                <span>Evidence Citations</span>
              </div>
            </button>

            <button
              onClick={() => handleNav('privacy')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors font-medium ${
                isCurrent('privacy')
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck size={16} className={isCurrent('privacy') ? 'text-emerald-400' : 'text-slate-400'} />
                <span>Privacy &amp; AI Boundary</span>
              </div>
            </button>
          </div>

          {/* Golden Demo Quick Launcher */}
          <div className="pt-2">
            <button
              onClick={onQuickDemo}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-gradient-to-br from-slate-800/90 to-indigo-950/50 border border-slate-700/80 hover:border-indigo-500/50 text-left transition group"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                  <Sparkles size={14} className="text-amber-400 shrink-0" />
                  <span>Try Classroom Demo</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  12 Vietnamese G10 English submissions
                </p>
              </div>
              <ChevronRight size={14} className="text-slate-400 group-hover:text-white group-hover:translate-x-0.5 transition" />
            </button>
          </div>
        </div>

        {/* Sidebar Bottom: Help, Charter & Teacher Profile */}
        <div className="p-3 border-t border-slate-800/80 space-y-2 bg-[#0A0F1D]/80">
          <div className="flex items-center justify-between px-2 text-[11px] text-slate-400">
            <button
              onClick={onOpenHowItWorks}
              className="flex items-center gap-1.5 hover:text-white transition"
            >
              <HelpCircle size={13} />
              <span>How it works</span>
            </button>
            <button
              onClick={onOpenResponsibleAI}
              className="hover:text-white transition underline underline-offset-2"
            >
              Charter
            </button>
          </div>

          {/* Teacher Profile Card */}
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-900/60 text-indigo-300 font-bold text-xs border border-indigo-700/50">
              LA
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">
                Ms. Lan Anh
              </p>
              <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                <GraduationCap size={10} className="text-slate-400" />
                Grade 10 English Teacher
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
