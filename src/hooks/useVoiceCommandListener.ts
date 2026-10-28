import { useState, useEffect, useRef, useCallback } from 'react';
import { speechService } from '../utils/speech';

export type VoiceMode = 'need-based' | 'always-on' | 'off';

export interface VoiceCommandHistoryItem {
  id: string;
  transcript: string;
  action: string;
  timestamp: string;
  success: boolean;
}

export interface VoiceCommandCallbacks {
  onScheduleFollowUp?: (targetName: string, rawText: string) => void;
  onAddLeadToPipeline?: (targetName: string, rawText: string) => void;
  onCallLead?: (targetName: string) => void;
  onNavigateTab?: (tab: 'leads' | 'network' | 'linkedin' | 'pipeline' | 'call_studio' | 'meeting_notes' | 'reminders' | 'briefing' | 'google_forms') => void;
  onToggleTheme?: () => void;
  onOpenModal?: (modal: 'chatbot' | 'transcriber' | 'grounding' | 'settings' | 'display' | 'install') => void;
  onScrapeLeadsTrigger?: () => void;
}

const INACTIVITY_TIMEOUT_SECONDS = 8;

export function useVoiceCommandListener(callbacks: VoiceCommandCallbacks) {
  // Mode selection: 'need-based' (default modern standard), 'always-on', or 'off'
  const [voiceMode, setVoiceModeState] = useState<VoiceMode>(() => {
    const savedMode = localStorage.getItem('pulsar_voice_mode') as VoiceMode | null;
    if (savedMode && ['need-based', 'always-on', 'off'].includes(savedMode)) {
      return savedMode;
    }
    const oldAlwaysOn = localStorage.getItem('pulsar_always_on_voice');
    if (oldAlwaysOn === 'false') return 'off';
    // Default to need-based for smart, privacy-conscious battery saving
    return 'need-based';
  });

  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [transcript, setTranscript] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [voiceFeedbackEnabled, setVoiceFeedbackEnabled] = useState<boolean>(true);
  const [lastActionMessage, setLastActionMessage] = useState<string | null>(null);
  const [commandHistory, setCommandHistory] = useState<VoiceCommandHistoryItem[]>([]);
  const [autoOffSecondsRemaining, setAutoOffSecondsRemaining] = useState<number | null>(null);

  // Refs
  const recognitionRef = useRef<any>(null);
  const restartTimeoutRef = useRef<any>(null);
  const autoOffTimerRef = useRef<any>(null);
  const autoOffCountdownIntervalRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isManuallyStoppedRef = useRef<boolean>(false);

  const voiceModeRef = useRef<VoiceMode>(voiceMode);
  voiceModeRef.current = voiceMode;

  const callbacksRef = useRef<VoiceCommandCallbacks>(callbacks);
  callbacksRef.current = callbacks;

  const voiceFeedbackRef = useRef<boolean>(voiceFeedbackEnabled);
  voiceFeedbackRef.current = voiceFeedbackEnabled;

  const isListeningRef = useRef<boolean>(isListening);
  isListeningRef.current = isListening;

  // Cleanup audio visualizer
  const cleanupAudioVisualizer = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  // Set up microphone volume visualizer
  const setupAudioVisualizer = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);

      audioContextRef.current = ctx;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setAudioLevel(normalized);

        animFrameRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (e) {
      // Audio level visualizer blocked or denied - speech recognition can still work
      console.warn('Microphone audio visualizer error:', e);
    }
  }, []);

  // Stop listening helper
  const stopListening = useCallback((reason?: string) => {
    isManuallyStoppedRef.current = true;
    if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
    if (autoOffTimerRef.current) clearTimeout(autoOffTimerRef.current);
    if (autoOffCountdownIntervalRef.current) clearInterval(autoOffCountdownIntervalRef.current);
    setAutoOffSecondsRemaining(null);

    cleanupAudioVisualizer();
    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    } catch (e) {}

    setIsListening(false);

    if (reason === 'timeout') {
      speechService.playSleepChirp();
      setLastActionMessage('Voice listener auto-off (Need-based idle sleep). Tap to speak.');
      setTimeout(() => setLastActionMessage(prev => prev?.includes('auto-off') ? null : prev), 4000);
    } else if (reason === 'fulfilled') {
      speechService.playSleepChirp();
    }
  }, [cleanupAudioVisualizer]);

  // Start need-based listening session with auto-off timer
  const startNeedBasedListening = useCallback(() => {
    isManuallyStoppedRef.current = false;
    speechService.playListeningChirp();
    setupAudioVisualizer();

    try {
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }
    } catch (e) {
      // Might already be active
    }

    setIsListening(true);
    setAutoOffSecondsRemaining(INACTIVITY_TIMEOUT_SECONDS);

    // Reset any existing timers
    if (autoOffTimerRef.current) clearTimeout(autoOffTimerRef.current);
    if (autoOffCountdownIntervalRef.current) clearInterval(autoOffCountdownIntervalRef.current);

    let secondsLeft = INACTIVITY_TIMEOUT_SECONDS;
    autoOffCountdownIntervalRef.current = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft <= 0) {
        clearInterval(autoOffCountdownIntervalRef.current);
        setAutoOffSecondsRemaining(null);
        stopListening('timeout');
      } else {
        setAutoOffSecondsRemaining(secondsLeft);
      }
    }, 1000);
  }, [setupAudioVisualizer, stopListening]);

  // Reset inactivity timer when user speaks interim words
  const resetInactivityTimer = useCallback(() => {
    if (voiceModeRef.current !== 'need-based') return;
    if (autoOffCountdownIntervalRef.current) clearInterval(autoOffCountdownIntervalRef.current);

    let secondsLeft = INACTIVITY_TIMEOUT_SECONDS;
    setAutoOffSecondsRemaining(secondsLeft);

    autoOffCountdownIntervalRef.current = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft <= 0) {
        clearInterval(autoOffCountdownIntervalRef.current);
        setAutoOffSecondsRemaining(null);
        stopListening('timeout');
      } else {
        setAutoOffSecondsRemaining(secondsLeft);
      }
    }, 1000);
  }, [stopListening]);

  // Set voice mode
  const setVoiceMode = useCallback((mode: VoiceMode) => {
    setVoiceModeState(mode);
    voiceModeRef.current = mode;
    localStorage.setItem('pulsar_voice_mode', mode);
    localStorage.setItem('pulsar_always_on_voice', mode === 'always-on' ? 'true' : 'false');

    if (mode === 'always-on') {
      isManuallyStoppedRef.current = false;
      setAutoOffSecondsRemaining(null);
      if (autoOffTimerRef.current) clearTimeout(autoOffTimerRef.current);
      if (autoOffCountdownIntervalRef.current) clearInterval(autoOffCountdownIntervalRef.current);
      speechService.playListeningChirp();
      setupAudioVisualizer();
      try {
        if (recognitionRef.current) {
          recognitionRef.current.start();
        }
      } catch (e) {}
    } else if (mode === 'off') {
      stopListening();
    } else if (mode === 'need-based') {
      // Stop continuous listening, wait for explicit need
      stopListening();
      setLastActionMessage('Need-Based Mode: Voice activates on demand, executes command, and turns off automatically.');
      setTimeout(() => setLastActionMessage(prev => prev?.includes('Need-Based Mode') ? null : prev), 4000);
    }
  }, [setupAudioVisualizer, stopListening]);

  // Toggle listening for current need
  const toggleListening = useCallback(() => {
    if (isListeningRef.current) {
      stopListening();
      speechService.playSleepChirp();
    } else {
      if (voiceModeRef.current === 'off') {
        setVoiceMode('need-based');
      }
      startNeedBasedListening();
    }
  }, [startNeedBasedListening, stopListening, setVoiceMode]);

  // Backwards-compatible toggleAlwaysOn
  const toggleAlwaysOn = useCallback((forceState?: boolean) => {
    if (forceState !== undefined) {
      setVoiceMode(forceState ? 'always-on' : 'off');
    } else {
      if (voiceMode === 'always-on') {
        setVoiceMode('need-based');
      } else if (voiceMode === 'need-based') {
        toggleListening();
      } else {
        setVoiceMode('need-based');
        startNeedBasedListening();
      }
    }
  }, [voiceMode, setVoiceMode, toggleListening, startNeedBasedListening]);

  // Process and match recognized speech against keywords
  const processCommand = useCallback((rawText: string): boolean => {
    const text = rawText.trim().toLowerCase();
    if (!text) return false;

    const cb = callbacksRef.current;
    let matchedAction = '';
    let speechFeedback = '';

    // 0. Mode / Control Voice Commands: "Turn off voice", "Turn on voice", "Need based mode", "Stop listening"
    if (
      text.includes('turn off voice') ||
      text.includes('turn voice off') ||
      text.includes('stop listening') ||
      text.includes('mute voice') ||
      text.includes('mute listener') ||
      text.includes('pause voice') ||
      text.includes('disable voice')
    ) {
      matchedAction = 'Voice Listener Turned Off';
      speechFeedback = 'Voice command listener turned off.';
      stopListening();
      setVoiceMode('off');
    }
    else if (
      text.includes('turn on voice') ||
      text.includes('turn voice on') ||
      text.includes('start listening') ||
      text.includes('activate voice') ||
      text.includes('enable voice')
    ) {
      matchedAction = 'Voice Listener Activated (Need-Based)';
      speechFeedback = 'Voice listener active on-demand.';
      setVoiceMode('need-based');
      startNeedBasedListening();
    }
    else if (text.includes('need based') || text.includes('on demand mode') || text.includes('need-based mode')) {
      matchedAction = 'Switched to Need-Based Voice Mode';
      speechFeedback = 'Switched to need-based voice mode. Microphone turns on when needed and auto-turns off.';
      setVoiceMode('need-based');
    }
    else if (text.includes('always on mode') || text.includes('continuous listening')) {
      matchedAction = 'Switched to Always-On Continuous Mode';
      speechFeedback = 'Switched to always-on continuous listening mode.';
      setVoiceMode('always-on');
    }
    // 1. Keyword: "Schedule follow up for [Marcus Vance / name]"
    // Variations: "Schedule follow up for Marcus Vance", "Schedule a follow up with Marcus Vance", "Follow up with Marcus Vance", "Remind me to call Marcus Vance"
    else if (
      text.match(/(?:schedule|book|set)(?:\s+a)?(?:\s+follow[\s-]?up|\s+call|\s+meeting)?(?:\s+for|\s+with)\s+([a-z0-9\s.,'-]+)/i) ||
      text.match(/follow[\s-]?up(?:\s+with|\s+for)\s+([a-z0-9\s.,'-]+)/i) ||
      text.match(/remind(?:\s+me)?\s+to\s+call\s+([a-z0-9\s.,'-]+)/i)
    ) {
      const scheduleMatch = text.match(/(?:schedule|book|set)(?:\s+a)?(?:\s+follow[\s-]?up|\s+call|\s+meeting)?(?:\s+for|\s+with)\s+([a-z0-9\s.,'-]+)/i)
        || text.match(/follow[\s-]?up(?:\s+with|\s+for)\s+([a-z0-9\s.,'-]+)/i)
        || text.match(/remind(?:\s+me)?\s+to\s+call\s+([a-z0-9\s.,'-]+)/i);

      let targetName = scheduleMatch ? scheduleMatch[1]?.trim() : 'Marcus Vance';
      targetName = targetName.replace(/\b(tomorrow|today|at\s+\d+|on\s+\w+|please|now)\b/gi, '').trim();
      if (!targetName) targetName = 'Marcus Vance';

      matchedAction = `Schedule follow-up for ${targetName}`;
      speechFeedback = `Follow-up scheduled for ${targetName}. Opening reminders tracker.`;

      cb.onScheduleFollowUp?.(targetName, rawText);
    } 
    // 2. Keyword: "Add lead to pipeline"
    // Variations: "Add lead to pipeline", "Add to pipeline", "Add Marcus Vance to pipeline", "Move to pipeline", "Add this lead to pipeline"
    else if (
      text.includes('add lead to pipeline') ||
      text.includes('add to pipeline') ||
      text.includes('move to pipeline') ||
      text.includes('add this lead to pipeline') ||
      text.includes('put in pipeline') ||
      text.match(/add\s+(.+)\s+to\s+(?:the\s+)?pipeline/i)
    ) {
      const specificLeadMatch = text.match(/add\s+(.+)\s+to\s+(?:the\s+)?pipeline/i);
      let target = specificLeadMatch && !specificLeadMatch[1].includes('lead') ? specificLeadMatch[1].trim() : 'Marcus Vance';
      
      matchedAction = `Added ${target} to active sales pipeline`;
      speechFeedback = `Lead added to pipeline. Deal value updated. Opening pipeline hub.`;

      cb.onAddLeadToPipeline?.(target, rawText);
    }
    // 3. Keyword: "Call [Marcus Vance / name]" or "Dial [name]"
    else if (
      text.match(/(?:call|dial|ring)\s+(?:dr\.?\s+)?([a-z\s]+)/i) &&
      !text.includes('schedule')
    ) {
      const callMatch = text.match(/(?:call|dial|ring)\s+(?:dr\.?\s+)?([a-z\s]+)/i);
      const name = callMatch ? callMatch[1].trim() : 'Marcus Vance';
      matchedAction = `Dialing ${name} in Call Studio`;
      speechFeedback = `Initiating voice call to ${name} in Call Studio.`;

      cb.onCallLead?.(name);
    }
    // 4. Keyword: "Scrape leads" / "Run radar scanner"
    else if (
      text.includes('scrape lead') ||
      text.includes('run radar') ||
      text.includes('find leads') ||
      text.includes('start scraper')
    ) {
      matchedAction = 'Triggered Autonomous Lead Scraper';
      speechFeedback = 'Autonomous bot radar scanner initiated.';
      cb.onScrapeLeadsTrigger?.();
    }
    // 5. Navigation: Tab Switching
    else if (text.includes('go to leads') || text.includes('open scraper') || text.includes('show leads')) {
      matchedAction = 'Navigated to Bot Scraper & Radar';
      speechFeedback = 'Opening Bot Scraper and Radar tab.';
      cb.onNavigateTab?.('leads');
    }
    else if (text.includes('go to network') || text.includes('open network') || text.includes('network builder')) {
      matchedAction = 'Navigated to Network Builder Matrix';
      speechFeedback = 'Opening Network Builder.';
      cb.onNavigateTab?.('network');
    }
    else if (text.includes('go to linkedin') || text.includes('open linkedin') || text.includes('linkedin prospector')) {
      matchedAction = 'Navigated to LinkedIn Executive BD';
      speechFeedback = 'Opening LinkedIn Executive BD.';
      cb.onNavigateTab?.('linkedin');
    }
    else if (text.includes('open pipeline') || text.includes('sales pipeline') || text.includes('show pipeline')) {
      matchedAction = 'Navigated to Sales Pipeline & ROI Hub';
      speechFeedback = 'Opening Sales Pipeline and ROI Hub.';
      cb.onNavigateTab?.('pipeline');
    }
    else if (text.includes('call studio') || text.includes('open dialer') || text.includes('voice caller')) {
      matchedAction = 'Navigated to AI Voice Cold Caller';
      speechFeedback = 'Opening AI Voice Cold Caller Studio.';
      cb.onNavigateTab?.('call_studio');
    }
    else if (text.includes('meeting notes') || text.includes('call transcripts') || text.includes('show transcripts')) {
      matchedAction = 'Navigated to Call Transcripts & Notes';
      speechFeedback = 'Opening Call Transcripts and Notes.';
      cb.onNavigateTab?.('meeting_notes');
    }
    else if (text.includes('reminders') || text.includes('scheduled calls') || text.includes('show tasks')) {
      matchedAction = 'Navigated to Scheduled Calls & Tasks';
      speechFeedback = 'Opening Scheduled Calls and Reminders.';
      cb.onNavigateTab?.('reminders');
    }
    else if (text.includes('daily briefing') || text.includes('4 pm briefing') || text.includes('open briefing')) {
      matchedAction = 'Navigated to 4:00 PM PST Daily Briefing';
      speechFeedback = 'Opening Daily Briefing dashboard.';
      cb.onNavigateTab?.('briefing');
    }
    else if (text.includes('google form') || text.includes('forms') || text.includes('audit form') || text.includes('open forms')) {
      matchedAction = 'Navigated to Google Forms & Audits';
      speechFeedback = 'Opening Google Forms and Intake Audits workspace.';
      cb.onNavigateTab?.('google_forms');
    }
    // 6. Theme Switching
    else if (
      text.includes('dark mode') ||
      text.includes('light mode') ||
      text.includes('toggle theme') ||
      text.includes('switch theme')
    ) {
      matchedAction = 'Toggled Theme Mode';
      speechFeedback = 'Theme switched.';
      cb.onToggleTheme?.();
    }
    // 7. Modals
    else if (text.includes('open chat') || text.includes('open chatbot') || text.includes('ask ai')) {
      matchedAction = 'Opened Gemini AI Chatbot';
      speechFeedback = 'Opening AI Chatbot Copilot.';
      cb.onOpenModal?.('chatbot');
    }
    else if (text.includes('transcribe') || text.includes('audio transcription')) {
      matchedAction = 'Opened Audio Transcriber';
      speechFeedback = 'Opening Audio Transcriber.';
      cb.onOpenModal?.('transcriber');
    }
    else if (text.includes('grounding') || text.includes('maps intelligence')) {
      matchedAction = 'Opened Maps Grounding Intelligence';
      speechFeedback = 'Opening Maps Grounding modal.';
      cb.onOpenModal?.('grounding');
    }
    else if (text.includes('display settings') || text.includes('screen margins')) {
      matchedAction = 'Opened Display Settings';
      speechFeedback = 'Opening Display Settings.';
      cb.onOpenModal?.('display');
    }
    else if (text.includes('open settings') || text.includes('manager settings')) {
      matchedAction = 'Opened Manager Configuration';
      speechFeedback = 'Opening Settings.';
      cb.onOpenModal?.('settings');
    }

    if (matchedAction) {
      // Play high-tech action chime
      speechService.playActionChime();

      // Speak audio feedback if enabled
      if (voiceFeedbackRef.current && speechFeedback) {
        setTimeout(() => {
          speechService.speak(speechFeedback, { rate: 1.05 });
        }, 300);
      }

      setLastActionMessage(matchedAction);

      // Record in command history
      const historyItem: VoiceCommandHistoryItem = {
        id: `cmd-${Date.now()}`,
        transcript: rawText,
        action: matchedAction,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        success: true
      };
      setCommandHistory(prev => [historyItem, ...prev.slice(0, 19)]);

      // NEED-BASED AUTO TURN-OFF:
      // If running in need-based mode, once the requested command has been recognized and executed,
      // the need is satisfied! Automatically turn OFF the microphone after a brief completion pause.
      if (voiceModeRef.current === 'need-based') {
        setTimeout(() => {
          stopListening('fulfilled');
        }, 1200);
      }

      // Clear alert banner after 5 seconds
      setTimeout(() => {
        setLastActionMessage(prev => prev === matchedAction ? null : prev);
      }, 5000);

      return true;
    }

    return false;
  }, [stopListening, startNeedBasedListening, setVoiceMode]);

  // Global Keyboard shortcut 'V' or 'Alt+V' to activate need-based voice command
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input, textarea, or contentEditable element
      const activeEl = document.activeElement;
      const isInput = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'SELECT' ||
        (activeEl as HTMLElement).isContentEditable
      );

      if (isInput) return;

      if ((e.key === 'v' || e.key === 'V') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        toggleListening();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleListening]);

  // Initialize SpeechRecognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setHasPermission(true);
      isManuallyStoppedRef.current = false;
    };

    recognition.onresult = (event: any) => {
      let finalTranscriptChunk = '';
      let interimChunk = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          finalTranscriptChunk += item[0].transcript;
        } else {
          interimChunk += item[0].transcript;
        }
      }

      if (interimChunk) {
        setInterimTranscript(interimChunk);
        // User is currently speaking; reset the auto-off inactivity timer
        resetInactivityTimer();
      }

      if (finalTranscriptChunk) {
        const cleaned = finalTranscriptChunk.trim();
        setTranscript(cleaned);
        setInterimTranscript('');
        processCommand(cleaned);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') {
        // Normal in pause intervals
        return;
      }
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setHasPermission(false);
        setIsListening(false);
        return;
      }
      if (event.error === 'network') {
        console.warn('Speech recognition network blip; will attempt restart if always-on');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      // Auto-restart only if mode is strictly 'always-on' and not manually stopped
      if (voiceModeRef.current === 'always-on' && !isManuallyStoppedRef.current) {
        if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = setTimeout(() => {
          try {
            recognition.start();
          } catch (e) {
            // Already started or restarting
          }
        }, 300);
      }
    };

    recognitionRef.current = recognition;

    // Auto-start only if always-on is configured
    if (voiceMode === 'always-on') {
      try {
        recognition.start();
        setupAudioVisualizer();
      } catch (err) {
        console.warn('Initial recognition start error:', err);
      }
    }

    return () => {
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      if (autoOffTimerRef.current) clearTimeout(autoOffTimerRef.current);
      if (autoOffCountdownIntervalRef.current) clearInterval(autoOffCountdownIntervalRef.current);
      cleanupAudioVisualizer();
      try {
        recognition.stop();
      } catch (e) {}
    };
  }, [voiceMode, processCommand, setupAudioVisualizer, cleanupAudioVisualizer, resetInactivityTimer]);

  // Manually simulate or test a voice command (useful for 1-click tests or environments without mic)
  const triggerVoiceCommand = useCallback((commandText: string) => {
    setTranscript(commandText);
    setInterimTranscript('');
    processCommand(commandText);
  }, [processCommand]);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    voiceMode,
    setVoiceMode,
    isAlwaysOn: voiceMode === 'always-on',
    isListening,
    isSupported,
    hasPermission,
    transcript,
    interimTranscript,
    audioLevel,
    autoOffSecondsRemaining,
    voiceFeedbackEnabled,
    setVoiceFeedbackEnabled,
    lastActionMessage,
    commandHistory,
    toggleAlwaysOn,
    toggleListening,
    startNeedBasedListening,
    stopListening,
    triggerVoiceCommand,
    clearTranscript
  };
}
