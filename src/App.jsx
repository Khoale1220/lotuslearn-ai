import { persistTeacherInterventionCommand } from "./components/classroomWorld/teacherInterventionClient.js";
import { useMemo } from "react";
import ClassroomWorld from "./components/classroomWorld/ClassroomWorld.jsx";
import {
  createTeacherInterventionCommand,
  materializeTeacherIntervention
} from "./components/classroomWorld/teacherInterventionCommand.js";
import { createStudentIntelligenceBridge } from "./components/classroomWorld/studentIntelligenceBridge.js";
import { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { OverviewDashboard } from "./components/OverviewDashboard";
import { NewAnalysisWizard } from "./components/NewAnalysisWizard";
import { PipelineVisualizer } from "./components/PipelineVisualizer";
import { ResultsView } from "./components/ResultsView";
import { ClassesView } from "./components/views/ClassesView";
import { StudentsView } from "./components/views/StudentsView";
import { PrivacyTrustView } from "./components/views/PrivacyTrustView";
import { ResponsibleAIModal } from "./components/ResponsibleAIModal";
import { HowItWorksModal } from "./components/HowItWorksModal";
import { DEMO_CONTEXT, DEMO_SUBMISSIONS } from "./data/demoClassroom";
import { getCanonicalTeacherDecision } from "./utils/verificationDisplay";
function App() {
  const [currentView, setCurrentView] = useState("overview");
  const [activeAnalysis, setActiveAnalysis] = useState(null);
  const [, setLastTeacherIntervention] = useState(null);

  const handleTeacherIntervention = (input) => {
    const command =
      createTeacherInterventionCommand(input);

    const intervention =
      materializeTeacherIntervention(
        command,
        {
          createInterventionKey: () => {
            if (
              typeof globalThis.crypto?.randomUUID !==
              "function"
            ) {
              throw new Error(
                "Secure intervention key generation unavailable"
              );
            }

            return `intervention-${globalThis.crypto.randomUUID()}`;
          },

          nowIso: () =>
            new Date().toISOString()
        }
      );

    setLastTeacherIntervention(
      intervention
    );

    void persistTeacherInterventionCommand(intervention).catch(() => undefined);

    return intervention;
  };
  const [rawSubmissions, setRawSubmissions] = useState([]);
  const [cachedSubmissions, setCachedSubmissions] = useState([]);
  const [activeContext, setActiveContext] = useState(null);
  const [savedAnalyses, setSavedAnalyses] = useState([]);
  const [savedSessions, setSavedSessions] = useState([]);
  const [pipelineStage, setPipelineStage] = useState(1);
  const [pipelineDetail, setPipelineDetail] = useState("");
  const [pipelineError, setPipelineError] = useState(null);
  const [isResponsibleAIModalOpen, setIsResponsibleAIModalOpen] = useState(false);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);
  const [initialDemoLoad, setInitialDemoLoad] = useState(false);
  const [statusAnnouncement] = useState("");
  useEffect(() => {
    try {
      const stored = localStorage.getItem("lotuslearn_sessions");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sessions = parsed.map((item) => {
            const res = item.result || item;
            const normalizedClusters = (res.misconceptionClusters || []).map((c) => {
              const canonical = getCanonicalTeacherDecision(c);
              return {
                ...c,
                status: canonical,
                teacherDecision: canonical
              };
            });
            const normalizedInterventions = (res.interventions || []).map((i) => {
              const canonical = getCanonicalTeacherDecision(i);
              return {
                ...i,
                status: canonical,
                teacherDecision: canonical
              };
            });
            const normalizedResult = {
              ...res,
              misconceptionClusters: normalizedClusters,
              interventions: normalizedInterventions
            };
            const sanitizedEvidenceList = item.sanitizedSubmissions || [];
            return {
              result: normalizedResult,
              sanitizedSubmissions: sanitizedEvidenceList,
              savedAt: item.savedAt || item.timestamp || (/* @__PURE__ */ new Date()).toISOString()
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
      console.error("Failed to restore saved analyses:", err);
    }
  }, []);
  const saveAnalysis = (newResult) => {
    const sanitizedSubmissionsToCache = newResult.normalizedSourceEvidence && newResult.normalizedSourceEvidence.length > 0 ? newResult.normalizedSourceEvidence.map((evidence) => ({
      studentId: evidence.studentId,
      studentText: evidence.extractedText,
      workType: evidence.sourceType === "image_transcription" ? "handwritten_work" : "typed"
    })) : (newResult.studentObservations || []).map((obs) => ({
      studentId: obs.studentId,
      studentText: obs.supportingEvidence?.[0]?.quoteOrDetail || "",
      workType: "typed"
    }));
    const sessionObj = {
      result: newResult,
      sanitizedSubmissions: sanitizedSubmissionsToCache,
      savedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    setSavedSessions((prev) => {
      const updated = [sessionObj, ...prev.filter((p) => p.result.id !== newResult.id)];
      try {
        localStorage.setItem("lotuslearn_sessions", JSON.stringify(updated.slice(0, 10)));
      } catch (e) {
        console.error("Failed to cache session:", e);
      }
      return updated;
    });
    setSavedAnalyses((prev) => [newResult, ...prev.filter((p) => p.id !== newResult.id)]);
    setCachedSubmissions(sanitizedSubmissionsToCache);
  };
  const startPipelineAnalysis = async (context, submissions) => {
    setActiveContext(context);
    setRawSubmissions(submissions);
    setPipelineStage(1);
    setPipelineDetail("Initializing server-side Gemini 3.8 Flash pipeline...");
    setPipelineError(null);
    setCurrentView("processing");
    try {
      const response = await fetch("/api/analyze-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, submissions })
      });
      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          const rateLimitMsg = retryAfter ? `Inference rate limit exceeded. Please wait ${retryAfter} seconds before submitting again.` : errJson.message || errJson.error?.message || "Rate limit exceeded. Please wait a moment before trying again.";
          setPipelineError(rateLimitMsg);
          return;
        }
        if (response.status >= 400 && response.status < 500) {
          const clientErrMsg = errJson.message || errJson.error?.message || (response.status === 413 ? "Submission payload too large. Please reduce the number or size of submitted files." : `Request failed (HTTP ${response.status})`);
          setPipelineError(clientErrMsg);
          return;
        }
        const serverErrMsg = errJson.message || errJson.error?.message || `Server error encountered during analysis (HTTP ${response.status})`;
        setPipelineError(serverErrMsg);
        return;
      }
      if (!response.body) {
        const fallbackRes = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ context, submissions })
        });
        if (!fallbackRes.ok) {
          const errData = await fallbackRes.json().catch(() => ({}));
          setPipelineError(
            errData.code ? errData : errData.error || errData.message || `HTTP error ${fallbackRes.status}`
          );
          return;
        }
        const data = await fallbackRes.json();
        setActiveAnalysis(data);
        saveAnalysis(data);
        setCurrentView("results");
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        for (const evtBlock of events) {
          const lines = evtBlock.split("\n");
          let eventType = "";
          let dataStr = "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("event:")) {
              eventType = trimmed.substring(6).trim();
            } else if (trimmed.startsWith("data:")) {
              dataStr = trimmed.substring(5).trim();
            }
          }
          if (dataStr) {
            let parsedData = null;
            try {
              parsedData = JSON.parse(dataStr);
            } catch (parseErr) {
              console.warn("SSE parsing warning:", parseErr, dataStr);
              continue;
            }
            if (eventType === "progress") {
              setPipelineStage(parsedData.stage || 1);
              setPipelineDetail(parsedData.detail || parsedData.stageName || "");
            } else if (eventType === "complete") {
              setActiveAnalysis(parsedData);
              saveAnalysis(parsedData);
              setPipelineStage(7);
              setTimeout(() => {
                setCurrentView("results");
              }, 600);
            } else if (eventType === "error") {
              console.error("[LotusLearn AI] SSE pipeline stage error:", parsedData);
              setPipelineError(parsedData.code ? parsedData : parsedData.message || "Pipeline stage failed");
              return;
            }
          }
        }
      }
    } catch (err) {
      console.error("[LotusLearn AI] Pipeline execution error:", err);
      setPipelineError(
        err.code ? err : err.message || "A network or model error occurred during the analysis pipeline."
      );
    }
  };
  const handleQuickDemo = () => {
    startPipelineAnalysis(DEMO_CONTEXT, DEMO_SUBMISSIONS);
  };
  const handleAdjustIntervention = async (intervention, action) => {
    try {
      const res = await fetch("/api/intervention/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intervention, action })
      });
      if (!res.ok) {
        throw new Error("Failed to adjust intervention");
      }
      const updated = await res.json();
      if (activeAnalysis) {
        const newInterventions = activeAnalysis.interventions.map(
          (i) => i.interventionId === intervention.interventionId ? updated : i
        );
        const updatedResult = {
          ...activeAnalysis,
          interventions: newInterventions
        };
        setActiveAnalysis(updatedResult);
        saveAnalysis(updatedResult);
      }
    } catch (err) {
      console.error("Error adjusting intervention:", err);
    }
  };
  const handleUpdateMisconceptionStatus = (clusterId, status, newTitle) => {
    if (!activeAnalysis) return;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const updatedClusters = activeAnalysis.misconceptionClusters.map((c) => {
      if (c.clusterId === clusterId) {
        return {
          ...c,
          status,
          teacherDecision: status,
          decisionRecordedAt: nowIso,
          misconceptionTitle: newTitle && newTitle.trim() ? newTitle.trim() : c.misconceptionTitle
        };
      }
      return c;
    });
    const updated = {
      ...activeAnalysis,
      misconceptionClusters: updatedClusters
    };
    setActiveAnalysis(updated);
    saveAnalysis(updated);
  };
  const handleUpdateInterventionStatus = (interventionId, status) => {
    if (!activeAnalysis) return;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const updatedInterventions = activeAnalysis.interventions.map(
      (i) => i.interventionId === interventionId ? { ...i, status, teacherDecision: status, decisionRecordedAt: nowIso } : i
    );
    const updated = {
      ...activeAnalysis,
      interventions: updatedInterventions
    };
    setActiveAnalysis(updated);
    saveAnalysis(updated);
  };
  const handleNavigate = (target) => {
    if (target === "results" && !activeAnalysis) {
      handleQuickDemo();
      return;
    }
    setCurrentView(target);
  };
  const classroomIntelligenceStore = useMemo(() => {
    if (!activeAnalysis) {
      return createStudentIntelligenceBridge({
        observations: [],
        misconceptionClusters: [],
        interventions: [],
        analysisVersion: "lotuslearn-empty",
        sourceType: "lotuslearn-analysis"
      });
    }

    return createStudentIntelligenceBridge({
      observations: Array.isArray(activeAnalysis.studentObservations)
        ? activeAnalysis.studentObservations
        : [],
      misconceptionClusters: Array.isArray(activeAnalysis.misconceptionClusters)
        ? activeAnalysis.misconceptionClusters
        : [],
      interventions: Array.isArray(activeAnalysis.interventions)
        ? activeAnalysis.interventions
        : [],
      analysisVersion: String(
        activeAnalysis.analysisVersion ??
        activeAnalysis.version ??
        "lotuslearn-analysis"
      ),
      sourceType: String(
        activeAnalysis.sourceType ??
        activeAnalysis.context?.sourceType ??
        "lotuslearn-analysis"
      )
    });
  }, [activeAnalysis]);
  return <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex font-sans transition-colors">
      {
    /* Persistent Desktop Sidebar */
  }
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

      {
    /* Main App Layout (offset on desktop by sidebar width 280px / lg:pl-70) */
  }
      <div className="flex-1 flex flex-col min-w-0 lg:pl-70">
        {
    /* Restrained Top Navigation Bar */
  }
        <TopBar
    currentView={currentView}
    onNavigate={handleNavigate}
    onToggleSidebarMobile={() => setIsSidebarOpenMobile(true)}
    onQuickDemo={handleQuickDemo}
    onOpenResponsibleAI={() => setIsResponsibleAIModalOpen(true)}
    hasActiveResult={!!activeAnalysis}
    activeLessonTitle={activeAnalysis?.context.lessonTitle}
  />

        {
    /* Accessibility Announcement Region */
  }
        <div role="status" aria-live="polite" className="sr-only">
          {statusAnnouncement}
        </div>

        {
    /* Dynamic Content Views */
  }
        <main className="flex-1">
          {currentView === "overview" && <OverviewDashboard
    onStartAnalysis={() => {
      setInitialDemoLoad(false);
      setCurrentView("new-analysis");
    }}
    onTryDemo={handleQuickDemo}
    onSelectSavedAnalysis={(analysis) => {
      const matched = savedSessions.find((s) => s.result.id === analysis.id);
      setActiveAnalysis(analysis);
      setCachedSubmissions(matched?.sanitizedSubmissions || []);
      setCurrentView("results");
    }}
    savedAnalyses={savedAnalyses}
    onOpenHowItWorks={() => setIsHowItWorksOpen(true)}
  />}

          {currentView === "classes" && <ClassesView
    onStartAnalysis={() => {
      setInitialDemoLoad(false);
      setCurrentView("new-analysis");
    }}
    onTryDemo={handleQuickDemo}
    onSelectSavedAnalysis={(analysis) => {
      const matched = savedSessions.find((s) => s.result.id === analysis.id);
      setActiveAnalysis(analysis);
      setCachedSubmissions(matched?.sanitizedSubmissions || []);
      setCurrentView("results");
    }}
    savedAnalyses={savedAnalyses}
  />}

          {currentView === "students" && <StudentsView
    analysis={activeAnalysis}
    onTryDemo={handleQuickDemo}
    onInspectStudent={(_studentId) => {
      if (activeAnalysis) {
        setCurrentView("results");
      }
    }}
  />}

          {currentView === "privacy" && <PrivacyTrustView
    onOpenCharter={() => setIsResponsibleAIModalOpen(true)}
  />}

          {currentView === "new-analysis" && <NewAnalysisWizard
    onCancel={() => setCurrentView("overview")}
    onStartAnalysis={(context, submissions) => startPipelineAnalysis(context, submissions)}
    initialDemoLoad={initialDemoLoad}
  />}

          {currentView === "processing" && <PipelineVisualizer
    currentStage={pipelineStage}
    currentDetail={pipelineDetail}
    errorMessage={pipelineError || void 0}
    onRetry={() => {
      if (activeContext && rawSubmissions.length > 0) {
        startPipelineAnalysis(activeContext, rawSubmissions);
      }
    }}
    onCancel={() => setCurrentView("new-analysis")}
  />}

          {currentView === "results" && activeAnalysis && <ResultsView
    result={activeAnalysis}
    sanitizedSubmissions={cachedSubmissions}
    rawSubmissions={cachedSubmissions}
    onBackToDashboard={() => setCurrentView("overview")}
    onNewAnalysis={() => {
      setInitialDemoLoad(false);
      setCurrentView("new-analysis");
    }}
    onAdjustIntervention={handleAdjustIntervention}
    onUpdateMisconceptionStatus={handleUpdateMisconceptionStatus}
    onUpdateInterventionStatus={handleUpdateInterventionStatus}
  />}
        {currentView === "classroom-world" && <ClassroomWorld onTeacherIntervention={handleTeacherIntervention} intelligenceStore={classroomIntelligenceStore} />}
        </main>

        {
    /* Global Restrained Footer */
  }
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
    onClick={() => setCurrentView("privacy")}
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

      {
    /* Responsible AI Modal */
  }
      {isResponsibleAIModalOpen && <ResponsibleAIModal onClose={() => setIsResponsibleAIModalOpen(false)} />}

      {
    /* How LotusLearn Works Modal */
  }
      {isHowItWorksOpen && <HowItWorksModal onClose={() => setIsHowItWorksOpen(false)} />}
    </div>;
}
export {
  App as default
};
