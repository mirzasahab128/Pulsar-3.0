import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Building2, 
  Network, 
  Linkedin, 
  TrendingUp, 
  PhoneCall, 
  FileText, 
  Bell, 
  Flame, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  LayoutGrid,
  Check,
  Compass,
  ArrowUpRight,
  ClipboardList
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export type NavTabId = 
  | 'leads' 
  | 'network' 
  | 'linkedin' 
  | 'pipeline' 
  | 'call_studio' 
  | 'meeting_notes' 
  | 'reminders' 
  | 'briefing'
  | 'google_forms';

export interface NavTabItem {
  id: NavTabId;
  number: number;
  fullLabel: string;
  tabletLabel: string;
  mobileLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  tag: string;
  count?: number;
  badgeColor?: string;
}

export interface NavigationDockProps {
  activeTab: NavTabId;
  onSelectTab: (tabId: NavTabId) => void;
  leadsCount: number;
  meetingNotesCount: number;
  unreadTasksCount: number;
  onOpenMobileDrawer?: () => void;
  className?: string;
}

export const NavigationDock: React.FC<NavigationDockProps> = ({
  activeTab,
  onSelectTab,
  leadsCount,
  meetingNotesCount,
  unreadTasksCount,
  onOpenMobileDrawer,
  className = ''
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Tab definitions with responsive labels and dynamic counts
  const navTabs: NavTabItem[] = [
    {
      id: 'leads',
      number: 1,
      fullLabel: 'Bot Scraper & Radar',
      tabletLabel: 'Scraper & Radar',
      mobileLabel: 'Scraper',
      icon: Building2,
      tag: 'NPI & Registry',
      count: leadsCount,
      badgeColor: 'emerald'
    },
    {
      id: 'network',
      number: 2,
      fullLabel: 'Network Builder',
      tabletLabel: 'Network Map',
      mobileLabel: 'Network',
      icon: Network,
      tag: 'Target Mapping'
    },
    {
      id: 'linkedin',
      number: 3,
      fullLabel: 'LinkedIn Executive BD',
      tabletLabel: 'LinkedIn BD',
      mobileLabel: 'LinkedIn',
      icon: Linkedin,
      tag: 'Executive BD'
    },
    {
      id: 'pipeline',
      number: 4,
      fullLabel: 'Sales Pipeline & ROI',
      tabletLabel: 'Pipeline & ROI',
      mobileLabel: 'Pipeline',
      icon: TrendingUp,
      tag: 'Financial Valuation'
    },
    {
      id: 'call_studio',
      number: 5,
      fullLabel: 'AI Voice Cold Caller',
      tabletLabel: 'Voice Caller',
      mobileLabel: 'Dialer',
      icon: PhoneCall,
      tag: 'Telephony Engine'
    },
    {
      id: 'meeting_notes',
      number: 6,
      fullLabel: 'Call Transcripts & Notes',
      tabletLabel: 'Transcripts',
      mobileLabel: 'Notes',
      icon: FileText,
      tag: 'AI Summaries',
      count: meetingNotesCount,
      badgeColor: 'blue'
    },
    {
      id: 'reminders',
      number: 7,
      fullLabel: 'Scheduled Calls & Tasks',
      tabletLabel: 'Calls & Tasks',
      mobileLabel: 'Tasks',
      icon: Bell,
      tag: 'Reminders',
      count: unreadTasksCount,
      badgeColor: 'amber'
    },
    {
      id: 'briefing',
      number: 8,
      fullLabel: '4:00 PM PST Daily Briefing',
      tabletLabel: '4PM PST Briefing',
      mobileLabel: 'Briefing',
      icon: Flame,
      tag: 'Executive Brief'
    },
    {
      id: 'google_forms',
      number: 9,
      fullLabel: 'Google Forms & Audits',
      tabletLabel: 'Forms & Audits',
      mobileLabel: 'Forms',
      icon: ClipboardList,
      tag: 'Workspace'
    }
  ];

  // Check scroll capability for overflow indicators and arrows
  const checkScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 6);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 6);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollContainerRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll]);

  // Auto-scroll active tab into view smoothly
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const activeBtn = el.querySelector(`[data-tab-id="${activeTab}"]`) as HTMLElement;
    if (activeBtn) {
      const containerRect = el.getBoundingClientRect();
      const btnRect = activeBtn.getBoundingClientRect();
      if (btnRect.left < containerRect.left || btnRect.right > containerRect.right) {
        activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
    checkScroll();
  }, [activeTab, checkScroll]);

  // Click outside to close mobile dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const offset = direction === 'left' ? -260 : 260;
    el.scrollBy({ left: offset, behavior: 'smooth' });
  };

  const activeItem = navTabs.find(t => t.id === activeTab) || navTabs[0];
  const ActiveIcon = activeItem.icon;

  return (
    <nav 
      aria-label="Application Module Navigation"
      className={`sticky top-16 sm:top-18 lg:top-20 z-30 transition-all duration-200 ${className}`}
    >
      {/* Container with backdrop blur & refined boundary */}
      <div className={`rounded-[24px] border border-[var(--pv-border)] backdrop-blur-2xl shadow-[var(--pv-shadow)] transition-colors duration-200 ${
        isDark
          ? 'bg-[#121B14]/88'
          : 'bg-white/88'
      }`}>
        
        {/* ============================================================== */}
        {/* MOBILE & TABLET COMPACT HEADER ROW (< 1024px)                  */}
        {/* ============================================================== */}
        <div className="flex lg:hidden items-center justify-between gap-2 p-2 sm:p-2.5 border-b border-inherit">
          {/* Active Tab Quick Dropdown Button */}
          <div className="relative flex-1 min-w-0" ref={mobileMenuRef}>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition cursor-pointer min-h-[42px] ${
                isDark
                  ? 'bg-slate-900 border-slate-800 text-slate-100 hover:bg-slate-850'
                  : 'bg-slate-50 border-slate-200 text-slate-900 hover:bg-slate-100'
              }`}
              aria-expanded={isMobileMenuOpen}
              aria-label="Select module"
            >
              <div className="flex items-center gap-2.5 truncate">
                <div className="p-1.5 rounded-lg bg-[var(--pv-mint)] text-[var(--pv-accent)] shrink-0">
                  <ActiveIcon className="w-4 h-4" />
                </div>
                <div className="text-left truncate">
                  <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
                    Module {activeItem.number} of 9
                  </div>
                  <div className="text-xs font-bold truncate">
                    {activeItem.fullLabel}
                    {activeItem.count !== undefined && (
                      <span className="ml-1.5 font-mono text-[11px] text-[var(--pv-accent)] font-bold">
                        ({activeItem.count})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="hidden sm:inline text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[var(--pv-mint)] text-[var(--pv-green)] font-semibold">
                  Switch
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  isMobileMenuOpen ? 'rotate-180' : ''
                }`} />
              </div>
            </button>

            {/* Mobile/Tablet Modules Popover Menu */}
            {isMobileMenuOpen && (
              <div className={`absolute left-0 right-0 mt-2 rounded-2xl border p-2 shadow-2xl backdrop-blur-2xl z-50 animate-in fade-in zoom-in-95 duration-150 max-h-[70vh] overflow-y-auto no-scrollbar ${
                isDark ? 'bg-slate-900/98 border-slate-800 text-slate-100' : 'bg-white/98 border-slate-200 text-slate-900'
              }`}>
                <div className="px-2 py-1 text-[10px] font-mono uppercase text-slate-500 font-bold flex items-center justify-between">
                  <span>All 9 Core Modules</span>
                  <span className="text-[var(--pv-accent)]">1-Tap Navigation</span>
                </div>

                <div className="space-y-1 mt-1">
                  {navTabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = tab.id === activeTab;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          onSelectTab(tab.id);
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs font-semibold transition cursor-pointer border min-h-[44px] ${
                          isActive
                            ? 'bg-gradient-to-r from-[var(--pv-green)] to-[var(--pv-accent)] text-white border-[var(--pv-accent)] font-black shadow-md shadow-[0_10px_22px_rgba(11,93,59,0.28)] ring-1 ring-white/30'
                            : isDark
                              ? 'bg-slate-850/50 hover:bg-slate-800 text-slate-300 border-transparent hover:border-slate-700'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-transparent hover:border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`p-1.5 rounded-lg shrink-0 ${
                            isActive ? 'bg-white/20 text-white' : 'bg-[var(--pv-mint)] text-[var(--pv-accent)]'
                          }`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-bold flex items-center gap-1.5">
                              <span>{tab.number}. {tab.fullLabel}</span>
                              {tab.count !== undefined && (
                                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                                  isActive ? 'bg-white/25 text-white' : 'bg-[var(--pv-mint)] text-[var(--pv-green)]'
                                }`}>
                                  {tab.count}
                                </span>
                              )}
                            </div>
                            <div className={`text-[10px] font-mono truncate ${
                              isActive ? 'text-white/80' : 'text-slate-400'
                            }`}>
                              {tab.tag}
                            </div>
                          </div>
                        </div>

                        {isActive ? (
                          <Check className="w-4 h-4 text-white shrink-0 ml-2" />
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-2" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Quick Drawer Trigger Button for Tablet/Mobile */}
          {onOpenMobileDrawer && (
            <button
              type="button"
              onClick={onOpenMobileDrawer}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition cursor-pointer min-h-[42px] shrink-0 ${
                isDark 
                  ? 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800' 
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Open full menu with settings, templates, and utilities"
              aria-label="Open full menu"
            >
              <LayoutGrid className="w-4 h-4 text-[var(--pv-accent)]" />
              <span className="hidden sm:inline font-display">Menu</span>
            </button>
          )}
        </div>

        {/* ============================================================== */}
        {/* HORIZONTAL SCROLLABLE DOCK (Desktop, Tablet & Mobile Carousel) */}
        {/* ============================================================== */}
        <div className="relative flex items-center p-1.5 sm:p-2">
          
          {/* Scroll Left Button (Visible when scrolled) */}
          <button
            type="button"
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            className={`hidden md:flex items-center justify-center w-8 h-8 rounded-xl border transition-all duration-200 shrink-0 z-10 cursor-pointer ${
              canScrollLeft
                ? isDark 
                  ? 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-slate-700 shadow-md opacity-100' 
                  : 'bg-white/95 hover:bg-slate-50 text-slate-700 border-slate-300 shadow-sm opacity-100'
                : 'opacity-0 pointer-events-none'
            }`}
            aria-label="Scroll tabs left"
            title="Scroll left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Left Gradient Fade Mask */}
          <div 
            aria-hidden="true"
            className={`pointer-events-none absolute left-2 md:left-10 top-2 bottom-2 w-8 z-[5] transition-opacity duration-200 ${
              canScrollLeft 
                ? isDark 
                  ? 'opacity-100 bg-gradient-to-r from-[#121B14]/90 to-transparent' 
                  : 'opacity-100 bg-gradient-to-r from-white/90 to-transparent' 
                : 'opacity-0'
            }`} 
          />

          {/* Scrollable Tabs Track */}
          <div
            ref={scrollContainerRef}
            className="flex-1 flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar touch-pan-x px-1 py-0.5"
            style={{ 
              WebkitOverflowScrolling: 'touch',
              scrollBehavior: 'smooth' 
            }}
          >
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.id === activeTab;

              return (
                <button
                  key={tab.id}
                  data-tab-id={tab.id}
                  type="button"
                  onClick={() => onSelectTab(tab.id)}
                  className={`group relative flex items-center gap-2 px-3 sm:px-3.5 lg:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all transform active:scale-98 whitespace-nowrap cursor-pointer shrink-0 min-h-[42px] ${
                    isActive
                      ? 'bg-[var(--pv-green)] text-white font-bold shadow-[0_10px_22px_rgba(11,93,59,0.28)] ring-1 ring-white/20'
                      : isDark
                        ? 'text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
                  }`}
                  aria-selected={isActive}
                  role="tab"
                  title={`${tab.number}. ${tab.fullLabel} (${tab.tag})`}
                >
                  {/* Tab Icon */}
                  <Icon className={`w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                    isActive ? 'text-white' : 'text-[var(--pv-accent)]'
                  }`} />

                  {/* Responsive Labels */}
                  <span className="flex items-center gap-1.5">
                    {/* Number prefix */}
                    <span className={`text-[10px] font-mono px-1 py-0.2 rounded font-bold ${
                      isActive 
                        ? 'bg-white/20 text-white' 
                        : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-200/80 text-slate-600'
                    }`}>
                      {tab.number}
                    </span>

                    {/* Desktop Full Label (>= 1280px) */}
                    <span className="hidden xl:inline tracking-tight">
                      {tab.fullLabel}
                    </span>

                    {/* Tablet/Medium Desktop Label (768px - 1279px) */}
                    <span className="hidden md:inline xl:hidden tracking-tight">
                      {tab.tabletLabel}
                    </span>

                    {/* Mobile Label (< 768px) */}
                    <span className="md:hidden tracking-tight">
                      {tab.mobileLabel}
                    </span>
                  </span>

                  {/* Dynamic Count Badge */}
                  {tab.count !== undefined && (
                    <span className={`text-[10px] font-mono font-black px-1.5 py-0.2 rounded-full shrink-0 ${
                      isActive
                        ? 'bg-white/25 text-white'
                        : tab.count > 0
                          ? tab.badgeColor === 'amber'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : tab.badgeColor === 'blue'
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right Gradient Fade Mask */}
          <div 
            aria-hidden="true"
            className={`pointer-events-none absolute right-2 md:right-10 top-2 bottom-2 w-8 z-[5] transition-opacity duration-200 ${
              canScrollRight 
                ? isDark 
                  ? 'opacity-100 bg-gradient-to-l from-[#121B14]/90 to-transparent' 
                  : 'opacity-100 bg-gradient-to-l from-white/90 to-transparent' 
                : 'opacity-0'
            }`} 
          />

          {/* Scroll Right Button (Visible when scrolled) */}
          <button
            type="button"
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            className={`hidden md:flex items-center justify-center w-8 h-8 rounded-xl border transition-all duration-200 shrink-0 z-10 cursor-pointer ${
              canScrollRight
                ? isDark 
                  ? 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-slate-700 shadow-md opacity-100' 
                  : 'bg-white/95 hover:bg-slate-50 text-slate-700 border-slate-300 shadow-sm opacity-100'
                : 'opacity-0 pointer-events-none'
            }`}
            aria-label="Scroll tabs right"
            title="Scroll right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* ============================================================== */}
      {/* MOBILE BOTTOM NAVIGATION BAR (Fixed at bottom on < 768px)      */}
      {/* Ergonomic 1-tap thumb navigation for mobile smartphones        */}
      {/* ============================================================== */}
      <div className={`fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-[var(--pv-border)] backdrop-blur-2xl transition-colors duration-200 pb-[env(safe-area-inset-bottom)] ${
        isDark
          ? 'bg-[#121B14]/95 shadow-[0_-8px_25px_rgba(0,0,0,0.5)]'
          : 'bg-white/95 shadow-[0_-8px_25px_rgba(31,54,32,0.08)]'
      }`}>
        <div className="grid grid-cols-5 items-center h-15 px-1 max-w-lg mx-auto">
          {/* 1. Scraper / Leads */}
          <button
            type="button"
            onClick={() => onSelectTab('leads')}
            className={`flex flex-col items-center justify-center gap-1 py-1 rounded-xl transition cursor-pointer min-h-[48px] ${
              activeTab === 'leads' 
                ? 'text-[var(--pv-accent)] font-bold' 
                : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className={`w-5 h-5 ${activeTab === 'leads' ? 'text-[var(--pv-accent)]' : ''}`} />
            <span className="text-[10px] font-medium leading-none">Scraper</span>
          </button>

          {/* 2. Voice Dialer */}
          <button
            type="button"
            onClick={() => onSelectTab('call_studio')}
            className={`flex flex-col items-center justify-center gap-1 py-1 rounded-xl transition cursor-pointer min-h-[48px] ${
              activeTab === 'call_studio' 
                ? 'text-[var(--pv-accent)] font-bold' 
                : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PhoneCall className={`w-5 h-5 ${activeTab === 'call_studio' ? 'text-[var(--pv-accent)]' : ''}`} />
            <span className="text-[10px] font-medium leading-none">Dialer</span>
          </button>

          {/* 3. Pipeline & ROI */}
          <button
            type="button"
            onClick={() => onSelectTab('pipeline')}
            className={`flex flex-col items-center justify-center gap-1 py-1 rounded-xl transition cursor-pointer min-h-[48px] ${
              activeTab === 'pipeline' 
                ? 'text-[var(--pv-accent)] font-bold' 
                : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className={`w-5 h-5 ${activeTab === 'pipeline' ? 'text-[var(--pv-accent)]' : ''}`} />
            <span className="text-[10px] font-medium leading-none">Pipeline</span>
          </button>

          {/* 4. Tasks & Reminders */}
          <button
            type="button"
            onClick={() => onSelectTab('reminders')}
            className={`relative flex flex-col items-center justify-center gap-1 py-1 rounded-xl transition cursor-pointer min-h-[48px] ${
              activeTab === 'reminders' 
                ? 'text-[var(--pv-accent)] font-bold' 
                : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <div className="relative">
              <Bell className={`w-5 h-5 ${activeTab === 'reminders' ? 'text-[var(--pv-accent)]' : ''}`} />
              {unreadTasksCount > 0 && (
                <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 bg-[var(--pv-red)] text-white font-black text-[9px] rounded-full flex items-center justify-center shadow-sm">
                  {unreadTasksCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium leading-none">Tasks</span>
          </button>

          {/* 5. More / Menu */}
          <button
            type="button"
            onClick={() => {
              if (onOpenMobileDrawer) {
                onOpenMobileDrawer();
              } else {
                setIsMobileMenuOpen(true);
              }
            }}
            className={`flex flex-col items-center justify-center gap-1 py-1 rounded-xl transition cursor-pointer min-h-[48px] ${
              isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutGrid className="w-5 h-5 text-[var(--pv-accent)]" />
            <span className="text-[10px] font-medium leading-none">More</span>
          </button>
        </div>
      </div>
    </nav>
  );
};
