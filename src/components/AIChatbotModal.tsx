import React, { useState, useRef, useEffect } from 'react';
import { Leap } from 'loading-dev';
import { 
  Bot, 
  Send, 
  User, 
  Sparkles, 
  Zap, 
  Cpu, 
  Copy, 
  Check, 
  Trash2, 
  ShieldCheck,
  Stethoscope,
  X,
  RefreshCw,
  MessageSquare
} from 'lucide-react';
import { apiService } from '../services/api';
import { db, auth } from '../firebase';
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { useTheme } from '../context/ThemeContext';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  modelUsed?: string;
}

interface AIChatbotModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ChatRole = 'strategist' | 'denials_expert' | 'objection_coach';
type ModelChoice = 'gemini-3.5-flash' | 'gemini-3.1-pro-preview' | 'gemini-3.1-flash-lite';

export const AIChatbotModal: React.FC<AIChatbotModalProps> = ({ isOpen, onClose }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [selectedRole, setSelectedRole] = useState<ChatRole>('strategist');
  const [selectedModel, setSelectedModel] = useState<ModelChoice>('gemini-3.5-flash');
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'model',
      text: "Hello! I am your Pulsar Business Growth Copilot. How can I assist you with business growth, lead outreach, sales objections, or networking today? Healthcare & RCM is one industry pack I can help with.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      modelUsed: 'gemini-3.5-flash'
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (!isOpen) return null;

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const userText = inputMessage.trim();
    setInputMessage('');

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedHistory = [...messages, newMsg];
    setMessages(updatedHistory);
    setIsLoading(true);

    try {
      // Send conversation history to backend Gemini endpoint
      const response = await apiService.sendChatMessage({
        messages: updatedHistory.map(m => ({ role: m.role, text: m.text })),
        role: selectedRole,
        model: selectedModel
      });

      const modelReply: ChatMessage = {
        id: `reply-${Date.now()}`,
        role: 'model',
        text: response.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: response.model
      };

      const finalMessages = [...updatedHistory, modelReply];
      setMessages(finalMessages);

      // Persist to Firestore if user is authenticated
      if (auth.currentUser) {
        try {
          const sessionRef = doc(db, 'chat_sessions', `session-${auth.currentUser.uid}`);
          await setDoc(sessionRef, {
            userId: auth.currentUser.uid,
            role: selectedRole,
            messages: finalMessages,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (dbErr) {
          console.warn('Firestore chat session save error:', dbErr);
        }
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'model',
          text: "I encountered an error retrieving the analysis. Please check your connectivity or try a different model.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: `msg-${Date.now()}`,
        role: 'model',
        text: `Chat thread reset. You are now consulting with the ${
          selectedRole === 'strategist' ? 'Business Growth Strategist' :
          selectedRole === 'denials_expert' ? 'Pain-Point Specialist' : 'Objection Handling Coach'
        } powered by ${selectedModel}.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-md transition-colors ${
      isDark ? 'bg-slate-950/80' : 'bg-slate-900/50'
    }`}>
      <div className={`relative w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col h-[85vh] max-h-[700px] overflow-hidden border backdrop-blur-2xl transition-colors duration-300 ${
        isDark 
          ? 'bg-slate-900/95 border-slate-700/80 text-slate-100 shadow-[0_25px_80px_rgba(0,0,0,0.6)]' 
          : 'bg-white/95 border-slate-200 text-slate-900 shadow-[0_25px_80px_rgba(15,23,42,0.15)]'
      }`}>
        
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between gap-3 shrink-0 backdrop-blur-xl transition-colors ${
          isDark ? 'border-slate-800 bg-slate-900/90' : 'border-slate-200 bg-slate-50/90'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-400 via-emerald-400 to-cyan-500 flex items-center justify-center text-slate-950 shadow-md shadow-teal-500/20">
              <Bot className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h3 className={`text-base font-bold tracking-tight font-display flex items-center gap-2 ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                Pulsar Gemini Copilot
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-500 dark:text-teal-300 font-mono border border-teal-500/30">
                  Multi-Turn Chat
                </span>
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Specialized AI roles for business growth, outreach & objection defense
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleClearChat}
              className={`p-2 transition rounded-lg ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
              title="Clear conversation history"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className={`p-2 transition text-lg rounded-lg ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Role & Model Selector Toolbar */}
        <div className={`px-4 py-2.5 border-b grid grid-cols-1 sm:grid-cols-2 gap-2 shrink-0 text-xs transition-colors ${
          isDark ? 'bg-slate-950/80 border-slate-800/80' : 'bg-slate-100/80 border-slate-200'
        }`}>
          
          {/* Role selector */}
          <div className="flex items-center gap-2">
            <span className={isDark ? 'text-slate-400 font-medium' : 'text-slate-600 font-medium'}>Role:</span>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as ChatRole)}
              className={`border rounded-xl px-2.5 py-1 text-xs focus:outline-none focus:border-teal-500 transition ${
                isDark 
                  ? 'bg-slate-900 border-slate-700 text-slate-200' 
                  : 'bg-white border-slate-300 text-slate-800 shadow-sm'
              }`}
            >
              <option value="strategist">Business Growth Strategist</option>
              <option value="denials_expert">Pain-Point Specialist</option>
              <option value="objection_coach">Rapid Objection Coach</option>
            </select>
          </div>

          {/* Model selector (matching system prompt: 3.1-pro-preview for complex, 3.5-flash for general, 3.1-flash-lite for fast) */}
          <div className="flex items-center gap-2 sm:justify-end">
            <span className="text-slate-400 font-medium">Model:</span>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value as ModelChoice)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-teal-300 font-mono text-xs focus:outline-none focus:border-teal-500"
            >
              <option value="gemini-3.5-flash">gemini-3.5-flash (General Tasks)</option>
              <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (Complex Tasks)</option>
              <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Ultra-Fast)</option>
            </select>
          </div>
        </div>

        {/* Scrollable Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className={`max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                  isUser 
                    ? 'bg-gradient-to-r from-emerald-600 to-blue-600 text-white rounded-tr-none shadow-md shadow-emerald-500/15'
                    : isDark
                      ? 'bg-slate-800/90 border border-slate-700/80 text-slate-100 rounded-tl-none shadow-md'
                      : 'bg-slate-100 border border-slate-200 text-slate-900 rounded-tl-none shadow-sm'
                }`}>
                  <div className="flex items-center justify-between gap-3 mb-1 text-[10px] opacity-75 font-mono">
                    <span>{isUser ? 'You' : 'Gemini AI'}</span>
                    <span>{msg.timestamp}</span>
                  </div>

                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  {!isUser && (
                    <div className={`mt-2.5 pt-2 border-t flex items-center justify-between text-[10px] font-mono ${
                      isDark ? 'border-slate-700/60 text-slate-400' : 'border-slate-200 text-slate-500'
                    }`}>
                      <span>{msg.modelUsed || selectedModel}</span>
                      <button
                        onClick={() => handleCopy(msg.id, msg.text)}
                        className="hover:text-emerald-400 flex items-center gap-1 transition"
                      >
                        {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-slate-400" />}
                        <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white border border-blue-400/40 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-3 justify-start items-center text-xs text-teal-400 py-1.5 animate-pulse">
              <div className="p-1 rounded-lg bg-teal-500/15 text-teal-400 flex items-center justify-center shrink-0">
                <Leap size={32} color="#2dd4bf" />
              </div>
              <span className="font-mono">Gemini ({selectedModel}) is thinking...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggested Prompts */}
        <div className={`px-4 py-2 border-t flex gap-2 overflow-x-auto text-[11px] shrink-0 no-scrollbar ${
          isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          {[
            "Appeal letter for modifier 25 denial",
            "Overcoming 'We do billing in-house' objection",
            "AthenaHealth vs eClinicalWorks collection metrics",
            "Calculate 4.5% fee on $600k monthly volume"
          ].map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setInputMessage(prompt);
              }}
              className={`px-3 py-1 rounded-full whitespace-nowrap transition cursor-pointer border ${
                isDark 
                  ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-white/5' 
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-sm'
              }`}
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} className={`p-3 border-t flex items-center gap-2 shrink-0 ${
          isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
        }`}>
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={`Ask the ${selectedRole.replace('_', ' ')} (${selectedModel})...`}
            className={`flex-1 border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-teal-500 transition ${
              isDark 
                ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-500' 
                : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
            }`}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || isLoading}
            className="px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-md shadow-teal-500/20 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
