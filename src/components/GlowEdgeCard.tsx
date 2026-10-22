import React from 'react';

export type GlowVariant = 'ai' | 'validation' | 'verified' | 'warning' | 'human' | 'neutral';

interface GlowEdgeCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: GlowVariant;
  selected?: boolean;
  className?: string;
  innerClassName?: string;
  children: React.ReactNode;
  as?: React.ElementType;
}

export const GlowEdgeCard: React.FC<GlowEdgeCardProps> = ({
  variant = 'ai',
  selected = false,
  className = '',
  innerClassName = '',
  children,
  as: Component = 'div',
  ...rest
}) => {
  // Professional educational design system:
  // Restrained neutral borders with contextual state rings when selected
  let borderClass = 'border-slate-200 shadow-2xs hover:border-slate-300 hover:shadow-xs';
  
  if (selected) {
    switch (variant) {
      case 'ai':
        borderClass = 'border-blue-500 ring-2 ring-blue-500/20 shadow-xs';
        break;
      case 'validation':
        borderClass = 'border-teal-500 ring-2 ring-teal-500/20 shadow-xs';
        break;
      case 'verified':
        borderClass = 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs';
        break;
      case 'warning':
      case 'human':
        borderClass = 'border-amber-500 ring-2 ring-amber-500/20 shadow-xs';
        break;
      default:
        borderClass = 'border-slate-400 ring-2 ring-slate-400/20 shadow-xs';
        break;
    }
  }

  return (
    <Component
      className={`relative rounded-xl border bg-white transition-all duration-150 ${borderClass} ${className}`}
      {...rest}
    >
      <div className={`w-full h-full rounded-xl bg-white ${innerClassName}`}>
        {children}
      </div>
    </Component>
  );
};

