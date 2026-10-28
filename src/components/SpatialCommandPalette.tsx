import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Building2, 
  PhoneCall, 
  Sparkles, 
  TrendingUp, 
  Network, 
  Linkedin, 
  Bot, 
  Settings, 
  Layers, 
  Flame, 
  Mic, 
  ArrowRight, 
  X,
  Compass,
  Download,
  CheckSquare,
  ClipboardList,
  Bell,
  MapPin
} from 'lucide-react';
import { RCMLead, PulsarSpatialModule } from '../types';
import { useTheme } from '../context/ThemeContext';
import { PulsarGalaxy } from './PulsarGalaxy';

interface SpatialCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  leads: RCMLead[];
  onSelectLead: (lead: RCMLead) => void;
  onNavigate: (module: PulsarSpatialModule) => void;
  onOpenSettings: () => void;
  onOpenNicheLibrary: () => void;
  onOpenAI: () => void;
  onToggleVoice: () => void;
  onExportCSV: () => void;
}

export const SpatialCommandPalette: React.FC<SpatialCommandPaletteProps> = ({
  isOpen,
  onClose,
  leads,
  onSelectLead,
  onNavigate,
  onOpenSettings,
  onOpenNicheLibrary,
  onOpenAI,
  onToggleVoice,
  onExportCSV
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Global shortcut Cmd+K / Ctrl+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Filter navigation items
  const navActions: Array<{
    id: string;
    title: string;
    category: string;
    icon: React.ComponentType<{ className?: string }>;
    run: () => void;
  }> = [
    {
      id: 'nav_command_center',
      title: 'Dashboard',
      category: 'Workspace',
      icon: Compass,
      run: () => { onNavigate('command_center'); onClose(); }
    },
    {
      id: 'nav_leads',
      title: 'Bot Scraper & Radar Leads',
      category: 'Sales Intelligence',
      icon: Building2,
      run: () => { onNavigate('leads'); onClose(); }
    },
    {
      id: 'nav_territory_maps',
      title: 'Google Maps Territory & Field Operations',
      category: 'Sales Intelligence',
      icon: MapPin,
      run: () => { onNavigate('territory_maps'); onClose(); }
    },
    {
      id: 'nav_call_studio',
      title: 'Voice Studio & AI Phone Dialer',
      category: 'Outreach',
      icon: PhoneCall,
      run: () => { onNavigate('call_studio'); onClose(); }
    },
    {
      id: 'nav_linkedin',
      title: 'LinkedIn Executive BD',
      category: 'Outreach',
      icon: Linkedin,
      run: () => { onNavigate('linkedin'); onClose(); }
    },
    {
      id: 'nav_campaigns',
      title: 'Campaign Management & Sequences',
      category: 'Outreach',
      icon: Flame,
      run: () => { onNavigate('campaigns'); onClose(); }
    },
    {
      id: 'nav_google_tasks',
      title: 'Google Tasks Cloud Synchronization',
      category: 'Workspace & Tasks',
      icon: CheckSquare,
      run: () => { onNavigate('google_tasks'); onClose(); }
    },
    {
      id: 'nav_google_forms',
      title: 'Google Forms Client Intake & 50-Claim Audits',
      category: 'Workspace & Forms',
      icon: ClipboardList,
      run: () => { onNavigate('google_forms'); onClose(); }
    },
    {
      id: 'nav_reminders',
      title: 'Scheduled Calls & Action Items Tracker',
      category: 'Outreach',
      icon: Bell,
      run: () => { onNavigate('reminders'); onClose(); }
    },
    {
      id: 'nav_ai_agents',
      title: 'AI Agent Fleet & Autonomy Guardrails',
      category: 'Automation',
      icon: Bot,
      run: () => { onNavigate('ai_agents'); onClose(); }
    },
    {
      id: 'nav_pipeline',
      title: 'Revenue Pipeline & Velocity',
      category: 'Intelligence',
      icon: TrendingUp,
      run: () => { onNavigate('pipeline'); onClose(); }
    },
    {
      id: 'nav_integrations',
      title: 'Integrations Matrix (Twilio, WhatsApp, CRM)',
      category: 'Administration',
      icon: Network,
      run: () => { onNavigate('integrations'); onClose(); }
    },
    {
      id: 'action_ai_assistant',
      title: 'Open Gemini AI Copilot Panel',
      category: 'AI Quick Action',
      icon: Sparkles,
      run: () => { onOpenAI(); onClose(); }
    },
    {
      id: 'action_niche_library',
      title: 'Switch Business Industry / Niche Template',
      category: 'Workspace',
      icon: Layers,
      run: () => { onOpenNicheLibrary(); onClose(); }
    },
    {
      id: 'action_toggle_voice',
      title: 'Toggle Always-On Voice Command Listener',
      category: 'AI Quick Action',
      icon: Mic,
      run: () => { onToggleVoice(); onClose(); }
    },
    {
      id: 'action_export_csv',
      title: 'Export Leads Database (CSV / Spreadsheet)',
      category: 'Data Management',
      icon: Download,
      run: () => { onExportCSV(); onClose(); }
    },
    {
      id: 'action_settings',
      title: 'System Settings & Telephony Routing',
      category: 'Administration',
      icon: Settings,
      run: () => { onOpenSettings(); onClose(); }
    }
  ];

  // Matching actions
  const filteredActions = navActions.filter(a => 
    a.title.toLowerCase().includes(query.toLowerCase()) || 
    a.category.toLowerCase().includes(query.toLowerCase())
  );

  // Matching leads
  const filteredLeads = query.trim().length > 1 
    ? leads.filter(l => 
        l.practiceName.toLowerCase().includes(query.toLowerCase()) ||
        l.doctorName.toLowerCase().includes(query.toLowerCase()) ||
        l.specialty.toLowerCase().includes(query.toLowerCase()) ||
        l.phone.includes(query)
      ).slice(0, 5)
    : [];

  const allItems = [
    ...filteredActions.map(a => ({ type: 'action' as const, item: a })),
    ...filteredLeads.map(l => ({ type: 'lead' as const, item: l }))
  ];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, allItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + allItems.length) % Math.max(1, allItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = allItems[selectedIndex];
      if (current) {
        if (current.type === 'action') {
          current.item.run();
        } else {
          onSelectLead(current.item);
          onNavigate('call_studio');
          onClose();
        }
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden glass-modal flex flex-col transition-all duration-200 ${
          isDark 
            ? 'bg-[#0a0e1a]/95 border-white/[0.12] text-slate-100 shadow-[0_25px_80px_rgba(0,0,0,0.85)] ring-1 ring-white/10' 
            : 'bg-white/95 border-slate-200 text-slate-900 shadow-[0_25px_70px_rgba(15,23,42,0.18)]'
        }`}
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.08] dark:border-white/[0.08]">
          <Search className="w-5 h-5 text-violet-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, search prospects, or switch workspace..."
            className="w-full bg-transparent text-sm focus:outline-none placeholder:text-slate-500 font-medium"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-mono font-semibold rounded bg-white/10 text-slate-400 border border-white/10">
            ESC
          </kbd>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-[380px] overflow-y-auto p-2 space-y-1">
          {allItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 font-medium">
              No matching commands or prospects found for "{query}".
            </div>
          ) : (
            allItems.map((entry, idx) => {
              const isSelected = idx === selectedIndex;
              if (entry.type === 'action') {
                const action = entry.item;
                const IconComponent = action.icon;
                return (
                  <button
                    key={action.id}
                    onClick={() => action.run()}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs transition cursor-pointer ${
                      isSelected
                        ? isDark 
                          ? 'bg-violet-600/20 text-violet-200 border border-violet-500/30' 
                          : 'bg-violet-50 text-violet-900 border border-violet-200'
                        : isDark ? 'hover:bg-white/[0.04] text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-lg ${
                        isSelected 
                          ? 'bg-violet-500/20 text-violet-300' 
                          : isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-200/80 text-slate-600'
                      }`}>
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold">{action.title}</div>
                        <div className="text-[10px] text-slate-500">{action.category}</div>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="text-[10px] font-mono text-violet-400 flex items-center gap-1">
                        Select <ArrowRight className="w-3 h-3" />
                      </span>
                    )}
                  </button>
                );
              } else {
                const lead = entry.item;
                return (
                  <button
                    key={lead.id}
                    onClick={() => {
                      onSelectLead(lead);
                      onNavigate('call_studio');
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs transition cursor-pointer ${
                      isSelected
                        ? isDark 
                          ? 'bg-cyan-600/20 text-cyan-200 border border-cyan-500/30' 
                          : 'bg-cyan-50 text-cyan-900 border border-cyan-200'
                        : isDark ? 'hover:bg-white/[0.04] text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-lg ${
                        isSelected 
                          ? 'bg-cyan-500/20 text-cyan-300' 
                          : isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-200/80 text-slate-600'
                      }`}>
                        <PhoneCall className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold">{lead.practiceName}</div>
                        <div className="text-[10px] text-slate-500">
                          {lead.doctorName} · {lead.specialty} · {lead.phone}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="text-[10px] font-mono text-cyan-400 flex items-center gap-1">
                        Call Lead <ArrowRight className="w-3 h-3" />
                      </span>
                    )}
                  </button>
                );
              }
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 border-t border-white/[0.06] bg-black/20 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span><kbd className="font-mono bg-white/10 px-1 rounded">↑↓</kbd> to navigate</span>
            <span><kbd className="font-mono bg-white/10 px-1 rounded">↵</kbd> to select</span>
          </div>
          <span className="text-[10px] flex items-center gap-1.5 font-mono text-slate-400">
            <PulsarGalaxy size="xs" state="idle" showHalo={false} />
            <span>Pulsar Intelligence</span>
          </span>
        </div>
      </div>
    </div>
  );
};
