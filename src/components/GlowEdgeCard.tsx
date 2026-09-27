import React, { useState, useRef, useEffect } from 'react';

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
  const cardRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotion || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setCoords({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => {
    setIsHovered(false);
    setCoords(null);
  };

  // Color configurations per requested spec:
  // AI: blue → indigo → subtle violet
  // Validation: cyan → teal
  // Human: warm gold
  const glowConfigs: Record<
    GlowVariant,
    {
      gradient: string;
      radialSpotlight: string;
      activeShadow: string;
      hoverShadow: string;
      defaultBorder: string;
    }
  > = {
    ai: {
      gradient: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%)',
      radialSpotlight: 'rgba(99, 102, 241, 0.85), rgba(59, 130, 246, 0.5), transparent 70%',
      activeShadow:
        '0 0 0 1px rgba(99, 102, 241, 0.4), 0 0 20px -2px rgba(99, 102, 241, 0.35), 0 8px 16px -4px rgba(99, 102, 241, 0.15)',
      hoverShadow: '0 0 14px -2px rgba(99, 102, 241, 0.25)',
      defaultBorder: '#e2e8f0',
    },
    validation: {
      gradient: 'linear-gradient(135deg, #06b6d4 0%, #14b8a6 50%, #0d9488 100%)',
      radialSpotlight: 'rgba(20, 184, 166, 0.85), rgba(6, 182, 212, 0.5), transparent 70%',
      activeShadow:
        '0 0 0 1px rgba(20, 184, 166, 0.4), 0 0 20px -2px rgba(20, 184, 166, 0.35), 0 8px 16px -4px rgba(20, 184, 166, 0.15)',
      hoverShadow: '0 0 14px -2px rgba(20, 184, 166, 0.25)',
      defaultBorder: '#e2e8f0',
    },
    verified: {
      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      radialSpotlight: 'rgba(16, 185, 129, 0.85), transparent 70%',
      activeShadow:
        '0 0 0 1px rgba(16, 185, 129, 0.4), 0 0 18px -2px rgba(16, 185, 129, 0.3)',
      hoverShadow: '0 0 12px -2px rgba(16, 185, 129, 0.2)',
      defaultBorder: '#e2e8f0',
    },
    warning: {
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      radialSpotlight: 'rgba(245, 158, 11, 0.85), transparent 70%',
      activeShadow:
        '0 0 0 1px rgba(245, 158, 11, 0.4), 0 0 18px -2px rgba(245, 158, 11, 0.3)',
      hoverShadow: '0 0 12px -2px rgba(245, 158, 11, 0.2)',
      defaultBorder: '#e2e8f0',
    },
    human: {
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)',
      radialSpotlight: 'rgba(217, 119, 6, 0.85), rgba(245, 158, 11, 0.5), transparent 70%',
      activeShadow:
        '0 0 0 1px rgba(217, 119, 6, 0.4), 0 0 20px -2px rgba(217, 119, 6, 0.35), 0 8px 16px -4px rgba(217, 119, 6, 0.15)',
      hoverShadow: '0 0 14px -2px rgba(217, 119, 6, 0.25)',
      defaultBorder: '#e2e8f0',
    },
    neutral: {
      gradient: 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)',
      radialSpotlight: 'rgba(148, 163, 184, 0.6), transparent 70%',
      activeShadow:
        '0 0 0 1px rgba(148, 163, 184, 0.3), 0 0 14px -2px rgba(148, 163, 184, 0.2)',
      hoverShadow: '0 0 10px -2px rgba(148, 163, 184, 0.15)',
      defaultBorder: '#e2e8f0',
    },
  };

  const config = glowConfigs[variant] || glowConfigs.ai;

  // Compute outer background style
  let backgroundStyle: string;
  let shadowStyle: string | undefined;

  if (selected) {
    backgroundStyle = config.gradient;
    shadowStyle = config.activeShadow;
  } else if (!reducedMotion && isHovered && coords) {
    backgroundStyle = `radial-gradient(220px circle at ${coords.x}px ${coords.y}px, ${config.radialSpotlight}), ${config.defaultBorder}`;
    shadowStyle = config.hoverShadow;
  } else {
    backgroundStyle = config.defaultBorder;
    shadowStyle = undefined;
  }

  return (
    <Component
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        background: backgroundStyle,
        boxShadow: shadowStyle,
      }}
      className={`relative rounded-[16px] p-[1.5px] transition-all duration-200 ${className}`}
      {...rest}
    >
      {/* Card Content Interior: 100% readable, clean solid interior background */}
      <div
        className={`w-full h-full rounded-[14.5px] bg-white relative z-10 transition-colors ${innerClassName}`}
      >
        {children}
      </div>
    </Component>
  );
};
