import React, { useState } from 'react';
import { 
  Share2, 
  Users, 
  Building2, 
  PhoneCall, 
  Linkedin, 
  Send, 
  Sparkles, 
  CheckCircle2, 
  ShieldCheck, 
  ArrowRight, 
  ExternalLink,
  ChevronRight,
  Filter,
  Network,
  Zap,
  Clock
} from 'lucide-react';
import { RCMLead } from '../types';
import { useTheme } from '../context/ThemeContext';

interface NetworkNode {
  id: string;
  name: string;
  title: string;
  organization: string;
  connectionStrength: number; // 0 - 100
  relationshipType: 'Warm Referral' | 'Mutual EHR Stack' | 'Direct NPI Match' | 'Alumni Network' | 'Cold Target';
  phone: string;
  email: string;
  ehrSystem: string;
  specialty: string;
  status: 'Ready for Call' | 'In Sequence' | 'Audit Scheduled';
  x: number; // percentage
  y: number; // percentage
}

interface NetworkBuilderMatrixProps {
  onDialLead?: (lead: RCMLead) => void;
  onSendLinkedIn?: (prospectName: string) => void;
}

export const NetworkBuilderMatrix: React.FC<NetworkBuilderMatrixProps> = ({
  onDialLead,
  onSendLinkedIn
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [selectedNodeId, setSelectedNodeId] = useState<string>('node-1');
  const [filterType, setFilterType] = useState<string>('All');

  // Demo network data: sample contacts for layout only, not real leads or clients.
  const [nodes, setNodes] = useState<NetworkNode[]>([
    {
      id: 'node-1',
      name: 'Dr. Marcus Vance, MD',
      title: 'Managing Partner & Interventional Cardiologist',
      organization: 'Austin Heart & Vascular Institute',
      connectionStrength: 96,
      relationshipType: 'Mutual EHR Stack',
      phone: '(512) 892-4100',
      email: 'm.vance@austinheart.com',
      ehrSystem: 'eClinicalWorks v12',
      specialty: 'Cardiology',
      status: 'Ready for Call',
      x: 50,
      y: 45
    },
    {
      id: 'node-2',
      name: 'Sarah Jenkins, CMPE',
      title: 'Practice Administrator & Billing Director',
      organization: 'Austin Heart & Vascular Institute',
      connectionStrength: 92,
      relationshipType: 'Direct NPI Match',
      phone: '(512) 892-4104',
      email: 's.jenkins@austinheart.com',
      ehrSystem: 'eClinicalWorks v12',
      specialty: 'RCM & Operations',
      status: 'Ready for Call',
      x: 28,
      y: 28
    },
    {
      id: 'node-3',
      name: 'David Sterling',
      title: 'VP of Revenue Cycle Management',
      organization: 'Northwest Orthopedic & Spine Surgery',
      connectionStrength: 88,
      relationshipType: 'Warm Referral',
      phone: '(206) 781-9920',
      email: 'dsterling@northwestorthospine.com',
      ehrSystem: 'Epic Systems',
      specialty: 'Orthopedics & Spine',
      status: 'Audit Scheduled',
      x: 75,
      y: 30
    },
    {
      id: 'node-4',
      name: 'Robert Hughes, CPA',
      title: 'Chief Financial Officer',
      organization: 'Apex Precision Diagnostic Labs',
      connectionStrength: 84,
      relationshipType: 'Mutual EHR Stack',
      phone: '(404) 636-7200',
      email: 'rhughes@apexdiagnosticlabs.com',
      ehrSystem: 'AthenaHealth',
      specialty: 'Diagnostic Pathology',
      status: 'In Sequence',
      x: 70,
      y: 68
    },
    {
      id: 'node-5',
      name: 'Dr. Eleanor Vance, MD',
      title: 'Clinical Medical Director',
      organization: 'Austin Heart & Vascular Institute',
      connectionStrength: 78,
      relationshipType: 'Alumni Network',
      phone: '(512) 892-4112',
      email: 'e.vance@austinheart.com',
      ehrSystem: 'eClinicalWorks v12',
      specialty: 'Cardiovascular Imaging',
      status: 'Ready for Call',
      x: 32,
      y: 65
    },
    {
      id: 'node-6',
      name: 'Michael Thornton',
      title: 'Billing & Prior-Auth Supervisor',
      organization: 'Northwest Orthopedic & Spine Surgery',
      connectionStrength: 82,
      relationshipType: 'Direct NPI Match',
      phone: '(206) 781-9925',
      email: 'mthornton@northwestorthospine.com',
      ehrSystem: 'Epic Systems',
      specialty: 'Workers Comp Billing',
      status: 'Ready for Call',
      x: 88,
      y: 48
    }
  ]);

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || nodes[0];

  const filteredNodes = nodes.filter(n => {
    if (filterType === 'All') return true;
    return n.relationshipType === filterType;
  });

  const handleLaunchColdCall = (node: NetworkNode) => {
    if (onDialLead) {
      const convertedLead: RCMLead = {
        id: `net-${node.id}`,
        practiceName: node.organization,
        doctorName: node.name,
        title: node.title,
        specialty: node.specialty,
        practiceSize: '10-25 Providers',
        phone: node.phone,
        email: node.email,
        address: '100 Medical Plaza, Suite 400',
        state: 'TX',
        ehrSystem: node.ehrSystem,
        monthlyClaimVolume: '$180,000 / mo',
        painPoints: ['Prior Auth Delays', 'Denial Spikes', 'EHR Billing Workflow'],
        status: 'Ready for Call',
        source: 'Network Builder'
      };
      onDialLead(convertedLead);
    }
  };

  return (
    <div className={`p-4 sm:p-6 rounded-3xl border transition-all duration-300 relative overflow-hidden backdrop-blur-2xl ${
      isDark
        ? 'bg-[#111C2E]/90 border-slate-700/40 text-[#F1F5F9] shadow-xl'
        : 'bg-white border-[#DCE5EC] text-[#172338] shadow-sm'
    }`}>
      {/* Top Ambient Glow Bar */}
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 via-teal-400 to-emerald-400 opacity-90" />

      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-blue-500/10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Network className="w-3.5 h-3.5" />
            <span>AnimMasterLib • Interactive Relationship & Network Matrix</span>
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>Healthcare Executive Decision-Maker Web</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-wider">Demo</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Visualizes multi-touch connections between Managing Physicians, Billing Supervisors, and CFOs to maximize warm transfer conversions.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {['All', 'Mutual EHR Stack', 'Warm Referral', 'Direct NPI Match', 'Alumni Network'].map((filter) => (
            <button
              key={filter}
              onClick={() => setFilterType(filter)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                filterType === filter
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : isDark
                    ? 'bg-slate-900 text-slate-400 hover:text-white border border-white/5'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Demo data banner: every contact in this tool is a sample example. */}
      <div className="mt-4 p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-xs font-bold text-amber-700 dark:text-amber-300">
        Demo data: the contacts in this network are sample examples for layout only. They are not real leads, clients, or verified contacts. Use NPI search to add real leads.
      </div>

      {/* Main Interactive Grid: Node Web Visualizer (Left 7 cols) + Decision Maker Card (Right 5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6 items-stretch">
        {/* Left Column: Interactive Node Map Canvas (7 cols) */}
        <div className={`lg:col-span-7 p-4 rounded-2xl relative min-h-[380px] flex flex-col justify-between overflow-hidden border transition-all ${
          isDark 
            ? 'bg-slate-950/85 border-blue-500/20 shadow-2xl shadow-blue-500/5' 
            : 'bg-slate-950 border-slate-300 shadow-xl'
        }`}>
          {/* Subtle Grid Backdrop */}
          <div 
            className="absolute inset-0 opacity-15 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(rgba(56, 189, 248, 0.4) 1px, transparent 1px)',
              backgroundSize: '24px 24px'
            }}
          />

          {/* SVG Animated Connecting Beams - Invisible paths and illuminated lines between stars */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <defs>
              <linearGradient id="activeBeamGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.9" />
                <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.9" />
              </linearGradient>
              <filter id="starGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Faint invisible network lattice paths between peers */}
            {filteredNodes.map((n1, i) => 
              filteredNodes.slice(i + 1).map((n2) => (
                <line
                  key={`lattice-${n1.id}-${n2.id}`}
                  x1={`${n1.x}%`}
                  y1={`${n1.y}%`}
                  x2={`${n2.x}%`}
                  y2={`${n2.y}%`}
                  stroke="rgba(56, 189, 248, 0.08)"
                  strokeWidth="0.75"
                />
              ))
            )}

            {/* Active illuminated paths connecting Center Hub to member stars */}
            {filteredNodes.map(node => {
              if (node.id === 'node-1') return null;
              const centerNode = nodes.find(n => n.id === 'node-1')!;
              const isSelected = selectedNodeId === node.id || selectedNodeId === 'node-1';

              return (
                <g key={`beam-${node.id}`}>
                  {/* Subtle ethereal invisible path guide */}
                  <line
                    x1={`${centerNode.x}%`}
                    y1={`${centerNode.y}%`}
                    x2={`${node.x}%`}
                    y2={`${node.y}%`}
                    stroke={isSelected ? 'rgba(56, 189, 248, 0.25)' : 'rgba(16, 185, 129, 0.12)'}
                    strokeWidth={isSelected ? 3 : 1}
                  />

                  {/* High intent luminous connection path */}
                  <line
                    x1={`${centerNode.x}%`}
                    y1={`${centerNode.y}%`}
                    x2={`${node.x}%`}
                    y2={`${node.y}%`}
                    stroke={isSelected ? 'url(#activeBeamGrad)' : 'rgba(16, 185, 129, 0.35)'}
                    strokeWidth={isSelected ? 2 : 1}
                    strokeDasharray={isSelected ? '6 3' : '4 4'}
                    filter={isSelected ? 'url(#starGlow)' : undefined}
                    className="transition-all duration-300"
                  />
                </g>
              );
            })}
          </svg>

          {/* Render Interactive Star Nodes */}
          <div className="relative z-10 w-full h-[320px]">
            {filteredNodes.map(node => {
              const isSelected = selectedNodeId === node.id;
              const isCenter = node.id === 'node-1';

              return (
                <button
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  className={`absolute transform -translate-x-1/2 -translate-y-1/2 p-2.5 rounded-2xl border transition-all duration-300 cursor-pointer group ${
                    isSelected
                      ? 'bg-gradient-to-r from-blue-600 via-teal-600 to-emerald-600 text-white border-white/80 shadow-[0_0_30px_rgba(16,185,129,0.5)] scale-110 z-20'
                      : isCenter
                        ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/60 shadow-lg shadow-emerald-500/20 hover:scale-105 z-10'
                        : 'bg-slate-900/90 text-slate-300 border-white/10 hover:border-blue-400 hover:scale-105 z-0'
                  }`}
                  style={{ left: `${node.x}%`, top: `${node.y}%` }}
                >
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    {/* Star core with luminous pulse ring */}
                    <div className="relative flex items-center justify-center">
                      <span className={`w-2.5 h-2.5 rounded-full ${
                        isSelected ? 'bg-white animate-ping' :
                        node.connectionStrength >= 90 ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-blue-400 shadow-[0_0_8px_#3b82f6]'
                      }`} />
                      <span className={`absolute w-1.5 h-1.5 rounded-full ${
                        isSelected ? 'bg-white' : node.connectionStrength >= 90 ? 'bg-white' : 'bg-blue-200'
                      }`} />
                    </div>
                    <span className="text-[11px] font-bold tracking-tight">{node.name}</span>
                  </div>
                  <div className={`text-[9px] font-mono mt-0.5 truncate max-w-[130px] ${
                    isSelected ? 'text-white/90 font-semibold' : 'text-slate-400'
                  }`}>
                    {node.title}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Bottom Canvas Stats */}
          <div className="relative z-10 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Demo Decision Makers: {filteredNodes.length}</span>
            </div>
            <span className="text-blue-400 font-bold">1-Click Cold Call & Sequence Capable</span>
          </div>
        </div>

        {/* Right Column: Selected Decision Maker Profile & BD Actions (5 cols) */}
        <div className={`lg:col-span-5 p-5 rounded-2xl border flex flex-col justify-between space-y-4 transition-all duration-300 ${
          isDark ? 'glass-card bg-slate-900/70 border-white/10' : 'bg-white border-slate-200/90 shadow-lg'
        }`}>
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30">
                  {selectedNode.relationshipType}
                </span>
                <span className="ml-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-black border border-amber-500/50">
                  Demo contact
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-2">
                  {selectedNode.name}
                </h3>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
                  {selectedNode.title}
                </p>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{selectedNode.organization}</span>
                </div>
              </div>

              {/* Connection Strength Ring */}
              <div className={`text-center p-2 rounded-xl border shrink-0 ${
                isDark ? 'bg-white/5 border-white/5' : 'bg-emerald-50 border-emerald-200'
              }`}>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">Affinity</span>
                <strong className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">{selectedNode.connectionStrength}%</strong>
              </div>
            </div>

            {/* Decision Maker Metadata Chips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 text-[11px] font-mono">
              <div className={`p-2.5 rounded-xl border ${
                isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'
              }`}>
                <span className="text-slate-500 dark:text-slate-400 block text-[10px]">EHR System</span>
                <strong className="text-slate-900 dark:text-white font-bold">{selectedNode.ehrSystem}</strong>
              </div>
              <div className={`p-2.5 rounded-xl border ${
                isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'
              }`}>
                <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Direct Backline</span>
                <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{selectedNode.phone}</strong>
              </div>
            </div>

            {/* AI Network Value Prop Tailoring */}
            <div className={`mt-4 p-3 rounded-xl border text-xs space-y-1 ${
              isDark 
                ? 'bg-blue-500/10 border-blue-500/20 text-slate-300' 
                : 'bg-blue-50/70 border-blue-200 text-slate-700'
            }`}>
              <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold text-[11px]">
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Cold Outreach Talking Point</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                "We overturn {selectedNode.ehrSystem} claim denials within 14 business days with zero setup fee and 98.4% clean claim pass rate for {selectedNode.specialty} clinics."
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-white/5">
            <button
              onClick={() => handleLaunchColdCall(selectedNode)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-400 hover:to-blue-500 text-white font-black text-xs shadow-lg shadow-emerald-500/20 transition cursor-pointer active:scale-98"
            >
              <PhoneCall className="w-4 h-4" />
              <span>Launch Live Cold Call Dialing ({selectedNode.phone})</span>
            </button>

            <button
              onClick={() => onSendLinkedIn?.(selectedNode.name)}
              className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl font-bold text-xs transition cursor-pointer active:scale-98 border ${
                isDark 
                  ? 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border-blue-500/30' 
                  : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300'
              }`}
            >
              <Linkedin className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
              <span>Queue Personalized LinkedIn Connection Sequence</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
