import React from 'react';
import { 
  Sliders, 
  Maximize2, 
  Minimize2, 
  Monitor, 
  LayoutGrid, 
  Type, 
  Check, 
  X,
  Layers,
  Sparkles,
  Smartphone,
  Sun,
  Moon
} from 'lucide-react';
import { useDisplay, WidthMode, DensityMode, CoreWidgetMode } from '../context/DisplayContext';
import { useTheme } from '../context/ThemeContext';

interface DisplaySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DisplaySettingsModal: React.FC<DisplaySettingsModalProps> = ({ isOpen, onClose }) => {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';
  const {
    widthMode,
    setWidthMode,
    density,
    setDensity,
    uiScale,
    setUiScale,
    coreWidgetMode,
    setCoreWidgetMode,
  } = useDisplay();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 backdrop-blur-2xl animate-in fade-in duration-200 bg-slate-950/80">
      <div className={`relative w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden transition-all duration-300 ${
        isDark 
          ? 'glass-modal border-white/15 text-slate-100' 
          : 'bg-white/95 border-slate-200 text-slate-900 shadow-[0_25px_80px_rgba(15,23,42,0.2)]'
      }`}>
        
        {/* Header */}
        <div className={`px-6 py-5 border-b flex items-center justify-between gap-4 ${
          isDark ? 'border-white/10 bg-slate-950/70' : 'border-slate-200 bg-slate-50/90'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-400 via-teal-400 to-indigo-500 flex items-center justify-center text-slate-950 shadow-lg shadow-teal-500/25 ring-1 ring-white/30">
              <Sliders className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`text-base font-bold font-display tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Screen Margins & Display Settings
                </h3>
              </div>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Adjust page width, padding density, and widget sizes to your screen
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition cursor-pointer ${
              isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          
          {/* Theme Appearance: Light and Dark Mode */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold font-display uppercase tracking-wider text-emerald-500 dark:text-emerald-400 flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                <span>Theme Mode & Visual Atmosphere</span>
              </label>
              <span className={`text-[11px] font-mono font-bold capitalize px-2 py-0.5 rounded-full ${
                isDark 
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' 
                  : 'bg-blue-500/15 text-blue-700 border border-blue-500/30'
              }`}>
                {theme} Mode Active
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`p-3.5 rounded-2xl border text-left transition-all duration-300 cursor-pointer flex flex-col justify-between relative overflow-hidden group ${
                  !isDark
                    ? 'border-blue-500 bg-gradient-to-br from-blue-500/15 via-white/95 to-emerald-500/10 shadow-lg shadow-blue-500/10 ring-2 ring-blue-400/30'
                    : 'border-white/10 bg-slate-900/40 hover:bg-slate-900 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-emerald-500 to-blue-500 flex items-center justify-center text-white shadow-sm">
                      <Sun className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <span className={`font-bold block ${isDark ? 'text-white' : 'text-slate-900'}`}>Light Mode</span>
                      <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Clinical sterile clarity</span>
                    </div>
                  </div>
                  {!isDark && (
                    <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`p-3.5 rounded-2xl border text-left transition-all duration-300 cursor-pointer flex flex-col justify-between relative overflow-hidden group ${
                  isDark
                    ? 'border-emerald-400 bg-gradient-to-br from-emerald-500/20 via-slate-900/80 to-blue-600/15 shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-400/30'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-blue-600 to-emerald-400 flex items-center justify-center text-white shadow-sm shadow-emerald-500/30">
                      <Moon className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <span className={`font-bold block ${isDark ? 'text-white' : 'text-slate-900'}`}>Dark Mode</span>
                      <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Deep navy oceanic neon</span>
                    </div>
                  </div>
                  {isDark && (
                    <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* 1. Page Width & Screen Margins */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold font-display uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5" />
                <span>Page Width & Screen Margins</span>
              </label>
              <span className={`text-[11px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {widthMode === 'fluid' ? '100% Full Width' : widthMode === 'wide' ? '1600px Max' : widthMode === 'default' ? '1280px Max' : '1080px Max'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setWidthMode('fluid')}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  widthMode === 'fluid'
                    ? 'border-teal-500 bg-teal-500/15 shadow-sm'
                    : isDark ? 'border-white/10 bg-slate-900/40 hover:bg-slate-900' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Fluid (100%)</span>
                  {widthMode === 'fluid' && <Check className="w-3.5 h-3.5 text-teal-400" />}
                </div>
                <span className={`text-[10px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Uses 100% of viewer display
                </span>
              </button>

              <button
                type="button"
                onClick={() => setWidthMode('wide')}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  widthMode === 'wide'
                    ? 'border-teal-500 bg-teal-500/15 shadow-sm'
                    : isDark ? 'border-white/10 bg-slate-900/40 hover:bg-slate-900' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Widescreen (1600px)</span>
                  {widthMode === 'wide' && <Check className="w-3.5 h-3.5 text-teal-400" />}
                </div>
                <span className={`text-[10px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Generous widescreen margins
                </span>
              </button>

              <button
                type="button"
                onClick={() => setWidthMode('default')}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  widthMode === 'default'
                    ? 'border-teal-500 bg-teal-500/15 shadow-sm'
                    : isDark ? 'border-white/10 bg-slate-900/40 hover:bg-slate-900' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Standard (1280px)</span>
                  {widthMode === 'default' && <Check className="w-3.5 h-3.5 text-teal-400" />}
                </div>
                <span className={`text-[10px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Balanced default desktop
                </span>
              </button>

              <button
                type="button"
                onClick={() => setWidthMode('compact')}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  widthMode === 'compact'
                    ? 'border-teal-500 bg-teal-500/15 shadow-sm'
                    : isDark ? 'border-white/10 bg-slate-900/40 hover:bg-slate-900' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Compact (1080px)</span>
                  {widthMode === 'compact' && <Check className="w-3.5 h-3.5 text-teal-400" />}
                </div>
                <span className={`text-[10px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Narrow centered reading view
                </span>
              </button>
            </div>
          </div>

          {/* 2. Spacing & Margin Density */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold font-display uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Vertical Spacing & Content Padding</span>
              </label>
              <span className={`text-[11px] font-mono capitalize ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {density} Density
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setDensity('compact')}
                className={`p-3 rounded-2xl border text-center transition cursor-pointer ${
                  density === 'compact'
                    ? 'border-emerald-500 bg-emerald-500/15 shadow-sm font-bold'
                    : isDark ? 'border-white/10 bg-slate-900/40 hover:bg-slate-900' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <div className={isDark ? 'text-white' : 'text-slate-900'}>Compact</div>
                <div className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Tighter rows</div>
              </button>

              <button
                type="button"
                onClick={() => setDensity('standard')}
                className={`p-3 rounded-2xl border text-center transition cursor-pointer ${
                  density === 'standard'
                    ? 'border-emerald-500 bg-emerald-500/15 shadow-sm font-bold'
                    : isDark ? 'border-white/10 bg-slate-900/40 hover:bg-slate-900' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <div className={isDark ? 'text-white' : 'text-slate-900'}>Standard</div>
                <div className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Default balance</div>
              </button>

              <button
                type="button"
                onClick={() => setDensity('spacious')}
                className={`p-3 rounded-2xl border text-center transition cursor-pointer ${
                  density === 'spacious'
                    ? 'border-emerald-500 bg-emerald-500/15 shadow-sm font-bold'
                    : isDark ? 'border-white/10 bg-slate-900/40 hover:bg-slate-900' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <div className={isDark ? 'text-white' : 'text-slate-900'}>Spacious</div>
                <div className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Airy margins</div>
              </button>
            </div>
          </div>

          {/* 3. ZoeyPulsarCore AI Box Display Mode */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold font-display uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Kinetic Core Box Height</span>
              </label>
              <span className={`text-[11px] font-mono capitalize ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {coreWidgetMode} View
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setCoreWidgetMode('collapsed')}
                className={`p-3 rounded-2xl border text-center transition cursor-pointer ${
                  coreWidgetMode === 'collapsed'
                    ? 'border-indigo-500 bg-indigo-500/15 shadow-sm font-bold'
                    : isDark ? 'border-white/10 bg-slate-900/40 hover:bg-slate-900' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-center gap-1">
                  <Minimize2 className="w-3 h-3 text-indigo-400" />
                  <span className={isDark ? 'text-white' : 'text-slate-900'}>Slim Ticker</span>
                </div>
                <div className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Max data room</div>
              </button>

              <button
                type="button"
                onClick={() => setCoreWidgetMode('standard')}
                className={`p-3 rounded-2xl border text-center transition cursor-pointer ${
                  coreWidgetMode === 'standard'
                    ? 'border-indigo-500 bg-indigo-500/15 shadow-sm font-bold'
                    : isDark ? 'border-white/10 bg-slate-900/40 hover:bg-slate-900' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <div className={isDark ? 'text-white' : 'text-slate-900'}>Standard Box</div>
                <div className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Balanced core</div>
              </button>

              <button
                type="button"
                onClick={() => setCoreWidgetMode('expanded')}
                className={`p-3 rounded-2xl border text-center transition cursor-pointer ${
                  coreWidgetMode === 'expanded'
                    ? 'border-indigo-500 bg-indigo-500/15 shadow-sm font-bold'
                    : isDark ? 'border-white/10 bg-slate-900/40 hover:bg-slate-900' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-center gap-1">
                  <Maximize2 className="w-3 h-3 text-indigo-400" />
                  <span className={isDark ? 'text-white' : 'text-slate-900'}>Full Studio</span>
                </div>
                <div className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Cinematic view</div>
              </button>
            </div>
          </div>

          {/* 4. Text & UI Scaling */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold font-display uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5" />
                <span>Text & UI Scale</span>
              </label>
              <span className="font-mono text-xs font-bold text-amber-400">
                {uiScale}%
              </span>
            </div>

            <div className="flex items-center gap-2">
              {[90, 95, 100, 105, 110].map((scale) => (
                <button
                  key={scale}
                  type="button"
                  onClick={() => setUiScale(scale)}
                  className={`flex-1 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer border ${
                    uiScale === scale
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                      : isDark
                        ? 'bg-slate-900/50 text-slate-400 border-white/10 hover:text-white'
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:text-slate-900'
                  }`}
                >
                  {scale}%
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t flex items-center justify-between ${
          isDark ? 'border-white/10 bg-slate-950/60' : 'border-slate-200 bg-slate-50/80'
        }`}>
          <button
            type="button"
            onClick={() => {
              setWidthMode('wide');
              setDensity('standard');
              setUiScale(100);
              setCoreWidgetMode('standard');
            }}
            className={`text-xs font-mono transition cursor-pointer ${
              isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Reset Defaults
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-400 to-emerald-400 text-slate-950 font-bold text-xs shadow-md transition cursor-pointer"
          >
            Apply & Close
          </button>
        </div>

      </div>
    </div>
  );
};
