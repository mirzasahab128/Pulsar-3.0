import React, { useState } from 'react';
import { 
  Clock, 
  Calendar, 
  TrendingUp, 
  Users, 
  Sparkles, 
  CheckCircle2, 
  Play, 
  Send, 
  AlertCircle, 
  Shuffle, 
  ArrowRight, 
  Sliders, 
  Layers, 
  ShieldCheck, 
  Activity,
  Zap,
  Info,
  CalendarCheck2,
  Plus,
  Trash2,
  Sun,
  Coffee,
  Sunset,
  Moon
} from 'lucide-react';
import { LinkedInQueueItem, LinkedInBatchTimeSlot, LinkedInConnectedAccount } from '../types';

interface BatchSchedulingTimelineProps {
  queue: LinkedInQueueItem[];
  onUpdateQueue: (queue: LinkedInQueueItem[]) => void;
  connectedAccount: LinkedInConnectedAccount;
  onOpenAutomator?: () => void;
  onOpenSettings?: () => void;
}

export const DEFAULT_BATCH_SLOTS: LinkedInBatchTimeSlot[] = [
  {
    id: 'slot-1',
    timePST: '08:30',
    label: 'Morning Clinic Huddle & Inbox Review',
    windowType: 'peak_morning',
    targetAllocation: 15,
    activityScore: 96,
    notes: 'Practice administrators & managing partners review LinkedIn before morning patient intake.',
    enabled: true
  },
  {
    id: 'slot-2',
    timePST: '11:45',
    label: 'Midday Administration & Charting Break',
    windowType: 'lunch_admin_break',
    targetAllocation: 15,
    activityScore: 88,
    notes: 'Clinic directors check messages during lunch billing audits and staff coordination.',
    enabled: true
  },
  {
    id: 'slot-3',
    timePST: '14:15',
    label: 'Afternoon Billing Department Checkpoint',
    windowType: 'afternoon_wrap',
    targetAllocation: 12,
    activityScore: 84,
    notes: 'Targeting business directors and CFOs wrapping daily outreach batches.',
    enabled: true
  },
  {
    id: 'slot-4',
    timePST: '17:00',
    label: 'Post-Clinic Wrap-up & Executive Commute',
    windowType: 'evening_commute',
    targetAllocation: 8,
    activityScore: 92,
    notes: 'High mobile acceptance window as physicians and clinic executives commute.',
    enabled: true
  }
];

export const BatchSchedulingTimeline: React.FC<BatchSchedulingTimelineProps> = ({
  queue,
  onUpdateQueue,
  connectedAccount,
  onOpenAutomator,
  onOpenSettings
}) => {
  const [slots, setSlots] = useState<LinkedInBatchTimeSlot[]>(() => {
    const saved = localStorage.getItem('pulsercm_linkedin_batch_slots');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return DEFAULT_BATCH_SLOTS;
  });

  const [activeWindowFilter, setActiveWindowFilter] = useState<string>('all');
  const [selectedSlotForManualAssign, setSelectedSlotForManualAssign] = useState<string>(slots[0]?.id || 'slot-1');
  const [timelineFeedback, setTimelineFeedback] = useState<string | null>(null);

  const saveSlots = (newSlots: LinkedInBatchTimeSlot[]) => {
    setSlots(newSlots);
    localStorage.setItem('pulsercm_linkedin_batch_slots', JSON.stringify(newSlots));
  };

  const handleToggleSlot = (id: string) => {
    const updated = slots.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s);
    saveSlots(updated);
  };

  const handleUpdateAllocation = (id: string, val: number) => {
    const updated = slots.map(s => s.id === id ? { ...s, targetAllocation: Math.max(1, Math.min(30, val)) } : s);
    saveSlots(updated);
  };

  // Auto-allocate ready queue items across enabled peak time slots
  const handleAutoDistributeQueue = () => {
    const enabledSlots = slots.filter(s => s.enabled);
    if (enabledSlots.length === 0) {
      setTimelineFeedback('Please enable at least one time slot before scheduling batches.');
      return;
    }

    const unassignedItems = queue.filter(q => q.status === 'approved' || q.status === 'queued');
    if (unassignedItems.length === 0) {
      setTimelineFeedback('No pending/approved prospects in queue to distribute. Find prospects in the Automator first!');
      return;
    }

    let slotIdx = 0;
    const updatedQueue = queue.map(item => {
      if (item.status === 'approved' || item.status === 'queued') {
        const slot = enabledSlots[slotIdx % enabledSlots.length];
        slotIdx++;
        return {
          ...item,
          scheduledTimeSlot: slot.timePST,
          batchName: slot.label
        };
      }
      return item;
    });

    onUpdateQueue(updatedQueue);
    setTimelineFeedback(`✓ Distributed ${unassignedItems.length} prospects across ${enabledSlots.length} high-activity schedule windows!`);
    setTimeout(() => setTimelineFeedback(null), 5000);
  };

  const handleAssignSingleSlot = (slotTime: string, batchName: string) => {
    const unassignedItems = queue.filter(q => q.status === 'approved' || q.status === 'queued');
    if (unassignedItems.length === 0) {
      setTimelineFeedback('No pending/approved prospects in queue to assign.');
      return;
    }

    const updatedQueue = queue.map(item => {
      if (item.status === 'approved' || item.status === 'queued') {
        return {
          ...item,
          scheduledTimeSlot: slotTime,
          batchName
        };
      }
      return item;
    });

    onUpdateQueue(updatedQueue);
    setTimelineFeedback(`✓ Assigned all pending queue prospects to ${batchName} (${slotTime} PST).`);
    setTimeout(() => setTimelineFeedback(null), 4000);
  };

  const totalAllocatedToday = slots.filter(s => s.enabled).reduce((acc, s) => acc + s.targetAllocation, 0);

  // Group queue by slot
  const getSlotCount = (timePST: string) => {
    return queue.filter(q => q.scheduledTimeSlot === timePST).length;
  };

  const getSlotSentCount = (timePST: string) => {
    return queue.filter(q => q.scheduledTimeSlot === timePST && (q.status === 'sent' || q.status === 'accepted')).length;
  };

  const getSlotWindowIcon = (type: LinkedInBatchTimeSlot['windowType']) => {
    switch (type) {
      case 'peak_morning': return <Coffee className="w-4 h-4 text-emerald-400" />;
      case 'lunch_admin_break': return <Sun className="w-4 h-4 text-cyan-400" />;
      case 'afternoon_wrap': return <Sunset className="w-4 h-4 text-blue-400" />;
      case 'evening_commute': return <Moon className="w-4 h-4 text-sky-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Timeline Overview & Schedule Optimizer */}
      <div className="p-6 rounded-2xl glass-panel bg-gradient-to-r from-slate-950/90 via-blue-950/30 to-slate-950/90 border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-semibold uppercase tracking-wider mb-2">
              <CalendarCheck2 className="w-3.5 h-3.5 text-blue-400" />
              <span>Smart Batch Scheduling Timeline</span>
              <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                PST Timezone Grounded
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-3">
              <span>Optimized Outbound Activity Windows</span>
            </h2>

            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Pre-schedules connection requests for peak medical decision-maker activity windows (8:30 AM clinic huddle, 11:45 AM lunch charting, 5:00 PM evening commute) to boost acceptance rates by up to <strong>+38%</strong>.
            </p>
          </div>

          {/* Quick Actions & Quota Balance */}
          <div className="flex items-center gap-3 bg-slate-950/80 p-3.5 rounded-2xl border border-white/10 shadow-inner flex-wrap">
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Planned Daily Batches</div>
              <div className="font-mono text-2xl font-black text-white flex items-center gap-1.5">
                <span className="text-cyan-400">{totalAllocatedToday}</span>
                <span className="text-slate-500 text-base">/ 50 limit</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pl-3 border-l border-slate-800">
              <button
                onClick={handleAutoDistributeQueue}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-400 hover:to-blue-500 text-white text-xs font-bold transition shadow-md shadow-emerald-600/20 cursor-pointer"
                title="Automatically distribute pending queue items across optimal time slots"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Auto-Distribute Queue</span>
              </button>

              {onOpenAutomator && (
                <button
                  onClick={onOpenAutomator}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
                >
                  View Automator
                </button>
              )}
            </div>
          </div>
        </div>

        {timelineFeedback && (
          <div className="mt-4 p-3 rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-200 text-xs flex items-center justify-between">
            <span>{timelineFeedback}</span>
            <button onClick={() => setTimelineFeedback(null)} className="text-blue-400 hover:text-white font-mono text-xs">✕</button>
          </div>
        )}
      </div>

      {/* Timeline Visual Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/10 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Daily Schedule Window Matrix (PST)
            </h3>
          </div>

          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span>High Engagement Window</span>
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-cyan-400 ml-2" />
            <span>Moderate Engagement</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {slots.map((slot) => {
            const scheduledCount = getSlotCount(slot.timePST);
            const sentCount = getSlotSentCount(slot.timePST);
            const isFilled = scheduledCount >= slot.targetAllocation;

            return (
              <div 
                key={slot.id}
                className={`p-4 rounded-2xl glass-panel border transition relative flex flex-col justify-between space-y-3 ${
                  slot.enabled 
                    ? 'bg-slate-900/80 border-white/10 hover:border-cyan-500/40 shadow-lg' 
                    : 'bg-slate-950/40 border-slate-800 opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-mono text-lg font-black text-white">
                      {getSlotWindowIcon(slot.windowType)}
                      <span>{slot.timePST}</span>
                      <span className="text-xs font-normal text-slate-400">PST</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                        slot.activityScore >= 90 
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' 
                          : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                      }`}>
                        {slot.activityScore}% Activity Index
                      </span>

                      <input
                        type="checkbox"
                        checked={slot.enabled}
                        onChange={() => handleToggleSlot(slot.id)}
                        className="rounded border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
                        title="Enable/Disable this schedule window"
                      />
                    </div>
                  </div>

                  <h4 className="text-xs font-bold text-slate-200 mt-2 line-clamp-1">
                    {slot.label}
                  </h4>

                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                    {slot.notes}
                  </p>
                </div>

                {/* Progress & Allocation Config */}
                <div className="pt-3 border-t border-white/5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Assigned / Target:</span>
                    <span className="font-bold text-white">
                      <span className="text-cyan-400">{scheduledCount}</span> / {slot.targetAllocation}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-white/5">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        isFilled ? 'bg-emerald-400' : 'bg-gradient-to-r from-emerald-400 to-blue-500'
                      }`}
                      style={{ width: `${Math.min(100, (scheduledCount / slot.targetAllocation) * 100)}%` }}
                    />
                  </div>

                  {/* Quick controls */}
                  <div className="flex items-center justify-between gap-2 pt-1 text-[11px]">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500">Target:</span>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={slot.targetAllocation}
                        onChange={(e) => handleUpdateAllocation(slot.id, parseInt(e.target.value) || 1)}
                        className="w-12 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-center text-slate-200 font-mono"
                      />
                    </div>

                    <button
                      onClick={() => handleAssignSingleSlot(slot.timePST, slot.label)}
                      className="text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer transition hover:underline"
                      title="Assign current unassigned prospects to this window"
                    >
                      Fill Batch
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scheduled Prospects Timeline Feed */}
      <div className="p-6 rounded-2xl glass-panel border border-white/10 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10 flex-wrap gap-2">
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Outreach Batch Schedule Queue</span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Scheduled connection requests queued to fire at optimal prospect activity windows.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">
              Total Queued: <strong className="text-white font-bold">{queue.length}</strong>
            </span>
          </div>
        </div>

        {queue.length === 0 ? (
          <div className="py-12 text-center text-slate-400 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
            <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium text-slate-300">No prospects currently scheduled in timeline.</p>
            <p className="text-xs text-slate-500 mt-1">Use "Auto-Distribute Queue" above to populate high-engagement batches.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/70 text-[11px] uppercase tracking-wider text-slate-400 border-b border-white/5">
                <tr>
                  <th className="py-3 px-3">Decision Maker & Practice</th>
                  <th className="py-3 px-3">Target Specialty</th>
                  <th className="py-3 px-3">Scheduled Window (PST)</th>
                  <th className="py-3 px-3">Batch Name</th>
                  <th className="py-3 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {queue.slice(0, 12).map((item) => {
                  const isScheduled = !!item.scheduledTimeSlot;
                  const isSent = item.status === 'sent' || item.status === 'accepted';

                  return (
                    <tr key={item.id} className="hover:bg-slate-900/50 transition">
                      <td className="py-3 px-3">
                        <div className="font-bold text-white">
                          {item.prospect.fullName}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {item.prospect.practice} • {item.prospect.location}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono">
                          {item.prospect.specialty || 'General Business'}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        {item.scheduledTimeSlot ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono text-xs font-bold">
                            <Clock className="w-3 h-3 text-blue-400" />
                            {item.scheduledTimeSlot} PST
                          </span>
                        ) : (
                          <span className="text-slate-500 font-mono text-[11px]">
                            Immediate / Unscheduled
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-slate-300">
                        {item.batchName || 'General Queue'}
                      </td>

                      <td className="py-3 px-3 text-right">
                        {item.status === 'accepted' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            Accepted
                          </span>
                        ) : item.status === 'sent' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[11px]">
                            <Send className="w-3 h-3 text-blue-400" />
                            Dispatched
                          </span>
                        ) : item.scheduledTimeSlot ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[11px] font-mono">
                            Scheduled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                            Ready in Queue
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
