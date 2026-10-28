import React, { useState } from 'react';
import { 
  Building2, 
  Cpu, 
  Users, 
  Stethoscope, 
  Wrench, 
  TrendingUp, 
  Check, 
  Sparkles, 
  Search, 
  Layers, 
  ArrowRight, 
  X, 
  ChevronRight, 
  Bot, 
  ShieldCheck, 
  MessageCircle, 
  PhoneCall, 
  Share2, 
  FileText, 
  AlertCircle,
  Copy,
  Zap,
  Briefcase
} from 'lucide-react';
import { NICHE_TEMPLATES, NicheTemplate } from '../data/nicheTemplates';
import { useTheme } from '../context/ThemeContext';

interface BusinessNicheLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeNicheId: string;
  onSelectTemplate: (template: NicheTemplate) => void;
  isReadOnly?: boolean;
}

export const BusinessNicheLibraryModal: React.FC<BusinessNicheLibraryModalProps> = ({
  isOpen,
  onClose,
  activeNicheId,
  onSelectTemplate,
  isReadOnly = false
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [previewTemplate, setPreviewTemplate] = useState<NicheTemplate>(() => {
    return NICHE_TEMPLATES.find(t => t.id === activeNicheId) || NICHE_TEMPLATES[0];
  });
  const [activeTab, setActiveTab] = useState<'persona' | 'agent_prompt' | 'channels' | 'objections'>('persona');
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);
  const [appliedNotice, setAppliedNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const categories = ['All', 'Real Estate', 'B2B SaaS', 'Recruitment & Staffing', 'Healthcare & RCM', 'Home & Field Services', 'Growth & Agencies'];

  const filteredTemplates = NICHE_TEMPLATES.filter(tpl => {
    const matchesCategory = selectedCategory === 'All' || tpl.category === selectedCategory;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || 
      tpl.name.toLowerCase().includes(q) ||
      tpl.description.toLowerCase().includes(q) ||
      tpl.targetPersona.targetRoles.some(r => r.toLowerCase().includes(q)) ||
      tpl.agentConfig.agentName.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const getIcon = (iconName: string, className = "w-5 h-5") => {
    switch (iconName) {
      case 'Building2': return <Building2 className={className} />;
      case 'Cpu': return <Cpu className={className} />;
      case 'Users': return <Users className={className} />;
      case 'Stethoscope': return <Stethoscope className={className} />;
      case 'Wrench': return <Wrench className={className} />;
      case 'TrendingUp': return <TrendingUp className={className} />;
      default: return <Briefcase className={className} />;
    }
  };

  const handleApply = (tpl: NicheTemplate) => {
    onSelectTemplate(tpl);
    setAppliedNotice(`Pulsar AI Agent instructions & target personas updated for ${tpl.name}!`);
    setTimeout(() => {
      setAppliedNotice(null);
      onClose();
    }, 1200);
  };

  const handleCopyPrompt = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div 
        className={`relative w-full max-w-6xl max-h-[92vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden transition-all duration-300 ${
          isDark 
            ? 'bg-slate-950/95 border-teal-500/30 shadow-[0_0_50px_rgba(20,184,166,0.15)] text-slate-100' 
            : 'bg-white border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.15)] text-slate-900'
        }`}
      >
        {/* Modal Header */}
        <div className={`p-4 sm:p-6 border-b flex items-center justify-between shrink-0 ${
          isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-100 bg-slate-50'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-tr from-teal-500 via-emerald-500 to-cyan-500 flex items-center justify-center text-slate-950 shadow-lg shadow-teal-500/25">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-2xl font-black tracking-tight font-display flex items-center gap-2">
                  <span>Business Niche Library</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-400 font-bold border border-teal-500/30 uppercase tracking-widest">
                    Multi-Industry AI
                  </span>
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Select a high-converting niche template to auto-populate Pulsar AI agent instructions, target buyer personas, and outreach scripts.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-xl border transition cursor-pointer ${
              isDark 
                ? 'border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white' 
                : 'border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-900'
            }`}
            title="Close Niche Library"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Applied Notification Banner */}
        {appliedNotice && (
          <div className="bg-emerald-500 text-slate-950 px-4 py-2.5 flex items-center justify-center gap-2 text-xs sm:text-sm font-bold animate-bounce shadow-md">
            <Check className="w-4 h-4 stroke-[3]" />
            <span>{appliedNotice}</span>
          </div>
        )}

        {/* Search & Category Filter Toolbar */}
        <div className={`p-3 sm:px-6 py-3 border-b flex flex-col md:flex-row items-center justify-between gap-3 shrink-0 ${
          isDark ? 'border-slate-800/80 bg-slate-950/80' : 'border-slate-100 bg-white'
        }`}>
          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-teal-500 text-slate-950 font-bold shadow-sm'
                    : isDark
                      ? 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search niche, persona, role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-3 py-1.5 rounded-xl border text-xs transition outline-none ${
                isDark 
                  ? 'bg-slate-900 border-slate-800 focus:border-teal-500 text-white placeholder-slate-500' 
                  : 'bg-slate-50 border-slate-200 focus:border-teal-500 text-slate-900 placeholder-slate-400'
              }`}
            />
          </div>
        </div>

        {/* Modal Main Body (Grid split: Left Templates List, Right Detailed Inspector) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden">
          {/* Left Column: Template Cards List (5 cols) */}
          <div className={`lg:col-span-5 p-3 sm:p-5 overflow-y-auto border-r space-y-3 ${
            isDark ? 'border-slate-800 bg-slate-950/60' : 'border-slate-100 bg-slate-50/50'
          }`}>
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                Available Templates ({filteredTemplates.length})
              </span>
              <span className="text-[11px] text-teal-400 font-medium">
                Click to inspect & auto-fill
              </span>
            </div>

            {filteredTemplates.map((tpl) => {
              const isSelected = previewTemplate.id === tpl.id;
              const isActive = activeNicheId === tpl.id;

              return (
                <div
                  key={tpl.id}
                  onClick={() => setPreviewTemplate(tpl)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer relative group ${
                    isSelected
                      ? isDark 
                        ? 'bg-teal-950/30 border-teal-500/60 shadow-[0_0_20px_rgba(20,184,166,0.15)] ring-1 ring-teal-500/40' 
                        : 'bg-teal-50/80 border-teal-500 ring-1 ring-teal-500/30'
                      : isDark
                        ? 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800 hover:border-slate-700'
                        : 'bg-white hover:bg-slate-100/80 border-slate-200'
                  }`}
                >
                  {/* Active Workspace Badge */}
                  {isActive && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold border border-emerald-500/40">
                      <Check className="w-3 h-3 stroke-[3]" />
                      <span>Active Niche</span>
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/30'
                        : isDark
                          ? 'bg-slate-800 text-teal-400'
                          : 'bg-teal-50 text-teal-700'
                    }`}>
                      {getIcon(tpl.iconName, "w-4 h-4")}
                    </div>

                    <div className="flex-1 pr-16">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-slate-100 group-hover:text-teal-400 transition">
                          {tpl.name}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                          {tpl.category}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 font-mono border border-amber-500/20">
                          {tpl.badge}
                        </span>
                      </div>

                      <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                        {tpl.tagline}
                      </p>

                      <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Bot className="w-3.5 h-3.5 text-teal-400" />
                          <strong className="text-slate-200">{tpl.agentConfig.agentName.split('—')[0]}</strong>
                        </span>
                        <span className="font-mono text-teal-400 font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                          Inspect & Apply <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Template Inspector & AI Engine Auto-Population (7 cols) */}
          <div className="lg:col-span-7 flex flex-col h-full overflow-hidden">
            {/* Inspector Top Summary Bar */}
            <div className={`p-4 sm:p-6 border-b shrink-0 ${
              isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-100 bg-white'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/40 flex items-center justify-center">
                    {getIcon(previewTemplate.iconName, "w-6 h-6")}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-base sm:text-xl text-slate-100">
                        {previewTemplate.name}
                      </h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/30">
                        {previewTemplate.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {previewTemplate.tagline}
                    </p>
                  </div>
                </div>

                {/* Primary Action Button */}
                <button
                  onClick={() => handleApply(previewTemplate)}
                  disabled={isReadOnly}
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition transform active:scale-95 shadow-lg cursor-pointer ${
                    activeNicheId === previewTemplate.id
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : isReadOnly
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                        : 'bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 shadow-teal-500/25 ring-1 ring-white/30'
                  }`}
                  title={isReadOnly ? 'Customer account has read-only access' : 'Auto-populate Pulsar AI agent instructions and buyer persona'}
                >
                  <Sparkles className="w-4 h-4 text-slate-950" />
                  <span>
                    {activeNicheId === previewTemplate.id 
                      ? 'Template Active' 
                      : isReadOnly 
                        ? 'Read-Only Mode' 
                        : 'Apply & Auto-Populate Agent'}
                  </span>
                </button>
              </div>

              {/* Inspector Sub-Tabs */}
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-800/80">
                <button
                  onClick={() => setActiveTab('persona')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'persona'
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Target Buyer Persona</span>
                </button>

                <button
                  onClick={() => setActiveTab('agent_prompt')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'agent_prompt'
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>AI Agent Prompt & Instructions</span>
                </button>

                <button
                  onClick={() => setActiveTab('objections')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'objections'
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Objection Handlers</span>
                </button>

                <button
                  onClick={() => setActiveTab('channels')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'channels'
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Multi-Channel Scripts</span>
                </button>
              </div>
            </div>

            {/* Inspector Tab Content Area */}
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
              {/* TAB 1: TARGET PERSONA */}
              {activeTab === 'persona' && (
                <div className="space-y-4 animate-fade-in">
                  <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <h5 className="text-xs font-mono uppercase tracking-wider text-teal-400 font-bold mb-2 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" /> Target Decision-Maker Roles
                    </h5>
                    <div className="flex flex-wrap gap-1.5">
                      {previewTemplate.targetPersona.targetRoles.map((role, idx) => (
                        <span key={idx} className="px-2.5 py-1 rounded-lg text-xs bg-teal-500/10 text-teal-300 border border-teal-500/20 font-medium">
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                      <h6 className="text-[11px] font-mono uppercase text-slate-400 font-bold mb-1">Target Organization Types</h6>
                      <ul className="text-xs text-slate-300 space-y-1 list-disc pl-4">
                        {previewTemplate.targetPersona.companyTypes.map((t, idx) => (
                          <li key={idx}>{t}</li>
                        ))}
                      </ul>
                    </div>

                    <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                      <h6 className="text-[11px] font-mono uppercase text-slate-400 font-bold mb-1">Company Size & Geo Footprint</h6>
                      <p className="text-xs text-slate-300 font-medium">{previewTemplate.targetPersona.companySizeRange}</p>
                      <p className="text-xs text-teal-400 mt-1">{previewTemplate.targetPersona.operatingRegions}</p>
                    </div>
                  </div>

                  {/* Core Pain Points Solved */}
                  <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <h5 className="text-xs font-mono uppercase tracking-wider text-rose-400 font-bold mb-2 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" /> High-Urgency Pain Points Uncovered
                    </h5>
                    <ul className="space-y-2">
                      {previewTemplate.targetPersona.corePainPoints.map((pain, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                          <span>{pain}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Value Proposition & Offer */}
                  <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <h5 className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold mb-2 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5" /> Guaranteed Value Proposition & Lead Magnet
                    </h5>
                    <p className="text-xs text-slate-200 font-medium">
                      {previewTemplate.agentConfig.valueProposition}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono font-bold">
                        Offer: {previewTemplate.agentConfig.primaryOffer}
                      </span>
                      <span className="px-2.5 py-1 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono font-bold">
                        Metric: {previewTemplate.agentConfig.keyMetricOrGuarantee}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: AGENT SYSTEM PROMPT & INSTRUCTIONS */}
              {activeTab === 'agent_prompt' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                        <Bot className="w-4 h-4 text-teal-400" />
                        <span>Dynamic System Prompt Injection</span>
                      </h4>
                      <p className="text-xs text-slate-400">
                        This instruction payload is fed into Pulsar Core during telephony calls and autonomous outreach.
                      </p>
                    </div>

                    <button
                      onClick={() => handleCopyPrompt(previewTemplate.agentConfig.systemPrompt)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                        copiedPrompt
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                      }`}
                    >
                      {copiedPrompt ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedPrompt ? 'Copied' : 'Copy Prompt'}</span>
                    </button>
                  </div>

                  <div className={`p-4 rounded-xl border font-mono text-xs leading-relaxed whitespace-pre-wrap select-all ${
                    isDark ? 'bg-slate-900 border-slate-800 text-teal-200/90' : 'bg-slate-100 border-slate-200 text-slate-800'
                  }`}>
                    {previewTemplate.agentConfig.systemPrompt}
                  </div>

                  {/* Escalation & Warm Transfer Triggers */}
                  <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <h5 className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold mb-2 flex items-center gap-1.5">
                      <PhoneCall className="w-3.5 h-3.5" /> Live Warm Transfer Escalation Criteria
                    </h5>
                    <ul className="space-y-1.5">
                      {previewTemplate.agentConfig.escalationTriggers.map((trig, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                          <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <span>{trig}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* TAB 3: OBJECTION HANDLERS */}
              {activeTab === 'objections' && (
                <div className="space-y-3 animate-fade-in">
                  <div className="text-xs text-slate-400 mb-2">
                    Pre-scripted rebuttals embedded directly into Pulsar’s conversational intelligence engine:
                  </div>

                  {previewTemplate.agentConfig.objectionHandlers.map((obj, idx) => (
                    <div 
                      key={idx} 
                      className={`p-4 rounded-xl border space-y-2 ${
                        isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-rose-400 text-xs font-bold">
                        <span className="w-5 h-5 rounded-full bg-rose-500/20 flex items-center justify-center text-[10px]">Q</span>
                        <span>Prospect Objection: "{obj.objection}"</span>
                      </div>
                      <div className="flex items-start gap-2 text-teal-300 text-xs leading-relaxed pl-7">
                        <span>Pulsar Rebuttal: {obj.rebuttal}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 4: MULTI-CHANNEL SCRIPTS */}
              {activeTab === 'channels' && (
                <div className="space-y-4 animate-fade-in">
                  {/* Phone Voice Script */}
                  <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <h5 className="text-xs font-mono uppercase tracking-wider text-teal-400 font-bold mb-2 flex items-center gap-1.5">
                      <PhoneCall className="w-3.5 h-3.5" /> Telephony Elevator Script (CallStudio)
                    </h5>
                    <p className="text-xs text-slate-200 font-mono bg-slate-950/40 p-3 rounded-lg border border-slate-800">
                      "{previewTemplate.agentConfig.samplePitchScript}"
                    </p>
                  </div>

                  {/* WhatsApp Template */}
                  <div className={`p-4 rounded-xl border ${isDark ? 'bg-emerald-950/20 border-emerald-900/40' : 'bg-emerald-50 border-emerald-200'}`}>
                    <h5 className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold mb-2 flex items-center gap-1.5">
                      <MessageCircle className="w-3.5 h-3.5" /> WhatsApp Business Messaging Template
                    </h5>
                    <p className="text-xs text-emerald-200 font-mono bg-slate-950/40 p-3 rounded-lg border border-slate-800">
                      "{previewTemplate.agentConfig.whatsAppTemplate}"
                    </p>
                  </div>

                  {/* LinkedIn InMail Template */}
                  <div className={`p-4 rounded-xl border ${isDark ? 'bg-blue-950/20 border-blue-900/40' : 'bg-blue-50 border-blue-200'}`}>
                    <h5 className="text-xs font-mono uppercase tracking-wider text-blue-400 font-bold mb-2 flex items-center gap-1.5">
                      <Share2 className="w-3.5 h-3.5" /> LinkedIn InMail & Connection Note
                    </h5>
                    <p className="text-xs text-blue-200 font-mono bg-slate-950/40 p-3 rounded-lg border border-slate-800">
                      "{previewTemplate.agentConfig.linkedInTemplate}"
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Footer Action Bar */}
            <div className={`p-4 border-t flex items-center justify-between shrink-0 ${
              isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-100 bg-slate-50'
            }`}>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Tenant-Isolated Database • Queries Scoped by Workspace Profile</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className={`px-4 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                    isDark ? 'border-slate-800 hover:bg-slate-800 text-slate-400' : 'border-slate-200 hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  Close
                </button>

                <button
                  onClick={() => handleApply(previewTemplate)}
                  disabled={isReadOnly}
                  className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black transition transform active:scale-95 shadow-md cursor-pointer ${
                    activeNicheId === previewTemplate.id
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : isReadOnly
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                        : 'bg-teal-400 hover:bg-teal-300 text-slate-950'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                  <span>{activeNicheId === previewTemplate.id ? 'Active in Workspace' : 'Apply to Pulsar Agent'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
