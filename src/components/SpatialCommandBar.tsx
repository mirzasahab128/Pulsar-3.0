import React, { useState, useRef, useEffect } from 'react';
import { 
  Search,
  Menu,
  Sparkles,
  Bot,
  Clock,
  Bell,
  Plus,
  Sun,
  Moon,
  Settings,
  ShieldCheck,
  Crown,
  Lock,
  LogOut,
  Layers, 
  PhoneCall, 
  UserPlus, 
  Download, 
  FileText,
  ChevronDown,
  X,
  ExternalLink
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { formatPSTTime } from '../utils/pstTime';
import { ManagerSettings, ActionItem, PulsarSpatialModule } from '../types';
import { PulsarGalaxy } from './PulsarGalaxy';

interface SpatialCommandBarProps {
  onOpenCommandPalette: () => void;
  onOpenMobileSidebar: () => void;
  activeNicheName: string;
  onOpenNicheLibrary: () => void;
  unreadTasksCount: number;
  tasks: ActionItem[];
  onOpenTasks: () => void;
  onOpenCallStudio: () => void;
  onOpenNewLeadModal: () => void;
  onOpenAI: () => void;
  onExportCSV: () => void;
  settings: ManagerSettings;
  activeAgentsCount?: number;
  // Vessa-structure additions: centered pill tabs + settings entry. Tabs
  // switch real modules only; onSelectModule is App's plain setter here
  // (the four tab targets need no special-casing).
  activeModule?: PulsarSpatialModule;
  onSelectModule?: (module: PulsarSpatialModule) => void;
  onOpenSettings?: () => void;
}

export const SpatialCommandBar: React.FC<SpatialCommandBarProps> = ({
  onOpenCommandPalette,
  onOpenMobileSidebar,
  activeNicheName,
  onOpenNicheLibrary,
  unreadTasksCount,
  tasks,
  onOpenTasks,
  onOpenCallStudio,
  onOpenNewLeadModal,
  onOpenAI,
  onExportCSV,
  settings,
  activeAgentsCount = 4,
  activeModule,
  onSelectModule,
  onOpenSettings
}) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const { isMasterAdmin, workspaceId, openAuthModal, access, signOut } = useAuth();
  // Display-only role truth: the server's access verdict wins when the
  // server is reachable; a null access means unreachable, not "customer".
  const displayIsMaster = access ? (access.isMasterAdmin || isMasterAdmin) : isMasterAdmin;
  const roleChip = access ? (displayIsMaster ? 'Master' : 'Customer') : (isMasterAdmin ? 'Master' : 'Offline');

  const [pstTime, setPstTime] = useState<string>(() => formatPSTTime(new Date()));
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const actionsRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Live PST clock tick
  useEffect(() => {
    const timer = setInterval(() => {
      setPstTime(formatPSTTime(new Date()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setIsActionsOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const tenantId = workspaceId || (isMasterAdmin ? 'ws_pulsar_master' : 'ws_pulsar_customer');

  // Time-aware greeting for the user chip (reference bar shows one).
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  // Header identity comes from the signed-in account, not the sales persona
  // in settings (whose 'Sales & BD Manager' default leaked into the header).
  // Signed out, fall back to the settings name as before.
  const headerName = access?.displayName || settings.managerName.split(' ')[0];
  const headerTitle = access?.title || access?.displayName || settings.managerName;
  const headerEmail = access?.email || settings.managerEmail;

  // Centered pill tabs — the revenue flow, Pulsar's own modules only.
  // Any other module (via sidebar/dock) simply leaves all tabs unselected.
  const barTabs: Array<{ id: PulsarSpatialModule; label: string }> = [
    { id: 'command_center', label: 'Dashboard' },
    { id: 'leads', label: 'Leads' },
    { id: 'campaigns', label: 'Campaigns' },
    { id: 'pipeline', label: 'Pipeline' },
  ];

  return (
    <header className={`sticky top-0 z-30 h-16 mx-3 mt-3 mb-3 w-[calc(100%-1.5rem)] rounded-[28px] border border-[var(--pv-border)] backdrop-blur-2xl transition-all duration-300 select-none text-[var(--pv-ink)] ${
      isDark
        ? 'bg-[#121B14]/88 shadow-[0_4px_30px_rgba(0,0,0,0.35)]'
        : 'bg-white/85 shadow-sm'
    }`}>
      <div className="h-full px-4 flex items-center justify-between gap-3">

        {/* Left Section: Brand, Mobile Menu, Command Palette Search & Workspace Badge */}
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Brand — the reference bar carries the brand; the rail below
              no longer does. Clicking loads the Dashboard, as before. */}
          <button
            type="button"
            onClick={() => onSelectModule?.('command_center')}
            className="flex items-center gap-2 shrink-0 cursor-pointer group text-left"
            title="Pulsar — go to Dashboard"
            aria-label="Pulsar — go to Dashboard"
          >
            <span className="transition-transform duration-200 group-hover:scale-105">
              <PulsarGalaxy size="sm" state="active" glow={true} />
            </span>
            <span className="hidden sm:block leading-none">
              <span className="block font-bold text-sm tracking-tight font-display text-[var(--pv-ink)] group-hover:underline decoration-[var(--pv-accent)] underline-offset-4">
                Pulsar
              </span>
              <span className="block text-[10px] font-mono font-medium text-[var(--pv-accent)] mt-0.5">
                Growth OS
              </span>
            </span>
          </button>

          {/* Mobile Sidebar Hamburger */}
          <button
            onClick={onOpenMobileSidebar}
            className="lg:hidden p-2 rounded-full border transition cursor-pointer bg-[var(--pv-card-soft)] border-[var(--pv-border)] text-[var(--pv-ink)] hover:bg-[var(--pv-mint)]"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Quick Command Palette Launcher */}
          <button
            onClick={onOpenCommandPalette}
            className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border text-xs font-medium transition cursor-pointer group bg-[var(--pv-card-soft)] hover:bg-[var(--pv-mint)] border-[var(--pv-border)] text-[var(--pv-muted)] hover:text-[var(--pv-ink)]"
            title="Press Cmd+K or Ctrl+K to search anything"
          >
            <Search className="w-3.5 h-3.5 text-[var(--pv-green)] transition-colors" />
            <span className="hidden sm:inline">Search prospects or jump to module...</span>
            <span className="sm:hidden">Search...</span>
            <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono rounded-md bg-[var(--pv-card)] text-[var(--pv-muted)] border border-[var(--pv-border)]">
              ⌘K
            </kbd>
          </button>

          {/* Workspace Tenant Pill (Quiet Enterprise Metadata) */}
          <div className="hidden xl:flex items-center gap-1.5 text-xs text-[var(--pv-muted)] font-mono px-2 py-1">
            <span>Tenant:</span>
            <span className="text-[var(--pv-ink)] font-bold">{tenantId}</span>
            <span>·</span>
            <span className="text-[var(--pv-accent)] text-[11px]">Isolated DB</span>
          </div>

          {/* Active Business Niche Switcher Button */}
          <button
            onClick={onOpenNicheLibrary}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition cursor-pointer bg-[var(--pv-mint)] hover:bg-[var(--pv-mint-2)] border-[var(--pv-mint-2)] text-[var(--pv-green)]"
            title="Click to switch business industry / niche"
          >
            <Layers className="w-3.5 h-3.5 text-[var(--pv-green)] shrink-0" />
            <span className="truncate max-w-[140px] lg:max-w-[200px] font-semibold">
              {activeNicheName.split('&')[0].trim()}
            </span>
          </button>
        </div>

        {/* Center Section: pill tabs (reference structure, Pulsar modules).
            Hidden below xl so the bar never crowds on smaller screens;
            the sidebar and dock still reach every module there. */}
        <div className="hidden xl:flex flex-1 justify-center min-w-0">
          <div className="flex items-center gap-1 rounded-full border border-[var(--pv-border)] bg-[var(--pv-card-soft)] p-1">
            {barTabs.map((tab) => {
              const isActive = activeModule === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onSelectModule?.(tab.id)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-[var(--pv-green)] text-white shadow'
                      : 'text-[var(--pv-muted)] hover:text-[var(--pv-ink)] hover:bg-[var(--pv-mint)]'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Section: AI Fleet Status, PST Clock, Notifications, Quick Actions, Theme, User */}
        <div className="flex items-center gap-2">
          
          {/* AI Agent Fleet Status Indicator */}
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--pv-mint)] border border-[var(--pv-mint-2)] text-[var(--pv-green)] text-xs font-mono font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--pv-bright)] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--pv-bright)]" />
            </span>
            <span className="hidden md:inline">{activeAgentsCount} Agents Operational</span>
            <span className="md:hidden">AI Active</span>
          </div>

          {/* Live PST Operations Clock */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--pv-card-soft)] border border-[var(--pv-border)] text-xs font-mono text-[var(--pv-ink)]">
            <Clock className="w-3.5 h-3.5 text-[var(--pv-accent)]" />
            <span>{pstTime} <span className="text-[var(--pv-muted)] text-[10px]">PST</span></span>
          </div>

          {/* Settings — dedicated icon button (reference structure).
              Opens the same Settings modal as the sidebar's Settings. */}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-full border transition cursor-pointer bg-[var(--pv-card-soft)] hover:bg-[var(--pv-mint)] border-[var(--pv-border)] text-[var(--pv-ink)]"
              title="Settings"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}

          {/* Notifications Drawer Dropdown */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className="relative p-2 rounded-full border transition cursor-pointer bg-[var(--pv-card-soft)] hover:bg-[var(--pv-mint)] border-[var(--pv-border)] text-[var(--pv-ink)]"
              title="Notifications & Pending Tasks"
            >
              <Bell className="w-4 h-4" />
              {unreadTasksCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-0.5 bg-[var(--pv-red)] text-white font-black text-[10px] rounded-full flex items-center justify-center font-mono">
                  {unreadTasksCount}
                </span>
              )}
            </button>

            {isNotificationsOpen && (
              <div className={`absolute right-0 mt-2 w-80 rounded-3xl border shadow-2xl glass-modal p-3 space-y-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200 ${
                isDark ? 'bg-[#121B14]/95 border-white/[0.12] text-slate-200' : 'bg-white border-slate-200 text-slate-800'
              }`}>
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                  <span className="font-bold text-xs">Action Items & Reminders</span>
                  <span className="text-[10px] font-mono text-slate-400">{unreadTasksCount} pending</span>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-1.5 py-1">
                  {tasks.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-500">
                      No pending tasks or action items.
                    </div>
                  ) : (
                    tasks.slice(0, 5).map(task => (
                      <div 
                        key={task.id} 
                        className={`p-2 rounded-xl border text-xs flex items-start justify-between gap-2 ${
                          task.completed 
                            ? 'opacity-50 border-white/5' 
                            : isDark ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div>
                          <div className={`font-semibold ${task.completed ? 'line-through' : ''}`}>
                            {task.task}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            Due: {task.due} · {task.priority}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <button
                  onClick={() => {
                    setIsNotificationsOpen(false);
                    onOpenTasks();
                  }}
                  className="w-full py-2 rounded-full bg-[var(--pv-green)] hover:bg-[var(--pv-accent)] text-white font-bold text-xs transition cursor-pointer text-center"
                >
                  View All Action Items
                </button>
              </div>
            )}
          </div>

          {/* + New — primary creation button (reference structure).
              Directly opens the new-prospect entry (leads module), the
              same destination as Quick Action's "Add New Prospect".
              The Quick Action dropdown stays for its other actions. */}
          <button
            onClick={onOpenNewLeadModal}
            className="flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[var(--pv-green)] to-[var(--pv-accent)] hover:brightness-110 text-white text-xs font-bold shadow-[0_10px_22px_rgba(11,93,59,0.28)] transition cursor-pointer"
            title="Add a new prospect"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New</span>
          </button>

          {/* Quick Action Button */}
          <div className="relative" ref={actionsRef}>
            <button
              onClick={() => setIsActionsOpen(!isActionsOpen)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[var(--pv-green)] to-[var(--pv-accent)] hover:brightness-110 text-white text-xs font-bold shadow-[0_10px_22px_rgba(11,93,59,0.28)] transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Quick Action</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-70" />
            </button>

            {isActionsOpen && (
              <div className={`absolute right-0 mt-2 w-56 rounded-3xl border shadow-2xl glass-modal p-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-200 ${
                isDark ? 'bg-[#121B14]/95 border-white/[0.12] text-slate-200' : 'bg-white border-slate-200 text-slate-800'
              }`}>
                <button
                  onClick={() => {
                    setIsActionsOpen(false);
                    onOpenNewLeadModal();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-medium hover:bg-white/10 transition cursor-pointer"
                >
                  <UserPlus className="w-4 h-4 text-emerald-400" />
                  <span>Add New Prospect</span>
                </button>

                <button
                  onClick={() => {
                    setIsActionsOpen(false);
                    onOpenCallStudio();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-medium hover:bg-white/10 transition cursor-pointer"
                >
                  <PhoneCall className="w-4 h-4 text-cyan-400" />
                  <span>Start AI Voice Call</span>
                </button>

                <button
                  onClick={() => {
                    setIsActionsOpen(false);
                    onOpenAI();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-medium hover:bg-white/10 transition cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  <span>Launch Gemini Copilot</span>
                </button>

                <button
                  onClick={() => {
                    setIsActionsOpen(false);
                    onExportCSV();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-medium hover:bg-white/10 transition cursor-pointer"
                >
                  <Download className="w-4 h-4 text-amber-400" />
                  <span>Export Leads (CSV)</span>
                </button>
              </div>
            )}
          </div>

          {/* Theme Switcher Toggle */}
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-full border transition cursor-pointer bg-[var(--pv-card-soft)] hover:bg-[var(--pv-mint)] border-[var(--pv-border)] ${
              isDark ? 'text-[var(--pv-amber)]' : 'text-[var(--pv-violet)]'
            }`}
            title={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* User Profile & RBAC Indicator — theme user chip */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="flex items-center gap-2 p-1 pl-2.5 rounded-full border border-[var(--pv-border)] hover:bg-[var(--pv-mint)] bg-[var(--pv-card-soft)] transition cursor-pointer"
            >
              <div className="flex flex-col text-right hidden sm:block">
                <span className="text-xs font-bold leading-none text-[var(--pv-ink)]">
                  {greeting}, {headerName}
                </span>
                <span className={`text-[10px] font-mono leading-none mt-0.5 ${
                  displayIsMaster ? 'text-[var(--pv-amber)]' : 'text-[var(--pv-sky)]'
                }`}>
                  {roleChip}
                </span>
              </div>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                displayIsMaster ? 'bg-[var(--pv-amber-tint)] text-[var(--pv-amber)]' : 'bg-[var(--pv-sky-tint)] text-[var(--pv-sky)]'
              }`}>
                {displayIsMaster ? <Crown className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              </div>
            </button>

            {isProfileMenuOpen && (
              <div className={`absolute right-0 mt-2 w-60 rounded-3xl border shadow-2xl glass-modal p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200 ${
                isDark ? 'bg-[#121B14]/95 border-white/[0.12] text-slate-200' : 'bg-white border-slate-200 text-slate-800'
              }`}>
                <div className="p-2 border-b border-white/[0.08] mb-1">
                  <div className="font-bold text-xs text-[var(--pv-ink)]">{headerTitle}</div>
                  <div className="text-[10px] text-slate-400 truncate">{headerEmail}</div>
                  <div className="mt-1 text-[10px] font-mono text-[var(--pv-sky)]">
                    Role: {access ? (displayIsMaster ? 'Master Controller' : 'Customer Read-Only') : 'Server offline · roles unverified'}
                  </div>
                </div>

                {/* Phase 2: the old "Switch to Admin/Customer" button was a
                    production no-op (setQuickProfile only warns) — it could
                    never grant admin, yet looked like it could. Replaced
                    with the real Sign out the founder asked for. */}
                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    void signOut();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-medium hover:bg-white/10 transition cursor-pointer text-rose-300"
                >
                  <span>Sign out</span>
                  <LogOut className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    openAuthModal('signin');
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-medium hover:bg-white/10 transition cursor-pointer text-slate-300"
                >
                  <span>Account & Authentication</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};
