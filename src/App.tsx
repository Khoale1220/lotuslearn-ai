import React, { useState, useEffect } from 'react';
import { Sidebar, NavigationTarget } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { OverviewDashboard } from './components/OverviewDashboard';
import { NewAnalysisWizard } from './components/NewAnalysisWizard';
import { PipelineVisualizer } from './components/PipelineVisualizer';
import { ResultsView } from './components/ResultsView';
import { ClassesView } from './components/views/ClassesView';
import { StudentsView } from './components/views/StudentsView';
import { PrivacyTrustView } from './components/views/PrivacyTrustView';
import { ResponsibleAIModal } from './components/ResponsibleAIModal';
import { HowItWorksModal } from './components/HowItWorksModal';
import {
  ClassAnalysisResult,
  DifferentiatedIntervention,
  LearningContext,
  StudentSubmission,
  SavedSession,
  TeacherDecision,
} from './types';
import { DEMO_CONTEXT, DEMO_SUBMISSIONS } from './data/demoClassroom';
import { getCanonicalTeacherDecision } from './utils/verificationDisplay';

export default function App() {
  const [currentView, setCurrentView] = useState<NavigationTarget>('overview');

  const [activeAnalysis, setActiveAnalysis] = useState<ClassAnalysisResult | null>(null);
  const [rawSubmissions, setRawSubmissions] = useState<StudentSubmission[]>([]);
  const [cachedSubmissions, setCachedSubmissions] = useState<StudentSubmission[]>([]);
  const [activeContext, setActiveContext] = useState<LearningContext | null>(null);
  const [savedAnalyses, setSavedAnalyses] = useState<ClassAnalysisResult[]>([]);
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);

  // Pipeline execution state
  const [pipelineStage, setPipelineStage] = useState<number>(1);
  const [pipelineDetail, setPipelineDetail] = useState<string>('');
  const [pipelineError, setPipelineError] = useState<
    string | { message: string; code?: string; stage?: string; retryable?: boolean } | null
  >(null);

  // Modals and accessibility announcements
  const [isResponsibleAIModalOpen, setIsResponsibleAIModalOpen] = useState(false);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);
  const [initialDemoLoad, setInitialDemoLoad] = useState(false);
  const [statusAnnouncement, setStatusAnnouncement] = useState<string>('');

  // Load saved sessions from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('lotuslearn_sessions');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sessions: SavedSession[] = parsed.map((item: any) => {
            const res = (item.result || item) as ClassAnalysisResult;
            const normalizedClusters = (res.misconceptionClusters || []).map((c: any) => {
              const canonical = getCanonicalTeacherDecision(c);
              return {
                ...c,
                status: canonical,
                teacherDecision: canonical,
              };
            });
            const normalizedInterventions = (res.interventions || []).map((i: any) => {
              const canonical = getCanonicalTeacherDecision(i);
              return {
                ...i,
                status: canonical,
                teacherDecision: canonical,
              };
            });
            const normalizedResult: ClassAnalysisResult = {
              ...res,
              misconceptionClusters: normalizedClusters,
              interventions: normalizedInterventions,
            };

            const sanitizedEvidenceList: StudentSubmission[] =
              item.sanitizedSubmissions || [];

            return {
              result: normalizedResult,
              sanitizedSubmissions: sanitizedEvidenceList,
              savedAt: item.savedAt || item.timestamp || new Date().toISOString(),
            };
          });
          setSavedSessions(sessions);
          const analyses = sessions.map((s) => s.result);
          setSavedAnalyses(analyses);
          setActiveAnalysis(analyses[0]);
          setCachedSubmissions(sessions[0].sanitizedSubmissions || []);
        }
      }
    } catch (err) {
      console.error('Failed to restore saved analyses:', err);
    }
  }, []);

  // Save analysis sessions to localStorage: store ONLY sanitized derived data, never raw text or images
  const saveAnalysis = (newResult: ClassAnalysisResult) => {
    // Zero raw PII in persistent storage: browser persistence is constructed
    // strictly from trusted sanitized server output (normalizedSourceEvidence).
    // Raw user inputs, unredacted names, and raw uploaded images are never stored in localStorage.
    const sanitizedSubmissionsToCache: StudentSubmission[] =
      newResult.normalizedSourceEvidence && newResult.normalizedSourceEvidence.length > 0
        ? newResult.normalizedSourceEvidence.map((evidence) => ({
            studentId: evidence.studentId,
            studentText: evidence.extractedText,
            workType: evidence.sourceType === 'image_transcription' ? 'handwritten_work' : 'typed',
          }))
        : (newResult.studentObservations || []).map((obs) => ({
            studentId: obs.studentId,
            studentText: obs.supportingEvidence?.[0]?.quoteOrDetail || '',
            workType: 'typed',
          }));

    const sessionObj: SavedSession = {
      result: newResult,
      sanitizedSubmissions: sanitizedSubmissionsToCache,
      savedAt: new Date().toISOString(),
    };

    setSavedSessions((prev) => {
      const updated = [sessionObj, ...prev.filter((p) => p.result.id !== newResult.id)];
      try {
        localStorage.setItem('lotuslearn_sessions', JSON.stringify(updated.slice(0, 10)));
      } catch (e) {
        console.error('Failed to cache session:', e);
      }
      return updated;
    });

    setSavedAnalyses((prev) => [newResult, ...prev.filter((p) => p.id !== newResult.id)]);
    setCachedSubmissions(sanitizedSubmissionsToCache);
  };

  // Run full multi-stage pipeline via SSE stream with fallback
  const startPipelineAnalysis = async (
    context: LearningContext,
    submissions: StudentSubmission[]
  ) => {
    setActiveContext(context);
    setRawSubmissions(submissions);
    setPipelineStage(1);
    setPipelineDetail('Initializing server-side Gemini 3.8 Flash pipeline...');
    setPipelineError(null);
    setCurrentView('processing' as any);

    try {
      // Attempt SSE streaming for live visual progression
      const response = await fetch('/api/analyze-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, submissions }),
      });

      if (!response.ok) {
        // Enforce Load Protection & Rate Limiting Contract:
        // Never fall back to synchronous /api/analyze on HTTP 429, 400, or any 4xx client errors.
        // Doing so duplicates load on an already-rejected request.
        const errJson = await response.json().catch(() => ({}));
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const rateLimitMsg = retryAfter
            ? `Inference rate limit exceeded. Please wait ${retryAfter} seconds before submitting again.`
            : (errJson.message || errJson.error?.message || 'Rate limit exceeded. Please wait a moment before trying again.');
          setPipelineError(rateLimitMsg);
          return;
        }

        if (response.status >= 400 && response.status < 500) {
          const clientErrMsg =
            errJson.message ||
            errJson.error?.message ||
            (response.status === 413
              ? 'Submission payload too large. Please reduce the number or size of submitted files.'
              : `Request failed (HTTP ${response.status})`);
          setPipelineError(clientErrMsg);
          return;
        }

        // On HTTP 5xx errors from the server, do not hammer the server with duplicate requests
        const serverErrMsg =
          errJson.message ||
          errJson.error?.message ||
          `Server error encountered during analysis (HTTP ${response.status})`;
        setPipelineError(serverErrMsg);
        return;
      }

      if (!response.body) {
        // Only if connection succeeded with 200 OK but ReadableStream is unsupported in legacy client environment,
        // fall back to standard synchronous POST
        const fallbackRes = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context, submissions }),
        });

        if (!fallbackRes.ok) {
          const errData = await fallbackRes.json().catch(() => ({}));
          setPipelineError(
            errData.code ? errData : (errData.error || errData.message || `HTTP error ${fallbackRes.status}`)
          );
          return;
        }

        const data: ClassAnalysisResult = await fallbackRes.json();
        setActiveAnalysis(data);
        saveAnalysis(data);
        setCurrentView('results');
        return;
      }

      // Read SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const evtBlock of events) {
          const lines = evtBlock.split('\n');
          let eventType = '';
          let dataStr = '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('event:')) {
              eventType = trimmed.substring(6).trim();
            } else if (trimmed.startsWith('data:')) {
              dataStr = trimmed.substring(5).trim();
            }
          }

          if (dataStr) {
            let parsedData: any = null;
            try {
              parsedData = JSON.parse(dataStr);
            } catch (parseErr) {
              console.warn('SSE parsing warning:', parseErr, dataStr);
              continue;
            }

            if (eventType === 'progress') {
              setPipelineStage(parsedData.stage || 1);
              setPipelineDetail(parsedData.detail || parsedData.stageName || '');
            } else if (eventType === 'complete') {
              setActiveAnalysis(parsedData);
              saveAnalysis(parsedData);
              setPipelineStage(7);
              setTimeout(() => {
                setCurrentView('results');
              }, 600);
            } else if (eventType === 'error') {
              console.error('[LotusLearn AI] SSE pipeline stage error:', parsedData);
              setPipelineError(parsedData.code ? parsedData : (parsedData.message || 'Pipeline stage failed'));
              return;
            }
          }
        }
      }
    } catch (err: any) {
      console.error('[LotusLearn AI] Pipeline execution error:', err);
      setPipelineError(
        err.code ? err : (err.message || 'A network or model error occurred during the analysis pipeline.')
      );
    }
  };

  // Launch Demo Classroom path directly
  const handleQuickDemo = () => {
    startPipelineAnalysis(DEMO_CONTEXT, DEMO_SUBMISSIONS);
  };

  // Adjust intervention with server-side Gemini
  const handleAdjustIntervention = async (
    intervention: DifferentiatedIntervention,
    action: 'simplify' | 'challenge' | 'exit_ticket'
  ) => {
    try {
      const res = await fetch('/api/intervention/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intervention, action }),
      });

      if (!res.ok) {
        throw new Error('Failed to adjust intervention');
      }

      const updated = await res.json();
      if (activeAnalysis) {
        const newInterventions = activeAnalysis.interventions.map((i) =>
          i.interventionId === intervention.interventionId ? updated : i
        );
        const updatedResult = {
          ...activeAnalysis,
          interventions: newInterventions,
        };
        setActiveAnalysis(updatedResult);
        saveAnalysis(updatedResult);
      }
    } catch (err) {
      console.error('Error adjusting intervention:', err);
    }
  };

  // Human-in-the-loop: update misconception status and/or title
  const handleUpdateMisconceptionStatus = (
    clusterId: string,
    status: TeacherDecision,
    newTitle?: string
  ) => {
    if (!activeAnalysis) return;
    const nowIso = new Date().toISOString();
    const updatedClusters = activeAnalysis.misconceptionClusters.map((c) => {
      if (c.clusterId === clusterId) {
        return {
          ...c,
          status,
          teacherDecision: status,
          decisionRecordedAt: nowIso,
          misconceptionTitle:
            newTitle && newTitle.trim() ? newTitle.trim() : c.misconceptionTitle,
        };
      }
      return c;
    });
    const updated = {
      ...activeAnalysis,
      misconceptionClusters: updatedClusters,
    };
    setActiveAnalysis(updated);
    saveAnalysis(updated);
  };

  // Human-in-the-loop: update intervention status
  const handleUpdateInterventionStatus = (
    interventionId: string,
    status: TeacherDecision
  ) => {
    if (!activeAnalysis) return;
    const nowIso = new Date().toISOString();
    const updatedInterventions = activeAnalysis.interventions.map((i) =>
      i.interventionId === interventionId
        ? { ...i, status, teacherDecision: status, decisionRecordedAt: nowIso }
        : i
    );
    const updated = {
      ...activeAnalysis,
      interventions: updatedInterventions,
    };
    setActiveAnalysis(updated);
    saveAnalysis(updated);
  };

  // Flexible Navigation Dispatcher
  const handleNavigate = (target: NavigationTarget) => {
    if (target === 'results' && !activeAnalysis) {
      handleQuickDemo();
      return;
    }
    setCurrentView(target);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 flex font-sans selection:bg-indigo-100 selection:text-indigo-900 transition-colors">
      {/* Persistent Desktop Sidebar */}
      <Sidebar
        activeView={currentView}
        onNavigate={handleNavigate}
        onQuickDemo={handleQuickDemo}
        onOpenResponsibleAI={() => setIsResponsibleAIModalOpen(true)}
        onOpenHowItWorks={() => setIsHowItWorksOpen(true)}
        hasActiveResult={!!activeAnalysis}
        isOpenMobile={isSidebarOpenMobile}
        onCloseMobile={() => setIsSidebarOpenMobile(false)}
      />

      {/* Main App Layout (offset on desktop by sidebar width 280px / lg:pl-70) */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-70">
        {/* Restrained Top Navigation Bar */}
        <TopBar
          currentView={currentView}
          onNavigate={handleNavigate}
          onToggleSidebarMobile={() => setIsSidebarOpenMobile(true)}
          onQuickDemo={handleQuickDemo}
          onOpenResponsibleAI={() => setIsResponsibleAIModalOpen(true)}
          hasActiveResult={!!activeAnalysis}
          activeLessonTitle={activeAnalysis?.context.lessonTitle}
        />

        {/* Accessibility Announcement Region */}
        <div role="status" aria-live="polite" className="sr-only">
          {statusAnnouncement}
        </div>

        {/* Dynamic Content Views */}
        <main className="flex-1">
          {currentView === 'overview' && (
            <OverviewDashboard
              onStartAnalysis={() => {
                setInitialDemoLoad(false);
                setCurrentView('new-analysis');
              }}
              onTryDemo={handleQuickDemo}
              onSelectSavedAnalysis={(analysis) => {
                const matched = savedSessions.find((s) => s.result.id === analysis.id);
                setActiveAnalysis(analysis);
                setCachedSubmissions(matched?.sanitizedSubmissions || []);
                setCurrentView('results');
              }}
              savedAnalyses={savedAnalyses}
              onOpenHowItWorks={() => setIsHowItWorksOpen(true)}
            />
          )}

          {currentView === 'classes' && (
            <ClassesView
              onStartAnalysis={() => {
                setInitialDemoLoad(false);
                setCurrentView('new-analysis');
              }}
              onTryDemo={handleQuickDemo}
              onSelectSavedAnalysis={(analysis) => {
                const matched = savedSessions.find((s) => s.result.id === analysis.id);
                setActiveAnalysis(analysis);
                setCachedSubmissions(matched?.sanitizedSubmissions || []);
                setCurrentView('results');
              }}
              savedAnalyses={savedAnalyses}
            />
          )}

          {currentView === 'students' && (
            <StudentsView
              analysis={activeAnalysis}
              onTryDemo={handleQuickDemo}
              onInspectStudent={(studentId) => {
                if (activeAnalysis) {
                  setCurrentView('results');
                }
              }}
            />
          )}

          {currentView === 'privacy' && (
            <PrivacyTrustView
              onOpenCharter={() => setIsResponsibleAIModalOpen(true)}
            />
          )}

          {currentView === 'new-analysis' && (
            <NewAnalysisWizard
              onCancel={() => setCurrentView('overview')}
              onStartAnalysis={(context, submissions) =>
                startPipelineAnalysis(context, submissions)
              }
              initialDemoLoad={initialDemoLoad}
            />
          )}

          {(currentView as string) === 'processing' && (
            <PipelineVisualizer
              currentStage={pipelineStage}
              currentDetail={pipelineDetail}
              errorMessage={pipelineError || undefined}
              onRetry={() => {
                if (activeContext && rawSubmissions.length > 0) {
                  startPipelineAnalysis(activeContext, rawSubmissions);
                }
              }}
              onCancel={() => setCurrentView('new-analysis')}
            />
          )}

          {currentView === 'results' && activeAnalysis && (
            <ResultsView
              result={activeAnalysis}
              sanitizedSubmissions={cachedSubmissions}
              rawSubmissions={cachedSubmissions}
              onBackToDashboard={() => setCurrentView('overview')}
              onNewAnalysis={() => {
                setInitialDemoLoad(false);
                setCurrentView('new-analysis');
              }}
              onAdjustIntervention={handleAdjustIntervention}
              onUpdateMisconceptionStatus={handleUpdateMisconceptionStatus}
              onUpdateInterventionStatus={handleUpdateInterventionStatus}
            />
          )}
        </main>

        {/* Global Restrained Footer */}
        <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 py-6 text-xs text-slate-500 dark:text-slate-400 transition-colors">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800 dark:text-slate-200">LotusLearn</span>
              <span className="text-slate-300 dark:text-slate-700">/</span>
              <span>Evidence-grounded formative assessment</span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-slate-500 dark:text-slate-400">
              <button
                onClick={() => setIsHowItWorksOpen(true)}
                className="hover:text-slate-900 dark:hover:text-slate-200 transition"
              >
                6-Stage Pipeline
              </button>
              <button
                onClick={() => setCurrentView('privacy')}
                className="hover:text-slate-900 dark:hover:text-slate-200 transition"
              >
                Privacy Model
              </button>
              <button
                onClick={() => setIsResponsibleAIModalOpen(true)}
                className="hover:text-slate-900 dark:hover:text-slate-200 underline underline-offset-2"
              >
                Responsible AI Charter
              </button>
            </div>
          </div>
        </footer>
      </div>

      {/* Responsible AI Modal */}
      {isResponsibleAIModalOpen && (
        <ResponsibleAIModal onClose={() => setIsResponsibleAIModalOpen(false)} />
      )}

      {/* How LotusLearn Works Modal */}
      {isHowItWorksOpen && (
        <HowItWorksModal onClose={() => setIsHowItWorksOpen(false)} />
      )}
    </div>
  );
}
