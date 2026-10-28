import React from 'react';
import { Sun, Moon, Sparkles } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', showLabel = true }) => {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div
      role="radiogroup"
      aria-label="Light and Dark Mode Selector"
      className={`relative inline-flex items-center p-1 rounded-2xl border transition-all duration-300 backdrop-blur-2xl select-none group ${
        isDark
          ? 'glass-panel bg-slate-950/80 border-white/[0.14] shadow-[0_8px_32px_rgba(0,0,0,0.55)] ring-1 ring-white/10'
          : 'bg-white/90 border-slate-200/95 shadow-[0_8px_30px_rgba(15,23,42,0.1)] ring-1 ring-slate-900/5'
      } ${className}`}
    >
      {/* Specular glass reflection bar across the top */}
      <div className="absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />

      {/* Light Mode Button */}
      <button
        type="button"
        role="radio"
        aria-checked={!isDark}
        onClick={() => setTheme('light')}
        title="Activate Light Mode"
        className={`relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer ${
          !isDark
            ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-blue-500 text-white shadow-md shadow-emerald-500/25 ring-1 ring-white/60 font-black scale-102'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 active:scale-95'
        }`}
      >
        <Sun className={`w-3.5 h-3.5 transition-transform duration-500 ${!isDark ? 'rotate-0 text-white scale-110 drop-shadow-[0_0_6px_rgba(255,255,255,0.7)]' : '-rotate-45'}`} />
        <span className="font-mono tracking-tight text-[11px]">Light</span>
      </button>

      {/* Dark Mode Button */}
      <button
        type="button"
        role="radio"
        aria-checked={isDark}
        onClick={() => setTheme('dark')}
        title="Activate Dark Mode"
        className={`relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer ${
          isDark
            ? 'bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-500 text-white shadow-md shadow-blue-500/35 ring-1 ring-white/50 font-black scale-102'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:scale-95'
        }`}
      >
        <Moon className={`w-3.5 h-3.5 transition-transform duration-500 ${isDark ? 'rotate-0 text-white scale-110 drop-shadow-[0_0_6px_rgba(255,255,255,0.7)]' : 'rotate-12'}`} />
        <span className="font-mono tracking-tight text-[11px]">Dark</span>
      </button>

      {/* Luminous Pulsing Quantum Jewel Indicator (Skiper/Animaster Style) */}
      <div className="relative flex items-center justify-center mx-1.5">
        <span
          className={`w-2 h-2 rounded-full transition-all duration-500 ${
            isDark
              ? 'bg-emerald-400 shadow-[0_0_12px_#10b981] animate-pulse'
              : 'bg-blue-500 shadow-[0_0_12px_#3b82f6]'
          }`}
        />
        <span
          className={`absolute w-3.5 h-3.5 rounded-full -inset-0.75 pointer-events-none opacity-40 transition-all duration-500 animate-ping ${
            isDark ? 'bg-emerald-400' : 'bg-blue-400'
          }`}
        />
      </div>
    </div>
  );
};
