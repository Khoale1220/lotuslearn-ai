import React, { useState } from 'react';
import { MisconceptionCluster, TeacherDecision } from '../../types';
import {
  AlertCircle,
  Check,
  X,
  Edit2,
  HelpCircle,
  Quote,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  getTeacherStatusLabel,
  getCanonicalTeacherDecision,
} from '../../utils/verificationDisplay';

interface MisconceptionMapProps {
  clusters: MisconceptionCluster[];
  selectedClusterId: string | null;
  totalStudents?: number;
  onSelectCluster: (clusterId: string) => void;
  onUpdateStatus?: (
    clusterId: string,
    status: TeacherDecision,
    newTitle?: string
  ) => void;
  onInspectStudent?: (studentId: string) => void;
  onOpenWhyInsight?: (cluster: MisconceptionCluster) => void;
}

export const MisconceptionMap: React.FC<MisconceptionMapProps> = ({
  clusters,
  selectedClusterId,
  totalStudents = 12,
  onSelectCluster,
  onUpdateStatus,
  onInspectStudent,
  onOpenWhyInsight,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedTitles, setEditedTitles] = useState<Record<string, string>>({});

  const handleStartEdit = (cluster: MisconceptionCluster, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(cluster.clusterId);
    setEditedTitles((prev) => ({
      ...prev,
      [cluster.clusterId]: cluster.misconceptionTitle,
    }));
  };

  const handleSaveEdit = (clusterId: string, e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const trimmedTitle = (editedTitles[clusterId] ?? '').trim();
    setEditingId(null);
    if (trimmedTitle) {
      onUpdateStatus?.(clusterId, 'edited', trimmedTitle);
    } else {
      onUpdateStatus?.(clusterId, 'edited');
    }
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-2">
        <div>
          <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider block mb-1">
            Class Diagnostic Patterns
          </span>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Misconception Discovery Map
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Synthesized class-wide patterns identified from student responses. Click any card to inspect supporting quotes.
          </p>
        </div>
        <div className="text-xs text-slate-600 font-mono">
          <span className="font-bold text-slate-900">{clusters.length}</span> diagnosed patterns
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {clusters.map((cluster) => {
          const isSelected = selectedClusterId === cluster.clusterId;
          const canonicalDecision = getCanonicalTeacherDecision(cluster);
          const isDismissed = canonicalDecision === 'dismissed';
          const isEditing = editingId === cluster.clusterId;
          const sampleEvidence = cluster.evidenceExamples[0];

          const priorityBadge =
            cluster.teachingPriority === 'urgent'
              ? 'text-rose-800 bg-rose-50 border-rose-200'
              : cluster.teachingPriority === 'high'
              ? 'text-amber-800 bg-amber-50 border-amber-200'
              : 'text-blue-800 bg-blue-50 border-blue-200';

          const evidenceBadge =
            cluster.evidenceStrength === 'strong'
              ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
              : cluster.evidenceStrength === 'review_required'
              ? 'text-amber-800 bg-amber-50 border-amber-200'
              : 'text-slate-700 bg-slate-100 border-slate-200';

          return (
            <div
              key={cluster.clusterId}
              role="region"
              aria-label={`Misconception cluster: ${cluster.misconceptionTitle}`}
              tabIndex={0}
              onClick={() => onSelectCluster(cluster.clusterId)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  if ((e.target as HTMLElement).tagName !== 'BUTTON' && (e.target as HTMLElement).tagName !== 'INPUT') {
                    e.preventDefault();
                    onSelectCluster(cluster.clusterId);
                  }
                }
              }}
              className={`rounded-xl border p-5 space-y-4 cursor-pointer transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                isSelected
                  ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-xs bg-white'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-2xs'
              } ${isDismissed ? 'opacity-60 bg-slate-50' : ''}`}
            >
              {/* Priority & Impact Bar */}
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 text-xs">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${priorityBadge}`}>
                    {cluster.teachingPriority.toUpperCase()} PRIORITY
                  </span>
                  <span className="text-slate-300" aria-hidden="true">/</span>
                  <span className="font-semibold text-slate-900 text-xs font-mono">
                    {cluster.studentCount} / {totalStudents} students ({cluster.percentageAffected}%)
                  </span>
                </div>

                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${evidenceBadge}`}>
                  Evidence: {cluster.evidenceStrength ? cluster.evidenceStrength.replace('_', ' ') : 'Checked'}
                </span>
              </div>

              {/* Title & Inline Edit */}
              <div>
                {isEditing ? (
                  <form
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
                      onChange={(e) =>
                        setEditedTitles({
                          ...editedTitles,
                          [cluster.clusterId]: e.target.value,
                        })
                      }
                      className="w-full text-sm font-bold text-slate-900 rounded-lg border border-blue-500 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        className="px-3 py-1 text-xs font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="px-3 py-1 text-xs font-medium rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-bold text-slate-900 tracking-tight">
                      {cluster.misconceptionTitle}
                    </h3>
                    <button
                      type="button"
                      onClick={(e) => handleStartEdit(cluster, e)}
                      className="text-slate-400 hover:text-slate-700 p-1 transition rounded shrink-0"
                      title="Edit misconception title"
                      aria-label={`Edit title for ${cluster.misconceptionTitle}`}
                    >
                      <Edit2 size={13} />
                    </button>
                  </div>
                )}
              </div>

              {/* Description */}
              <p className="text-xs text-slate-600 leading-relaxed">
                {cluster.explanation}
              </p>

              {/* Verbatim Excerpt Preview */}
              {sampleEvidence && (
                <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-700">Sample Student Quote:</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onInspectStudent?.(sampleEvidence.studentId);
                      }}
                      className="text-blue-700 hover:underline font-mono font-medium"
                    >
                      {sampleEvidence.studentId}
                    </button>
                  </div>
                  <blockquote className="text-slate-800 italic font-serif leading-snug">
                    &quot;{sampleEvidence.excerpt}&quot;
                  </blockquote>
                </div>
              )}

              {/* Affected Students Chips */}
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  Affected Students ({cluster.affectedStudentIds.length}):
                </span>
                <div className="flex flex-wrap gap-1">
                  {cluster.affectedStudentIds.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onInspectStudent?.(id);
                      }}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-blue-100 text-slate-800 hover:text-blue-900 text-xs font-mono font-medium transition"
                      aria-label={`Inspect ${id}`}
                    >
                      {id}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bottom Line: Why this insight? + Human Decision Controls */}
              <div
                className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-2">
                  {onOpenWhyInsight && (
                    <button
                      type="button"
                      onClick={() => onOpenWhyInsight(cluster)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                    >
                      <HelpCircle size={13} />
                      <span>Why this insight?</span>
                    </button>
                  )}
                  <span className="text-slate-300" aria-hidden="true">/</span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {getTeacherStatusLabel(canonicalDecision)}
                  </span>
                </div>

                {/* Teacher Decision Controls */}
                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => onUpdateStatus?.(cluster.clusterId, 'accepted')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition ${
                      canonicalDecision === 'accepted'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Check size={12} />
                    <span>Accept</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleStartEdit(cluster, e)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition ${
                      canonicalDecision === 'edited'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Edit2 size={11} />
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onUpdateStatus?.(cluster.clusterId, 'dismissed')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition ${
                      canonicalDecision === 'dismissed'
                        ? 'bg-slate-700 text-white shadow-2xs'
                        : 'border border-slate-300 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                    }`}
                  >
                    <X size={12} />
                    <span>Dismiss</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
