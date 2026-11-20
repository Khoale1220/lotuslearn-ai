import { useState } from "react";
import {
  Check,
  X,
  Edit2,
  HelpCircle
} from "lucide-react";
import {
  getTeacherStatusLabel,
  getCanonicalTeacherDecision
} from "../../utils/verificationDisplay";
const MisconceptionMap = ({
  clusters,
  selectedClusterId,
  totalStudents = 12,
  onSelectCluster,
  onUpdateStatus,
  onInspectStudent,
  onOpenWhyInsight
}) => {
  const [editingId, setEditingId] = useState(null);
  const [editedTitles, setEditedTitles] = useState({});
  const handleStartEdit = (cluster, e) => {
    e.stopPropagation();
    setEditingId(cluster.clusterId);
    setEditedTitles((prev) => ({
      ...prev,
      [cluster.clusterId]: cluster.misconceptionTitle
    }));
  };
  const handleSaveEdit = (clusterId, e) => {
    e.stopPropagation();
    e.preventDefault();
    const trimmedTitle = (editedTitles[clusterId] ?? "").trim();
    setEditingId(null);
    if (trimmedTitle) {
      onUpdateStatus?.(clusterId, "edited", trimmedTitle);
    } else {
      onUpdateStatus?.(clusterId, "edited");
    }
  };
  const handleCancelEdit = (e) => {
    e.stopPropagation();
    setEditingId(null);
  };
  return <div className="ui-card rounded-2xl p-6 sm:p-8 shadow-2xs space-y-6">
      {
    /* Header */
  }
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[var(--border-decorative)] gap-2">
        <div>
          <span className="text-xs font-semibold text-[var(--status-info-fg)] uppercase tracking-wider block mb-1">
            Class Diagnostic Patterns
          </span>
          <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
            Misconception Discovery Map
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Synthesized class-wide patterns identified from student responses. Click any card to inspect supporting quotes.
          </p>
        </div>
        <div className="text-xs text-[var(--text-secondary)] font-mono">
          <span className="font-bold text-[var(--text-primary)]">{clusters.length}</span> diagnosed patterns
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {clusters.map((cluster) => {
    const isSelected = selectedClusterId === cluster.clusterId;
    const canonicalDecision = getCanonicalTeacherDecision(cluster);
    const isDismissed = canonicalDecision === "dismissed";
    const isEditing = editingId === cluster.clusterId;
    const sampleEvidence = cluster.evidenceExamples[0];
    const priorityBadge = cluster.teachingPriority === "urgent" ? "ui-status-error" : cluster.teachingPriority === "high" ? "ui-status-warning" : "ui-status-info";
    const evidenceBadge = cluster.evidenceStrength === "strong" ? "ui-status-success" : cluster.evidenceStrength === "review_required" ? "ui-status-warning" : "text-[var(--text-primary)] bg-[var(--bg-elevated)] border-[var(--border-decorative)]";
    return <div
      key={cluster.clusterId}
      role="region"
      aria-label={`Misconception cluster: ${cluster.misconceptionTitle}`}
      tabIndex={0}
      onClick={() => onSelectCluster(cluster.clusterId)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          if (e.target.tagName !== "BUTTON" && e.target.tagName !== "INPUT") {
            e.preventDefault();
            onSelectCluster(cluster.clusterId);
          }
        }
      }}
      className={`rounded-xl border p-5 space-y-4 cursor-pointer transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] ${isSelected ? "border-[var(--status-info-border)] ring-2 ring-[var(--border-focus)] shadow-xs bg-[var(--bg-surface)]" : "border-[var(--border-decorative)] bg-[var(--bg-surface)] hover:border-[var(--border-control)] hover:shadow-2xs"} ${isDismissed ? "opacity-60 bg-[var(--bg-elevated)]" : ""}`}
    >
              {
      /* Priority & Impact Bar */
    }
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[var(--border-decorative)] text-xs">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${priorityBadge}`}>
                    {cluster.teachingPriority.toUpperCase()} PRIORITY
                  </span>
                  <span className="text-[var(--text-secondary)]" aria-hidden="true">/</span>
                  <span className="font-semibold text-[var(--text-primary)] text-xs font-mono">
                    {cluster.studentCount} / {totalStudents} students ({cluster.percentageAffected}%)
                  </span>
                </div>

                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${evidenceBadge}`}>
                  Evidence: {cluster.evidenceStrength ? cluster.evidenceStrength.replace("_", " ") : "Checked"}
                </span>
              </div>

              {
      /* Title & Inline Edit */
    }
              <div>
                {isEditing ? <form
      onSubmit={(e) => handleSaveEdit(cluster.clusterId, e)}
      onClick={(e) => e.stopPropagation()}
      className="space-y-2"
    >
                    <label htmlFor={`edit-title-${cluster.clusterId}`} className="sr-only">
                      Edit Misconception Title
                    </label>
                    <input
      id={`edit-title-${cluster.clusterId}`}
      type="text"
      value={editedTitles[cluster.clusterId] ?? cluster.misconceptionTitle}
      onChange={(e) => setEditedTitles({
        ...editedTitles,
        [cluster.clusterId]: e.target.value
      })}
      className="ui-input w-full text-sm font-bold rounded-lg px-3 py-1.5"
      autoFocus
    />
                    <div className="flex items-center gap-2">
                      <button
      type="submit"
      className="ui-btn ui-btn-primary px-3 py-1 text-xs"
    >
                        Save
                      </button>
                      <button
      type="button"
      onClick={handleCancelEdit}
      className="px-3 py-1 text-xs font-medium rounded-md border border-[var(--border-control)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
    >
                        Cancel
                      </button>
                    </div>
                  </form> : <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
                      {cluster.misconceptionTitle}
                    </h3>
                    <button
      type="button"
      onClick={(e) => handleStartEdit(cluster, e)}
      className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 transition rounded shrink-0"
      title="Edit misconception title"
      aria-label={`Edit title for ${cluster.misconceptionTitle}`}
    >
                      <Edit2 size={13} />
                    </button>
                  </div>}
              </div>

              {
      /* Description */
    }
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {cluster.explanation}
              </p>

              {
      /* Verbatim Excerpt Preview */
    }
              {sampleEvidence && <div className="rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-decorative)] p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                    <span className="font-semibold text-[var(--text-primary)]">Sample Student Quote:</span>
                    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onInspectStudent?.(sampleEvidence.studentId);
      }}
      className="text-[var(--status-info-fg)] hover:underline font-mono font-medium"
    >
                      {sampleEvidence.studentId}
                    </button>
                  </div>
                  <blockquote className="text-[var(--text-primary)] italic font-serif leading-snug">
                    &quot;{sampleEvidence.excerpt}&quot;
                  </blockquote>
                </div>}

              {
      /* Affected Students Chips */
    }
              <div>
                <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider block mb-1">
                  Affected Students ({cluster.affectedStudentIds.length}):
                </span>
                <div className="flex flex-wrap gap-1">
                  {cluster.affectedStudentIds.map((id) => <button
      key={id}
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onInspectStudent?.(id);
      }}
      className="px-2 py-0.5 rounded bg-[var(--bg-elevated)] hover:bg-[var(--status-info-bg)] text-[var(--text-primary)] hover:text-[var(--status-info-fg)] text-xs font-mono font-medium transition"
      aria-label={`Inspect ${id}`}
    >
                      {id}
                    </button>)}
                </div>
              </div>

              {
      /* Bottom Line: Why this insight? + Human Decision Controls */
    }
              <div
      className="pt-3 border-t border-[var(--border-decorative)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
      onClick={(e) => e.stopPropagation()}
    >
                <div className="flex items-center gap-2">
                  {onOpenWhyInsight && <button
      type="button"
      onClick={() => onOpenWhyInsight(cluster)}
      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--status-info-fg)] hover:text-[var(--status-info-fg)] hover:underline"
    >
                      <HelpCircle size={13} />
                      <span>Why this insight?</span>
                    </button>}
                  <span className="text-[var(--text-secondary)]" aria-hidden="true">/</span>
                  <span className="text-[11px] text-[var(--text-secondary)] font-mono">
                    {getTeacherStatusLabel(canonicalDecision)}
                  </span>
                </div>

                {
      /* Teacher Decision Controls */
    }
                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  <button
      type="button"
      onClick={() => onUpdateStatus?.(cluster.clusterId, "accepted")}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition ${canonicalDecision === "accepted" ? "ui-status-success shadow-2xs" : "ui-btn-secondary"}`}
    >
                    <Check size={12} />
                    <span>Accept</span>
                  </button>

                  <button
      type="button"
      onClick={(e) => handleStartEdit(cluster, e)}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition ${canonicalDecision === "edited" ? "ui-btn-primary shadow-2xs" : "ui-btn-secondary"}`}
    >
                    <Edit2 size={11} />
                    <span>Edit</span>
                  </button>

                  <button
      type="button"
      onClick={() => onUpdateStatus?.(cluster.clusterId, "dismissed")}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition ${canonicalDecision === "dismissed" ? "ui-status-neutral shadow-2xs" : "ui-btn-secondary"}`}
    >
                    <X size={12} />
                    <span>Dismiss</span>
                  </button>
                </div>
              </div>
            </div>;
  })}
      </div>
    </div>;
};
export {
  MisconceptionMap
};
