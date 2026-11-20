import { Clock, Target, BookOpen, CheckCircle } from "lucide-react";
const InstructionalGroups = ({
  groups,
  onInspectStudent
}) => {
  return <div className="ui-card rounded-2xl p-6 sm:p-8 shadow-2xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[var(--border-decorative)] gap-2">
        <div>
          <span className="text-xs font-semibold text-[var(--status-info-fg)] uppercase tracking-wider block mb-1">
            Dynamic Cohorts
          </span>
          <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
            Formative Instructional Groups
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Targeted student cohorts derived directly from diagnostic error patterns. Zero permanent ability labels.
          </p>
        </div>
        <div className="text-xs text-[var(--text-secondary)] font-mono">
          <span className="font-bold text-[var(--text-primary)]">{groups.length}</span> targeted cohorts
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {groups.map((group, idx) => {
    const isExtension = group.groupName.toLowerCase().includes("extension");
    const isClarification = group.groupName.toLowerCase().includes("clarification");
    const headerColor = isExtension ? "ui-status-success" : isClarification ? "ui-status-info" : "ui-status-warning";
    return <div
      key={group.groupId || idx}
      className="ui-card ui-card-interactive rounded-xl p-5 space-y-4 hover:shadow-2xs"
    >
              {
      /* Group Name & Duration */
    }
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-[var(--border-decorative)]">
                <div>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${headerColor}`}>
                    Cohort #{idx + 1}
                  </span>
                  <h3 className="mt-1.5 text-base font-bold text-[var(--text-primary)] tracking-tight">
                    {group.groupName}
                  </h3>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-mono text-[var(--text-secondary)] shrink-0">
                  <Clock size={12} />
                  <span>{group.estimatedDuration}</span>
                </div>
              </div>

              {
      /* Student IDs in this cohort */
    }
              <div>
                <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider block mb-1.5">
                  Assigned Students ({group.studentIds.length}):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {group.studentIds.map((id) => <button
      key={id}
      type="button"
      onClick={() => onInspectStudent?.(id)}
      className="px-2 py-0.5 rounded bg-[var(--bg-elevated)] hover:bg-[var(--status-info-bg)] text-[var(--text-primary)] hover:text-[var(--status-info-fg)] text-xs font-mono font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
      aria-label={`Inspect ${id} profile`}
    >
                      {id}
                    </button>)}
                </div>
              </div>

              {
      /* Common Learning Need */
    }
              <div className="rounded-lg bg-[var(--bg-elevated)] p-3 text-xs space-y-1">
                <span className="font-semibold text-[var(--text-primary)] text-[11px] uppercase tracking-wider block">
                  Common Learning Need:
                </span>
                <p className="text-[var(--text-primary)] leading-relaxed">
                  {group.commonLearningNeed}
                </p>
              </div>

              {
      /* Suggested Activity & Facilitation Instructions */
    }
              <div className="space-y-2 text-xs">
                <div>
                  <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                    <BookOpen size={13} className="text-[var(--status-info-fg)]" />
                    Targeted Activity:
                  </span>
                  <p className="text-[var(--text-primary)] mt-1 leading-relaxed pl-5">
                    {group.suggestedActivity}
                  </p>
                </div>

                <div>
                  <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                    <Target size={13} className="text-[var(--status-info-fg)]" />
                    Teacher Facilitation Note:
                  </span>
                  <p className="text-[var(--text-primary)] mt-1 leading-relaxed pl-5">
                    {group.teacherInstructions}
                  </p>
                </div>
              </div>

              {
      /* Example Question & Success Criterion */
    }
              <div className="pt-3 border-t border-[var(--border-decorative)] text-xs space-y-2">
                <div className="bg-[var(--status-info-bg)] p-2.5 rounded-lg border border-[var(--status-info-border)]">
                  <span className="font-semibold text-[var(--status-info-fg)] text-[11px] block">
                    Diagnostic Practice Prompt:
                  </span>
                  <p className="text-[var(--text-primary)] mt-0.5 italic">
                    &quot;{group.exampleQuestion}&quot;
                  </p>
                </div>

                <div className="flex items-start gap-1.5 text-[11px] text-[var(--text-secondary)]">
                  <CheckCircle size={13} className="text-[var(--status-success)] mt-0.5 shrink-0" />
                  <span>
                    <strong className="text-[var(--text-primary)]">Success Criterion:</strong> {group.successCriterion}
                  </span>
                </div>
              </div>
            </div>;
  })}
      </div>
    </div>;
};
export {
  InstructionalGroups
};
