import React, { useState, useRef, useEffect } from 'react';
import { Leap } from 'loading-dev';
import { 
  Mic, 
  MicOff, 
  Sparkles, 
  Copy, 
  Check, 
  Download, 
  X, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  Volume2
} from 'lucide-react';
import { apiService } from '../services/api';

interface AudioTranscriberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTranscription?: (text: string) => void;
}

export const AudioTranscriberModal: React.FC<AudioTranscriberModalProps> = ({
  isOpen,
  onClose,
  onApplyTranscription
}) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordSeconds, setRecordSeconds] = useState<number>(0);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [transcriptionText, setTranscriptionText] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  if (!isOpen) return null;

  const startRecording = async () => {
    setErrorMsg(null);
    setTranscriptionText('');
    audioChunksRef.current = [];
    setRecordSeconds(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Stop audio tracks
        stream.getTracks().forEach(track => track.stop());

        // Convert blob to base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          setIsTranscribing(true);
          try {
            const result = await apiService.transcribeAudio(base64Audio, 'audio/webm');
            setTranscriptionText(result.transcription);
          } catch (err: any) {
            console.error('Transcription error:', err);
            setErrorMsg('Transcription failed. Ensure audio was captured clearly.');
          } finally {
            setIsTranscribing(false);
          }
        };
      };

      recorder.start();
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setRecordSeconds(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Mic access error:', err);
      setErrorMsg('Microphone access denied or unavailable. Please grant microphone permissions.');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(transcriptionText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([transcriptionText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pulsar-transcription-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl p-6 shadow-2xl text-slate-100 space-y-4">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-emerald-500 to-blue-500 text-white font-bold shadow-md shadow-emerald-500/20">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Clinical Audio Transcriber
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 font-mono border border-blue-500/30">
                  gemini-3.5-transcribe
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Record doctor consultations or voice notes with your microphone for instant AI speech-to-text
              </p>
            </div>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 text-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Recording Visualizer Area */}
        <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-4">
          <div className="relative inline-block">
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isTranscribing}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition shadow-2xl cursor-pointer ${
                isRecording
                  ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse ring-8 ring-rose-500/20'
                  : 'bg-teal-500 hover:bg-teal-400 text-slate-950 hover:scale-105'
              }`}
            >
              {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
            </button>
          </div>

          <div>
            <div className="text-sm font-bold text-white">
              {isRecording ? (
                <span className="text-rose-400 font-mono flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  Recording Microphone ({formatTime(recordSeconds)})
                </span>
              ) : isTranscribing ? (
                <div className="flex flex-col items-center justify-center gap-2 text-teal-400 py-1">
                  <Leap size={36} color="#2dd4bf" />
                  <span className="font-mono text-xs">Transcribing with gemini-3.5-transcribe...</span>
                </div>
              ) : (
                <span className="text-slate-300">
                  Click microphone to start audio capture
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Supports physician dictation, EHR call snippets, and medical billing jargon
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Transcription Output */}
        {transcriptionText && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Verbatim AI Transcription:
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="hover:text-white flex items-center gap-1 text-[11px] font-mono cursor-pointer"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="hover:text-white flex items-center gap-1 text-[11px] font-mono cursor-pointer"
                >
                  <Download className="w-3 h-3 text-cyan-400" />
                  <span>Save .txt</span>
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 leading-relaxed font-sans max-h-48 overflow-y-auto">
              {transcriptionText}
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
          {onApplyTranscription && transcriptionText ? (
            <button
              type="button"
              onClick={() => {
                onApplyTranscription(transcriptionText);
                onClose();
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold transition shadow-md shadow-teal-500/20 cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>Apply to Notes</span>
            </button>
          ) : <div />}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
