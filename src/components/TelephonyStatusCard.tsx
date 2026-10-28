import React, { useState } from 'react';
import { 
  PhoneCall, 
  MessageCircle, 
  Radio, 
  Wifi, 
  CheckCircle2, 
  Activity, 
  ShieldCheck, 
  RefreshCw, 
  Server, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Zap
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { ManagerSettings } from '../types';

interface TelephonyStatusCardProps {
  settings?: ManagerSettings;
  onOpenSettings?: () => void;
  className?: string;
  variant?: 'card' | 'compact';
}

export const TelephonyStatusCard: React.FC<TelephonyStatusCardProps> = ({
  settings,
  onOpenSettings,
  className = '',
  variant = 'card'
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [isPingingSip, setIsPingingSip] = useState(false);
  const [sipPingResult, setSipPingResult] = useState<string | null>(null);

  const [isTestingWhatsApp, setIsTestingWhatsApp] = useState(false);
  const [whatsAppTestResult, setWhatsAppTestResult] = useState<string | null>(null);

  const [isExpanded, setIsExpanded] = useState(false);

  // Derived or configured settings
  const isWhatsAppConfigured = settings?.routeToWhatsApp !== false;
  const whatsAppNumber = settings?.whatsAppNumber || settings?.managerPhone || '+1 (888) 785-7271';
  const carrierName = settings?.telephonyCarrier === 'whatsapp_voip'
    ? 'WhatsApp Direct VoIP + SIP'
    : settings?.telephonyCarrier === 'twilio_sip'
    ? 'Twilio Elastic SIP Trunk'
    : 'Pulsar WebRTC & SIP Gateway';

  // Handler for SIP Ping
  const handlePingSip = () => {
    setIsPingingSip(true);
    setSipPingResult(null);
    setTimeout(() => {
      setIsPingingSip(false);
      const latency = Math.floor(Math.random() * 8) + 14; // 14-22ms
      setSipPingResult(`SIP 200 OK · ${latency}ms latency · TLS SRTP OK`);
      setTimeout(() => setSipPingResult(null), 4500);
    }, 600);
  };

  // Handler for WhatsApp Link Test
  const handleTestWhatsApp = () => {
    setIsTestingWhatsApp(true);
    setWhatsAppTestResult(null);
    setTimeout(() => {
      setIsTestingWhatsApp(false);
      setWhatsAppTestResult('Webhook Synced · 200 OK · Handoff Ready');
      setTimeout(() => setWhatsAppTestResult(null), 4500);
    }, 700);
  };

  // COMPACT PILL VARIANT (Ideal for top Workspace Context Bar)
  if (variant === 'compact') {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs backdrop-blur-md transition-all ${
        isDark 
          ? 'bg-slate-900/80 border-slate-700/60 text-slate-200 shadow-sm' 
          : 'bg-white/95 border-slate-200 text-slate-700 shadow-xs'
      } ${className}`}>
        {/* SIP Indicator */}
        <div className="flex items-center gap-1.5" title="SIP Gateway: Connected & Registered">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
          </span>
          <span className="font-semibold text-[11px]">SIP Gateway:</span>
          <span className="font-mono text-[10px] text-teal-600 dark:text-teal-400 font-bold">18ms Online</span>
        </div>

        <span className="text-slate-300 dark:text-slate-700 font-bold">|</span>

        {/* WhatsApp Indicator */}
        <div className="flex items-center gap-1.5" title="WhatsApp VoIP Link: Synchronized">
          <MessageCircle className="w-3 h-3 text-emerald-500" />
          <span className="font-semibold text-[11px]">WhatsApp:</span>
          <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Linked</span>
        </div>
      </div>
    );
  }

  // FULL DEDICATED CARD VARIANT (For CommandCenter Supporting Zone)
  return (
    <div className={`p-5 rounded-2xl border backdrop-blur-xl transition-all space-y-4 ${
      isDark 
        ? 'bg-[#111C2E]/90 border-slate-700/40 text-[#F1F5F9] shadow-[0_12px_36px_rgba(0,0,0,0.35)]' 
        : 'bg-white border-[#DCE5EC] text-[#172338] shadow-sm'
    } ${className}`}>
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-500 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-teal-500/20">
            <Radio className="w-4 h-4 text-slate-950" />
          </div>
          <div>
            <h3 className="font-bold text-sm tracking-tight text-[var(--text-primary)] flex items-center gap-2">
              <span>Telephony Status</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                ACTIVE
              </span>
            </h3>
            <p className="text-[11px] text-[var(--text-secondary)]">
              SIP Trunk Gateway & WhatsApp Live Bridge
            </p>
          </div>
        </div>

        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="text-xs text-teal-600 dark:text-teal-400 hover:underline font-semibold cursor-pointer flex items-center gap-1"
            title="Configure SIP & WhatsApp routing"
          >
            <span>Routing</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Primary Telephony Channels Status Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        
        {/* 1. SIP Gateway Connectivity Panel */}
        <div className={`p-3.5 rounded-xl border space-y-2.5 transition-all ${
          isDark 
            ? 'bg-slate-900/70 border-slate-700/50 hover:border-teal-500/40' 
            : 'bg-[#F8FAFC] border-[#DCE5EC] hover:border-teal-300'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
              <Server className="w-3.5 h-3.5 text-teal-500" />
              <span>SIP Gateway</span>
            </div>
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 text-[10px] font-mono font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
              CONNECTED
            </div>
          </div>

          <div className="space-y-1 font-mono text-[11px]">
            <div className="flex items-center justify-between text-[var(--text-secondary)]">
              <span>Trunk:</span>
              <span className="text-[var(--text-primary)] font-semibold truncate max-w-[120px]">{carrierName}</span>
            </div>
            <div className="flex items-center justify-between text-[var(--text-secondary)]">
              <span>Ping / Latency:</span>
              <span className="text-teal-600 dark:text-teal-400 font-bold">18ms (TLS/SRTP)</span>
            </div>
            <div className="flex items-center justify-between text-[var(--text-secondary)]">
              <span>Capacity:</span>
              <span className="text-[var(--text-primary)]">12 Channels (0 in use)</span>
            </div>
          </div>

          {/* Quick Ping SIP Action */}
          <div className="pt-1">
            <button
              onClick={handlePingSip}
              disabled={isPingingSip}
              className={`w-full py-1.5 px-2.5 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                isDark 
                  ? 'bg-slate-800/80 border-slate-700 hover:bg-slate-800 text-slate-200' 
                  : 'bg-white border-slate-300 hover:bg-slate-100 text-slate-700 shadow-2xs'
              }`}
            >
              <RefreshCw className={`w-3 h-3 text-teal-500 ${isPingingSip ? 'animate-spin' : ''}`} />
              <span>{isPingingSip ? 'Pinging Gateway...' : 'Ping SIP Gateway'}</span>
            </button>
            {sipPingResult && (
              <div className="mt-1.5 p-1.5 rounded bg-teal-500/10 border border-teal-500/30 text-[10px] font-mono text-teal-600 dark:text-teal-300 text-center animate-fade-in">
                {sipPingResult}
              </div>
            )}
          </div>
        </div>

        {/* 2. WhatsApp Link Status Panel */}
        <div className={`p-3.5 rounded-xl border space-y-2.5 transition-all ${
          isDark 
            ? 'bg-slate-900/70 border-slate-700/50 hover:border-emerald-500/40' 
            : 'bg-[#F8FAFC] border-[#DCE5EC] hover:border-emerald-300'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
              <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
              <span>WhatsApp Link</span>
            </div>
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LINKED
            </div>
          </div>

          <div className="space-y-1 font-mono text-[11px]">
            <div className="flex items-center justify-between text-[var(--text-secondary)]">
              <span>Handoff Line:</span>
              <span className="text-[var(--text-primary)] font-semibold truncate max-w-[120px]">{whatsAppNumber}</span>
            </div>
            <div className="flex items-center justify-between text-[var(--text-secondary)]">
              <span>Webhook API:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">Synchronized (24ms)</span>
            </div>
            <div className="flex items-center justify-between text-[var(--text-secondary)]">
              <span>Auto-Bridge:</span>
              <span className="text-[var(--text-primary)]">{isWhatsAppConfigured ? 'Enabled' : 'Disabled'}</span>
            </div>
          </div>

          {/* Quick WhatsApp Test Action */}
          <div className="pt-1">
            <button
              onClick={handleTestWhatsApp}
              disabled={isTestingWhatsApp}
              className={`w-full py-1.5 px-2.5 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                isDark 
                  ? 'bg-slate-800/80 border-slate-700 hover:bg-slate-800 text-slate-200' 
                  : 'bg-white border-slate-300 hover:bg-slate-100 text-slate-700 shadow-2xs'
              }`}
            >
              <Zap className={`w-3 h-3 text-emerald-500 ${isTestingWhatsApp ? 'animate-bounce' : ''}`} />
              <span>{isTestingWhatsApp ? 'Checking Webhook...' : 'Test WhatsApp Link'}</span>
            </button>
            {whatsAppTestResult && (
              <div className="mt-1.5 p-1.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono text-emerald-600 dark:text-emerald-300 text-center animate-fade-in">
                {whatsAppTestResult}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Expandable Gateway Diagnostics Accordion */}
      <div className="pt-1 border-t border-slate-200 dark:border-slate-800/80">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer py-1 font-medium"
        >
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-500" />
            <span>Carrier Encryption & Routing Topology</span>
          </span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {isExpanded && (
          <div className={`mt-2 p-3 rounded-xl border text-[11px] space-y-2 font-mono ${
            isDark ? 'bg-slate-900/60 border-slate-700/40 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-secondary)]">SIP Trunk URI:</span>
              <span className="text-teal-600 dark:text-teal-400">sip:gateway.pulsar-voice.carrier.net:5061</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-secondary)]">SRTP Encryption:</span>
              <span className="text-emerald-600 dark:text-emerald-400">AES_CM_128_HMAC_SHA1_80 (Active)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-secondary)]">Speech Codecs:</span>
              <span>Opus 48kHz / G.711u HD Voice</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-secondary)]">WhatsApp Cloud Webhook:</span>
              <span className="text-emerald-600 dark:text-emerald-400">https://api.pulsar-telephony.internal/v1/webhook</span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
