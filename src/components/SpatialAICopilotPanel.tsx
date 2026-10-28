import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Send, 
  Bot, 
  X, 
  ChevronRight, 
  FileText, 
  ShieldCheck, 
  PhoneCall, 
  Zap, 
  Copy, 
  Check, 
  RotateCcw,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { apiService } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { RCMLead } from '../types';

interface SpatialAICopilotPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeLead?: RCMLead | null;
  onApplyDraft?: (draft: string) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'gemini';
  text: string;
  timestamp: string;
  suggestedAction?: {
    type: 'draft_pitch' | 'dial_lead' | 'audit_proposal';
    payload: string;
  };
}

export const SpatialAICopilotPanel: React.FC<SpatialAICopilotPanelProps> = ({
  isOpen,
  onClose,
  activeLead,
  onApplyDraft
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-init',
      sender: 'gemini',
      text: activeLead 
        ? `I am ready with intelligence for ${activeLead.practiceName}. Decision maker: ${activeLead.doctorName}. Key billing friction: ${activeLead.painPoints.join(', ')}. Would you like me to draft an audit pitch or objection script?`
        : 'Pulsar Spatial AI Copilot is online. Ask me to draft cold outreach sequences, analyze physician pain points, formulate objection counters, or synthesize meeting transcripts.',
      timestamp: 'Just now'
    }
  ]);

  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  const handleSendQuery = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const prompt = `You are the Pulsar Autonomous SDR Copilot.
Active Prospect Context:
${activeLead ? `- Practice: ${activeLead.practiceName}
- Decision Maker: ${activeLead.doctorName}
- Specialty: ${activeLead.specialty}
- EHR System: ${activeLead.ehrSystem}
- Monthly Claim Volume: ${activeLead.monthlyClaimVolume}
- Pain Points: ${activeLead.painPoints.join('; ')}` : 'No single active lead selected; answer generally for multi-industry business development.'}

User Directive: "${textToSend}"

Provide a sharp, consultative, high-converting response formatted with clean bullet points, actionable scripts, and clear citations of facts vs AI inferences. Keep it under 150 words.`;

      const response = await apiService.sendChatMessage({
        messages: [{ role: 'user', text: prompt }],
        role: 'strategist',
        model: 'gemini-3.5-flash'
      });

      const aiMsg: ChatMessage = {
        id: `gemini-${Date.now()}`,
        sender: 'gemini',
        text: response.reply || 'Generated strategic recommendation. Ready to deploy or adapt.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'gemini',
        text: `Error contacting Gemini API: ${err?.message || 'Check network connection or server endpoint'}.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const promptChips = [
    'Draft 30-sec cold call pitch',
    'Generate modifier 25 denial audit angle',
    'Write executive LinkedIn connection note',
    'Formulate counter for "we do billing in-house"'
  ];

  return (
    <div className={`fixed top-16 bottom-0 right-0 z-40 w-full sm:w-96 border-l shadow-2xl glass-modal flex flex-col transition-all duration-300 animate-in slide-in-from-right duration-300 ${
      isDark 
        ? 'bg-[#0a0e1a]/95 border-white/[0.1] text-slate-100 shadow-[0_0_50px_rgba(0,0,0,0.8)]' 
        : 'bg-white/95 border-slate-200 text-slate-900 shadow-xl'
    }`}>
      {/* Header */}
      <div className="p-4 border-b border-white/[0.08] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-violet-500/20 text-violet-300 border border-violet-500/30">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-xs text-white">Gemini Spatial Copilot</div>
            <div className="text-[10px] text-slate-400 font-mono">Autonomous Sales Reasoning</div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Prompt Chips */}
      <div className="p-2 border-b border-white/[0.06] flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
        {promptChips.map((chip, idx) => (
          <button
            key={idx}
            onClick={() => handleSendQuery(chip)}
            className="px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition cursor-pointer"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin text-xs">
        {messages.map((msg) => {
          const isGemini = msg.sender === 'gemini';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isGemini ? 'items-start' : 'items-end'}`}
            >
              <div className={`p-3 rounded-2xl max-w-[90%] border leading-relaxed ${
                isGemini
                  ? isDark 
                    ? 'bg-white/[0.04] border-white/[0.08] text-slate-200' 
                    : 'bg-slate-100 border-slate-200 text-slate-800'
                  : 'bg-violet-600 text-white border-violet-500 shadow-md'
              }`}>
                <div className="whitespace-pre-wrap">{msg.text}</div>
              </div>

              <div className="flex items-center gap-2 mt-1 px-1 text-[10px] text-slate-500">
                <span>{msg.timestamp}</span>
                {isGemini && (
                  <button
                    onClick={() => handleCopy(msg.id, msg.text)}
                    className="hover:text-slate-300 transition cursor-pointer flex items-center gap-1"
                  >
                    {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {isLoading && (
          <div className="flex items-center gap-2 text-violet-400 text-xs py-2">
            <span className="w-2 h-2 rounded-full bg-violet-400 animate-ping" />
            <span className="font-mono">Synthesizing intelligence...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="p-3 border-t border-white/[0.08] shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendQuery();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask Copilot or request pitch draft..."
            className="flex-1 p-2.5 rounded-xl border border-white/10 bg-white/5 text-xs text-white focus:outline-none focus:border-violet-500"
          />
          <button
            type="submit"
            disabled={!inputQuery.trim() || isLoading}
            className="p-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition cursor-pointer disabled:opacity-50 shadow-md"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
