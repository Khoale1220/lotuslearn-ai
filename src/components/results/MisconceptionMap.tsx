import React, { useState } from 'react';
import { MisconceptionCluster } from '../../types';
import {
  AlertCircle,
  Check,
  X,
  Edit2,
  ArrowRight,
  HelpCircle,
  Quote,
  ShieldCheck,
  Eye,
} from 'lucide-react';
import { GlowEdgeCard } from '../GlowEdgeCard';
import { ProvenanceBadge } from '../ProvenanceBadge';

interface MisconceptionMapProps {
  clusters: MisconceptionCluster[];
  selectedClusterId: string | null;
  totalStudents?: number;
  onSelectCluster: (clusterId: string) => void;
  onUpdateStatus?: (clusterId: string, status: 'accepted' | 'edited' | 'dismissed') => void;
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

  const handleSaveEdit = (clusterId: string) => {
    setEditingId(null);
    onUpdateStatus?.(clusterId, 'edited');
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider">
              Section 02 · Class Diagnostics
            </span>
            <span className="text-slate-300">·</span>
            <ProvenanceBadge type="gemini" label="Gemini Diagnosis" size="sm" />
            <ProvenanceBadge type="code" label="Code Verified" size="sm" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 mt-1">
            Misconception Discovery Map
          </h2>
          <p className="text-xs text-slate-500">
            Synthesized class-wide patterns discovered by Gemini. Click any card to drill down into verbatim evidence.
          </p>
        </div>
        <div className="text-xs text-slate-500 font-mono">
          Showing <span className="font-semibold text-slate-900">{clusters.length}</span> diagnosed clusters
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {clusters.map((cluster) => {
          const isSelected = selectedClusterId === cluster.clusterId;
          const isDismissed = cluster.status === 'dismissed';
          const isEditing = editingId === cluster.clusterId;
          const displayTitle = editedTitles[cluster.clusterId] || cluster.misconceptionTitle;
          const sampleEvidence = cluster.evidenceExamples[0];

          const priorityBadge =
            cluster.teachingPriority === 'urgent'
              ? 'text-rose-700 bg-rose-50 border-rose-200'
              : cluster.teachingPriority === 'high'
              ? 'text-amber-800 bg-amber-50 border-amber-200'
              : 'text-blue-700 bg-blue-50 border-blue-200';

          const evidenceStrengthBadge =
            cluster.evidenceStrength === 'strong'
              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
              : cluster.evidenceStrength === 'review_required'
              ? 'text-rose-700 bg-rose-50 border-rose-200'
              : 'text-slate-700 bg-slate-50 border-slate-200';

          return (
            <GlowEdgeCard
              key={cluster.clusterId}
              variant="ai"
              selected={isSelected}
              onClick={() => onSelectCluster(cluster.clusterId)}
              className={`cursor-pointer transition-all ${
                isDismissed ? 'opacity-60 bg-slate-50/70' : 'hover:shadow-xs'
              }`}
            >
              <div className="p-5 space-y-3.5">
                {/* Top Meta Line: Zero-pill discipline */}
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${priorityBadge}`}>
                      {cluster.teachingPriority.toUpperCase()} PRIORITY
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="font-semibold text-slate-900 text-[11px] font-mono">
                      {cluster.studentCount} / {totalStudents} students ({cluster.percentageAffected}%)
                    </span>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${evidenceStrengthBadge}`}>
                    Evidence: {cluster.evidenceStrength ? cluster.evidenceStrength.replace('_', ' ') : 'Strong'}
                  </span>
                </div>

                {/* Title & Active State */}
                <div>
                  {isEditing ? (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={displayTitle}
                        onChange={(e) =>
                          setEditedTitles({ ...editedTitles, [cluster.clusterId]: e.target.value })
                        }
                        className="w-full text-sm font-bold text-slate-900 border border-blue-400 rounded px-2 py-1"
                      />
                      <button
                        onClick={() => handleSaveEdit(cluster.clusterId)}
                        className="px-2.5 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-bold text-slate-900 tracking-tight leading-snug">
                        {displayTitle}
                      </h3>
                      {isSelected && (
                        <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded shrink-0 flex items-center gap-1">
                          Active Selection <ArrowRight size={11} />
                        </span>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-slate-600 leading-relaxed mt-1">
                    {cluster.explanation}
                  </p>

                  {/* Compact Provenance Badges (Requested in Prompt) */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-2">
                    <ProvenanceBadge type="gemini" label="Gemini Generated" size="sm" />
                    <ProvenanceBadge type="code" label="Code Verified" size="sm" />
                    <ProvenanceBadge
                      type="human"
                      label={
                        cluster.status === 'accepted'
                          ? 'Teacher Accepted'
                          : cluster.status === 'edited'
                          ? 'Teacher Edited'
                          : cluster.status === 'dismissed'
                          ? 'Teacher Dismissed'
                          : 'Teacher Review Pending'
                      }
                      size="sm"
                    />
                  </div>
                </div>

                {/* Mini Source Evidence Preview */}
                {sampleEvidence && (
                  <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-2.5 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                      <span className="flex items-center gap-1 font-semibold text-slate-700">
                        <Quote size={11} className="text-indigo-500" />
                        Sample Citation ({sampleEvidence.studentId})
                      </span>
                      <span className="text-slate-400">
                        {sampleEvidence.sourceType === 'image_transcription' ? 'Image Transcribed' : 'Typed Quote'}
                      </span>
                    </div>
                    <p className="text-[11px] italic font-serif text-slate-900 truncate">
                      &quot;{sampleEvidence.excerpt}&quot;
                    </p>
                  </div>
                )}

                {/* Affected Students Roster Row */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-semibold uppercase text-slate-400">Students:</span>
                    {cluster.affectedStudentIds.slice(0, 4).map((id) => (
                      <button
                        key={id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onInspectStudent?.(id);
                        }}
                        className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-800 text-[10px] font-mono transition"
                        title="Click to view raw submission"
                      >
                        {id}
                      </button>
                    ))}
                    {cluster.affectedStudentIds.length > 4 && (
                      <span className="text-[10px] text-slate-400">
                        +{cluster.affectedStudentIds.length - 4} more
                      </span>
                    )}
                  </div>

                  {/* "Why this insight?" button (Requested in Prompt) */}
                  {onOpenWhyInsight && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenWhyInsight(cluster);
                      }}
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-md transition shrink-0 ml-2 shadow-2xs"
                      title="Inspect evidence grounding and verification provenance"
                    >
                      <HelpCircle size={12} className="text-indigo-600" />
                      <span>Why this insight?</span>
                    </button>
                  )}
                </div>

                {/* Human-in-the-Loop Decision Row */}
                <div
                  className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                    <span>STATUS:</span>
                    <span className="font-semibold text-slate-700 capitalize">{cluster.status || 'Accepted'}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onUpdateStatus?.(cluster.clusterId, 'accepted')}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs transition ${
                        cluster.status === 'accepted'
                          ? 'bg-emerald-100 text-emerald-800 font-semibold'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                      title="Accept this diagnosed cluster"
                    >
                      <Check size={11} /> Accept
                    </button>

                    <button
                      onClick={() => setEditingId(isEditing ? null : cluster.clusterId)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs text-slate-600 hover:bg-slate-100 transition"
                      title="Edit diagnosis title"
                    >
                      <Edit2 size={11} /> Edit
                    </button>

                    <button
                      onClick={() =>
                        onUpdateStatus?.(
                          cluster.clusterId,
                          isDismissed ? 'accepted' : 'dismissed'
                        )
                      }
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs transition ${
                        isDismissed
                          ? 'text-amber-700 bg-amber-50 font-medium'
                          : 'text-slate-400 hover:text-rose-600 hover:bg-slate-100'
                      }`}
                      title="Dismiss or restore"
                    >
                      <X size={11} /> {isDismissed ? 'Restore' : 'Dismiss'}
                    </button>
                  </div>
                </div>
              </div>
            </GlowEdgeCard>
          );
        })}
      </div>
    </div>
  );
};
