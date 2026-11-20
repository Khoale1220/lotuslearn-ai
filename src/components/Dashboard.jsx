import { PlusCircle, Play, BookOpen, Users, AlertCircle, Lightbulb, ArrowUpRight, Clock, HardDrive } from "lucide-react";
import { getCanonicalTeacherDecision } from "../utils/verificationDisplay";
const Dashboard = ({
  onNewAnalysis,
  onTryDemo,
  onSelectSavedAnalysis,
  savedAnalyses
}) => {
  const totalClasses = savedAnalyses.length;
  const totalSamples = savedAnalyses.reduce(
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
    /* Top Banner & Primary Actions */
  }
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[var(--border-decorative)]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Formative Assessment Dashboard
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[var(--text-secondary)]">
            Evidence-backed diagnostic insights and instructional interventions for your classes.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
    onClick={onTryDemo}
    className="ui-btn ui-btn-secondary gap-2 px-3.5 py-2 text-xs sm:text-sm shadow-2xs active:scale-98"
  >
            <Play size={15} className="text-[var(--border-focus)]" />
            <span>Try Demo Classroom</span>
          </button>
          <button
    onClick={onNewAnalysis}
    className="ui-btn ui-btn-primary gap-2 px-4 py-2 text-xs sm:text-sm shadow-2xs active:scale-98"
  >
            <PlusCircle size={16} />
            <span>New Analysis</span>
          </button>
        </div>
      </div>

      {
    /* 4 Summary Cards (Zero-pill discipline, decision-oriented metrics) */
  }
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="ui-card rounded-xl p-5 shadow-2xs">
          <div className="flex items-center justify-between text-[var(--text-secondary)]">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Classes Analyzed</span>
            <BookOpen size={18} className="text-[var(--border-focus)]" aria-hidden="true" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[var(--text-primary)]">{totalClasses}</span>
            <span className="text-xs text-[var(--text-secondary)]">sessions</span>
          </div>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">Formative assessment sessions processed</p>
        </div>

        <div className="ui-card rounded-xl p-5 shadow-2xs">
          <div className="flex items-center justify-between text-[var(--text-secondary)]">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Student Responses</span>
            <Users size={18} className="text-[var(--border-focus)]" aria-hidden="true" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[var(--text-primary)]">{totalSamples}</span>
            <span className="text-xs text-[var(--text-secondary)]">submissions</span>
          </div>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">Worksheets &amp; exit tickets examined</p>
        </div>

        <div className="ui-card rounded-xl p-5 shadow-2xs">
          <div className="flex items-center justify-between text-[var(--text-secondary)]">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Diagnosed Patterns</span>
            <AlertCircle size={18} className="text-[var(--status-error)]" aria-hidden="true" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[var(--text-primary)]">{totalMisconceptions}</span>
            <span className="text-xs text-[var(--text-secondary)]">clusters</span>
          </div>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">Systemic class-wide patterns identified</p>
        </div>

        <div className="ui-card rounded-xl p-5 shadow-2xs">
          <div className="flex items-center justify-between text-[var(--text-secondary)]">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Teaching Scaffolds</span>
            <Lightbulb size={18} className="text-[var(--status-warning)]" aria-hidden="true" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[var(--text-primary)]">{totalInterventions}</span>
            <span className="text-xs text-[var(--text-secondary)]">action plans</span>
          </div>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">Differentiated lesson scaffolds prepared</p>
        </div>
      </div>

      {
    /* Saved Analyses Section */
  }
      <section aria-labelledby="saved-analyses-heading" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1">
          <div>
            <h2 id="saved-analyses-heading" className="text-lg font-bold text-[var(--text-primary)]">
              Saved Analyses
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] mt-0.5">
              <HardDrive size={13} className="text-[var(--text-secondary)]" />
              <span>Saved locally on this device</span>
            </div>
          </div>
          <span className="text-xs text-[var(--text-secondary)]">Click any session to view evidence and next-lesson plan</span>
        </div>

        {savedAnalyses.length === 0 ? <div className="ui-card-elevated rounded-xl border-dashed p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-[var(--border-focus)]">
              <BookOpen size={22} />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-[var(--text-primary)]">No saved analyses yet</h3>
            <p className="mt-1 text-xs text-[var(--text-secondary)] max-w-md mx-auto leading-relaxed">
              When you analyze student responses, your diagnostic summaries, evidence quotes, and next-lesson plans will be saved here on your device.
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
    onClick={onTryDemo}
    className="ui-btn ui-btn-primary gap-2 px-4 py-2 text-xs shadow-2xs"
  >
                <span>Try Demo Classroom</span>
                <ArrowUpRight size={14} />
              </button>
              <button
    onClick={onNewAnalysis}
    className="ui-btn ui-btn-secondary gap-2 px-4 py-2 text-xs"
  >
                <span>Start New Analysis</span>
              </button>
            </div>
          </div> : <div className="ui-card divide-y divide-[var(--border-decorative)] rounded-xl overflow-hidden shadow-2xs">
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
      className="w-full text-left flex flex-col sm:flex-row sm:items-center justify-between p-5 hover:bg-[var(--bg-elevated)] transition-colors gap-4 focus-visible:bg-[var(--bg-elevated)]"
      aria-label={`Open session ${analysis.context.lessonTitle}`}
    >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
                      <span className="font-semibold text-[var(--text-primary)]">{analysis.context.subject}</span>
                      <span className="text-[var(--border-decorative)]">/</span>
                      <span>{analysis.context.gradeLevel}</span>
                      <span className="text-[var(--border-decorative)]">/</span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(analysis.timestamp).toLocaleDateString()}
                      </span>
                      {acceptedCount > 0 && <>
                          <span className="text-[var(--border-decorative)]">/</span>
                          <span className="text-[var(--status-success)] font-medium">
                            {acceptedCount} accepted
                          </span>
                        </>}
                      {pendingCount > 0 && <>
                          <span className="text-[var(--border-decorative)]">/</span>
                          <span className="text-[var(--status-warning)] font-medium">
                            {pendingCount} review pending
                          </span>
                        </>}
                    </div>
                    <h3 className="text-base font-semibold text-[var(--text-primary)]">
                      {analysis.context.lessonTitle}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] line-clamp-1 max-w-2xl">
                      {analysis.context.learningObjective}
                    </p>
                  </div>

                  <div className="flex items-center gap-6 self-start sm:self-center shrink-0">
                    <div className="text-right text-xs">
                      <span className="font-medium text-[var(--text-primary)]">
                        {analysis.classSnapshot?.misconceptionCount || analysis.misconceptionClusters?.length || 0}
                      </span>{" "}
                      <span className="text-[var(--text-secondary)]">patterns</span>
                      <span className="mx-2 text-[var(--border-decorative)]">|</span>
                      <span className="font-medium text-[var(--text-primary)]">
                        {analysis.studentObservations?.length || analysis.classSnapshot?.totalSubmissions || 0}
                      </span>{" "}
                      <span className="text-[var(--text-secondary)]">students</span>
                    </div>

                    <span className="inline-flex items-center text-xs font-semibold text-[var(--border-focus)] hover:text-[var(--text-primary)]">
                      Inspect <ArrowUpRight size={14} className="ml-1" />
                    </span>
                  </div>
                </button>;
  })}
          </div>}
      </section>

      {
    /* Human-in-the-Loop Pedagogical Principle Notice */
  }
      <div className="ui-card-elevated rounded-xl p-4 text-xs text-[var(--text-secondary)] flex items-start gap-3">
        <div className="h-2 w-2 rounded-full bg-[var(--bg-elevated)]0 mt-1 shrink-0" aria-hidden="true" />
        <p className="leading-relaxed">
          <strong className="text-[var(--text-primary)]">Human-in-the-Loop Decision Support:</strong>{" "}
          LotusLearn supports teacher decision-making. AI-generated insights, groupings, and next-lesson plans are suggestions designed to be reviewed and approved by the educator before classroom instruction.
        </p>
      </div>
    </div>;
};
export {
  Dashboard
};
