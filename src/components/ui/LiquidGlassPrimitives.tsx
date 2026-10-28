import React from 'react';
import { useTheme } from '../../context/ThemeContext';

/**
 * Liquid Glass Primitives — Pulsar Master Design System
 * 
 * Implements refined liquid-glass morphism, Apple-inspired spatial depth,
 * crisp contrast, and zero-pill discipline across:
 * - GlassCard (Elevated content surface with high legibility)
 * - GlassSurface (Floating action surface / control docks)
 * - GlassStatusChip (Subtle state indicator with semantic colors)
 * - GlassDropdown (Translucent layered menu)
 * - GlassAISurface (Reserved violet-tinted intelligence surface)
 * - GlassModalLayer (Multi-layered focused dialog backdrop and shell)
 */

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'interactive' | 'flat';
  children: React.ReactNode;
  className?: string;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  variant = 'default',
  children,
  className = '',
  ...props
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const baseStyles = 'relative rounded-2xl transition-all duration-250';
  
  const variantStyles = {
    default: isDark
      ? 'bg-[#111C2E]/85 backdrop-blur-xl border border-slate-700/30 text-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.35)]'
      : 'bg-white/90 backdrop-blur-xl border border-[#DCE5EC] text-[#172338] shadow-[0_4px_20px_rgba(23,35,56,0.05)]',
    elevated: isDark
      ? 'bg-[#17263B]/90 backdrop-blur-2xl border border-slate-700/40 text-slate-100 shadow-[0_16px_40px_rgba(0,0,0,0.5)]'
      : 'bg-white/96 backdrop-blur-2xl border border-[#DCE5EC] text-[#172338] shadow-[0_10px_30px_rgba(23,35,56,0.08)]',
    interactive: isDark
      ? 'bg-[#111C2E]/80 hover:bg-[#17263B]/95 backdrop-blur-xl border border-slate-700/30 hover:border-teal-500/40 text-slate-100 shadow-[0_8px_24px_rgba(0,0,0,0.35)] hover:shadow-[0_12px_32px_rgba(45,212,191,0.12)] cursor-pointer'
      : 'bg-white/85 hover:bg-white backdrop-blur-xl border border-[#DCE5EC] hover:border-teal-600/40 text-[#172338] shadow-[0_4px_16px_rgba(23,35,56,0.05)] hover:shadow-[0_8px_24px_rgba(13,148,136,0.08)] cursor-pointer',
    flat: isDark
      ? 'bg-[#111C2E]/50 border border-slate-800/40 text-slate-200'
      : 'bg-[#EAF5F7]/60 border border-[#DCE5EC] text-[#172338]',
  };

  return (
    <div className={`${baseStyles} ${variantStyles[variant]} ${className}`} {...props}>
      {children}
    </div>
  );
};

interface GlassSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  elevation?: 'low' | 'mid' | 'high';
}

export const GlassSurface: React.FC<GlassSurfaceProps> = ({
  children,
  className = '',
  elevation = 'mid',
  ...props
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const elevationStyles = {
    low: isDark 
      ? 'bg-[#111C2E]/70 backdrop-blur-md border border-slate-700/30' 
      : 'bg-white/75 backdrop-blur-md border border-[#DCE5EC] shadow-sm',
    mid: isDark 
      ? 'bg-[#111C2E]/85 backdrop-blur-xl border border-slate-700/40 shadow-lg' 
      : 'bg-white/88 backdrop-blur-xl border border-[#DCE5EC] shadow-[0_8px_24px_rgba(23,35,56,0.06)]',
    high: isDark 
      ? 'bg-[#17263B]/92 backdrop-blur-2xl border border-slate-600/40 shadow-2xl' 
      : 'bg-white/95 backdrop-blur-2xl border border-[#DCE5EC] shadow-[0_16px_40px_rgba(23,35,56,0.1)]',
  };

  return (
    <div className={`rounded-2xl transition-all duration-200 ${elevationStyles[elevation]} ${className}`} {...props}>
      {children}
    </div>
  );
};

interface GlassStatusChipProps {
  status: 'active' | 'success' | 'warning' | 'error' | 'ai' | 'neutral';
  label: string;
  pulse?: boolean;
  className?: string;
}

export const GlassStatusChip: React.FC<GlassStatusChipProps> = ({
  status,
  label,
  pulse = false,
  className = '',
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const colorConfig = {
    active: {
      dot: 'bg-[#0D9488] dark:bg-[#2DD4BF]',
      text: 'text-[#0D9488] dark:text-[#2DD4BF]',
      bg: isDark ? 'bg-teal-950/40 border-teal-500/25' : 'bg-teal-50 border-teal-200/80',
    },
    success: {
      dot: 'bg-[#16A34A] dark:bg-emerald-400',
      text: 'text-[#16A34A] dark:text-emerald-400',
      bg: isDark ? 'bg-emerald-950/40 border-emerald-500/25' : 'bg-emerald-50 border-emerald-200/80',
    },
    warning: {
      dot: 'bg-[#D97706] dark:bg-amber-400',
      text: 'text-[#D97706] dark:text-amber-400',
      bg: isDark ? 'bg-amber-950/40 border-amber-500/25' : 'bg-amber-50 border-amber-200/80',
    },
    error: {
      dot: 'bg-[#DC2626] dark:bg-rose-400',
      text: 'text-[#DC2626] dark:text-rose-400',
      bg: isDark ? 'bg-rose-950/40 border-rose-500/25' : 'bg-rose-50 border-rose-200/80',
    },
    ai: {
      dot: 'bg-[#7C3AED] dark:bg-[#A78BFA]',
      text: 'text-[#7C3AED] dark:text-[#A78BFA]',
      bg: isDark ? 'bg-violet-950/40 border-violet-500/30' : 'bg-purple-50 border-purple-200/80',
    },
    neutral: {
      dot: 'bg-[#64748B] dark:bg-slate-400',
      text: 'text-[#64748B] dark:text-slate-300',
      bg: isDark ? 'bg-slate-900/60 border-slate-700/30' : 'bg-slate-100 border-slate-200',
    },
  };

  const current = colorConfig[status] || colorConfig.neutral;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border backdrop-blur-md select-none ${current.bg} ${current.text} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${current.dot} ${pulse ? 'animate-pulse' : ''}`} />
      <span className="font-medium tracking-tight">{label}</span>
    </div>
  );
};

interface GlassAISurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  badge?: string;
}

export const GlassAISurface: React.FC<GlassAISurfaceProps> = ({
  children,
  className = '',
  badge = 'Pulsar Intelligence',
  ...props
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div
      className={`relative rounded-2xl p-5 border backdrop-blur-xl transition-all duration-300 ${
        isDark
          ? 'bg-gradient-to-br from-[#111C2E]/95 via-[#17263B]/90 to-[#1e1e38]/85 border-violet-500/30 shadow-[0_12px_36px_rgba(124,58,237,0.1)]'
          : 'bg-gradient-to-br from-white/95 via-purple-50/40 to-indigo-50/30 border-purple-200/80 shadow-[0_8px_24px_rgba(124,58,237,0.06)]'
      } ${className}`}
      {...props}
    >
      {badge && (
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mb-3 text-[#7C3AED] dark:text-[#A78BFA]">
          <span className="w-2 h-2 rounded-full bg-[#7C3AED] dark:bg-[#A78BFA] animate-pulse" />
          <span>{badge}</span>
        </div>
      )}
      {children}
    </div>
  );
};
