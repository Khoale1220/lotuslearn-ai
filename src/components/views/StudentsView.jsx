import { useState } from "react";
import {
  UserRound,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ShieldCheck,
  Table as TableIcon,
  LayoutGrid,
  FileCheck
} from "lucide-react";
const StudentsView = ({
  analysis,
  onInspectStudent,
  onTryDemo
}) => {
  const [viewMode, setViewMode] = useState("table");
  const observations = analysis?.studentObservations || [];
  const groups = analysis?.instructionalGroups || [];
  const formatPseudonym = (studentId) => {
    const match = studentId.match(/\d+/);
    return match ? `S-${match[0].padStart(2, "0")}` : studentId;
  };
  const getRecommendedGroup = (studentId) => {
    const found = groups.find((g) => g.studentIds.includes(studentId));
    return found ? found.groupName : "Core Practice Group";
  };
  return <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
      {
    /* Header */
  }
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[var(--border-default)]  gap-4 transition-colors">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)]  font-heading">
            Student Roster &amp; Profiles
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[var(--text-secondary)] ">
            Formative observations anchored directly to de-identified student submissions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] bg-[var(--bg-elevated)]  border border-[var(--border-default)]  px-3 py-1.5 rounded-lg">
            <ShieldCheck size={15} className="text-[var(--status-info-fg)]  shrink-0" />
            <span>Pseudonymized roster keys (S-01 to S-12)</span>
          </div>

          {observations.length > 0 && <div className="flex items-center bg-[var(--bg-surface)]  p-0.5 rounded-lg border border-[var(--border-default)]  text-xs">
              <button
    type="button"
    onClick={() => setViewMode("table")}
    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition ${viewMode === "table" ? "bg-[var(--bg-elevated)]  text-[var(--text-primary)]  shadow-2xs font-semibold" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] "}`}
  >
                <TableIcon size={13} />
                <span>Table</span>
              </button>
              <button
    type="button"
    onClick={() => setViewMode("cards")}
    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition ${viewMode === "cards" ? "bg-[var(--bg-elevated)]  text-[var(--text-primary)]  shadow-2xs font-semibold" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] "}`}
  >
                <LayoutGrid size={13} />
                <span>Cards</span>
              </button>
            </div>}
        </div>
      </div>

      {observations.length === 0 ? <div className="rounded-2xl border border-dashed border-[var(--border-strong)]  bg-[var(--bg-surface)]  p-12 text-center space-y-4 transition-colors">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--status-info-bg)]  text-[var(--status-info-fg)] ">
            <UserRound size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[var(--text-primary)]  font-heading">
              No active student observations loaded
            </h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto leading-relaxed">
              Run an analysis or load the Grade 10 English demo classroom to see individual student profiles, verbatim evidence excerpts, and formative diagnoses.
            </p>
          </div>
          <button
    onClick={onTryDemo}
    className="inline-flex items-center gap-2 rounded-xl bg-[var(--action-primary-bg)]  hover:bg-[var(--action-primary-hover)]  text-[var(--action-primary-text)] px-5 py-2.5 text-xs font-semibold shadow-2xs transition"
  >
            <span>Load Demo Classroom</span>
            <ArrowUpRight size={14} />
          </button>
        </div> : viewMode === "table" ? (
    /* Section 74: Student review table */
    <div className="rounded-2xl border border-[var(--border-default)]  bg-[var(--bg-surface)]  shadow-2xs overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-default)]  bg-[var(--bg-elevated)]  text-[var(--text-secondary)] font-semibold uppercase tracking-wider text-[11px]">
                  <th scope="col" className="py-3.5 px-4 sm:px-6">Pseudonymous Student ID</th>
                  <th scope="col" className="py-3.5 px-4">Evidence Status</th>
                  <th scope="col" className="py-3.5 px-4">Identified Need</th>
                  <th scope="col" className="py-3.5 px-4">Recommended Group</th>
                  <th scope="col" className="py-3.5 px-4 sm:px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {observations.map((obs) => {
      const pseudoId = formatPseudonym(obs.studentId);
      const quoteCount = obs.supportingEvidence?.length || 0;
      const hasMisconceptions = obs.misconceptions && obs.misconceptions.length > 0;
      const primaryNeed = hasMisconceptions ? obs.misconceptions[0] : "Target rubric criteria mastered";
      const recGroup = getRecommendedGroup(obs.studentId);
      return <tr
        key={obs.studentId}
        className="hover:bg-[var(--bg-elevated)]  transition-colors"
      >
                      <td className="py-3.5 px-4 sm:px-6 font-medium text-[var(--text-primary)] ">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[var(--status-info-fg)]  bg-[var(--status-info-bg)]  border border-[var(--status-info-border)]  px-2 py-0.5 rounded text-xs">
                            {pseudoId}
                          </span>
                          <span className="text-[11px] text-[var(--text-secondary)] font-mono hidden sm:inline">
                            ({obs.studentId})
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-[var(--text-secondary)] ">
                        <span className="inline-flex items-center gap-1.5 font-medium text-[11px] text-[var(--text-secondary)]  bg-[var(--bg-elevated)]  px-2.5 py-1 rounded-md">
                          <FileCheck size={13} className="text-[var(--status-success-fg)] " />
                          <span>{quoteCount} quote{quoteCount === 1 ? "" : "s"} anchored</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-[var(--text-primary)]  max-w-xs md:max-w-md">
                        {hasMisconceptions ? <div className="flex items-start gap-1.5">
                            <AlertCircle size={13} className="text-[var(--status-warning-fg)]  shrink-0 mt-0.5" />
                            <span className="line-clamp-2 leading-relaxed">{primaryNeed}</span>
                          </div> : <div className="flex items-center gap-1.5 text-[var(--status-success-fg)] ">
                            <CheckCircle2 size={13} className="text-[var(--status-success-fg)]  shrink-0" />
                            <span>{primaryNeed}</span>
                          </div>}
                      </td>

                      <td className="py-3.5 px-4 text-[var(--text-secondary)]  font-medium">
                        <span className="inline-block bg-[var(--bg-elevated)]  border border-[var(--border-default)]  px-2.5 py-1 rounded text-[11px] text-[var(--text-secondary)] ">
                          {recGroup}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 sm:px-6 text-right">
                        {onInspectStudent ? <button
        type="button"
        onClick={() => onInspectStudent(obs.studentId)}
        className="inline-flex items-center gap-1 font-semibold text-[var(--text-secondary)]  hover:text-[var(--text-primary)]  transition text-xs"
      >
                            <span>Inspect Quotes</span>
                            <ArrowUpRight size={13} />
                          </button> : null}
                      </td>
                    </tr>;
    })}
              </tbody>
            </table>
          </div>
        </div>
  ) : (
    /* Cards View */
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {observations.map((obs) => {
      const hasMisconceptions = obs.misconceptions && obs.misconceptions.length > 0;
      const pseudoId = formatPseudonym(obs.studentId);
      const recGroup = getRecommendedGroup(obs.studentId);
      return <div
        key={obs.studentId}
        className="rounded-2xl border border-[var(--border-default)]  bg-[var(--bg-surface)]  p-5 space-y-4 shadow-2xs hover:border-[var(--border-strong)]  hover:shadow-xs transition"
      >
                {
        /* Header */
      }
                <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)] ">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--status-info-bg)]  border border-[var(--status-info-border)]  text-[var(--status-info-fg)]  font-mono font-bold text-xs">
                      {pseudoId}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[var(--text-primary)]  font-mono">
                        {pseudoId} <span className="text-[11px] text-[var(--text-secondary)] font-normal">({obs.studentId})</span>
                      </h3>
                      <span className="text-[10px] text-[var(--text-secondary)] font-medium">{recGroup}</span>
                    </div>
                  </div>

                  <span
        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${hasMisconceptions ? "bg-[var(--status-warning-bg)]  text-[var(--status-warning-fg)]  border border-[var(--status-warning-border)] " : "bg-[var(--status-success-bg)]  text-[var(--status-success-fg)]  border border-[var(--status-success-border)] "}`}
      >
                    {hasMisconceptions ? `${obs.misconceptions.length} Need(s)` : "Mastered"}
                  </span>
                </div>

                {
        /* Demonstrated Understandings */
      }
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--status-success-fg)]  flex items-center gap-1">
                    <CheckCircle2 size={11} />
                    Demonstrated Strengths
                  </span>
                  <div className="space-y-1">
                    {obs.demonstratedUnderstanding.slice(0, 2).map((u, idx) => <p key={idx} className="text-xs text-[var(--text-secondary)]  leading-snug">
                        - {u}
                      </p>)}
                    {obs.demonstratedUnderstanding.length === 0 && <p className="text-xs text-[var(--text-secondary)] italic">No specific strengths recorded.</p>}
                  </div>
                </div>

                {
        /* Misconceptions */
      }
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--status-warning-fg)]  flex items-center gap-1">
                    <AlertCircle size={11} />
                    Target Misconceptions
                  </span>
                  <div className="space-y-1">
                    {obs.misconceptions.slice(0, 2).map((m, idx) => <p
        key={idx}
        className="text-xs text-[var(--text-primary)]  bg-[var(--bg-elevated)]  border border-[var(--border-subtle)]  rounded-lg p-2 leading-snug"
      >
                        {m}
                      </p>)}
                    {obs.misconceptions.length === 0 && <p className="text-xs text-[var(--status-success-fg)]  bg-[var(--status-success-bg)]  border border-[var(--status-success-border)]  rounded-lg p-2">
                        Complete accuracy on target rubric standard.
                      </p>}
                  </div>
                </div>

                {
        /* Evidence Quote Link */
      }
                <div className="pt-2 border-t border-[var(--border-subtle)]  flex items-center justify-between text-xs">
                  <span className="text-[var(--text-secondary)] text-[11px] font-mono">
                    {obs.supportingEvidence?.length || 0} quotes anchored
                  </span>
                  {onInspectStudent && <button
        type="button"
        onClick={() => onInspectStudent(obs.studentId)}
        className="inline-flex items-center gap-1 font-semibold text-[var(--text-secondary)]  hover:text-[var(--text-primary)]  transition"
      >
                      <span>Inspect Quotes</span>
                      <ArrowUpRight size={13} />
                    </button>}
                </div>
              </div>;
    })}
        </div>
  )}
    </div>;
};
export {
  StudentsView
};
