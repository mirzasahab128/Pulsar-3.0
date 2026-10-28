import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Clock, 
  PhoneCall, 
  Sparkles, 
  Settings, 
  Bell, 
  ShieldCheck,
  Flame,
  Mic,
  Globe,
  MessageSquare,
  LogOut,
  LogIn,
  Database,
  MessageCircle,
  Smartphone,
  Sliders,
  Moon,
  Sun,
  Crown,
  Lock,
  Code2,
  Layers,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Building2,
  Network,
  Linkedin,
  TrendingUp,
  FileText,
  CheckCircle2,
  Activity,
  ClipboardList,
  User as UserIcon,
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import { formatPSTTime, getTimeUntil4PMPST } from '../utils/pstTime';
import { ManagerSettings } from '../types';
import { ThemeToggle } from './ThemeToggle';
import { useTheme } from '../context/ThemeContext';
import { useDisplay } from '../context/DisplayContext';
import { useAuth } from '../context/AuthContext';
import { PulsarGalaxy } from './PulsarGalaxy';

export interface HeaderProps {
  settings: ManagerSettings;
  onOpenSettings: () => void;
  onOpenBriefing: () => void;
  unreadTasksCount: number;
  onOpenChatbot: () => void;
  onOpenTranscriber: () => void;
  onOpenGrounding: () => void;
  onOpenInstall?: () => void;
  onOpenDisplaySettings?: () => void;
  auditsBooked?: number;
  onViewHotLeads?: () => void;
  voiceMode?: 'need-based' | 'always-on' | 'off';
  isVoiceListening?: boolean;
  isVoiceAlwaysOn?: boolean;
  autoOffSecondsRemaining?: number | null;
  onToggleVoiceListener?: () => void;
  onOpenCodebase?: () => void;
  onOpenNicheLibrary?: () => void;
  activeNicheName?: string;
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
  isMobileDrawerOpen?: boolean;
  onToggleMobileDrawer?: (open: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  onOpenSettings,
  onOpenBriefing,
  unreadTasksCount,
  onOpenChatbot,
  onOpenTranscriber,
  onOpenGrounding,
  onOpenInstall,
  onOpenDisplaySettings,
  auditsBooked = 0,
  onViewHotLeads,
  voiceMode = 'need-based',
  isVoiceListening = false,
  isVoiceAlwaysOn = true,
  autoOffSecondsRemaining = null,
  onToggleVoiceListener,
  onOpenCodebase,
  onOpenNicheLibrary,
  activeNicheName = 'All Industries',
  activeTab = 'leads',
  onSelectTab,
  isMobileDrawerOpen: controlledDrawerOpen,
  onToggleMobileDrawer
}) => {
  const { widthMode, containerClass } = useDisplay();
  const { 
    currentUser, 
    profile, 
    role, 
    isReadOnly, 
    isMasterAdmin, 
    openAuthModal, 
    signOut, 
    setQuickProfile 
  } = useAuth();
  
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const [pstTimeStr, setPstTimeStr] = useState<string>('');
  const [countdown, setCountdown] = useState<{ hours: number; minutes: number; seconds: number; isPast4PMToday: boolean }>({
    hours: 0,
    minutes: 0,
    seconds: 0,
    isPast4PMToday: false
  });

  // Responsive state (support both controlled and internal state)
  const [internalDrawerOpen, setInternalDrawerOpen] = useState(false);
  const isMobileDrawerOpen = controlledDrawerOpen !== undefined ? controlledDrawerOpen : internalDrawerOpen;
  const setIsMobileDrawerOpen = (open: boolean) => {
    if (onToggleMobileDrawer) {
      onToggleMobileDrawer(open);
    } else {
      setInternalDrawerOpen(open);
    }
  };

  const [isAiSuiteOpen, setIsAiSuiteOpen] = useState(false);
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const aiSuiteRef = useRef<HTMLDivElement>(null);
  const toolsMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // PST Clock & Countdown effect
  useEffect(() => {
    const update = () => {
      setPstTimeStr(formatPSTTime());
      const cd = getTimeUntil4PMPST();
      setCountdown(cd);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  // Close menus on outside click or escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (aiSuiteRef.current && !aiSuiteRef.current.contains(e.target as Node)) {
        setIsAiSuiteOpen(false);
      }
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target as Node)) {
        setIsToolsMenuOpen(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileDrawerOpen(false);
        setIsAiSuiteOpen(false);
        setIsToolsMenuOpen(false);
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Prevent background scroll when mobile drawer is open
  useEffect(() => {
    if (isMobileDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileDrawerOpen]);

  // Tab definitions for navigation drawer
  const navTabs = [
    { id: 'leads', label: 'Bot Scraper & Radar', icon: Building2, tag: 'NPI & Web Scraper' },
    { id: 'network', label: 'Network Builder', icon: Network, tag: 'Discovery Map' },
    { id: 'linkedin', label: 'LinkedIn Executive BD', icon: Linkedin, tag: 'Multi-Channel Outreach' },
    { id: 'pipeline', label: 'Sales Pipeline & ROI', icon: TrendingUp, tag: 'Financial Valuation' },
    { id: 'call_studio', label: 'AI Voice Cold Caller', icon: PhoneCall, tag: 'Autonomous Telephony' },
    { id: 'meeting_notes', label: 'Call Transcripts & Notes', icon: FileText, tag: 'AI Call Summaries' },
    { id: 'reminders', label: 'Scheduled Calls & Tasks', icon: Bell, tag: `${unreadTasksCount} Pending` },
    { id: 'briefing', label: '4:00 PM PST Daily Briefing', icon: Flame, tag: 'Executive Brief' },
    { id: 'google_forms', label: 'Google Forms & Audits', icon: ClipboardList, tag: 'Forms & Surveys' },
  ];

  return (
    <>
      <header className={`border-b sticky top-0 z-40 transition-colors duration-300 backdrop-blur-2xl ${
        isDark 
          ? 'border-slate-800/80 bg-[#0B1220]/85 shadow-[0_4px_30px_rgba(0,0,0,0.55)]' 
          : 'border-[#DCE5EC] bg-white/92 shadow-[0_4px_25px_rgba(23,35,56,0.06)]'
      }`}>
        <div className={`${containerClass} h-16 sm:h-18 lg:h-20 flex items-center justify-between gap-2 sm:gap-3 transition-all duration-300`}>
          
          {/* ============================================================ */}
          {/* LEFT: BRAND & ACTIVE NICHE (Desktop, Tablet, Mobile)        */}
          {/* ============================================================ */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 min-w-0">
            {/* Signature Pulsar Galaxy Pixel Mark — brand button: loads the Dashboard */}
            <button
              type="button"
              onClick={() => onSelectTab?.('command_center')}
              className="relative shrink-0 flex items-center justify-center cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95"
              title="Pulsar — go to Dashboard"
              aria-label="Pulsar — go to Dashboard"
            >
              <PulsarGalaxy size="md" state="active" glow={true} />
            </button>

            {/* Brand Title & Context */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => onSelectTab?.('command_center')}
                  className="cursor-pointer group text-left"
                  title="Pulsar — go to Dashboard"
                  aria-label="Pulsar — go to Dashboard"
                >
                  <span className="text-base sm:text-lg lg:text-xl font-bold tracking-tight font-display flex items-center gap-1.5">
                    <span className={`${isDark ? 'text-[#F1F5F9]' : 'text-[#172338]'} group-hover:underline decoration-teal-400/70 underline-offset-4`}>Pulsar</span>
                    <span className="hidden sm:inline text-[11px] font-mono font-medium text-slate-400 dark:text-slate-500">
                      Growth OS
                    </span>
                  </span>
                </button>
              </div>

              {/* Business Niche Indicator & Library Modal Trigger */}
              <div className="flex items-center gap-1.5 text-[11px] font-medium truncate">
                {onOpenNicheLibrary ? (
                  <button
                    onClick={onOpenNicheLibrary}
                    type="button"
                    className={`group flex items-center gap-1 text-[11px] font-medium transition cursor-pointer max-w-[170px] sm:max-w-[240px] truncate ${
                      isDark ? 'text-teal-300 hover:text-teal-200' : 'text-teal-700 hover:text-teal-900'
                    }`}
                    title="Click to open Business Niche Library: Switch templates & personas"
                  >
                    <Layers className="w-3 h-3 text-teal-400 shrink-0 group-hover:rotate-12 transition-transform duration-300" />
                    <span className="truncate font-semibold underline decoration-teal-500/40 hover:decoration-teal-400">
                      {activeNicheName.split('&')[0].trim()}
                    </span>
                    <span className="hidden md:inline text-[9px] px-1 py-0.2 rounded bg-teal-500/20 text-teal-300 uppercase font-mono">
                      Niche
                    </span>
                  </button>
                ) : (
                  <span className={`truncate ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {activeNicheName.split('&')[0].trim()}
                  </span>
                )}

                <span className="hidden sm:inline text-slate-500">•</span>
                <span className="hidden sm:inline-flex items-center gap-1 text-emerald-500 text-[10px] font-mono font-semibold">
                  <Database className="w-2.5 h-2.5 shrink-0" />
                  <span>Isolated</span>
                </span>
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* CENTER: LIVE OPERATIONS & PST BRIEFING (Desktop & Tablet)   */}
          {/* ============================================================ */}
          <div className="hidden md:flex items-center gap-2 lg:gap-2.5 shrink-0">
            {/* 4:00 PM PST Daily Briefing Countdown */}
            <button
              onClick={onOpenBriefing}
              type="button"
              className={`flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs transition group cursor-pointer backdrop-blur-md ${
                isDark 
                  ? 'bg-blue-950/50 hover:bg-blue-900/50 border-blue-800/40 text-blue-200' 
                  : 'bg-blue-50/80 hover:bg-blue-100/80 border-blue-200 text-blue-900 shadow-sm'
              }`}
              title="Click to view 4:00 PM PST Progress Briefing"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <div className="text-left leading-tight">
                <div className="text-[10px] font-medium uppercase tracking-wider flex items-center gap-1 text-blue-400 dark:text-blue-300">
                  <Flame className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="hidden xl:inline">4:00 PM PST Briefing</span>
                  <span className="xl:hidden">4PM PST</span>
                </div>
                <div className="font-mono font-bold text-[11px]">
                  in {String(countdown.hours).padStart(2, '0')}:{String(countdown.minutes).padStart(2, '0')}:{String(countdown.seconds).padStart(2, '0')}
                </div>
              </div>
            </button>

            {/* Current PST Clock (Desktop >= 1024px) */}
            <div className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-mono ${
              isDark 
                ? 'bg-slate-900/60 border-slate-800 text-slate-300' 
                : 'bg-slate-100/80 border-slate-200 text-slate-700'
            }`}>
              <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="text-[11px]">{pstTimeStr || 'PST Live'}</span>
            </div>

            {/* WhatsApp Telephony Bridge (Desktop >= 1280px) */}
            <div className={`hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs ${
              isDark 
                ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300' 
                : 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
            }`}>
              <div className="relative shrink-0">
                <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
              </div>
              <div className="text-left leading-tight font-mono text-[11px]">
                <span className="text-[9px] uppercase tracking-wider text-emerald-500 font-bold block">WhatsApp</span>
                <span className="font-bold">{settings.whatsAppNumber || settings.managerPhone}</span>
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* RIGHT: DESKTOP & TABLET ACTIONS + MOBILE HAMBURGER           */}
          {/* ============================================================ */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            
            {/* 1. Voice Command Listener Button (Desktop & Tablet) */}
            {onToggleVoiceListener && (
              <button
                onClick={onToggleVoiceListener}
                type="button"
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border text-xs font-bold transition transform active:scale-95 cursor-pointer backdrop-blur-md shadow-sm min-h-[38px] sm:min-h-[40px] ${
                  isVoiceListening
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                    : voiceMode === 'need-based'
                      ? isDark ? 'bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border-teal-500/30' : 'bg-teal-50 hover:bg-teal-100 text-teal-800 border-teal-200'
                      : isDark ? 'bg-slate-900/80 hover:bg-slate-800 text-slate-400 border-slate-800' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
                }`}
                title={
                  isVoiceListening
                    ? `Voice listener live (${autoOffSecondsRemaining !== null ? `Auto-off in ${autoOffSecondsRemaining}s` : 'Active'}). Click to pause.`
                    : 'Voice Assistant: Click or press V to speak commands.'
                }
                aria-label="Toggle Voice Command Assistant"
              >
                <div className="relative flex items-center justify-center">
                  <Mic className={`w-3.5 h-3.5 ${isVoiceListening ? 'text-emerald-400' : 'text-teal-400'}`} />
                  {isVoiceListening && (
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                  )}
                </div>
                <span className="hidden sm:inline font-mono text-[11px]">
                  {isVoiceListening 
                    ? (autoOffSecondsRemaining !== null ? `Voice (${autoOffSecondsRemaining}s)` : 'Voice Live')
                    : 'Voice'}
                </span>
              </button>
            )}

            {/* 2. Hot Lead Notification Flame (Desktop & Tablet) */}
            {auditsBooked > 0 && (
              <button
                onClick={onViewHotLeads || onOpenBriefing}
                type="button"
                className={`relative flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border text-xs shadow-sm cursor-pointer transition transform active:scale-95 group min-h-[38px] sm:min-h-[40px] ${
                  isDark
                    ? 'bg-amber-500/15 border-amber-500/40 hover:border-amber-400 text-amber-200 shadow-amber-500/10'
                    : 'bg-amber-50 border-amber-300 hover:border-amber-400 text-amber-900 shadow-amber-500/10'
                }`}
                title={`${auditsBooked} Hot Lead(s) flagged with audits booked! Click to view.`}
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                </span>
                <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500/30 shrink-0" />
                <span className="font-black text-amber-500 dark:text-amber-300">
                  {auditsBooked}
                </span>
                <span className="hidden md:inline font-bold text-amber-600 dark:text-amber-300">
                  Hot
                </span>
              </button>
            )}

            {/* 3. Task Notifications Bell (Desktop, Tablet, Mobile) */}
            <button 
              onClick={onOpenBriefing}
              type="button"
              className={`relative p-2 rounded-xl border transition cursor-pointer min-h-[38px] min-w-[38px] sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center ${
                isDark 
                  ? 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white' 
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700 shadow-sm'
              }`}
              title={`${unreadTasksCount} Action Items Pending`}
              aria-label={`${unreadTasksCount} Action Items Pending`}
            >
              <Bell className="w-4 h-4" />
              {unreadTasksCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                  {unreadTasksCount}
                </span>
              )}
            </button>

            {/* 4. Desktop AI Suite Dropdown Menu (>= 1024px) */}
            <div className="relative hidden lg:block" ref={aiSuiteRef}>
              <button
                type="button"
                onClick={() => {
                  setIsAiSuiteOpen(!isAiSuiteOpen);
                  setIsToolsMenuOpen(false);
                  setIsProfileMenuOpen(false);
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition cursor-pointer min-h-[40px] ${
                  isDark
                    ? 'bg-blue-600/15 hover:bg-blue-600/25 text-blue-300 border-blue-500/30'
                    : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200 shadow-sm'
                }`}
                title="AI Copilot Suite: Gemini Chat, Audio Transcriber & Web Grounding"
              >
                <Bot className="w-3.5 h-3.5 text-blue-400" />
                <span>AI Suite</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isAiSuiteOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Popover */}
              {isAiSuiteOpen && (
                <div className={`absolute right-0 mt-2 w-64 rounded-2xl border p-2 shadow-2xl backdrop-blur-2xl z-50 animate-in fade-in zoom-in-95 duration-150 ${
                  isDark ? 'bg-slate-900/95 border-slate-800 text-slate-200' : 'bg-white/95 border-slate-200 text-slate-800'
                }`}>
                  <div className="text-[10px] font-mono uppercase font-bold px-2 py-1 text-slate-500">
                    Gemini Intelligence Suite
                  </div>
                  
                  <button
                    onClick={() => {
                      onOpenChatbot();
                      setIsAiSuiteOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left text-xs font-semibold transition cursor-pointer ${
                      isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 shrink-0">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold">AI Chat Copilot</div>
                      <div className="text-[10px] text-slate-400 font-normal">Multi-turn sales & strategy assistant</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      onOpenTranscriber();
                      setIsAiSuiteOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left text-xs font-semibold transition cursor-pointer ${
                      isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
                      <Mic className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold">Audio Transcriber</div>
                      <div className="text-[10px] text-slate-400 font-normal">gemini-3.5-transcribe dictation</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      onOpenGrounding();
                      setIsAiSuiteOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left text-xs font-semibold transition cursor-pointer ${
                      isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 shrink-0">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold">Maps & Web Grounding</div>
                      <div className="text-[10px] text-slate-400 font-normal">Verified company & place lookups</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* 5. Business Niche Library Button (Desktop >= 1024px) */}
            {onOpenNicheLibrary && (
              <button
                onClick={onOpenNicheLibrary}
                type="button"
                className={`hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition transform active:scale-95 cursor-pointer backdrop-blur-md shadow-sm min-h-[40px] ${
                  isDark 
                    ? 'bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border-teal-500/40 shadow-[0_0_15px_rgba(20,184,166,0.15)]' 
                    : 'bg-teal-50 hover:bg-teal-100 text-teal-800 border-teal-300 shadow-sm'
                }`}
                title="Business Niche Library: Switch templates (Real Estate, SaaS, Recruitment, Healthcare, HVAC, Growth)"
              >
                <Layers className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span className="font-display">Niche Library</span>
              </button>
            )}

            {/* 6. Desktop Utilities Menu Dropdown (>= 1024px) */}
            <div className="relative hidden lg:block" ref={toolsMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setIsToolsMenuOpen(!isToolsMenuOpen);
                  setIsAiSuiteOpen(false);
                  setIsProfileMenuOpen(false);
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer min-h-[40px] ${
                  isDark 
                    ? 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300' 
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700 shadow-sm'
                }`}
                title="System Utilities & Architecture"
              >
                <Sliders className="w-3.5 h-3.5 text-slate-400" />
                <span>Tools</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isToolsMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isToolsMenuOpen && (
                <div className={`absolute right-0 mt-2 w-60 rounded-2xl border p-2 shadow-2xl backdrop-blur-2xl z-50 animate-in fade-in zoom-in-95 duration-150 ${
                  isDark ? 'bg-slate-900/95 border-slate-800 text-slate-200' : 'bg-white/95 border-slate-200 text-slate-800'
                }`}>
                  <div className="text-[10px] font-mono uppercase font-bold px-2 py-1 text-slate-500">
                    Application Tools
                  </div>

                  {onOpenDisplaySettings && (
                    <button
                      onClick={() => {
                        onOpenDisplaySettings();
                        setIsToolsMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs font-semibold transition cursor-pointer ${
                        isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Sliders className="w-3.5 h-3.5 text-blue-400" />
                        <span>Display & Margins</span>
                      </div>
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                        {widthMode}
                      </span>
                    </button>
                  )}

                  {onOpenInstall && (
                    <button
                      onClick={() => {
                        onOpenInstall();
                        setIsToolsMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 p-2 rounded-xl text-left text-xs font-semibold transition cursor-pointer ${
                        isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Install Native App (PWA)</span>
                    </button>
                  )}

                  {onOpenCodebase && (
                    <button
                      onClick={() => {
                        onOpenCodebase();
                        setIsToolsMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 p-2 rounded-xl text-left text-xs font-semibold transition cursor-pointer ${
                        isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                      }`}
                    >
                      <Code2 className="w-3.5 h-3.5 text-teal-400" />
                      <span>Codebase Architecture</span>
                    </button>
                  )}

                  {onSelectTab && (
                    <button
                      onClick={() => {
                        onSelectTab('google_forms');
                        setIsToolsMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 p-2 rounded-xl text-left text-xs font-semibold transition cursor-pointer ${
                        isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                      }`}
                    >
                      <ClipboardList className="w-3.5 h-3.5 text-teal-400" />
                      <span>Google Forms & Audits</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 7. Theme Toggle (Desktop, Tablet, Mobile) */}
            <div className="hidden sm:block">
              <ThemeToggle showLabel={false} />
            </div>

            {/* 8. User Account & Role Badge (Desktop >= 768px) */}
            <div className="relative hidden md:block" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setIsProfileMenuOpen(!isProfileMenuOpen);
                  setIsAiSuiteOpen(false);
                  setIsToolsMenuOpen(false);
                }}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border text-xs font-bold transition shadow-sm cursor-pointer min-h-[38px] sm:min-h-[40px] ${
                  isMasterAdmin
                    ? isDark 
                      ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/40 ring-1 ring-amber-500/20' 
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 ring-1 ring-amber-300/40'
                    : isDark 
                      ? 'bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border-sky-500/40 ring-1 ring-sky-500/20' 
                      : 'bg-sky-50 hover:bg-sky-100 text-sky-900 border-sky-300 ring-1 ring-sky-300/40'
                }`}
                title={`Active Role: ${isMasterAdmin ? 'Master Controller (Admin)' : 'Customer (Read-Only)'}. Click for account actions.`}
              >
                {isMasterAdmin ? (
                  <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                )}
                <span className="hidden xl:inline">
                  {isMasterAdmin ? 'Admin (Master)' : 'Customer (RO)'}
                </span>
                <span className="xl:hidden">
                  {isMasterAdmin ? 'Admin' : 'RO'}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Profile Dropdown */}
              {isProfileMenuOpen && (
                <div className={`absolute right-0 mt-2 w-72 rounded-2xl border p-3 shadow-2xl backdrop-blur-2xl z-50 animate-in fade-in zoom-in-95 duration-150 ${
                  isDark ? 'bg-slate-900/95 border-slate-800 text-slate-200' : 'bg-white/95 border-slate-200 text-slate-800'
                }`}>
                  <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                      isMasterAdmin ? 'bg-amber-500/20 text-amber-300' : 'bg-sky-500/20 text-sky-300'
                    }`}>
                      {profile?.displayName?.charAt(0) || (isMasterAdmin ? 'A' : 'C')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs truncate">
                        {profile?.displayName || (isMasterAdmin ? 'Master Controller' : 'Customer Account')}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">
                        {currentUser?.email || profile?.email || 'Not signed in'}
                      </div>
                      <div className="text-[10px] text-teal-400 font-mono mt-0.5">
                        WS: {profile?.workspaceId || 'ws_pulsar_master'}
                      </div>
                    </div>
                  </div>

                  {/* Verified Role Information */}
                  <div className="pt-2.5 pb-1 border-t border-[var(--lg-border-glass)]">
                    <div className="text-[10px] font-mono uppercase text-slate-500 font-bold mb-1 flex items-center justify-between">
                      <span>Access Role</span>
                      <span className="text-emerald-400 font-bold">RBAC Enforced</span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-800/40 border border-slate-700/50 text-xs">
                      <div className="flex items-center gap-2">
                        {isMasterAdmin ? (
                          <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        )}
                        <span className="font-semibold text-slate-200">
                          {isMasterAdmin ? 'Master Admin' : 'Customer (Read-Only)'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {isMasterAdmin 
                          ? 'Full orchestration & outbound control' 
                          : 'Read-only access strictly isolated to your workspace'}
                      </div>
                    </div>
                  </div>

                  {/* Settings & Auth Buttons */}
                  <div className="pt-2 border-t border-slate-800 space-y-1">
                    <button
                      onClick={() => {
                        onOpenSettings();
                        setIsProfileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 p-2 rounded-xl text-left text-xs font-semibold transition cursor-pointer ${
                        isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                      }`}
                    >
                      <Settings className="w-3.5 h-3.5 text-slate-400" />
                      <span>Manager Configuration</span>
                    </button>

                    {currentUser ? (
                      <button
                        onClick={() => {
                          signOut();
                          setIsProfileMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2 p-2 rounded-xl text-left text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out Session</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          openAuthModal('signin');
                          setIsProfileMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2 p-2 rounded-xl text-left text-xs font-semibold text-teal-400 hover:bg-teal-500/10 transition cursor-pointer"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        <span>Sign In / Register</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 9. Configuration Gear Button (Desktop >= 1280px) */}
            <button
              onClick={onOpenSettings}
              type="button"
              className={`hidden xl:flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-xl border text-xs font-semibold transition cursor-pointer min-h-[38px] sm:min-h-[40px] ${
                isDark
                  ? 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-800 hover:border-slate-700'
                  : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 shadow-sm'
              }`}
              title="Manager Settings & Configuration"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4 text-slate-400" />
              <span className="hidden xl:inline">Config</span>
            </button>

            {/* 10. MOBILE & TABLET HAMBURGER BUTTON (Mobile < 768px, Tablet < 1024px) */}
            <button
              onClick={() => setIsMobileDrawerOpen(true)}
              type="button"
              className={`flex lg:hidden items-center justify-center p-2 rounded-xl border transition cursor-pointer min-h-[40px] min-w-[40px] ${
                isDark 
                  ? 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-800 hover:border-teal-500/40 shadow-sm' 
                  : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 shadow-sm'
              }`}
              title="Open Navigation Menu"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5 text-teal-400" />
            </button>

          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/* FULL RESPONSIVE MOBILE & TABLET NAVIGATION DRAWER            */}
      {/* ============================================================ */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200">
          {/* Backdrop Blur Overlay */}
          <div 
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-md transition-opacity"
            onClick={() => setIsMobileDrawerOpen(false)}
          />

          {/* Slide-over Drawer Panel */}
          <div 
            className={`relative w-full sm:w-[420px] max-w-full h-full shadow-2xl flex flex-col z-10 overflow-hidden animate-in slide-in-from-right duration-300 border-l ${
              isDark 
                ? 'bg-slate-950/98 border-slate-800 text-slate-100' 
                : 'bg-white/98 border-slate-200 text-slate-900'
            }`}
          >
            {/* Drawer Top Header */}
            <div className={`p-4 border-b flex items-center justify-between shrink-0 ${
              isDark ? 'border-slate-800/80 bg-slate-900/40' : 'border-slate-200 bg-slate-50/80'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-teal-400 to-emerald-400 flex items-center justify-center text-slate-950 font-black shadow-md">
                  <Bot className="w-4 h-4 text-slate-950" />
                </div>
                <div>
                  <div className="font-bold text-sm font-display flex items-center gap-1.5">
                    <span>Pulsar Navigation</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-400 font-bold uppercase">
                      Menu
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {pstTimeStr || 'PST Telephony Live'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* 1-Tap Theme Toggle inside drawer */}
                <button
                  type="button"
                  onClick={toggleTheme}
                  className={`p-2 rounded-xl border transition cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center ${
                    isDark ? 'bg-slate-850 border-slate-700 text-amber-300' : 'bg-white border-slate-200 text-slate-700'
                  }`}
                  title="Toggle Light / Dark mode"
                >
                  {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className={`p-2 rounded-xl border transition cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center ${
                    isDark 
                      ? 'bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white border-slate-700' 
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border-slate-200'
                  }`}
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drawer Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
              
              {/* 1. User Profile & Role Switcher Card */}
              <div className={`p-3.5 rounded-2xl border ${
                isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                      isMasterAdmin ? 'bg-amber-500/20 text-amber-300' : 'bg-sky-500/20 text-sky-300'
                    }`}>
                      {profile?.displayName?.charAt(0) || (isMasterAdmin ? 'A' : 'C')}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs truncate max-w-[170px]">
                        {profile?.displayName || (isMasterAdmin ? 'Master Controller' : 'Customer Read-Only')}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono truncate max-w-[170px]">
                        {currentUser?.email || profile?.email || 'Not signed in'}
                      </div>
                    </div>
                  </div>

                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                    isMasterAdmin 
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' 
                      : 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                  }`}>
                    {isMasterAdmin ? 'ADMIN' : 'READ-ONLY'}
                  </span>
                </div>

                {/* Verified RBAC status */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <div className="text-[11px] text-slate-400">
                    Workspace: <strong className="text-slate-200">{profile?.workspaceId || 'Default'}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => signOut()}
                    className="text-xs text-rose-400 font-semibold flex items-center gap-1 hover:underline"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>

              {/* 2. Active Business Niche Template Card */}
              <div className={`p-3.5 rounded-2xl border transition-all ${
                isDark ? 'bg-teal-950/30 border-teal-500/30' : 'bg-teal-50/70 border-teal-200'
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-[10px] font-mono uppercase font-bold text-teal-400 flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    <span>Active Outreach Niche</span>
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-300 font-bold uppercase">
                    Configured
                  </span>
                </div>
                <div className="font-bold text-sm mb-1 text-teal-300 dark:text-teal-200">
                  {activeNicheName}
                </div>
                <p className={`text-[11px] mb-3 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  AI agent instructions, target persona, and objection handlers are auto-configured for this niche.
                </p>
                {onOpenNicheLibrary && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenNicheLibrary();
                      setIsMobileDrawerOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition cursor-pointer shadow-md shadow-teal-500/20"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Switch Niche in Library</span>
                  </button>
                )}
              </div>

              {/* 3. Primary Module Navigation Links */}
              <div>
                <div className="text-[10px] font-mono uppercase font-bold px-1 mb-2 text-slate-400 flex items-center justify-between">
                  <span>Application Modules</span>
                  <span className="text-[9px]">Tap to Navigate</span>
                </div>
                <div className="space-y-1">
                  {navTabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          if (onSelectTab) {
                            onSelectTab(tab.id);
                          }
                          setIsMobileDrawerOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs font-semibold transition cursor-pointer border min-h-[44px] ${
                          isActive
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-emerald-400 font-black shadow-md shadow-emerald-500/25 ring-1 ring-white/30'
                            : isDark
                              ? 'bg-slate-900/60 hover:bg-slate-850 text-slate-300 border-slate-800'
                              : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200 shadow-sm'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-teal-400'}`} />
                          <span className="truncate">{tab.label}</span>
                        </div>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0 ${
                          isActive ? 'bg-white/20 text-white font-bold' : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {tab.tag}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. AI Intelligence Tools */}
              <div>
                <div className="text-[10px] font-mono uppercase font-bold px-1 mb-2 text-slate-400">
                  AI Copilot Features
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChatbot();
                      setIsMobileDrawerOpen(false);
                    }}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs font-semibold transition cursor-pointer min-h-[44px] ${
                      isDark ? 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-900'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>AI Chat</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onOpenTranscriber();
                      setIsMobileDrawerOpen(false);
                    }}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs font-semibold transition cursor-pointer min-h-[44px] ${
                      isDark ? 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    }`}
                  >
                    <Mic className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Transcribe</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onOpenGrounding();
                      setIsMobileDrawerOpen(false);
                    }}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs font-semibold transition cursor-pointer min-h-[44px] ${
                      isDark ? 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-cyan-300' : 'bg-cyan-50 border-cyan-200 text-cyan-900'
                    }`}
                  >
                    <Globe className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>Grounding</span>
                  </button>
                </div>
              </div>

              {/* 5. Telephony & Operations Overview */}
              <div className={`p-3.5 rounded-2xl border space-y-2 text-xs ${
                isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="text-[10px] font-mono uppercase font-bold text-slate-500">
                  Operations & Live Telephony
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">4:00 PM PST Briefing:</span>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenBriefing();
                      setIsMobileDrawerOpen(false);
                    }}
                    className="font-mono font-bold text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Flame className="w-3 h-3 text-emerald-400" />
                    <span>in {String(countdown.hours).padStart(2, '0')}:{String(countdown.minutes).padStart(2, '0')}:{String(countdown.seconds).padStart(2, '0')}</span>
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">WhatsApp Bridge:</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {settings.whatsAppNumber || settings.managerPhone}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Hot Leads Booked:</span>
                  <span className="font-bold text-amber-400">
                    {auditsBooked} Audit{auditsBooked !== 1 ? 's' : ''} Scheduled
                  </span>
                </div>
              </div>

              {/* 6. System & Architecture Utilities */}
              <div className="space-y-1 pt-1">
                <div className="text-[10px] font-mono uppercase font-bold px-1 mb-1 text-slate-400">
                  System Utilities
                </div>

                {onOpenDisplaySettings && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenDisplaySettings();
                      setIsMobileDrawerOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer min-h-[44px] ${
                      isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-blue-400" />
                      <span>Screen Width & Margins</span>
                    </div>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
                      {widthMode}
                    </span>
                  </button>
                )}

                {onOpenInstall && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenInstall();
                      setIsMobileDrawerOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer min-h-[44px] ${
                      isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  >
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    <span>Install Mobile App (PWA)</span>
                  </button>
                )}

                {onOpenCodebase && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenCodebase();
                      setIsMobileDrawerOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer min-h-[44px] ${
                      isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  >
                    <Code2 className="w-4 h-4 text-teal-400" />
                    <span>Codebase & Security Rules</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    onOpenSettings();
                    setIsMobileDrawerOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer min-h-[44px] ${
                    isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                  }`}
                >
                  <Settings className="w-4 h-4 text-slate-400" />
                  <span>Manager Settings & Preferences</span>
                </button>
              </div>

            </div>

            {/* Drawer Bottom Actions */}
            <div className={`p-4 border-t shrink-0 flex items-center justify-between gap-2 ${
              isDark ? 'border-slate-800/80 bg-slate-900/60' : 'border-slate-200 bg-slate-50'
            }`}>
              {currentUser ? (
                <button
                  type="button"
                  onClick={() => {
                    signOut();
                    setIsMobileDrawerOpen(false);
                  }}
                  className="flex items-center gap-1.5 py-2 px-3 rounded-xl border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 text-xs font-bold transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    openAuthModal('signin');
                    setIsMobileDrawerOpen(false);
                  }}
                  className="flex items-center gap-1.5 py-2 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-600 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In / Register</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(false)}
                className={`py-2 px-4 rounded-xl border text-xs font-bold transition cursor-pointer ${
                  isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700 shadow-sm'
                }`}
              >
                Close Menu
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
