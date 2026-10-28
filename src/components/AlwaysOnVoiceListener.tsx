import { useState } from 'react';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  Zap, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  CalendarPlus, 
  TrendingUp, 
  PhoneCall, 
  HelpCircle,
  X,
  Flame,
  Activity,
  Radio,
  Power,
  Minimize2
} from 'lucide-react';
import type { VoiceMode, VoiceCommandHistoryItem } from '../hooks/useVoiceCommandListener';
import { useTheme } from '../context/ThemeContext';

interface AlwaysOnVoiceListenerProps {
  voiceMode?: VoiceMode;
  onSetVoiceMode?: (mode: VoiceMode) => void;
  isAlwaysOn: boolean;
  isListening: boolean;
  isSupported: boolean;
  hasPermission: boolean | null;
  transcript: string;
  interimTranscript: string;
  audioLevel: number;
  autoOffSecondsRemaining?: number | null;
  voiceFeedbackEnabled: boolean;
  onToggleVoiceFeedback: (enabled: boolean) => void;
  lastActionMessage: string | null;
  commandHistory: VoiceCommandHistoryItem[];
  onToggleAlwaysOn: () => void;
  onToggleListening?: () => void;
  onTriggerCommand: (cmd: string) => void;
}

export const AlwaysOnVoiceListener = ({
  voiceMode = 'need-based',
  onSetVoiceMode,
  isAlwaysOn,
  isListening,
  isSupported,
  hasPermission,
  transcript: _transcript,
  interimTranscript,
  audioLevel,
  autoOffSecondsRemaining = null,
  voiceFeedbackEnabled,
  onToggleVoiceFeedback,
  lastActionMessage,
  commandHistory,
  onToggleAlwaysOn,
  onToggleListening,
  onTriggerCommand
}: AlwaysOnVoiceListenerProps) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  // Minimized = floating mic button only (bottom-right). Defaults to
  // minimized on first load so the panel never covers page content on
  // arrival; the user's choice persists across reloads.
  const [isMinimized, setIsMinimized] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('pulsar_voice_minimized');
      return stored === null ? true : stored === 'true';
    } catch {
      return true;
    }
  });

  const updateMinimized = (next: boolean) => {
    setIsMinimized(next);
    try {
      localStorage.setItem('pulsar_voice_minimized', String(next));
    } catch {
      // storage unavailable (private mode) — state still applies this session
    }
  };

  const effectiveToggle = onToggleListening ?? onToggleAlwaysOn;

  const sampleKeywords = [
    { 
      label: 'Schedule follow up for Marcus Vance', 
      cmd: 'Schedule follow up for Marcus Vance',
      desc: 'Creates high-priority call task and opens Reminders',
      icon: CalendarPlus,
      color: 'emerald'
    },
    { 
      label: 'Add lead to pipeline', 
      cmd: 'Add lead to pipeline',
      desc: 'Moves lead to active pipeline, boosts projected MRR',
      icon: TrendingUp,
      color: 'blue'
    },
    { 
      label: 'Call Marcus Vance', 
      cmd: 'Call Marcus Vance',
      desc: 'Loads Dr. Vance into Call Studio and opens dialer',
      icon: PhoneCall,
      color: 'teal'
    },
    { 
      label: 'Open Daily Briefing', 
      cmd: 'Open daily briefing',
      desc: 'Switches to 4:00 PM PST Daily Briefing',
      icon: Flame,
      color: 'amber'
    },
    { 
      label: 'Toggle Dark / Light Mode', 
      cmd: 'Toggle theme',
      desc: 'Switches system design theme instantaneously',
      icon: Sparkles,
      color: 'purple'
    }
  ];

  return (
    <>
      {/* Floating Need-Based & Always-On Voice Listener HUD (Bottom Right, above the mic button) */}
      {!isMinimized && (
      <aside 
        aria-label="Voice command assistant"
        className="fixed bottom-24 right-4 z-40 max-w-sm sm:max-w-md w-[calc(100vw-2rem)] select-none transition-all duration-300"
      >
        {/* Main Glassmorphic Capsule */}
        <div className={`p-2.5 sm:p-3 rounded-2xl border shadow-2xl backdrop-blur-2xl transition-all duration-300 ${
          isDark 
            ? 'glass-panel bg-slate-950/90 border-white/[0.12] text-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.6)] ring-1 ring-white/10' 
            : 'bg-white/95 border-slate-200/90 text-slate-900 shadow-[0_16px_40px_rgba(15,23,42,0.14)] ring-1 ring-slate-900/5'
        }`}>
          
          {/* Top Row: Mode Switcher + Mic State Indicator + Quick Actions */}
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/60 dark:border-white/[0.08]">
            {/* Mode Switcher Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/90 p-0.5 rounded-xl border border-slate-200/80 dark:border-white/[0.06] text-[10px]">
              <button
                type="button"
                onClick={() => onSetVoiceMode ? onSetVoiceMode('need-based') : onToggleAlwaysOn()}
                className={`px-2 py-0.5 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${
                  voiceMode === 'need-based'
                    ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Need-Based Mode: Turns on when you speak or tap, executes command, and turns off automatically"
              >
                <Zap className="w-3 h-3" />
                <span>Need-Based</span>
              </button>

              <button
                type="button"
                onClick={() => onSetVoiceMode ? onSetVoiceMode('always-on') : onToggleAlwaysOn()}
                className={`px-2 py-0.5 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${
                  voiceMode === 'always-on'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Always-On Mode: Continuously listens in the background"
              >
                <Radio className="w-3 h-3" />
                <span>Always-On</span>
              </button>

              <button
                type="button"
                onClick={() => onSetVoiceMode ? onSetVoiceMode('off') : onToggleAlwaysOn()}
                className={`px-1.5 py-0.5 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${
                  voiceMode === 'off'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Voice Listener Off: Muted"
              >
                <Power className="w-3 h-3" />
                <span>Off</span>
              </button>
            </div>

            {/* Right: Sound feedback & Help Modal */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onToggleVoiceFeedback(!voiceFeedbackEnabled)}
                className={`p-1.5 rounded-lg border transition cursor-pointer ${
                  voiceFeedbackEnabled
                    ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10'
                    : isDark
                      ? 'text-slate-500 border-slate-800 bg-slate-900 hover:text-slate-300'
                      : 'text-slate-400 border-slate-200 bg-slate-50 hover:text-slate-700'
                }`}
                title={voiceFeedbackEnabled ? 'Spoken Voice Feedback: ON (Click to mute)' : 'Spoken Voice Feedback: OFF (Click to unmute)'}
              >
                {voiceFeedbackEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => setShowHelpModal(true)}
                className={`p-1.5 rounded-lg border transition cursor-pointer ${
                  isDark ? 'text-slate-400 hover:text-slate-200 border-slate-800 bg-slate-900' : 'text-slate-500 hover:text-slate-800 border-slate-200 bg-slate-50'
                }`}
                title="Voice command dictionary and need-based guide"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`p-1.5 rounded-lg border transition cursor-pointer ${
                  isDark ? 'text-slate-400 hover:text-white border-slate-800 bg-slate-900' : 'text-slate-500 hover:text-slate-900 border-slate-200 bg-slate-50'
                }`}
                title={isExpanded ? 'Collapse drawer' : 'Expand drawer'}
              >
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => updateMinimized(true)}
                className={`p-1.5 rounded-lg border transition cursor-pointer ${
                  isDark ? 'text-slate-400 hover:text-white border-slate-800 bg-slate-900' : 'text-slate-500 hover:text-slate-900 border-slate-200 bg-slate-50'
                }`}
                title="Minimize voice assistant to the mic button"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Main Action Bar: Live Interaction / Tap to Speak */}
          <div className="pt-2 flex items-center justify-between gap-2.5">
            
            {/* Primary Mic Trigger & Status */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <button
                onClick={effectiveToggle}
                className={`relative p-2.5 rounded-xl transition-all duration-300 cursor-pointer flex items-center justify-center shrink-0 ${
                  isListening
                    ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/40 ring-2 ring-emerald-400/50'
                    : voiceMode === 'need-based'
                      ? 'bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 shadow-[0_0_15px_rgba(20,184,166,0.15)]'
                      : isAlwaysOn
                        ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                        : isDark
                          ? 'bg-slate-800 text-slate-400 hover:text-slate-200'
                          : 'bg-slate-100 text-slate-500 hover:text-slate-800'
                }`}
                title={
                  isListening 
                    ? 'Listening now! Click to turn off.' 
                    : voiceMode === 'need-based'
                      ? 'Need-Based Voice: Click to turn on listener (or press V)'
                      : 'Click to activate voice listener'
                }
              >
                {isListening ? (
                  <>
                    <Mic className="w-4 h-4 text-slate-950 animate-pulse" />
                    <span className="absolute -inset-1 rounded-xl bg-emerald-400 opacity-40 animate-ping pointer-events-none" />
                  </>
                ) : voiceMode === 'need-based' ? (
                  <Mic className="w-4 h-4 text-teal-400" />
                ) : isAlwaysOn ? (
                  <Activity className="w-4 h-4 text-amber-400 animate-spin" />
                ) : (
                  <MicOff className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {/* Status & Subtext */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold tracking-tight font-display">
                    {isListening 
                      ? 'Listening on-demand'
                      : voiceMode === 'need-based' 
                        ? 'Need-Based Ready'
                        : voiceMode === 'always-on' 
                          ? 'Always-On Standby' 
                          : 'Voice Paused'}
                  </span>

                  {/* Need-Based Auto-off timer badge */}
                  {isListening && autoOffSecondsRemaining !== null && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 font-semibold animate-pulse">
                      Auto-off: {autoOffSecondsRemaining}s
                    </span>
                  )}

                  {!isListening && voiceMode === 'need-based' && (
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      Press <kbd className="font-bold text-teal-300">V</kbd> to speak
                    </span>
                  )}
                </div>

                {/* Subtext description & audio visualizer wave */}
                <div className="flex items-center gap-1 mt-0.5">
                  {isListening ? (
                    <div className="flex items-center gap-0.5 h-2.5">
                      {[0, 1, 2, 3, 4, 5, 6, 7].map((barIdx) => {
                        const threshold = (barIdx + 1) * 11;
                        const isActive = audioLevel >= threshold || Math.sin(Date.now() / 200 + barIdx) > 0.55;
                        return (
                          <span
                            key={barIdx}
                            className={`w-1 rounded-full transition-all duration-75 ${
                              isActive
                                ? 'bg-emerald-400 h-2.5 shadow-[0_0_4px_#34d399]'
                                : isDark
                                  ? 'bg-slate-700/60 h-1'
                                  : 'bg-slate-300 h-1'
                            }`}
                          />
                        );
                      })}
                      {interimTranscript && (
                        <span className="text-[10px] font-mono text-emerald-400 truncate max-w-[140px] ml-1">
                          "{interimTranscript}"
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 truncate block">
                      {voiceMode === 'need-based'
                        ? 'Turns on when needed, runs command, auto-turns off.'
                        : voiceMode === 'always-on'
                          ? 'Continuous hands-free monitoring.'
                          : 'Microphone is turned off.'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Action Button in Need-Based Mode */}
            {voiceMode === 'need-based' && (
              <button
                type="button"
                onClick={effectiveToggle}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition transform active:scale-95 shrink-0 cursor-pointer flex items-center gap-1 border ${
                  isListening
                    ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border-rose-500/30'
                    : 'bg-gradient-to-r from-teal-500/20 to-emerald-500/20 hover:from-teal-500/30 hover:to-emerald-500/30 text-teal-300 border-teal-500/40 shadow-sm'
                }`}
              >
                {isListening ? (
                  <>
                    <Power className="w-3 h-3 text-rose-400" />
                    <span>Stop</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3 h-3 text-teal-400" />
                    <span>Speak</span>
                  </>
                )}
              </button>
            )}

          </div>

          {/* Triggered Action Alert Banner */}
          {lastActionMessage && (
            <div className="mt-2 p-2 rounded-xl bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-emerald-500/15 border border-emerald-500/30 text-emerald-500 dark:text-emerald-300 text-[11px] font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0 animate-bounce" />
              <div className="truncate flex-1">
                <span className="font-bold">⚡ Action:</span> {lastActionMessage}
              </div>
            </div>
          )}

          {/* Quick-Click Command Keyword Chips */}
          <div className="mt-2 pt-2 border-t border-slate-200/50 dark:border-white/[0.08]">
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5">
              <span className="font-mono flex items-center gap-1 font-semibold">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                Say or 1-click test keyword:
              </span>
              <span className="text-[9px] text-teal-400 font-mono">Instant Trigger</span>
            </div>

            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => onTriggerCommand('Schedule follow up for Marcus Vance')}
                className={`text-[10px] px-2 py-1 rounded-lg border font-medium transition cursor-pointer flex items-center gap-1 transform active:scale-95 ${
                  isDark
                    ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/25 hover:border-emerald-400'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                }`}
                title="Voice keyword: 'Schedule follow up for Marcus Vance'"
              >
                <CalendarPlus className="w-3 h-3 text-emerald-500" />
                <span>"Schedule follow up for Marcus Vance"</span>
              </button>

              <button
                type="button"
                onClick={() => onTriggerCommand('Add lead to pipeline')}
                className={`text-[10px] px-2 py-1 rounded-lg border font-medium transition cursor-pointer flex items-center gap-1 transform active:scale-95 ${
                  isDark
                    ? 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border-blue-500/25 hover:border-blue-400'
                    : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200'
                }`}
                title="Voice keyword: 'Add lead to pipeline'"
              >
                <TrendingUp className="w-3 h-3 text-blue-500" />
                <span>"Add lead to pipeline"</span>
              </button>
            </div>
          </div>

          {/* Expanded Drawer */}
          {isExpanded && (
            <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-white/[0.08] space-y-3">
              
              {/* Additional Command Quick Chips */}
              <div>
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  More Voice Keywords
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {sampleKeywords.slice(2).map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onTriggerCommand(item.cmd)}
                      className={`text-[10px] p-1.5 rounded-xl border text-left font-medium transition cursor-pointer flex items-center gap-1.5 transform active:scale-95 ${
                        isDark 
                          ? 'bg-slate-900 hover:bg-slate-800/90 border-slate-800 text-slate-200' 
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                      }`}
                    >
                      <item.icon className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                      <span className="truncate">"{item.cmd}"</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Need-Based Voice Commands */}
              <div className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-[11px] space-y-1">
                <span className="font-bold text-teal-300 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-teal-400" />
                  Need-Based Control Commands:
                </span>
                <p className="text-[10px] text-slate-300">
                  Say <span className="font-mono text-teal-300">"Turn off voice"</span> or <span className="font-mono text-teal-300">"Stop listening"</span> to mute anytime. Say <span className="font-mono text-teal-300">"Need-based mode"</span> or <span className="font-mono text-teal-300">"Always-on mode"</span> to switch modes dynamically!
                </p>
              </div>

              {/* Recent Voice Command Audit Log */}
              {commandHistory.length > 0 && (
                <div>
                  <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">
                    <span>Recent Voice Triggers</span>
                    <span>{commandHistory.length} logged</span>
                  </div>
                  <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                    {commandHistory.slice(0, 5).map((cmd) => (
                      <div 
                        key={cmd.id} 
                        className={`text-[10px] p-1.5 rounded-lg border flex items-center justify-between gap-1.5 ${
                          isDark ? 'bg-slate-900/60 border-slate-800/80 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                        }`}
                      >
                        <div className="truncate flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5 text-teal-400 shrink-0" />
                          <span className="font-semibold">{cmd.action}</span>
                        </div>
                        <span className="text-[9px] font-mono text-slate-400 shrink-0">{cmd.timestamp}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {hasPermission === false && (
                <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] flex items-center gap-2">
                  <Radio className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>Microphone permission blocked. You can still trigger commands via the 1-click keyword chips above!</span>
                </div>
              )}

              {!isSupported && (
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] flex items-center gap-2">
                  <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Browser Web Speech not supported here. Use the 1-click test chips to trigger any voice action!</span>
                </div>
              )}

            </div>
          )}

        </div>
      </aside>
      )}

      {/* Floating Mic Button (Bottom Right) — the whole voice UI when
          minimized; toggles the panel open/closed when clicked. */}
      <button
        type="button"
        onClick={() => updateMinimized(!isMinimized)}
        className={`fixed bottom-4 right-4 z-40 w-14 h-14 rounded-full flex items-center justify-center border shadow-2xl backdrop-blur-xl transition-all duration-300 cursor-pointer transform hover:scale-105 active:scale-95 ${
          !isMinimized
            ? isDark
              ? 'bg-slate-900/95 text-slate-200 border-slate-700'
              : 'bg-white/95 text-slate-700 border-slate-300'
            : isListening
              ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 shadow-emerald-500/40 ring-2 ring-emerald-400/60'
              : voiceMode === 'need-based'
                ? isDark
                  ? 'bg-slate-900/95 text-teal-300 border-teal-500/40 shadow-[0_10px_30px_rgba(20,184,166,0.25)]'
                  : 'bg-white/95 text-teal-600 border-teal-300'
                : isAlwaysOn
                  ? isDark
                    ? 'bg-slate-900/95 text-amber-400 border-amber-500/40'
                    : 'bg-white/95 text-amber-600 border-amber-300'
                  : isDark
                    ? 'bg-slate-900/95 text-slate-400 border-slate-700'
                    : 'bg-white/95 text-slate-500 border-slate-300'
        }`}
        title={
          !isMinimized
            ? 'Minimize voice assistant'
            : isListening
              ? 'Listening now — click to open the voice panel'
              : 'Voice Assistant — click to open the voice panel'
        }
        aria-label={!isMinimized ? 'Minimize voice assistant' : 'Open voice assistant panel'}
      >
        {!isMinimized ? (
          <Minimize2 className="w-6 h-6" />
        ) : isListening ? (
          <>
            <Mic className="w-6 h-6 animate-pulse" />
            <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-30 animate-ping pointer-events-none" />
          </>
        ) : voiceMode === 'off' ? (
          <MicOff className="w-6 h-6" />
        ) : voiceMode === 'always-on' ? (
          <Activity className="w-6 h-6 animate-spin" />
        ) : (
          <Mic className="w-6 h-6" />
        )}
      </button>

      {/* Voice Commands Guide Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className={`w-full max-w-lg rounded-3xl border shadow-2xl p-6 transition-all duration-300 ${
            isDark 
              ? 'glass-panel bg-slate-950 border-white/[0.12] text-slate-100 shadow-[0_25px_60px_rgba(0,0,0,0.8)]' 
              : 'bg-white border-slate-200 text-slate-900 shadow-2xl'
          }`}>
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-teal-500/25">
                  <Mic className="w-5 h-5 text-slate-950" />
                </div>
                <div>
                  <h3 className="text-base font-bold font-display">Need-Based & Always-On Voice Commands</h3>
                  <p className="text-xs text-slate-400">Control Pulsar completely by voice with privacy-first smart auto on/off.</p>
                </div>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-4 space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              
              {/* How Need-Based Works */}
              <div className="p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/25 space-y-2">
                <div className="flex items-center gap-2 text-teal-300 font-bold text-xs">
                  <Zap className="w-4 h-4 text-teal-400" />
                  <span>How "Need-Based" Voice Command Works:</span>
                </div>
                <ul className="text-xs text-slate-300 space-y-1.5 list-disc pl-4">
                  <li><strong>Turn On:</strong> Tap the mic button or press keyboard key <kbd className="bg-slate-800 text-teal-300 px-1 py-0.5 rounded text-[11px] font-mono">V</kbd> when you want to issue a command.</li>
                  <li><strong>Auto Turn Off:</strong> Once your command is recognized and executed, the mic automatically shuts off to protect your privacy and preserve battery.</li>
                  <li><strong>Inactivity Sleep:</strong> If no speech is detected after 8 seconds, the listener automatically turns off with a soft chirp.</li>
                  <li><strong>Switch Anytime:</strong> You can switch between <em>Need-Based</em>, <em>Always-On</em>, and <em>Off</em> at any time using the mode toggle.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
                  Priority Action Keywords
                </h4>
                
                {sampleKeywords.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-2xl border transition flex items-start justify-between gap-3 ${
                      isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                        <item.icon className="w-3.5 h-3.5 shrink-0" />
                        <span>"{item.cmd}"</span>
                      </div>
                      <p className="text-[11px] text-slate-400">{item.desc}</p>
                    </div>

                    <button
                      onClick={() => {
                        onTriggerCommand(item.cmd);
                        setShowHelpModal(false);
                      }}
                      className="px-2.5 py-1 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-xs font-semibold border border-emerald-500/30 transition shrink-0 cursor-pointer"
                    >
                      Test
                    </button>
                  </div>
                ))}
              </div>

              <div className="space-y-2 pt-1">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-blue-400">
                  Control & Navigation Keywords
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className={`p-2 rounded-xl border ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <strong className="text-slate-200">"Turn off voice"</strong>
                    <p className="text-slate-400 text-[10px]">Turns off the voice listener</p>
                  </div>
                  <div className={`p-2 rounded-xl border ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <strong className="text-slate-200">"Need-based mode"</strong>
                    <p className="text-slate-400 text-[10px]">Switches to need-based auto on/off</p>
                  </div>
                  <div className={`p-2 rounded-xl border ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <strong className="text-slate-200">"Go to leads"</strong>
                    <p className="text-slate-400 text-[10px]">Opens Bot Scraper & Radar</p>
                  </div>
                  <div className={`p-2 rounded-xl border ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <strong className="text-slate-200">"Open pipeline"</strong>
                    <p className="text-slate-400 text-[10px]">Switches to Pipeline & ROI</p>
                  </div>
                  <div className={`p-2 rounded-xl border ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <strong className="text-slate-200">"Open reminders"</strong>
                    <p className="text-slate-400 text-[10px]">Scheduled calls and tasks</p>
                  </div>
                  <div className={`p-2 rounded-xl border ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <strong className="text-slate-200">"Toggle dark mode"</strong>
                    <p className="text-slate-400 text-[10px]">Switches website theme</p>
                  </div>
                </div>
              </div>

            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-white/10 flex justify-end">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
