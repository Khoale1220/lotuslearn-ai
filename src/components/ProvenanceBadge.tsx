import React from 'react';
import { Sparkles, ShieldCheck, UserCheck, CheckCircle2, AlertOctagon } from 'lucide-react';

export type ProvenanceType = 'gemini' | 'code' | 'human' | 'verified' | 'warning';

interface ProvenanceBadgeProps {
  type: ProvenanceType;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const ProvenanceBadge: React.FC<ProvenanceBadgeProps> = ({
  type,
  label,
  size = 'sm',
  className = '',
}) => {
  const isSm = size === 'sm';

  switch (type) {
    case 'gemini':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded-md border text-slate-700 bg-indigo-50/60 border-indigo-200/80 ${
            isSm ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
          } ${className}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" aria-hidden="true" />
          <span className="font-semibold text-indigo-900">{label || 'Gemini Generated'}</span>
        </span>
      );

    case 'code':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded-md border text-slate-700 bg-teal-50/60 border-teal-200/80 ${
            isSm ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
          } ${className}`}
        >
          <ShieldCheck size={isSm ? 12 : 14} className="text-teal-600 shrink-0" aria-hidden="true" />
          <span className="font-semibold text-teal-900">{label || 'Code Verified'}</span>
        </span>
      );

    case 'human':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded-md border text-slate-700 bg-amber-50/60 border-amber-200/80 ${
            isSm ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
          } ${className}`}
        >
          <UserCheck size={isSm ? 12 : 14} className="text-amber-600 shrink-0" aria-hidden="true" />
          <span className="font-semibold text-amber-900">{label || 'Teacher Reviewed'}</span>
        </span>
      );

    case 'verified':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded-md border text-slate-700 bg-emerald-50/60 border-emerald-200/80 ${
            isSm ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
          } ${className}`}
        >
          <CheckCircle2 size={isSm ? 12 : 14} className="text-emerald-600 shrink-0" aria-hidden="true" />
          <span className="font-semibold text-emerald-900">{label || 'Verified Grounding'}</span>
        </span>
      );

    case 'warning':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded-md border text-slate-700 bg-amber-50/60 border-amber-200/80 ${
            isSm ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
          } ${className}`}
        >
          <AlertOctagon size={isSm ? 12 : 14} className="text-amber-600 shrink-0" aria-hidden="true" />
          <span className="font-semibold text-amber-900">{label || 'Review Required'}</span>
        </span>
      );

    default:
      return null;
  }
};
