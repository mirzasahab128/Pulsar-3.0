import React, { useState, useEffect, useRef } from 'react';
import { 
  PhoneCall, 
  PhoneOff, 
  PhoneForwarded, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  User, 
  Bot, 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
  Send,
  Zap,
  ShieldCheck,
  ChevronRight,
  Calendar,
  CalendarPlus,
  CalendarCheck,
  UserCheck,
  Disc,
  HardDrive,
  Download,
  Database,
  Radio,
  MessageCircle,
  RotateCcw,
  Trash2,
  History,
  Save,
  Check
} from 'lucide-react';
import { RCMLead, ManagerSettings, TranscriptMessage, MeetingNote, ActionItem } from '../types';
import { speechService } from '../utils/speech';
import { apiService } from '../services/api';
import { analyzeCallSentiment } from '../utils/callSentimentAnalyzer';
import { WarmTransferModal } from './WarmTransferModal';
import { useTheme } from '../context/ThemeContext';
import { CallWaveformVisualizer } from './CallWaveformVisualizer';
import { NicheTemplate } from '../data/nicheTemplates';

export const CALL_STUDIO_DRAFT_KEY = 'pulsar_call_studio_draft';

export interface CallStudioDraft {
  id: string;
  leadId: string;
  leadPracticeName: string;
  leadDoctorName: string;
  leadPhone: string;
  callNotes: string;
  userCustomInput: string;
  dictatedText: string;
  transferReason?: string;
  callState: 'idle' | 'dialing' | 'ringing' | 'connected' | 'transferred' | 'completed';
  callDuration: number;
  recordedSeconds: number;
  transcript: TranscriptMessage[];
  savedAt: number;
  savedAtFormatted: string;
}

interface CallStudioProps {
  lead: RCMLead;
  settings: ManagerSettings;
  nicheTemplate?: NicheTemplate;
  onCallEnded: (lead: RCMLead, note: MeetingNote) => void;
  onScheduleFollowUpCall?: (task: ActionItem) => void;
  onClose: () => void;
}

export const CallStudio: React.FC<CallStudioProps> = ({
  lead,
  settings,
  nicheTemplate,
  onCallEnded,
  onScheduleFollowUpCall,
  onClose
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const agentName = nicheTemplate?.agentConfig.agentName || 'Sarah';
  const nicheName = nicheTemplate?.name || 'All Industries';

  const [callState, setCallState] = useState<'idle' | 'dialing' | 'ringing' | 'connected' | 'transferred' | 'completed'>('idle');
  const [callDuration, setCallDuration] = useState<number>(0);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [isAiSpeaking, setIsAiSpeaking] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [transferReason, setTransferReason] = useState<string>('');
  const [userCustomInput, setUserCustomInput] = useState<string>('');
  const [isAnalyzingNotes, setIsAnalyzingNotes] = useState<boolean>(false);
  const [generatedNote, setGeneratedNote] = useState<MeetingNote | null>(null);

  // Follow-up call scheduling state
  const [showScheduleModal, setShowScheduleModal] = useState<boolean>(false);
  const [scheduleDate, setScheduleDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [scheduleTime, setScheduleTime] = useState<string>('10:00');
  const [scheduleContact, setScheduleContact] = useState<string>(lead.doctorName);
  const [schedulePhone, setSchedulePhone] = useState<string>(lead.phone);
  const [scheduleAgenda, setScheduleAgenda] = useState<string>(
    `Review 50-claim free billing audit report and discuss ${lead.ehrSystem} denial overturn workflows.`
  );
  const [schedulePriority, setSchedulePriority] = useState<'Urgent' | 'High' | 'Medium' | 'Low'>('High');
  const [scheduleSuccessMsg, setScheduleSuccessMsg] = useState<string | null>(null);

  // Audio recording & storage capture state
  const [isRecording, setIsRecording] = useState<boolean>(true);
  const [recordedSeconds, setRecordedSeconds] = useState<number>(0);
  const [showStorageModal, setShowStorageModal] = useState<boolean>(false);
  const [downloadToast, setDownloadToast] = useState<boolean>(false);

  // Live Voice API (gemini-3.8-live) mode
  const [useLiveApi, setUseLiveApi] = useState<boolean>(true);

  // Real-Time Voice Dictation State (Browser Microphone API + Web Speech Recognition)
  const [isDictating, setIsDictating] = useState<boolean>(false);
  const [dictatedText, setDictatedText] = useState<string>('');
  const [interimText, setInterimText] = useState<string>('');
  const [micVolume, setMicVolume] = useState<number>(0);
  const [micPermission, setMicPermission] = useState<'prompt' | 'granted' | 'denied' | 'unsupported'>('prompt');
  const [micErrorMsg, setMicErrorMsg] = useState<string | null>(null);
  const [dictationTarget, setDictationTarget] = useState<'call_note' | 'manager_speech'>('call_note');

  // Dedicated Live Call Notes & Manual Override State (Auto-saved every 10s to localStorage)
  const [callNotes, setCallNotes] = useState<string>('');
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<Date | null>(null);
  const [recoverableDraft, setRecoverableDraft] = useState<CallStudioDraft | null>(null);
  const [draftToastMessage, setDraftToastMessage] = useState<string | null>(null);

  // Synchronization refs to avoid stale closures during periodic 10s auto-save & unmount
  const callNotesRef = useRef(callNotes);
  const userCustomInputRef = useRef(userCustomInput);
  const dictatedTextRef = useRef(dictatedText);
  const transcriptRef = useRef(transcript);
  const callStateRef = useRef(callState);
  const callDurationRef = useRef(callDuration);
  const recordedSecondsRef = useRef(recordedSeconds);
  const transferReasonRef = useRef(transferReason);

  useEffect(() => {
    callNotesRef.current = callNotes;
    userCustomInputRef.current = userCustomInput;
    dictatedTextRef.current = dictatedText;
    transcriptRef.current = transcript;
    callStateRef.current = callState;
    callDurationRef.current = callDuration;
    recordedSecondsRef.current = recordedSeconds;
    transferReasonRef.current = transferReason;
  });

  const triggerDraftToast = (msg: string) => {
    setDraftToastMessage(msg);
    setTimeout(() => setDraftToastMessage(null), 3500);
  };

  // Helper to persist current call state, call notes, and manual override inputs to localStorage
  const saveDraftToLocalStorage = (): boolean => {
    const currentNotes = callNotesRef.current;
    const currentInput = userCustomInputRef.current;
    const currentDictation = dictatedTextRef.current;
    const currentTranscript = transcriptRef.current;
    const currentState = callStateRef.current;
    const currentDuration = callDurationRef.current;
    const currentRecorded = recordedSecondsRef.current;
    const currentReason = transferReasonRef.current;

    const hasUnsavedContent =
      currentNotes.trim().length > 0 ||
      currentInput.trim().length > 0 ||
      currentDictation.trim().length > 0 ||
      currentTranscript.length > 0 ||
      currentState === 'connected' ||
      currentState === 'transferred' ||
      currentState === 'dialing' ||
      currentState === 'ringing';

    if (!hasUnsavedContent || currentState === 'completed') {
      return false;
    }

    const draft: CallStudioDraft = {
      id: `draft-${lead.id}`,
      leadId: lead.id,
      leadPracticeName: lead.practiceName,
      leadDoctorName: lead.doctorName,
      leadPhone: lead.phone,
      callNotes: currentNotes,
      userCustomInput: currentInput,
      dictatedText: currentDictation,
      transferReason: currentReason,
      callState: currentState,
      callDuration: currentDuration,
      recordedSeconds: currentRecorded,
      transcript: currentTranscript,
      savedAt: Date.now(),
      savedAtFormatted: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    try {
      localStorage.setItem(CALL_STUDIO_DRAFT_KEY, JSON.stringify(draft));
      setLastAutoSavedAt(new Date());
      return true;
    } catch (err) {
      console.error('Failed to auto-save call draft to localStorage:', err);
      return false;
    }
  };

  // Check localStorage for existing call draft on component mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CALL_STUDIO_DRAFT_KEY);
      if (raw) {
        const draft: CallStudioDraft = JSON.parse(raw);
        const hasWork =
          Boolean(draft.callNotes?.trim()) ||
          Boolean(draft.userCustomInput?.trim()) ||
          Boolean(draft.dictatedText?.trim()) ||
          (Array.isArray(draft.transcript) && draft.transcript.length > 0) ||
          draft.callState === 'connected' ||
          draft.callState === 'transferred';

        if (hasWork && draft.callState !== 'completed') {
          setRecoverableDraft(draft);
        }
      }
    } catch (e) {
      console.error('Failed to load call studio draft on mount:', e);
    }
  }, []);

  // Periodic Auto-Save every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      saveDraftToLocalStorage();
    }, 10000); // exactly every 10 seconds

    return () => clearInterval(interval);
  }, [lead.id]);

  // Auto-save immediately when component unmounts (e.g. user accidentally navigates away from active call)
  useEffect(() => {
    return () => {
      saveDraftToLocalStorage();
    };
  }, [lead.id]);

  // Browser beforeunload protection against accidental tab closure / reload during active calls
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const currentState = callStateRef.current;
      const currentNotes = callNotesRef.current;
      const currentInput = userCustomInputRef.current;

      if (currentState === 'connected' || currentState === 'transferred' || currentNotes.trim() || currentInput.trim()) {
        saveDraftToLocalStorage();
        e.preventDefault();
        e.returnValue = 'You have an active call session in progress. Your call notes and inputs are auto-saved.';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Restore draft state when user clicks "Recover Draft"
  const handleRecoverDraft = (draft: CallStudioDraft) => {
    if (draft.callNotes) setCallNotes(draft.callNotes);
    if (draft.userCustomInput) setUserCustomInput(draft.userCustomInput);
    if (draft.dictatedText) setDictatedText(draft.dictatedText);
    if (draft.transferReason) setTransferReason(draft.transferReason);
    if (Array.isArray(draft.transcript) && draft.transcript.length > 0) {
      setTranscript(draft.transcript);
    }
    if (draft.callDuration) setCallDuration(draft.callDuration);
    if (draft.recordedSeconds) setRecordedSeconds(draft.recordedSeconds);
    if (draft.callState && draft.callState !== 'completed' && draft.callState !== 'idle') {
      setCallState(draft.callState);
    }
    setRecoverableDraft(null);
    triggerDraftToast(`Recovered call draft for ${draft.leadPracticeName} (saved at ${draft.savedAtFormatted})`);
    speechService.playTelephoneRing('transfer_chime');
  };

  // Discard draft from localStorage
  const handleDiscardDraft = () => {
    localStorage.removeItem(CALL_STUDIO_DRAFT_KEY);
    setRecoverableDraft(null);
    triggerDraftToast('Call draft discarded');
  };

  const speechRecognitionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<any>(null);

  // Storage calculations: simulated 1.2 MB/min (0.02 MB/sec) for 64kbps Opus telephony dual-track audio
  const baseCloudStorageMb = 142.4;
  const currentSessionAudioMb = parseFloat((recordedSeconds * 0.02).toFixed(2));
  const totalStorageMb = parseFloat((baseCloudStorageMb + currentSessionAudioMb).toFixed(1));
  const maxStorageQuotaMb = 500.0;
  const storageUsagePercent = Math.min(100, Math.round((totalStorageMb / maxStorageQuotaMb) * 100));
  const storageRemainingHours = Math.max(0, Math.floor((maxStorageQuotaMb - totalStorageMb) / 1.2 / 60)).toString();

  // Toggle Audio Capture Recording
  const handleToggleRecord = () => {
    setIsRecording((prev) => !prev);
    speechService.playTelephoneRing('transfer_chime');
  };

  // Download Simulated Audio WAV Archive
  const handleDownloadRecording = () => {
    const metadata = `Pulsar HIPAA Telephony Audio Recording Archive\n` +
      `Practice: ${lead.practiceName}\n` +
      `Lead / Contact: ${lead.doctorName}\n` +
      `Phone: ${lead.phone}\n` +
      `Call State: ${callState}\n` +
      `Total Call Duration: ${formatTimer(callDuration)}\n` +
      `Audio Capture Duration: ${formatTimer(recordedSeconds)}\n` +
      `Simulated Audio Size: ${currentSessionAudioMb} MB\n` +
      `Encoding: Opus 24kHz Stereo Dual-Track Telephony Audio\n` +
      `Encryption: AES-256 GCM HIPAA Storage Vault\n` +
      `Exported: ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PST\n`;
    const blob = new Blob([metadata], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pulsar-recording-${lead.id}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadToast(true);
    setTimeout(() => setDownloadToast(false), 3000);
  };

  // Sync state if lead changes
  useEffect(() => {
    setScheduleContact(lead.doctorName);
    setSchedulePhone(lead.phone);
    setScheduleAgenda(`Review 50-claim free billing audit report and discuss ${lead.ehrSystem} denial overturn workflows.`);
  }, [lead]);

  // Auto-scroll transcript container internally without dragging the page
  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
    }
  }, [transcript]);

  // Call duration counter
  useEffect(() => {
    if (callState === 'connected' || callState === 'transferred') {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  // Audio capture recording timer (only increments when recording is toggled ON and call is active)
  useEffect(() => {
    let recTimer: any = null;
    if (isRecording && (callState === 'connected' || callState === 'transferred')) {
      recTimer = setInterval(() => {
        setRecordedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (recTimer) clearInterval(recTimer);
    };
  }, [isRecording, callState]);

  // Clean up speech when unmounting
  useEffect(() => {
    return () => {
      speechService.stop();
    };
  }, []);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Start the automated AI Call
  const handleStartCall = async () => {
    setCallState('dialing');
    setCallDuration(0);
    setRecordedSeconds(0);
    setTranscript([]);
    setGeneratedNote(null);
    speechService.playTelephoneRing('ring');

    // Simulate dialing & ringing for realism
    setTimeout(() => {
      setCallState('ringing');
      speechService.playTelephoneRing('ring');

      setTimeout(async () => {
        setCallState('connected');
        
        // Initial doctor greeting from the practice
        const initialPracticeGreeting = `Hello, ${lead.practiceName}, this is ${lead.adminContact || 'front desk'}. How may I direct your call?`;
        addTranscriptMessage('Prospect', initialPracticeGreeting);

        // If transfer mode is set to "Instant on live human pickup", trigger warm transfer immediately!
        if (settings.transferMode === 'instant_pickup') {
          setTimeout(() => {
            setTransferReason('Live human answered the line (Instant Transfer Mode enabled).');
            setShowTransferModal(true);
          }, 800);
          return;
        }

        // AI introduction pitch dynamically formatted for the active business niche
        const aiIntro = nicheTemplate?.agentConfig.samplePitchScript
          ? nicheTemplate.agentConfig.samplePitchScript
              .replace(/\[Doctor Name \/ Decision Maker\]/g, lead.doctorName || 'there')
              .replace(/\[Doctor Name\]/g, lead.doctorName || 'there')
              .replace(/\[Decision Maker\]/g, lead.doctorName || 'there')
              .replace(/\[Practice \/ Company Name\]/g, lead.practiceName || 'your organization')
              .replace(/\[EHR System \/ Software\]/g, lead.ehrSystem || 'your system')
              .replace(/\[Practice Specialization\]/g, lead.specialty || 'your industry')
          : `Hi! My name is ${agentName} with ${nicheName}. I'm calling for ${lead.doctorName} regarding your operations with ${lead.ehrSystem}. We recently helped a similar group achieve ${nicheTemplate?.agentConfig.keyMetricOrGuarantee || 'a 15% net revenue boost'}. Would you be open to a quick 60-second summary?`;
        
        addTranscriptMessage(`AI Agent (${agentName})`, aiIntro, 'neutral');
        await playAiSpeech(aiIntro);
      }, 2500);
    }, 1800);
  };

  const addTranscriptMessage = (
    speaker: string,
    text: string,
    sentiment?: 'positive' | 'neutral' | 'skeptical' | 'objection'
  ) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setTranscript((prev) => [...prev, { id: `tr-${Date.now()}-${Math.random()}`, speaker, text, timestamp: timeStr, sentiment }]);
  };

  // Stop and clean up microphone streams & recognition on unmount
  useEffect(() => {
    return () => {
      stopVoiceDictation();
    };
  }, []);

  // Browser Microphone API & Real-Time Speech Recognition
  const startVoiceDictation = async () => {
    setMicErrorMsg(null);
    setInterimText('');

    // 1. Browser Microphone API: getUserMedia
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        setMicPermission('granted');

        // Connect into Web Audio API AnalyserNode for real-time waveform level measurement
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateLevel = () => {
            if (!mediaStreamRef.current) return;
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            const level = Math.min(100, Math.round((avg / 128) * 100));
            setMicVolume(level);
            animationFrameRef.current = requestAnimationFrame(updateLevel);
          };
          updateLevel();
        }
      } else {
        setMicPermission('unsupported');
        setMicErrorMsg('Browser mediaDevices API is not available in this browser.');
      }
    } catch (err: any) {
      console.warn('Microphone access warning:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setMicPermission('denied');
        setMicErrorMsg('Microphone access blocked. Click the lock icon in the address bar to allow microphone.');
      } else {
        setMicErrorMsg('Microphone notice: ' + (err.message || 'Unable to access audio device'));
      }
    }

    // 2. Initialize Web Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsDictating(true);
      setMicErrorMsg('Web Speech Recognition API is not natively supported in this browser. You can still type notes or monitor mic levels.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsDictating(true);
        speechService.playTelephoneRing('transfer_chime');
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let finalChunk = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalChunk += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (finalChunk) {
          setDictatedText((prev) => (prev ? prev + ' ' + finalChunk.trim() : finalChunk.trim()));
        }
        setInterimText(interim);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition notice:', event.error);
        if (event.error === 'not-allowed') {
          setMicPermission('denied');
          setMicErrorMsg('Microphone access blocked. Enable microphone in site settings.');
        } else if (event.error !== 'no-speech') {
          setMicErrorMsg(`Speech recognition: ${event.error}`);
        }
      };

      recognition.onend = () => {
        // Recognition ended
      };

      speechRecognitionRef.current = recognition;
      recognition.start();
      setIsDictating(true);
    } catch (err: any) {
      console.warn('Speech recognition start failed:', err);
      setMicErrorMsg('Speech recognition initialization failed: ' + err.message);
      setIsDictating(true);
    }
  };

  const stopVoiceDictation = () => {
    setIsDictating(false);
    setInterimText('');

    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (e) {}
      speechRecognitionRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }

    setMicVolume(0);
  };

  // Automatically append dictated call note to meeting notes transcript
  const handleAppendDictatedNote = (textToAppend?: string) => {
    const raw = textToAppend ?? (dictatedText + (interimText ? ' ' + interimText : ''));
    const finalized = raw.trim();
    if (!finalized) return;

    if (dictationTarget === 'manager_speech' && callState === 'transferred') {
      handleManagerSpeak(finalized);
    } else {
      addTranscriptMessage('Call Note (Dictated)', finalized, 'positive');

      // If call is already completed, also immediately sync with generatedNote & parent onCallEnded!
      if (callState === 'completed' && generatedNote) {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const updatedNote: MeetingNote = {
          ...generatedNote,
          transcript: [
            ...(generatedNote.transcript || []),
            {
              id: `tr-${Date.now()}-${Math.random()}`,
              speaker: 'Call Note (Dictated)',
              text: finalized,
              timestamp: timeStr,
              sentiment: 'positive'
            }
          ],
          executiveSummary: generatedNote.executiveSummary + `\n\n[Dictated Call Note]: ${finalized}`
        };
        setGeneratedNote(updatedNote);
        onCallEnded(lead, updatedNote);
      }
    }

    setDictatedText('');
    setInterimText('');
    stopVoiceDictation();
    speechService.playTelephoneRing('transfer_chime');
  };

  const playAiSpeech = async (text: string) => {
    setIsAiSpeaking(true);
    await speechService.speak(text, {
      rate: settings.speechRate,
      gender: settings.voiceGender,
      onEnd: () => setIsAiSpeaking(false)
    });
    setIsAiSpeaking(false);
  };

  // When prospect responds (either by clicking quick preset or custom input)
  const handleProspectResponse = async (text: string) => {
    if (!text.trim() || isAiSpeaking) return;

    addTranscriptMessage('Prospect', text);
    setUserCustomInput('');

    // If call is already bridged to manager, prospect is talking to the manager!
    if (callState === 'transferred') {
      return;
    }

    // Call server AI turn endpoint (or gemini-3.8-live if Live Voice API enabled)
    try {
      if (useLiveApi) {
        const liveTurn = await apiService.liveVoiceTurn({
          promptText: text,
          doctorName: lead.doctorName
        });
        addTranscriptMessage(`AI Agent (${agentName})`, liveTurn.spokenResponse, 'positive');
        await playAiSpeech(liveTurn.spokenResponse);

        if (
          liveTurn.spokenResponse.toLowerCase().includes('manager') || 
          liveTurn.spokenResponse.toLowerCase().includes('director') || 
          liveTurn.spokenResponse.toLowerCase().includes('bridge') ||
          liveTurn.spokenResponse.toLowerCase().includes('link you')
        ) {
          setTransferReason('Live Voice API recommended warm transfer to Operations Director');
          setTimeout(() => {
            setShowTransferModal(true);
          }, 1200);
        }
      } else {
        const turn = await apiService.getAiCallTurn({
          lead,
          userSpeech: text,
          conversationHistory: transcript,
          managerPhone: settings.managerPhone,
          callMode: settings.transferMode,
          agentConfig: nicheTemplate?.agentConfig,
          targetPersona: nicheTemplate?.targetPersona,
          nicheName: nicheTemplate?.name
        });

        addTranscriptMessage(`AI Agent (${agentName})`, turn.speechText, turn.sentiment);
        await playAiSpeech(turn.speechText);

        // Check if AI recommends warm transfer
        if (turn.shouldWarmTransfer) {
          setTransferReason(turn.transferReason || 'Prospect showed strong buying interest');
          setTimeout(() => {
            setShowTransferModal(true);
          }, 1200);
        }
      }
    } catch (e) {
      console.error('Call turn error:', e);
    }
  };

  // Manager accepts warm transfer
  const handleAcceptWarmTransfer = () => {
    setShowTransferModal(false);
    setCallState('transferred');
    speechService.playTelephoneRing('transfer_chime');
    addTranscriptMessage('System', `📞 Call bridged to Director line (${settings.managerPhone}). Direct two-way line open.`);
    addTranscriptMessage('Manager (You)', `Hello ${lead.doctorName || 'there'}, thank you for holding. This is ${settings.managerName} with Pulsar. ${agentName} mentioned you were discussing your operations on ${lead.ehrSystem}. I'd love to share how we can run a zero-obligation review and evaluate your specific requirements.`);
  };

  // Manager speaks during bridged call
  const handleManagerSpeak = (text: string) => {
    if (!text.trim()) return;
    addTranscriptMessage('Manager (You)', text);
    setUserCustomInput('');
  };

  // Manual Trigger Warm Transfer
  const handleTriggerManualTransfer = () => {
    setTransferReason('Manager requested manual call takeover');
    setShowTransferModal(true);
  };

  // Hang up call and generate clinical meeting notes
  const handleHangup = async () => {
    speechService.stop();
    speechService.playTelephoneRing('hangup');
    setCallState('completed');
    setIsAnalyzingNotes(true);

    const formattedDuration = formatTimer(callDuration);
    addTranscriptMessage('System', `Call terminated. Duration: ${formattedDuration}. Generating AI executive meeting notes for ${nicheName}...`);

    try {
      const finalTranscript = callNotes.trim()
        ? [
            ...transcript,
            {
              id: `tr-notes-${Date.now()}`,
              speaker: 'Manager (Call Notes & Observations)',
              text: callNotes.trim(),
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              sentiment: 'positive' as const
            }
          ]
        : transcript;

      const note = await apiService.generateMeetingNotes({
        transcript: finalTranscript,
        lead,
        callDuration: formattedDuration,
        agentConfig: nicheTemplate?.agentConfig,
        targetPersona: nicheTemplate?.targetPersona,
        nicheName: nicheTemplate?.name
      });

      // Automated AI Call Sentiment Analyzer (scored 1-10)
      const sentimentResult = analyzeCallSentiment(finalTranscript, note.qualificationStatus, note.statedBillingPainPoints);
      note.sentimentScore = sentimentResult.score;
      note.sentimentGrade = sentimentResult.grade;
      note.sentimentTone = sentimentResult.tone;
      note.sentimentReasoning = sentimentResult.summary;
      note.sentimentBuyingSignals = sentimentResult.buyingSignals;

      setGeneratedNote(note);
      onCallEnded(lead, note);

      // Cleanly clear auto-saved active draft once notes are finalized
      try {
        localStorage.removeItem(CALL_STUDIO_DRAFT_KEY);
        setRecoverableDraft(null);
      } catch (err) {}
    } catch (err) {
      console.error('Notes generation error:', err);
    } finally {
      setIsAnalyzingNotes(false);
    }
  };

  const formatScheduledDisplay = (dateStr: string, timeStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      const [hour, minute] = timeStr.split(':').map(Number);
      const dt = new Date(year, month - 1, day, hour, minute);
      return dt.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }) + ` at ${dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} PST`;
    } catch (e) {
      return `${dateStr} ${timeStr} PST`;
    }
  };

  const handleApplyPreset = (daysAhead: number, time: string) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    setScheduleDate(d.toISOString().split('T')[0]);
    setScheduleTime(time);
  };

  const handleConfirmScheduleCall = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleDate || !scheduleTime) return;

    const formattedDue = formatScheduledDisplay(scheduleDate, scheduleTime);
    const scheduledTask: ActionItem = {
      id: `scheduled-call-${Date.now()}`,
      task: `Scheduled Call: ${scheduleContact} (${lead.practiceName}) - ${scheduleAgenda}`,
      due: formattedDue,
      priority: schedulePriority,
      category: 'Phone Call',
      completed: false,
      leadId: lead.id,
      practiceName: lead.practiceName,
      isScheduledCall: true,
      scheduledDateTime: `${scheduleDate}T${scheduleTime}`,
      doctorName: scheduleContact,
      phone: schedulePhone,
      notes: scheduleAgenda
    };

    if (onScheduleFollowUpCall) {
      onScheduleFollowUpCall(scheduledTask);
    }

    addTranscriptMessage('System', `📅 Follow-up call confirmed: ${formattedDue} with ${scheduleContact} (${schedulePhone}). Added to Scheduled Calls tracker.`);
    speechService.playTelephoneRing('transfer_chime');

    setScheduleSuccessMsg(`Follow-up call successfully scheduled for ${formattedDue}!`);
    setTimeout(() => {
      setScheduleSuccessMsg(null);
      setShowScheduleModal(false);
    }, 1500);
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 backdrop-blur-xl animate-in fade-in duration-200 ${
      isDark ? 'bg-slate-950/85' : 'bg-slate-900/60'
    }`}>
      <div className={`relative w-full max-w-5xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-colors duration-300 ${
        isDark 
          ? 'bg-[#111C2E]/95 border border-slate-700/40 text-[#F1F5F9] shadow-[0_25px_80px_rgba(0,0,0,0.8)]' 
          : 'bg-white border border-[#DCE5EC] text-[#172338] shadow-[0_25px_80px_rgba(23,35,56,0.18)]'
      }`}>
        
        {/* Top Telephony Bar */}
        <div className={`px-6 py-4 border-b flex items-center justify-between gap-4 backdrop-blur-xl transition-colors ${
          isDark ? 'border-slate-800/80 bg-[#0B1220]/80' : 'border-[#DCE5EC] bg-[#EAF5F7]/80'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold transition shadow-lg ${
              callState === 'transferred' ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/30 animate-pulse' :
              callState === 'connected' ? 'bg-blue-600 text-white shadow-blue-600/30' :
              callState === 'dialing' || callState === 'ringing' ? 'bg-blue-600 text-white animate-pulse' :
              isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
            }`}>
              {callState === 'transferred' ? <PhoneForwarded className="w-5 h-5" /> : <PhoneCall className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className={`text-base font-bold tracking-tight font-display ${isDark ? 'text-white' : 'text-slate-900'}`}>{lead.practiceName}</h2>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider ${
                  callState === 'transferred' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                  callState === 'connected' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                  callState === 'ringing' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                  callState === 'completed' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                  isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'
                }`}>
                  {callState === 'transferred' ? '🔥 Warm Bridged to Manager' :
                   callState === 'connected' ? '● AI Live Call' :
                   callState === 'ringing' ? 'Ringing...' :
                   callState === 'dialing' ? 'Dialing SIP...' :
                   callState === 'completed' ? 'Call Completed' : 'Ready'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {lead.doctorName} • {lead.specialty} • <span className="text-emerald-400 font-mono">{lead.phone}</span>
              </p>
            </div>
          </div>

          {/* Call Controls & Duration */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {(callState === 'connected' || callState === 'transferred') && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border font-mono text-xs transition ${
                isDark 
                  ? 'bg-slate-800/80 border-slate-700 text-slate-300' 
                  : 'bg-white border-slate-200 text-slate-800 shadow-sm'
              }`}>
                <Clock className="w-3.5 h-3.5 text-emerald-500 animate-spin" />
                <span>{formatTimer(callDuration)}</span>
              </div>
            )}

            {/* Live API Mode Toggle Pill */}
            <button
              onClick={() => setUseLiveApi(prev => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer border ${
                useLiveApi
                  ? isDark
                    ? 'bg-blue-950/80 border-blue-500/60 text-blue-300 shadow-sm'
                    : 'bg-blue-50 border-blue-400 text-blue-800 shadow-sm'
                  : isDark
                    ? 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                    : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm'
              }`}
              title="Toggle Live Voice Conversation mode (gemini-3.8-live)"
            >
              <Radio className={`w-3.5 h-3.5 ${useLiveApi ? 'text-blue-400 animate-pulse' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">Live API:</span>
              <span>{useLiveApi ? 'gemini-3.8-live' : 'Standard'}</span>
            </button>

            {/* Visual Record Toggle */}
            <button
              onClick={handleToggleRecord}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer border ${
                isRecording
                  ? isDark
                    ? 'bg-blue-950/80 border-blue-500/60 text-blue-300 shadow-sm shadow-blue-950/50 hover:bg-blue-900/60'
                    : 'bg-blue-50 border-blue-400 text-blue-800 shadow-sm hover:bg-blue-100'
                  : isDark
                    ? 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                    : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm'
              }`}
              title={isRecording ? "Audio Capture is ACTIVE - Click to Pause Recording" : "Audio Capture is PAUSED - Click to Resume Recording"}
            >
              {isRecording ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </span>
                  <span>REC</span>
                  {(callState === 'connected' || callState === 'transferred') && (
                    <span className="text-[10px] text-blue-400 font-bold ml-0.5">{formatTimer(recordedSeconds)}</span>
                  )}
                  <span className="hidden sm:flex items-center gap-0.5 ml-1">
                    <span className="w-0.5 h-2 bg-blue-400 animate-pulse"></span>
                    <span className="w-0.5 h-3 bg-blue-400 animate-pulse delay-75"></span>
                    <span className="w-0.5 h-1.5 bg-blue-400 animate-pulse delay-150"></span>
                  </span>
                </>
              ) : (
                <>
                  <Disc className="w-3.5 h-3.5 text-slate-400" />
                  <span>REC OFF</span>
                </>
              )}
            </button>

            {/* Storage Indicator Pill */}
            <button
              onClick={() => setShowStorageModal(true)}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 rounded-xl border text-xs font-mono transition cursor-pointer ${
                isDark 
                  ? 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-300 hover:border-cyan-500/50' 
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-sm hover:border-teal-400'
              }`}
              title="Simulated Cloud Telephony Audio Storage - Click for details & retention"
            >
              <HardDrive className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
              <div className="flex items-center gap-1.5">
                <span className={`text-[11px] font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{totalStorageMb} / 500 MB</span>
                <div className={`w-7 sm:w-11 h-1.5 rounded-full overflow-hidden hidden sm:block ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                  <div 
                    className="h-full bg-gradient-to-r from-teal-500 to-blue-500 rounded-full"
                    style={{ width: `${storageUsagePercent}%` }}
                  />
                </div>
              </div>
            </button>

            {/* Real-Time Voice Dictation Button (Microphone API) */}
            <button
              onClick={isDictating ? stopVoiceDictation : startVoiceDictation}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs border transition cursor-pointer ${
                isDictating
                  ? 'bg-gradient-to-r from-emerald-500 to-blue-600 text-white border-white/60 ring-2 ring-emerald-400/50 animate-pulse shadow-md shadow-emerald-500/25'
                  : isDark
                    ? 'bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border-emerald-600/40 hover:border-emerald-400'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-300 shadow-sm'
              }`}
              title={isDictating ? "Microphone listening... Click to stop voice dictation" : "Dictate call notes in real time with your browser microphone"}
            >
              <Mic className={`w-3.5 h-3.5 ${isDictating ? 'text-white animate-bounce' : 'text-emerald-500'}`} />
              <span>{isDictating ? 'Listening...' : 'Voice Dictate'}</span>
              {isDictating && (
                <span className="flex items-center gap-0.5 ml-0.5">
                  <span className="w-1 bg-white rounded-full transition-all" style={{ height: `${Math.max(4, micVolume * 0.16)}px` }} />
                  <span className="w-1 bg-white rounded-full transition-all" style={{ height: `${Math.max(6, micVolume * 0.24)}px` }} />
                  <span className="w-1 bg-white rounded-full transition-all" style={{ height: `${Math.max(4, micVolume * 0.16)}px` }} />
                </span>
              )}
            </button>

            {/* Schedule Follow-up Call Button in Header */}
            <button
              onClick={() => setShowScheduleModal(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold text-xs border transition cursor-pointer ${
                isDark
                  ? 'bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border-blue-500/35'
                  : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-300 shadow-sm'
              }`}
              title="Schedule a follow-up call for a specific date and time"
            >
              <CalendarPlus className="w-3.5 h-3.5 text-blue-500" />
              <span className="hidden sm:inline">Schedule Call</span>
            </button>

            {callState === 'connected' && (
              <button
                onClick={handleTriggerManualTransfer}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs shadow-md transition cursor-pointer"
                title="Immediately bridge call to your phone"
              >
                <PhoneForwarded className="w-3.5 h-3.5" />
                <span>Bridge to My Phone</span>
              </button>
            )}

            {(callState === 'connected' || callState === 'transferred' || callState === 'ringing' || callState === 'dialing') && (
              <button
                onClick={handleHangup}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition cursor-pointer"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                <span>End Call</span>
              </button>
            )}

            {callState === 'idle' && (
              <button
                onClick={handleStartCall}
                className="relative group animate-radar-ripple flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-400 via-emerald-400 to-teal-500 hover:from-teal-300 hover:to-emerald-300 text-slate-950 font-black text-xs shadow-xl shadow-teal-500/30 transition transform active:scale-95 cursor-pointer ring-2 ring-teal-400/40"
                title="Initiate autonomous outbound cold call to provider"
              >
                <div className="relative">
                  <PhoneCall className="w-4 h-4 fill-slate-950" />
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-700 animate-ping" />
                </div>
                <span className="tracking-wide">Dial Provider Now</span>
                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-md bg-slate-950/20 text-slate-950 font-mono font-bold">
                  READY
                </span>
              </button>
            )}

            {/* 10s Auto-Save Status Indicator */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border font-mono text-xs transition ${
                isDark 
                  ? 'bg-slate-800/80 border-slate-700 text-slate-300' 
                  : 'bg-white border-slate-200 text-slate-700 shadow-sm'
              }`}
              title="Call notes and manual override inputs are automatically saved to localStorage every 10 seconds"
            >
              <span className={`w-2 h-2 rounded-full ${lastAutoSavedAt ? 'bg-emerald-400' : 'bg-slate-400'} animate-pulse`} />
              <span className="hidden lg:inline text-[10px] text-slate-400">Auto-save:</span>
              <span className="text-[11px] font-bold text-emerald-500">
                {lastAutoSavedAt 
                  ? `Saved ${lastAutoSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` 
                  : 'Every 10s'}
              </span>
            </div>

            <button
              onClick={() => {
                if (callState === 'connected' || callState === 'transferred' || callNotes.trim() || userCustomInput.trim()) {
                  saveDraftToLocalStorage();
                }
                onClose();
              }}
              className={`p-2 rounded-xl text-xs transition cursor-pointer border ${
                isDark 
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border-slate-700' 
                  : 'bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-900 border-slate-200 shadow-sm'
              }`}
              title="Close Call Studio (Active session will be preserved in localStorage)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Recover Draft Prompt Banner (Offered if user accidentally navigated away from an active call) */}
        {recoverableDraft && (
          <div className={`mx-6 my-3 p-4 rounded-2xl border transition-all duration-300 shadow-xl backdrop-blur-2xl animate-in slide-in-from-top-2 ${
            isDark
              ? 'bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-950 border-amber-500/40 text-slate-100'
              : 'bg-gradient-to-r from-amber-50 via-white to-teal-50 border-amber-300 text-slate-900 shadow-amber-500/10'
          }`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-500 border border-amber-500/40 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <RotateCcw className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-500 dark:text-amber-400 flex items-center gap-1.5 font-display">
                      <Sparkles className="w-3.5 h-3.5" />
                      Active Call Draft Available to Recover
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30 font-bold">
                      Auto-saved at {recoverableDraft.savedAtFormatted}
                    </span>
                  </div>
                  <p className="text-xs mt-1 text-[var(--text-secondary)]">
                    You previously navigated away from a call session with <strong>{recoverableDraft.leadPracticeName}</strong> ({recoverableDraft.leadDoctorName}). Would you like to restore your call notes and manual override inputs?
                  </p>
                  <div className="flex items-center gap-2.5 mt-2 text-[11px] font-mono text-slate-400 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-slate-900/60 border border-white/5">
                      Duration: <strong className="text-emerald-400">{formatTimer(recoverableDraft.callDuration)}</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-900/60 border border-white/5">
                      State: <strong className="uppercase text-cyan-400">{recoverableDraft.callState}</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-900/60 border border-white/5">
                      Transcript: <strong className="text-blue-400">{recoverableDraft.transcript?.length || 0} msgs</strong>
                    </span>
                    {recoverableDraft.callNotes && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-900/60 border border-white/5 truncate max-w-xs">
                        Notes: <em className="text-slate-300">"{recoverableDraft.callNotes.slice(0, 40)}..."</em>
                      </span>
                    )}
                    {recoverableDraft.userCustomInput && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-900/60 border border-white/5 truncate max-w-xs">
                        Override: <em className="text-teal-300">"{recoverableDraft.userCustomInput.slice(0, 30)}..."</em>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                <button
                  type="button"
                  onClick={() => handleRecoverDraft(recoverableDraft)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-teal-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Recover Draft</span>
                </button>
                <button
                  type="button"
                  onClick={handleDiscardDraft}
                  className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    isDark 
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' 
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-sm'
                  }`}
                  title="Discard this draft permanently"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  <span>Discard</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Skiper UI Live Audio Waveform Banner (Active during Dialing, Call, or Voice Dictation) */}
        {(callState !== 'idle' || isDictating) && (
          <div className={`px-6 py-2 border-b flex items-center justify-between gap-4 backdrop-blur-xl transition-all ${
            isDark ? 'bg-slate-950/90 border-blue-500/20' : 'bg-blue-50/80 border-blue-200'
          }`}>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {isDictating ? 'Browser Microphone Voice Dictation Active' : isAiSpeaking ? 'AI Voice Agent Speaking (Pulsar Neural)' : 'Telephony Audio Stream Active'}
              </span>
              <span className="text-[10px] text-blue-500 dark:text-blue-400 font-bold hidden sm:inline">
                • 16kHz PCM Opus
              </span>
            </div>

            <div className="flex-1 max-w-sm">
              <CallWaveformVisualizer
                isActive={callState === 'connected' || callState === 'transferred' || isDictating}
                isAiSpeaking={isAiSpeaking}
                isDictating={isDictating}
                micVolume={micVolume}
                height={28}
              />
            </div>

            <div className="text-[11px] font-mono text-emerald-500 font-bold hidden md:block">
              {callState === 'connected' ? 'Latency: 138ms' : isDictating ? 'Mic Signal: Active' : 'Connecting...'}
            </div>
          </div>
        )}

        {/* Main Body Grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">
          
          {/* Left: Lead Context & Clinical Intelligence (4 cols) */}
          <div className={`lg:col-span-4 border-r p-5 overflow-y-auto space-y-4 transition-colors ${
            isDark ? 'border-white/10 bg-slate-950/60' : 'border-slate-200 bg-slate-50/70'
          }`}>
            
            {/* Quick Practice Card */}
            <div className={`p-4 rounded-2xl border transition-colors ${
              isDark ? 'glass-card bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200/90 shadow-sm'
            }`}>
              <div className="text-[11px] font-bold text-teal-500 dark:text-teal-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Target Practice Profile
              </div>
              <div className="space-y-2 text-xs">
                <div className={`flex justify-between py-1 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Doctor/Lead:</span>
                  <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>{lead.doctorName}</span>
                </div>
                <div className={`flex justify-between py-1 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Practice Size:</span>
                  <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{lead.practiceSize}</span>
                </div>
                <div className={`flex justify-between py-1 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Current EHR:</span>
                  <span className="font-mono text-cyan-600 dark:text-cyan-400 font-semibold">{lead.ehrSystem}</span>
                </div>
                <div className={`flex justify-between py-1 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Monthly Claims:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{lead.monthlyClaimVolume}</span>
                </div>
                <div className={`flex justify-between py-1 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Direct Email:</span>
                  <span className={`truncate max-w-[170px] ${isDark ? 'text-slate-300' : 'text-slate-700'}`} title={lead.email}>{lead.email}</span>
                </div>
                <div className="py-1">
                  <span className={`block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Identified Pain Points:</span>
                  <ul className="space-y-1">
                    {lead.painPoints.map((pp, idx) => (
                      <li key={idx} className={`flex items-start gap-1.5 text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        <span className="text-rose-500 font-bold shrink-0">•</span>
                        <span>{pp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Live Call Notes & Manual Observations (Auto-Saved Every 10s to localStorage) */}
            <div className={`p-4 rounded-2xl border space-y-2.5 transition-colors ${
              isDark ? 'glass-card bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200/90 shadow-sm'
            }`}>
              <div className="flex items-center justify-between">
                <div className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  isDark ? 'text-teal-400' : 'text-teal-700'
                }`}>
                  <FileText className="w-3.5 h-3.5 text-teal-500" />
                  <span>Live Call Notes & Scratchpad</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>10s auto-save</span>
                </div>
              </div>

              <textarea
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
                placeholder="Type real-time clinical notes, physician objections, fee agreements, or observations here... (Auto-saved to localStorage every 10 seconds)"
                className={`w-full h-28 rounded-xl p-3 text-xs focus:outline-none focus:border-teal-500 border resize-y transition ${
                  isDark 
                    ? 'bg-slate-950/80 border-slate-700 text-slate-100 placeholder-slate-500' 
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 shadow-inner'
                }`}
              />

              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>{callNotes.length} characters</span>
                <span className="text-emerald-500 dark:text-emerald-400 font-semibold">
                  {lastAutoSavedAt ? `Saved ${lastAutoSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Draft protected'}
                </span>
              </div>
            </div>

            {/* Quick Follow-up Call Scheduler Card */}
            <div className={`p-4 rounded-2xl border transition-colors flex items-center justify-between ${
              isDark 
                ? 'bg-blue-950/25 border-blue-900/40' 
                : 'bg-blue-50/70 border-blue-200 shadow-sm'
            }`}>
              <div>
                <div className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  isDark ? 'text-blue-400' : 'text-blue-700'
                }`}>
                  <Calendar className="w-3.5 h-3.5 text-blue-500" />
                  Scheduled Follow-Up
                </div>
                <div className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Schedule specific date & time callback
                </div>
              </div>
              <button
                onClick={() => setShowScheduleModal(true)}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-bold text-xs shadow-sm transition cursor-pointer"
              >
                + Schedule
              </button>
            </div>

            {/* Audio Recording & Storage Vault Card */}
            <div className={`p-4 rounded-2xl border space-y-3 transition-colors ${
              isDark 
                ? 'glass-card bg-slate-900/80 border-slate-800' 
                : 'bg-white border-slate-200/90 shadow-sm'
            }`}>
              <div className="flex items-center justify-between">
                <div className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  <Disc className={`w-3.5 h-3.5 ${isRecording ? 'text-rose-500' : 'text-slate-400'}`} />
                  <span>Call Audio Capture</span>
                </div>
                {/* Visual Toggle Switch */}
                <button
                  type="button"
                  onClick={handleToggleRecord}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer focus:outline-none ${
                    isRecording ? 'bg-rose-600' : isDark ? 'bg-slate-700' : 'bg-slate-300'
                  }`}
                  title={isRecording ? "Click to Pause Audio Recording" : "Click to Enable Audio Recording"}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      isRecording ? 'translate-x-4.5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Status Row */}
              <div className="flex items-center justify-between text-xs">
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Capture Status:</span>
                <span className={`font-mono font-bold text-[11px] flex items-center gap-1.5 ${
                  isRecording ? 'text-rose-500' : isDark ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isRecording ? 'bg-rose-500 animate-ping' : 'bg-slate-400'}`} />
                  {isRecording ? `Recording (${formatTimer(recordedSeconds)})` : 'Capture Paused'}
                </span>
              </div>

              {/* Storage Capacity Bar */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className={`flex items-center gap-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    <HardDrive className="w-3 h-3 text-cyan-500" />
                    Storage Quota:
                  </span>
                  <span className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    {totalStorageMb} / 500 MB ({storageUsagePercent}%)
                  </span>
                </div>
                <div className={`h-2 w-full rounded-full overflow-hidden border ${
                  isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
                }`}>
                  <div 
                    className="h-full bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${storageUsagePercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>Session: {currentSessionAudioMb} MB</span>
                  <button 
                    onClick={() => setShowStorageModal(true)}
                    className="text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer font-semibold"
                  >
                    Storage Details →
                  </button>
                </div>
              </div>

              <div className={`pt-2 border-t flex items-center justify-between text-[10px] ${
                isDark ? 'border-slate-800 text-slate-400' : 'border-slate-100 text-slate-500'
              }`}>
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-500" />
                  HIPAA AES-256 Vault
                </span>
                <span className="font-mono">Dual-Track Audio</span>
              </div>
            </div>

            {/* Telephony Warm Transfer Rule Card */}
            <div className={`p-4 rounded-2xl border transition-colors ${
              isDark 
                ? 'bg-emerald-950/20 border-emerald-900/40' 
                : 'bg-emerald-50/70 border-emerald-200 shadow-sm'
            }`}>
              <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <PhoneForwarded className="w-3.5 h-3.5" />
                  Warm Transfer Route
                </span>
                {settings.routeToWhatsApp !== false && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono text-[10px]">
                    <MessageCircle className="w-3 h-3" />
                    WhatsApp Active
                  </span>
                )}
              </div>
              <div className={`text-xs space-y-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                <div className="flex justify-between items-center">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Destination:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    {settings.routeToWhatsApp !== false && <MessageCircle className="w-3 h-3 text-emerald-500" />}
                    <span>{settings.whatsAppNumber || settings.managerPhone}</span>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Trigger Mode:</span>
                  <span className={`capitalize font-semibold ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                    {settings.transferMode === 'instant_pickup' ? 'Instant on Pickup' : 'Warm Qualification First'}
                  </span>
                </div>
                <p className={`text-[11px] leading-relaxed pt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {settings.routeToWhatsApp !== false 
                    ? `When the contact answers, calls are automatically routed to your WhatsApp (${settings.whatsAppNumber || settings.managerPhone}) with live audio bridging.`
                    : `When the contact answers and shows interest, ${agentName} introduces our value proposition and bridges directly to your phone.`}
                </p>
              </div>
            </div>

            {/* Live Audio Waveform Indicator */}
            {(callState === 'connected' || callState === 'transferred') && (
              <div className={`p-4 rounded-2xl border flex items-center justify-between transition-colors ${
                isDark ? 'glass-card bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${isAiSpeaking ? 'bg-teal-500/20 text-teal-500' : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                    <Volume2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {isAiSpeaking ? `${agentName} is Speaking...` : callState === 'transferred' ? 'Director & Contact Speaking' : 'Listening to Contact'}
                    </div>
                    <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Ultra-Realistic Human Cadence</div>
                  </div>
                </div>
                <div className="flex items-end gap-1 h-6">
                  <span className={`w-1 rounded-full ${isAiSpeaking ? 'bg-teal-400 animate-wave-1' : isDark ? 'bg-slate-700 h-2' : 'bg-slate-300 h-2'}`} />
                  <span className={`w-1 rounded-full ${isAiSpeaking ? 'bg-teal-400 animate-wave-2' : isDark ? 'bg-slate-700 h-3' : 'bg-slate-300 h-3'}`} />
                  <span className={`w-1 rounded-full ${isAiSpeaking ? 'bg-teal-400 animate-wave-3' : isDark ? 'bg-slate-700 h-1.5' : 'bg-slate-300 h-1.5'}`} />
                  <span className={`w-1 rounded-full ${isAiSpeaking ? 'bg-teal-400 animate-wave-4' : isDark ? 'bg-slate-700 h-2.5' : 'bg-slate-300 h-2.5'}`} />
                  <span className={`w-1 rounded-full ${isAiSpeaking ? 'bg-teal-400 animate-wave-5' : isDark ? 'bg-slate-700 h-2' : 'bg-slate-300 h-2'}`} />
                </div>
              </div>
            )}
          </div>

          {/* Right: Live Transcript & Interaction Console (8 cols) */}
          <div className={`lg:col-span-8 flex flex-col h-full transition-colors ${
            isDark ? 'bg-slate-900/50' : 'bg-slate-50/70'
          }`}>
            
            {/* Transcript Stream Area */}
            <div ref={transcriptContainerRef} className="flex-1 p-5 overflow-y-auto space-y-3.5">
              {transcript.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-teal-400 mb-4 shadow-inner ${
                    isDark ? 'bg-slate-800/80' : 'bg-white shadow-md'
                  }`}>
                    <PhoneCall className="w-7 h-7" />
                  </div>
                  <h3 className={`text-base font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Outbound AI Dialer Ready</h3>
                  <p className={`text-xs max-w-md mb-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Click "Start Live Call" to trigger the autonomous caller. {agentName} will introduce our {nicheName} value proposition and link the call directly to your phone when answered.
                  </p>
                  <button
                    onClick={handleStartCall}
                    className="relative group animate-radar-ripple flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-gradient-to-r from-teal-400 via-emerald-400 to-teal-500 hover:from-teal-300 hover:to-emerald-300 text-slate-950 font-black text-sm shadow-2xl shadow-teal-500/35 transition transform active:scale-98 cursor-pointer ring-2 ring-teal-400/50"
                  >
                    <div className="relative">
                      <PhoneCall className="w-4 h-4 fill-slate-950" />
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-800 animate-ping" />
                    </div>
                    <span>Start Live Call to {lead.practiceName}</span>
                    <span className="ml-1 text-[11px] px-2 py-0.5 rounded bg-slate-950/20 text-slate-950 font-mono font-bold uppercase tracking-wider">
                      Ready
                    </span>
                  </button>
                </div>
              ) : (
                <>
                  {transcript.map((msg) => {
                    const isAi = msg.speaker.startsWith('AI Agent');
                    const isManager = msg.speaker === 'Manager (You)';
                    const isSys = msg.speaker === 'System';
                    const isNote = msg.speaker === 'Call Note (Dictated)';

                    if (isSys) {
                      return (
                        <div key={msg.id} className="flex justify-center my-2">
                          <span className={`text-[11px] px-3 py-1 rounded-full font-mono border ${
                            isDark 
                              ? 'bg-slate-800/90 text-slate-300 border-slate-700/80' 
                              : 'bg-slate-100 text-slate-700 border-slate-200 shadow-sm'
                          }`}>
                            {msg.text}
                          </span>
                        </div>
                      );
                    }

                    if (isNote) {
                      return (
                        <div key={msg.id} className="flex gap-3 max-w-[90%] mx-auto my-2.5 w-full animate-in fade-in">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-md bg-gradient-to-tr from-emerald-400 to-blue-500 text-white ring-2 ring-emerald-400/50">
                            <Mic className="w-4 h-4 fill-white text-white" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold font-display text-emerald-500 dark:text-emerald-400 flex items-center gap-1">
                                Dictated Call Note
                              </span>
                              <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{msg.timestamp}</span>
                              <span className="text-[10px] px-2 py-0.2 rounded-full font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                                🎙️ Real-Time Dictation
                              </span>
                            </div>
                            <div className={`p-4 rounded-2xl text-xs leading-relaxed border transition-all ${
                              isDark
                                ? 'bg-emerald-950/25 border-emerald-500/40 text-emerald-100 shadow-lg shadow-emerald-950/20'
                                : 'bg-emerald-50/90 border-emerald-300/80 text-emerald-950 shadow-sm'
                            }`}>
                              {msg.text}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-3 max-w-[85%] ${
                          isManager ? 'ml-auto flex-row-reverse' : isAi ? 'mr-auto' : 'mr-auto'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-sm ${
                          isAi ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/20' :
                          isManager ? 'bg-teal-500 text-slate-950 font-bold' :
                          'bg-blue-600 text-white'
                        }`}>
                          {isAi ? <Bot className="w-4 h-4" /> : isManager ? 'YOU' : <User className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className={`flex items-center gap-2 mb-1 ${isManager ? 'justify-end' : ''}`}>
                            <span className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{msg.speaker}</span>
                            <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{msg.timestamp}</span>
                            {msg.sentiment && (
                              <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                                msg.sentiment === 'positive' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                                msg.sentiment === 'objection' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
                                msg.sentiment === 'skeptical' ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400' :
                                isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {msg.sentiment}
                              </span>
                            )}
                          </div>
                          <div className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                            isAi 
                              ? isDark 
                                ? 'bg-slate-800 text-slate-100 rounded-tl-sm border border-slate-700/60' 
                                : 'bg-white text-slate-900 rounded-tl-sm border border-slate-200/90 shadow-sm'
                              : isManager 
                                ? 'bg-emerald-600 text-white rounded-tr-sm shadow-md' 
                                : isDark 
                                  ? 'bg-slate-800/80 text-cyan-100 rounded-tl-sm border border-cyan-800/30' 
                                  : 'bg-teal-50 text-slate-900 rounded-tl-sm border border-teal-200 shadow-sm'
                          }`}>
                            {msg.text}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            {/* Live Voice Dictation HUD with Browser Microphone API & Real-Time Waveform Telemetry */}
            {(isDictating || dictatedText.trim() || interimText.trim()) && (
              <div className={`mx-4 my-2.5 p-4 rounded-2xl border transition-all duration-300 shadow-2xl backdrop-blur-2xl animate-in slide-in-from-bottom-2 ${
                isDark
                  ? 'glass-modal border-emerald-500/40 bg-slate-950/95 text-slate-100'
                  : 'bg-white/95 border-emerald-300 text-slate-900 shadow-emerald-500/10'
              }`}>
                <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-emerald-500/20">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`relative flex items-center justify-center w-8 h-8 rounded-xl shrink-0 ${
                      isDictating 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm' 
                        : 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                    }`}>
                      <Mic className={`w-4 h-4 ${isDictating ? 'animate-pulse text-emerald-400' : 'text-blue-500'}`} />
                      {isDictating && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold font-display uppercase tracking-wider text-emerald-600 dark:text-emerald-300 flex items-center gap-1.5">
                          {isDictating ? 'Browser Microphone Listening...' : 'Voice Dictation Ready to Append'}
                        </span>
                        {isDictating && (
                          <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 animate-pulse font-bold">
                            LIVE AUDIO
                          </span>
                        )}
                      </div>
                      <p className={`text-[11px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Real-time voice dictation automatically appends to the meeting notes transcript
                      </p>
                    </div>
                  </div>

                  {/* Real-time Dynamic Waveform visualizer from getUserMedia AudioContext AnalyserNode */}
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/50 border border-white/10 font-mono text-[10px] shrink-0">
                    <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Mic Level:</span>
                    <div className="flex items-end gap-0.5 h-4 w-14">
                      {[0.2, 0.5, 0.8, 1.0, 0.7, 0.4, 0.9, 0.3].map((multiplier, i) => {
                        const barHeight = isDictating ? Math.max(3, Math.min(16, (micVolume * multiplier * 0.3))) : 2;
                        return (
                          <span
                            key={i}
                            className={`flex-1 rounded-full transition-all duration-75 ${
                              micVolume > 15 
                                ? 'bg-gradient-to-t from-emerald-500 to-blue-500' 
                                : isDark ? 'bg-slate-700' : 'bg-slate-300'
                            }`}
                            style={{ height: `${barHeight}px` }}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Live Transcribed Words Stream */}
                <div className="py-2.5">
                  <div className={`p-3.5 rounded-xl border text-xs leading-relaxed font-sans min-h-[54px] transition-colors ${
                    isDark 
                      ? 'bg-slate-900/80 border-slate-800 text-slate-100' 
                      : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}>
                    {dictatedText || interimText ? (
                      <>
                        <span>{dictatedText}</span>
                        {interimText && (
                          <span className="text-emerald-500 dark:text-emerald-400 italic font-medium ml-1">
                            {interimText}...
                          </span>
                        )}
                      </>
                    ) : (
                      <span className={`italic ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        Speak your call notes into the microphone... (e.g. "Doctor confirmed interest in 50-claim free audit, asked for fee schedule comparisons by Wednesday afternoon")
                      </span>
                    )}
                  </div>

                  {micErrorMsg && (
                    <div className="mt-1.5 text-[11px] text-rose-500 flex items-center gap-1 font-mono">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{micErrorMsg}</span>
                    </div>
                  )}
                </div>

                {/* Dictation Action Controls */}
                <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                  <div className="flex items-center gap-2">
                    {callState === 'transferred' && (
                      <div className="flex items-center gap-1 text-[11px]">
                        <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Target:</span>
                        <button
                          type="button"
                          onClick={() => setDictationTarget('call_note')}
                          className={`px-2 py-0.5 rounded-lg border font-semibold cursor-pointer ${
                            dictationTarget === 'call_note'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                              : 'text-slate-400 border-transparent hover:border-slate-700'
                          }`}
                        >
                          Clinical Note
                        </button>
                        <button
                          type="button"
                          onClick={() => setDictationTarget('manager_speech')}
                          className={`px-2 py-0.5 rounded-lg border font-semibold cursor-pointer ${
                            dictationTarget === 'manager_speech'
                              ? 'bg-blue-500/20 text-blue-400 border-blue-500/50'
                              : 'text-slate-400 border-transparent hover:border-slate-700'
                          }`}
                        >
                          Speak as Manager
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isDictating ? (
                      <button
                        type="button"
                        onClick={stopVoiceDictation}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                          isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                        }`}
                      >
                        <MicOff className="w-3.5 h-3.5 text-slate-400" />
                        <span>Pause Mic</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={startVoiceDictation}
                        className="px-3 py-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/30 transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Mic className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Resume Speaking</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setDictatedText('');
                        setInterimText('');
                        stopVoiceDictation();
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                        isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      Discard
                    </button>

                    <button
                      type="button"
                      disabled={!dictatedText.trim() && !interimText.trim()}
                      onClick={() => handleAppendDictatedNote()}
                      className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-400 hover:to-blue-500 text-white font-bold text-xs shadow-md disabled:opacity-40 transition cursor-pointer flex items-center gap-1.5 transform active:scale-95"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 fill-white text-emerald-600" />
                      <span>Append Note to Transcript</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Interaction & Objection Handling Toolbar */}
            {callState !== 'idle' && callState !== 'completed' && (
              <div className={`border-t p-4 space-y-3 transition-colors ${
                isDark ? 'border-slate-800 bg-slate-950/80' : 'border-slate-200 bg-white/95'
              }`}>
                
                {/* Quick Simulation Response Pills for Testing Human Responses */}
                {callState === 'connected' && (
                  <div>
                    <div className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 flex items-center justify-between ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      <div className="flex items-center gap-1">
                        <Zap className="w-3 h-3 text-emerald-400" />
                        <span>Simulate {lead.doctorName || 'Contact'} Responses & Objections:</span>
                      </div>
                      <span className="text-[10px] text-teal-500 font-mono">
                        {nicheTemplate?.name ? `${nicheTemplate.name.split('&')[0].trim()} Objections` : 'Standard Objections'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {nicheTemplate?.agentConfig.objectionHandlers && nicheTemplate.agentConfig.objectionHandlers.length > 0 ? (
                        <>
                          {nicheTemplate.agentConfig.objectionHandlers.slice(0, 3).map((handler, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleProspectResponse(handler.objection)}
                              className={`px-2.5 py-1 rounded-lg text-xs border transition cursor-pointer max-w-[280px] truncate ${
                                isDark 
                                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 hover:border-slate-500' 
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                              }`}
                              title={handler.objection}
                            >
                              "{handler.objection}"
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => handleProspectResponse("What are your exact fees, performance terms, and primary offer?")}
                            className={`px-2.5 py-1 rounded-lg text-xs border transition cursor-pointer font-medium ${
                              isDark 
                                ? 'bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border-emerald-800/40' 
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                            }`}
                          >
                            "What are your fees & terms?"
                          </button>
                          <button
                            type="button"
                            onClick={() => handleProspectResponse("Can you link me directly to your Director right now so we can walk through details?")}
                            className={`px-2.5 py-1 rounded-lg text-xs border transition cursor-pointer font-semibold ${
                              isDark 
                                ? 'bg-blue-950/60 hover:bg-blue-900/60 text-blue-300 border-blue-800/40' 
                                : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200'
                            }`}
                          >
                            "Link me to your Director"
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleProspectResponse("We do all of our billing in-house, thanks.")}
                            className={`px-2.5 py-1 rounded-lg text-xs border transition cursor-pointer ${
                              isDark 
                                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' 
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                            }`}
                          >
                            "We do billing in-house"
                          </button>
                          <button
                            onClick={() => handleProspectResponse("What are your rates and percentage fees?")}
                            className={`px-2.5 py-1 rounded-lg text-xs border transition cursor-pointer ${
                              isDark 
                                ? 'bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border-emerald-800/40' 
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                            }`}
                          >
                            "What are your rates?"
                          </button>
                          <button
                            onClick={() => handleProspectResponse(`We use ${lead.ehrSystem} and we're not looking to switch software.`)}
                            className={`px-2.5 py-1 rounded-lg text-xs border transition cursor-pointer ${
                              isDark 
                                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' 
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                            }`}
                          >
                            "We use {lead.ehrSystem}"
                          </button>
                          <button
                            onClick={() => handleProspectResponse("Can you link me to your sales manager so we can talk details?")}
                            className={`px-2.5 py-1 rounded-lg text-xs border transition cursor-pointer font-semibold ${
                              isDark 
                                ? 'bg-blue-950/60 hover:bg-blue-900/60 text-blue-300 border-blue-800/40' 
                                : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200'
                            }`}
                          >
                            "Link me to your manager"
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Input Bar with Real-Time Microphone Voice Dictation */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (callState === 'transferred') {
                      handleManagerSpeak(userCustomInput);
                    } else {
                      handleProspectResponse(userCustomInput);
                    }
                  }}
                  className="flex items-center gap-2"
                >
                  <button
                    type="button"
                    onClick={isDictating ? stopVoiceDictation : startVoiceDictation}
                    className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-center shrink-0 ${
                      isDictating
                        ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 border-amber-300 ring-2 ring-amber-400/60 animate-pulse shadow-md shadow-amber-500/20'
                        : isDark
                          ? 'bg-slate-800 text-amber-400 border-slate-700 hover:bg-slate-700 hover:text-amber-300'
                          : 'bg-white text-amber-600 border-slate-300 hover:bg-amber-50 shadow-sm'
                    }`}
                    title={isDictating ? "Microphone listening... Click to stop" : "Speak to dictate call note in real time (Browser Microphone API)"}
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                  <input
                    type="text"
                    value={userCustomInput}
                    onChange={(e) => setUserCustomInput(e.target.value)}
                    placeholder={
                      callState === 'transferred'
                        ? `Speak as Manager (${settings.managerName}) or click 🎙️ to dictate...`
                        : "Type doctor response or click 🎙️ to dictate call note..."
                    }
                    className={`flex-1 border rounded-xl px-4 py-2.5 text-xs transition focus:outline-none focus:border-teal-500 ${
                      isDark 
                        ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500' 
                        : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 shadow-sm'
                    }`}
                  />
                  <button
                    type="submit"
                    disabled={!userCustomInput.trim()}
                    className="p-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-slate-950 font-bold transition cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>

                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 px-1 pt-1.5">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Manual override input & notes auto-saved every 10s to localStorage</span>
                  </span>
                  {lastAutoSavedAt && (
                    <span className="text-emerald-500 font-semibold">
                      Auto-saved {lastAutoSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Post-Call Intelligence Status */}
            {callState === 'completed' && (
              <div className={`p-5 border-t flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-white/95'
              }`}>
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    {isAnalyzingNotes ? (
                      <div className="flex items-center gap-2 text-xs text-teal-500 dark:text-teal-400 font-medium">
                        <Sparkles className="w-4 h-4 animate-spin" />
                        <span>Gemini is extracting business meeting notes, business pain points & to-do items...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Call logged and meeting notes successfully compiled.</span>
                      </div>
                    )}
                  </div>

                  {/* Audio Capture Archive summary badge */}
                  <div className={`flex items-center gap-2 text-[11px] font-mono pt-0.5 ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    <span className={`flex items-center gap-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      <Disc className="w-3 h-3 text-blue-500" />
                      Recorded: <strong className={isDark ? 'text-blue-300' : 'text-blue-700'}>{formatTimer(recordedSeconds)}</strong>
                    </span>
                    <span>•</span>
                    <span className="text-cyan-600 dark:text-cyan-300 font-semibold">{currentSessionAudioMb} MB</span>
                    <span>•</span>
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      HIPAA Vault Encrypted
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Voice Dictate Post-Call Debrief Note Button */}
                  <button
                    onClick={isDictating ? stopVoiceDictation : startVoiceDictation}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer border shadow-sm ${
                      isDictating
                        ? 'bg-gradient-to-r from-emerald-500 to-blue-600 text-white border-white/60 ring-2 ring-emerald-400/50 animate-pulse'
                        : isDark
                          ? 'bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border-emerald-600/40'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-300'
                    }`}
                    title="Dictate clinical call notes with microphone to append directly to meeting notes"
                  >
                    <Mic className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{isDictating ? 'Listening...' : 'Dictate Call Note'}</span>
                  </button>

                  <button
                    onClick={handleDownloadRecording}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition cursor-pointer"
                    title="Export simulated telephony audio archive"
                  >
                    <Download className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Download Audio</span>
                  </button>

                  <button
                    onClick={() => setShowScheduleModal(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition cursor-pointer"
                  >
                    <CalendarPlus className="w-3.5 h-3.5" />
                    <span>Schedule Follow-Up Call</span>
                  </button>

                  {generatedNote && (
                    <button
                      onClick={onClose}
                      className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-md transition cursor-pointer"
                    >
                      View in Meeting Notes
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Schedule Follow-up Call Modal */}
        {/* Schedule Call Modal */}
        {showScheduleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
            <div className={`relative w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4 transition-colors ${
              isDark 
                ? 'glass-modal border border-white/15 text-slate-100' 
                : 'bg-white/95 border border-slate-200 text-slate-900 shadow-[0_25px_80px_rgba(15,23,42,0.18)]'
            }`}>
              
              <div className={`flex items-start justify-between pb-3 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
                    <CalendarPlus className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className={`text-base font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Schedule Follow-Up Call
                    </h3>
                    <p className="text-xs text-emerald-500 dark:text-emerald-400 font-medium">
                      {lead.practiceName} • {lead.doctorName}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                    isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ✕
                </button>
              </div>

              {scheduleSuccessMsg ? (
                <div className="p-6 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
                    <CalendarCheck className="w-6 h-6" />
                  </div>
                  <h4 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Call Scheduled Successfully!</h4>
                  <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{scheduleSuccessMsg}</p>
                  <p className="text-[11px] text-teal-600 dark:text-teal-400 font-medium">Integrated into Scheduled Calls & Reminders Tracker.</p>
                </div>
              ) : (
                <form onSubmit={handleConfirmScheduleCall} className="space-y-4">
                  
                  {/* Quick Preset Buttons */}
                  <div>
                    <span className={`text-[11px] font-bold uppercase tracking-wider block mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Quick Date & Time Presets (PST):
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => handleApplyPreset(1, '10:00')}
                        className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                          isDark ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                        }`}
                      >
                        <div className="font-semibold text-blue-500 dark:text-blue-400">Tomorrow, 10:00 AM</div>
                        <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Morning follow-up</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPreset(1, '14:00')}
                        className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                          isDark ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                        }`}
                      >
                        <div className="font-semibold text-emerald-500 dark:text-emerald-400">Tomorrow, 2:00 PM</div>
                        <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Afternoon check-in</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPreset(2, '11:30')}
                        className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                          isDark ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                        }`}
                      >
                        <div className="font-semibold text-blue-500 dark:text-blue-400">In 2 Days, 11:30 AM</div>
                        <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Audit review window</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPreset(4, '09:30')}
                        className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                          isDark ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                        }`}
                      >
                        <div className="font-semibold text-emerald-500 dark:text-emerald-400">Next Week, 9:30 AM</div>
                        <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Weekly planning call</div>
                      </button>
                    </div>
                  </div>

                  {/* Specific Date and Time Pickers */}
                  <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl border ${
                    isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div>
                      <label className={`text-xs block mb-1 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        Specific Date <span className="text-emerald-500">*</span>:
                      </label>
                      <input
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className={`w-full rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer border ${
                          isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-sm'
                        }`}
                        required
                      />
                    </div>

                    <div>
                      <label className={`text-xs block mb-1 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        Specific Time (PST) <span className="text-emerald-500">*</span>:
                      </label>
                      <input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className={`w-full rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer border ${
                          isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-sm'
                        }`}
                        required
                      />
                      <span className="text-[10px] text-teal-600 dark:text-teal-400 block mt-0.5 font-mono">
                        America/Los_Angeles (PST)
                      </span>
                    </div>
                  </div>

                  {/* Contact & Phone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={`text-xs block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        Doctor / Contact Person:
                      </label>
                      <input
                        type="text"
                        value={scheduleContact}
                        onChange={(e) => setScheduleContact(e.target.value)}
                        placeholder="e.g. Dr. Vance / Practice Admin"
                        className={`w-full rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 border ${
                          isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-sm'
                        }`}
                        required
                      />
                    </div>

                    <div>
                      <label className={`text-xs block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        Phone Number:
                      </label>
                      <input
                        type="text"
                        value={schedulePhone}
                        onChange={(e) => setSchedulePhone(e.target.value)}
                        placeholder="e.g. (512) 892-4100"
                        className={`w-full rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-emerald-500 border ${
                          isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-sm'
                        }`}
                        required
                      />
                    </div>
                  </div>

                  {/* Agenda / Objectives */}
                  <div>
                    <label className={`text-xs block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Call Agenda & Objectives:
                    </label>
                    <textarea
                      value={scheduleAgenda}
                      onChange={(e) => setScheduleAgenda(e.target.value)}
                      placeholder="e.g. Review free 50-claim billing audit results, present denial recovery figures, discuss EHR integration"
                      className={`w-full h-20 rounded-xl p-2.5 text-xs focus:outline-none focus:border-emerald-500 border ${
                        isDark ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 shadow-sm'
                      }`}
                    />
                  </div>

                  {/* Priority & Notice */}
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Priority:</span>
                      <select
                        value={schedulePriority}
                        onChange={(e) => setSchedulePriority(e.target.value as any)}
                        className={`rounded-xl px-2.5 py-1 text-xs focus:outline-none focus:border-emerald-500 border ${
                          isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-sm'
                        }`}
                      >
                        <option value="Urgent">Urgent</option>
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>

                    <div className={`text-[11px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Will display under 'Scheduled Calls'
                    </div>
                  </div>

                  {/* Form Actions */}
                  <div className={`pt-3 border-t flex justify-end gap-2 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                    <button
                      type="button"
                      onClick={() => setShowScheduleModal(false)}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                        isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white text-xs font-bold shadow-md cursor-pointer"
                    >
                      <CalendarCheck className="w-4 h-4 fill-white text-blue-600" />
                      <span>Confirm & Schedule Call</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Warm Transfer Bridge Alert Modal */}
        <WarmTransferModal
          lead={lead}
          settings={settings}
          isOpen={showTransferModal}
          onAccept={handleAcceptWarmTransfer}
          onDecline={() => setShowTransferModal(false)}
          triggerReason={transferReason}
        />

        {/* Cloud Audio Storage Details Modal */}
        {showStorageModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
            <div className={`relative w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4 transition-colors ${
              isDark 
                ? 'glass-modal border border-white/15 text-slate-100' 
                : 'bg-white/95 border border-slate-200 text-slate-900 shadow-[0_25px_80px_rgba(15,23,42,0.18)]'
            }`}>
              <div className={`flex items-start justify-between pb-3 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
                    <HardDrive className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className={`text-base font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Telephony Audio Storage Vault
                    </h3>
                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Simulated HIPAA Cloud Recording Archive & Capacity
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowStorageModal(false)}
                  className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                    isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ✕
                </button>
              </div>

              {/* Capacity Progress */}
              <div className={`p-4 rounded-2xl border space-y-2 ${
                isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Vault Allocation:</span>
                  <span className="text-cyan-600 dark:text-cyan-300 font-bold">{totalStorageMb} MB / {maxStorageQuotaMb} MB ({storageUsagePercent}%)</span>
                </div>
                <div className={`h-3 w-full rounded-full overflow-hidden border ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-200 border-slate-300'
                }`}>
                  <div 
                    className="h-full bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${storageUsagePercent}%` }}
                  />
                </div>
                <div className={`flex items-center justify-between text-[11px] pt-1 ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  <span>Available Space: <strong className={`font-mono ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{(maxStorageQuotaMb - totalStorageMb).toFixed(1)} MB</strong></span>
                  <span>Est. Time Left: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">~{storageRemainingHours} hours</strong></span>
                </div>
              </div>

              {/* Audio & Session Details */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className={`p-3.5 rounded-2xl border space-y-1 ${
                  isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className={`text-[11px] block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Current Call Captured:</span>
                  <span className="font-mono text-sm font-bold text-rose-500 dark:text-rose-300">{formatTimer(recordedSeconds)}</span>
                  <span className={`text-[10px] block ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>({currentSessionAudioMb} MB uncompressed)</span>
                </div>

                <div className={`p-3.5 rounded-2xl border space-y-1 ${
                  isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className={`text-[11px] block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Capture Status:</span>
                  <span className={`font-mono text-xs font-bold flex items-center gap-1.5 ${isRecording ? 'text-rose-500' : isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    <span className={`w-2 h-2 rounded-full ${isRecording ? 'bg-rose-500 animate-ping' : 'bg-slate-400'}`} />
                    {isRecording ? 'Recording Active' : 'Capture Paused'}
                  </span>
                  <button 
                    onClick={handleToggleRecord}
                    className="text-[10px] text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer font-semibold"
                  >
                    Toggle {isRecording ? 'Off' : 'On'}
                  </button>
                </div>
              </div>

              {/* Technical Specifications */}
              <div className={`p-3.5 rounded-2xl border space-y-1.5 text-xs ${
                isDark ? 'bg-slate-950/50 border-slate-800/80 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <div className={`flex justify-between py-1 border-b ${isDark ? 'border-slate-800/60' : 'border-slate-200'}`}>
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Audio Codec:</span>
                  <span className={`font-mono ${isDark ? 'text-slate-200' : 'text-slate-900 font-semibold'}`}>Opus 24kHz Dual-Track Telephony</span>
                </div>
                <div className={`flex justify-between py-1 border-b ${isDark ? 'border-slate-800/60' : 'border-slate-200'}`}>
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Channel Splitting:</span>
                  <span className={isDark ? 'text-slate-200' : 'text-slate-900 font-semibold'}>Channel 1: {agentName} (AI) • Channel 2: Prospect</span>
                </div>
                <div className={`flex justify-between py-1 border-b ${isDark ? 'border-slate-800/60' : 'border-slate-200'}`}>
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Security / HIPAA:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    AES-256 Encrypted Vault
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Retention Policy:</span>
                  <span className={isDark ? 'text-slate-200' : 'text-slate-900 font-semibold'}>30-Day Rolling Cloud Archive</span>
                </div>
              </div>

              {/* Modal Actions */}
              <div className={`pt-3 border-t flex items-center justify-between gap-2 ${
                isDark ? 'border-slate-800' : 'border-slate-200'
              }`}>
                <button
                  type="button"
                  onClick={handleDownloadRecording}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                    isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                  }`}
                >
                  <Download className="w-3.5 h-3.5 text-cyan-500" />
                  <span>Download Audio (.txt/.wav)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowStorageModal(false)}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-400 to-emerald-400 text-slate-950 text-xs font-bold shadow-md transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Download Feedback Toast */}
        {downloadToast && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs shadow-2xl animate-fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>Simulated call audio archive exported successfully!</span>
          </div>
        )}

        {/* Draft Recover & Auto-Save Toast Alert */}
        {draftToastMessage && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-950 text-white border border-emerald-500/40 shadow-2xl shadow-emerald-500/20 text-xs font-mono animate-in slide-in-from-bottom-3">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{draftToastMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
