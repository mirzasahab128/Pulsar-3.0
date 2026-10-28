import React, { useEffect, useState } from 'react';
import { 
  Flame, 
  Mail, 
  Linkedin, 
  PhoneCall, 
  Plus, 
  Play, 
  Pause, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Users, 
  ArrowRight, 
  Send,
  Eye,
  Sliders,
  ShieldCheck,
  X
} from 'lucide-react';
import { OutreachCampaign, CampaignStatus, RCMLead } from '../types';
import { useTheme } from '../context/ThemeContext';
import { apiService } from '../services/api';

interface CampaignManagementWorkspaceProps {
  leads: RCMLead[];
  onTriggerCall?: (lead: RCMLead) => void;
}

export const CampaignManagementWorkspace: React.FC<CampaignManagementWorkspaceProps> = ({
  leads,
  onTriggerCall
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [campaigns, setCampaigns] = useState<OutreachCampaign[]>([
    {
      id: 'camp-1',
      name: 'Cardiology 50-Claim Audit Recovery',
      niche: 'Cardiology & Vascular Specialties',
      channels: ['voice', 'email'],
      status: 'running',
      targetCount: 45,
      deliveredCount: 38,
      openRate: 64,
      replyRate: 28,
      meetingsBooked: 6,
      createdAt: 'Oct 10, 2026',
      scheduledFor: 'Mon-Fri 08:30 - 16:30 PST',
      description: 'Pitches complimentary retrospective modifier 25 & 59 audit for high-volume cardiology billing managers.'
    },
    {
      id: 'camp-2',
      name: 'Orthopedic Workers Comp Denial Overturn',
      niche: 'Orthopedic Surgery & Sports Medicine',
      channels: ['linkedin', 'email'],
      status: 'scheduled',
      targetCount: 60,
      deliveredCount: 15,
      openRate: 58,
      replyRate: 19,
      meetingsBooked: 3,
      createdAt: 'Oct 12, 2026',
      scheduledFor: 'Tomorrow 09:00 PST',
      description: 'Executive peer outreach targeting business executives and administrators with growth case studies.'
    },
    {
      id: 'camp-3',
      name: 'Urgent Care EHR Migration Denial Defense',
      niche: 'Urgent Care & Multi-Site Clinics',
      channels: ['email'],
      status: 'draft',
      targetCount: 30,
      deliveredCount: 0,
      openRate: 0,
      replyRate: 0,
      meetingsBooked: 0,
      createdAt: 'Oct 14, 2026',
      description: 'Automated clean claims guarantee sequencing for urgent care clinics dealing with clearinghouse rejection spikes.'
    }
  ]);

  // Phases 1–3 (Part 2): sync the real campaign counters to the server so
  // GET /api/dashboard/stats can aggregate campaign performance. Opened /
  // replied derive from each campaign's stored delivered count and rates.
  useEffect(() => {
    apiService.syncDashboardSnapshot({
      campaigns: campaigns.map(c => ({
        id: c.id,
        name: c.name,
        status: c.status,
        sent: c.deliveredCount,
        opened: Math.round((c.deliveredCount * (c.openRate || 0)) / 100),
        replied: Math.round((c.deliveredCount * (c.replyRate || 0)) / 100),
        createdAt: (() => {
          const t = Date.parse(c.createdAt);
          return Number.isNaN(t) ? null : new Date(t).toISOString();
        })()
      }))
    }).catch(e => console.warn('Campaign snapshot sync:', e));
  }, [campaigns]);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignNiche, setNewCampaignNiche] = useState('All Industries');
  const [newCampaignDesc, setNewCampaignDesc] = useState('');
  const [selectedChannels, setSelectedChannels] = useState<('email' | 'linkedin' | 'voice' | 'whatsapp')[]>(['email', 'voice']);

  const handleToggleStatus = (id: string) => {
    setCampaigns(prev => prev.map(c => {
      if (c.id === id) {
        const nextStatus: CampaignStatus = c.status === 'running' ? 'paused' : 'running';
        return { ...c, status: nextStatus };
      }
      return c;
    }));
  };

  const handleCreateCampaign = () => {
    if (!newCampaignName.trim()) return;
    const newCamp: OutreachCampaign = {
      id: `camp-${Date.now()}`,
      name: newCampaignName,
      niche: newCampaignNiche,
      channels: selectedChannels,
      status: 'review',
      targetCount: leads.length,
      deliveredCount: 0,
      openRate: 0,
      replyRate: 0,
      meetingsBooked: 0,
      createdAt: 'Today',
      description: newCampaignDesc || 'Targeted multi-channel executive BD campaign.'
    };
    setCampaigns(prev => [newCamp, ...prev]);
    setIsCreateModalOpen(false);
    setNewCampaignName('');
    setNewCampaignDesc('');
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className={`p-6 rounded-3xl border glass-elevated flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
        isDark ? 'bg-slate-900/60 border-white/[0.08]' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-[var(--pv-accent)] mb-1">
            <Flame className="w-4 h-4" />
            <span>MULTI-CHANNEL OUTREACH ENGINE</span>
          </div>
          <h1 className="text-2xl font-black text-[var(--pv-ink)] font-display tracking-tight">
            Campaign Orchestration
          </h1>
          <p className="text-xs text-[var(--pv-muted)] max-w-xl mt-1">
            Execute personalized email, LinkedIn, and AI voice sequences with strict deliverability and platform compliance.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#0B5D3B] to-[#1DA068] hover:brightness-110 text-white font-bold text-xs shadow-lg shadow-[var(--pv-shadow)] transition cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Campaign</span>
        </button>
      </div>

      {/* Campaign Cards List */}
      <div className="space-y-4">
        {campaigns.map((camp) => (
          <div 
            key={camp.id}
            className={`p-5 rounded-2xl border glass-standard space-y-4 transition ${
              isDark ? 'bg-slate-900/60 border-white/[0.08]' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="font-bold text-base text-[var(--pv-ink)]">{camp.name}</span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold uppercase ${
                    camp.status === 'running'
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : camp.status === 'scheduled'
                        ? 'bg-cyan-500/10 text-[var(--pv-green)] border-cyan-500/30'
                        : camp.status === 'paused'
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          : 'bg-slate-500/10 text-[var(--pv-ink)] border-slate-500/30'
                  }`}>
                    {camp.status}
                  </span>
                </div>
                <div className="text-xs text-[var(--pv-muted)] mt-0.5">{camp.niche} · Created {camp.createdAt}</div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleToggleStatus(camp.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    camp.status === 'running'
                      ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  {camp.status === 'running' ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause Campaign</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>Launch Campaign</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <p className="text-xs text-[var(--pv-ink)] leading-relaxed">
              {camp.description}
            </p>

            {/* Campaign Metrics Bar */}
            <div className="pt-3 border-t border-white/[0.06] grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div>
                <span className="text-[var(--pv-muted)] block text-[10px] uppercase font-mono">Audience</span>
                <span className="font-bold text-[var(--pv-ink)] tabular-nums">{camp.targetCount} Leads</span>
              </div>

              <div>
                <span className="text-[var(--pv-muted)] block text-[10px] uppercase font-mono">Delivered</span>
                <span className="font-bold text-[var(--pv-ink)] tabular-nums">{camp.deliveredCount} Sends</span>
              </div>

              <div>
                <span className="text-[var(--pv-muted)] block text-[10px] uppercase font-mono">Open Rate</span>
                <span className="font-bold text-[var(--pv-accent)] tabular-nums">{camp.openRate}%</span>
              </div>

              <div>
                <span className="text-[var(--pv-muted)] block text-[10px] uppercase font-mono">Reply Rate</span>
                <span className="font-bold text-violet-400 tabular-nums">{camp.replyRate}%</span>
              </div>

              <div>
                <span className="text-[var(--pv-muted)] block text-[10px] uppercase font-mono">Meetings</span>
                <span className="font-bold text-emerald-400 tabular-nums">{camp.meetingsBooked} Booked</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Campaign Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className={`w-full max-w-lg p-6 rounded-3xl border glass-modal space-y-4 ${
            isDark ? 'bg-[#0a0e1a]/95 border-white/[0.12] text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <span className="font-bold text-base">Create Autonomous Campaign</span>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1 text-[var(--pv-muted)] hover:text-[var(--pv-ink)] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1 text-[var(--pv-ink)]">Campaign Name</label>
                <input
                  type="text"
                  value={newCampaignName}
                  onChange={e => setNewCampaignName(e.target.value)}
                  placeholder="e.g. Q4 Pain Management Denial Audit Offer"
                  className="w-full p-2.5 rounded-xl border border-[var(--pv-border)] bg-[var(--pv-card-soft)] text-[var(--pv-ink)] focus:outline-none focus:border-[var(--pv-accent)]"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1 text-[var(--pv-ink)]">Target Industry Niche</label>
                <input
                  type="text"
                  value={newCampaignNiche}
                  onChange={e => setNewCampaignNiche(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[var(--pv-border)] bg-[var(--pv-card-soft)] text-[var(--pv-ink)] focus:outline-none focus:border-[var(--pv-accent)]"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1 text-[var(--pv-ink)]">Value Proposition & Objective</label>
                <textarea
                  rows={3}
                  value={newCampaignDesc}
                  onChange={e => setNewCampaignDesc(e.target.value)}
                  placeholder="Describe the offer, e.g. 50-claim retrospective audit to uncover modifier underpayments."
                  className="w-full p-2.5 rounded-xl border border-[var(--pv-border)] bg-[var(--pv-card-soft)] text-[var(--pv-ink)] focus:outline-none focus:border-[var(--pv-accent)]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.08]">
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 rounded-xl text-[var(--pv-muted)] hover:text-[var(--pv-ink)] text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCampaign}
                className="px-4 py-2 rounded-xl bg-[var(--pv-green)] hover:bg-[var(--pv-accent)] text-white font-bold text-xs shadow-md transition cursor-pointer"
              >
                Create Campaign
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
