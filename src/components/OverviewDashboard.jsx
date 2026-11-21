import {
  ArrowRight,
  Play,
  Clock,
  ArrowUpRight,
  PlusCircle,
  FolderOpen
} from "lucide-react";
import { getCanonicalTeacherDecision } from "../utils/verificationDisplay";
const OverviewDashboard = ({
  onStartAnalysis,
  onTryDemo,
  onSelectSavedAnalysis,
  savedAnalyses,
  onOpenHowItWorks
}) => {
  const totalSubmissions = savedAnalyses.reduce(
    (acc, cur) => acc + (cur.studentObservations?.length || cur.classSnapshot?.totalSubmissions || 0),
    0
  );
  const totalMisconceptions = savedAnalyses.reduce(
    (acc, cur) => acc + (cur.misconceptionClusters?.length || 0),
    0
  );
  const totalInterventions = savedAnalyses.reduce(
    (acc, cur) => acc + (cur.interventions?.length || 0),
    0
  );
  return <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
      {
    /* Header & Primary Actions */
  }
      <section className="ui-card rounded-xl p-6 sm:p-8">
        <div className="max-w-3xl space-y-3">
          <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            Diagnostic Assessment Workspace
          </span>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Formative Assessment &amp; Misconception Diagnosis
          </h1>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-2xl">
            Ingest student responses, review anchored evidence citations, and evaluate suggested instructional groupings for tomorrow’s lesson.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
    onClick={onTryDemo}
    className="ui-btn ui-btn-primary gap-2 px-4 py-2.5 text-xs sm:text-sm"
  >
              <Play size={14} />
              <span>Try Demo Class</span>
            </button>

            <button
    onClick={onStartAnalysis}
    className="ui-btn ui-btn-secondary gap-2 px-4 py-2.5 text-xs sm:text-sm"
  >
              <span>Analyze Submissions</span>
              <ArrowRight size={15} />
            </button>

            <button
    onClick={onOpenHowItWorks}
    className="ui-btn ui-btn-ghost text-xs px-2 py-2 ml-auto"
  >
              Pipeline architecture
            </button>
          </div>
        </div>
      </section>

      {
    /* Operational Metrics */
  }
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="ui-card rounded-xl p-5">
          <span className="text-xs font-medium text-[var(--text-secondary)]">Analysis Sessions</span>
          <div className="mt-2 text-2xl font-bold text-[var(--text-primary)] font-mono">
            {savedAnalyses.length}
          </div>
          <span className="text-xs text-[var(--text-secondary)] mt-1 block">Completed runs</span>
        </div>

        <div className="ui-card rounded-xl p-5">
          <span className="text-xs font-medium text-[var(--text-secondary)]">Submissions Processed</span>
          <div className="mt-2 text-2xl font-bold text-[var(--text-primary)] font-mono">
            {totalSubmissions}
          </div>
          <span className="text-xs text-[var(--text-secondary)] mt-1 block">De-identified &amp; analyzed</span>
        </div>

        <div className="ui-card rounded-xl p-5">
          <span className="text-xs font-medium text-[var(--text-secondary)]">Diagnosed Clusters</span>
          <div className="mt-2 text-2xl font-bold text-[var(--text-primary)] font-mono">
            {totalMisconceptions}
          </div>
          <span className="text-xs text-[var(--text-secondary)] mt-1 block">Anchored to student quotes</span>
        </div>

        <div className="ui-card rounded-xl p-5">
          <span className="text-xs font-medium text-[var(--text-secondary)]">Draft Interventions</span>
          <div className="mt-2 text-2xl font-bold text-[var(--text-primary)] font-mono">
            {totalInterventions}
          </div>
          <span className="text-xs text-[var(--text-secondary)] mt-1 block">Subject to teacher review</span>
        </div>
      </section>

      {
    /* Recent Runs */
  }
      <section className="space-y-3">
        <div className="flex items-center justify-between pb-1">
          <h2 className="text-base font-bold text-[var(--text-primary)]">
            Recent Analysis Runs
          </h2>
        </div>

        {savedAnalyses.length === 0 ? <div className="ui-card-elevated rounded-xl border-dashed p-10 text-center space-y-3">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
              <FolderOpen size={20} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">No session runs yet</h3>
              <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
                Run an analysis on sample or custom student work to view diagnostic findings.
              </p>
            </div>
            <div className="pt-2 flex justify-center gap-3">
              <button
    onClick={onTryDemo}
    className="ui-btn ui-btn-primary gap-1.5 px-3.5 py-2 text-xs"
  >
                <span>Try Demo Class</span>
                <ArrowUpRight size={14} />
              </button>
              <button
    onClick={onStartAnalysis}
    className="ui-btn ui-btn-secondary gap-1.5 px-3.5 py-2 text-xs"
  >
                <PlusCircle size={14} />
                <span>New Analysis</span>
              </button>
            </div>
          </div> : <div className="ui-card divide-y divide-[var(--border-decorative)] rounded-xl overflow-hidden">
            {savedAnalyses.map((analysis) => {
    const clusters = analysis.misconceptionClusters || [];
    const acceptedCount = clusters.filter(
      (c) => getCanonicalTeacherDecision(c) === "accepted"
    ).length;
    const pendingCount = clusters.filter(
      (c) => getCanonicalTeacherDecision(c) === "pending"
    ).length;
    return <button
      key={analysis.id}
      onClick={() => onSelectSavedAnalysis(analysis)}
      className="w-full text-left flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-[var(--bg-elevated)] transition-colors gap-3 focus-visible:bg-[var(--bg-elevated)]"
      aria-label={`Open session ${analysis.context.lessonTitle}`}
    >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
                      <span className="font-semibold text-[var(--text-primary)]">{analysis.context.subject}</span>
                      <span>{analysis.context.gradeLevel}</span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(analysis.timestamp).toLocaleDateString()}
                      </span>
                      {acceptedCount > 0 && <span className="text-[var(--status-success)] font-medium">
                          {acceptedCount} accepted
                        </span>}
                      {pendingCount > 0 && <span className="text-[var(--status-warning)] font-medium">
                          {pendingCount} pending review
                        </span>}
                    </div>
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {analysis.context.lessonTitle}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] truncate max-w-xl">
                      {analysis.context.learningObjective}
                    </p>
                  </div>

                  <div className="flex items-center gap-6 shrink-0 self-start sm:self-center">
                    <div className="text-right text-xs text-[var(--text-secondary)] space-x-3">
                      <span>
                        <strong className="text-[var(--text-primary)] font-mono">
                          {analysis.classSnapshot?.misconceptionCount || clusters.length}
                        </strong>{" "}
                        clusters
                      </span>
                      <span>
                        <strong className="text-[var(--text-primary)] font-mono">
                          {analysis.studentObservations?.length || analysis.classSnapshot?.totalSubmissions || 0}
                        </strong>{" "}
                        submissions
                      </span>
                    </div>

                    <span className="inline-flex items-center text-xs font-semibold text-[var(--text-primary)] hover:text-[var(--text-secondary)]">
                      Review findings <ArrowUpRight size={14} className="ml-0.5" />
                    </span>
                  </div>
                </button>;
  })}
          </div>}
      </section>
    </div>;
};
export {
  OverviewDashboard
};
