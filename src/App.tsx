import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { Dashboard } from './components/Dashboard';
import { NewAnalysisWizard } from './components/NewAnalysisWizard';
import { PipelineVisualizer } from './components/PipelineVisualizer';
import { ResultsView } from './components/ResultsView';
import { ResponsibleAIModal } from './components/ResponsibleAIModal';
import {
  ClassAnalysisResult,
  DifferentiatedIntervention,
  LearningContext,
  StudentSubmission,
  SavedSession,
} from './types';
import { DEMO_CONTEXT, DEMO_SUBMISSIONS } from './data/demoClassroom';

export default function App() {
  const [currentView, setCurrentView] = useState<
    'landing' | 'dashboard' | 'new-analysis' | 'processing' | 'results'
  >('landing');

  const [activeAnalysis, setActiveAnalysis] = useState<ClassAnalysisResult | null>(null);
  const [rawSubmissions, setRawSubmissions] = useState<StudentSubmission[]>([]);
  const [activeContext, setActiveContext] = useState<LearningContext | null>(null);
  const [savedAnalyses, setSavedAnalyses] = useState<ClassAnalysisResult[]>([]);
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);

  // Pipeline execution state
  const [pipelineStage, setPipelineStage] = useState<number>(1);
  const [pipelineDetail, setPipelineDetail] = useState<string>('');
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  // Modals
  const [isResponsibleAIModalOpen, setIsResponsibleAIModalOpen] = useState(false);
  const [initialDemoLoad, setInitialDemoLoad] = useState(false);

  // Load saved sessions from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('lotuslearn_sessions');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sessions: SavedSession[] = parsed.map((item: any) => {
            if (item.result && Array.isArray(item.rawSubmissions)) {
              return item as SavedSession;
            }
            // For legacy sessions without stored submissions, do NOT inject demo data
            return {
              result: item as ClassAnalysisResult,
              rawSubmissions: [],
              savedAt: item.timestamp || new Date().toISOString(),
            };
          });
          setSavedSessions(sessions);
          const analyses = sessions.map((s) => s.result);
          setSavedAnalyses(analyses);
          setActiveAnalysis(analyses[0]);
          setRawSubmissions(sessions[0].rawSubmissions || []);
        }
      }
    } catch (err) {
      console.error('Failed to restore saved analyses:', err);
    }
  }, []);

  // Save analyses and raw submissions to localStorage when updated
  const saveAnalysis = (newResult: ClassAnalysisResult, submissionsToSave?: StudentSubmission[]) => {
    const effectiveSubmissions =
      submissionsToSave && submissionsToSave.length > 0 ? submissionsToSave : rawSubmissions;
    const sessionObj: SavedSession = {
      result: newResult,
      rawSubmissions: effectiveSubmissions,
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
    setCurrentView('processing');

    try {
      // Attempt SSE streaming for live visual progression
      const response = await fetch('/api/analyze-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, submissions }),
      });

      if (!response.ok || !response.body) {
        // Fallback to standard POST
        const fallbackRes = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context, submissions }),
        });

        if (!fallbackRes.ok) {
          const errData = await fallbackRes.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP error ${fallbackRes.status}`);
        }

        const data: ClassAnalysisResult = await fallbackRes.json();
        setActiveAnalysis(data);
        saveAnalysis(data, submissions);
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
              saveAnalysis(parsedData, submissions);
              setPipelineStage(7);
              setTimeout(() => {
                setCurrentView('results');
              }, 600);
            } else if (eventType === 'error') {
              console.error('[LotusLearn AI] SSE pipeline stage error:', parsedData);
              setPipelineError(parsedData.message || 'Pipeline stage failed');
              return;
            }
          }
        }
      }
    } catch (err: any) {
      console.error('[LotusLearn AI] Pipeline execution error:', err);
      setPipelineError(
        err.message || 'A network or model error occurred during the analysis pipeline.'
      );
    }
  };

  // Launch Demo Classroom path directly
  const handleQuickDemo = () => {
    startPipelineAnalysis(DEMO_CONTEXT, DEMO_SUBMISSIONS);
  };

  // Open New Analysis with demo pre-filled
  const handleOpenDemoInWizard = () => {
    setInitialDemoLoad(true);
    setCurrentView('new-analysis');
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

  // Human-in-the-loop: update misconception status
  const handleUpdateMisconceptionStatus = (
    clusterId: string,
    status: 'accepted' | 'edited' | 'dismissed'
  ) => {
    if (!activeAnalysis) return;
    const updatedClusters = activeAnalysis.misconceptionClusters.map((c) =>
      c.clusterId === clusterId ? { ...c, status } : c
    );
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
    status: 'accepted' | 'edited' | 'dismissed'
  ) => {
    if (!activeAnalysis) return;
    const updatedInterventions = activeAnalysis.interventions.map((i) =>
      i.interventionId === interventionId ? { ...i, status } : i
    );
    const updated = {
      ...activeAnalysis,
      interventions: updatedInterventions,
    };
    setActiveAnalysis(updated);
    saveAnalysis(updated);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Navigation Header */}
      <Header
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view)}
        onOpenResponsibleAI={() => setIsResponsibleAIModalOpen(true)}
        onQuickDemo={handleQuickDemo}
        hasActiveResult={!!activeAnalysis}
        onViewResults={() => setCurrentView('results')}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {currentView === 'landing' && (
          <Hero
            onStartAnalysis={() => {
              setInitialDemoLoad(false);
              setCurrentView('new-analysis');
            }}
            onTryDemo={handleQuickDemo}
          />
        )}

        {currentView === 'dashboard' && (
          <Dashboard
            onNewAnalysis={() => {
              setInitialDemoLoad(false);
              setCurrentView('new-analysis');
            }}
            onTryDemo={handleQuickDemo}
            onSelectSavedAnalysis={(analysis) => {
              const matched = savedSessions.find((s) => s.result.id === analysis.id);
              setActiveAnalysis(analysis);
              setRawSubmissions(matched?.rawSubmissions || []);
              setCurrentView('results');
            }}
            savedAnalyses={savedAnalyses}
          />
        )}

        {currentView === 'new-analysis' && (
          <NewAnalysisWizard
            onCancel={() => setCurrentView('dashboard')}
            onStartAnalysis={(context, submissions) =>
              startPipelineAnalysis(context, submissions)
            }
            initialDemoLoad={initialDemoLoad}
          />
        )}

        {currentView === 'processing' && (
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
            rawSubmissions={rawSubmissions}
            onBackToDashboard={() => setCurrentView('dashboard')}
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

      {/* Footer (Anti-slop: quiet, clean, with real links & branding) */}
      <footer className="border-t border-slate-200 bg-white py-8 text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">LotusLearn AI</span>
            <span>·</span>
            <span>From student work to targeted intervention in 60 seconds</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-slate-500">
            <span>Google Cloud AI Builder Cup 2026</span>
            <span>·</span>
            <span>Team TTKK • Vietnam</span>
            <span>·</span>
            <button
              onClick={() => setIsResponsibleAIModalOpen(true)}
              className="hover:text-slate-900 underline underline-offset-2"
            >
              Responsible AI Charter
            </button>
          </div>
        </div>
      </footer>

      {/* Responsible AI Transparency Modal */}
      {isResponsibleAIModalOpen && (
        <ResponsibleAIModal onClose={() => setIsResponsibleAIModalOpen(false)} />
      )}
    </div>
  );
}
