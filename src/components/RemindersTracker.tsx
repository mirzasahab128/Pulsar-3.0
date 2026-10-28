import React, { useState } from 'react';
import { 
  Bell, 
  CheckSquare, 
  Clock, 
  Plus, 
  AlertTriangle, 
  CheckCircle2, 
  Filter, 
  Send, 
  Mail, 
  PhoneCall, 
  Sparkles,
  Calendar,
  CalendarCheck,
  CalendarPlus,
  Trash2,
  ExternalLink,
  User,
  ArrowRight,
  Flame,
  ShieldAlert,
  Info,
  Check
} from 'lucide-react';
import { ActionItem } from '../types';
import { speechService } from '../utils/speech';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { GoogleTasksWorkspace } from './GoogleTasksWorkspace';

export interface PriorityBadgeProps {
  priority: 'Urgent' | 'High' | 'Medium' | 'Low' | string;
  size?: 'sm' | 'md';
  showIcon?: boolean;
  className?: string;
}

/**
 * Color-coded priority badge component with distinct colors and indicators:
 * - Urgent: High-alert crimson/rose with pulsing indicator
 * - High: Priority amber/orange with golden indicator
 * - Medium: Standard sky/cobalt blue with crisp indicator
 * - Low: Routine emerald/green with relaxed indicator
 */
export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ 
  priority, 
  size = 'sm', 
  showIcon = true,
  className = ''
}) => {
  const norm = priority?.toLowerCase() || 'medium';

  if (norm === 'urgent') {
    return (
      <span 
        className={`inline-flex items-center gap-1.5 font-mono font-bold uppercase rounded-md tracking-wider border shadow-sm bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/50 ${
          size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[10px]'
        } ${className}`}
        title="Urgent Priority - Requires immediate same-day action"
      >
        {showIcon && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
          </span>
        )}
        <span>Urgent</span>
      </span>
    );
  }

  if (norm === 'high') {
    return (
      <span 
        className={`inline-flex items-center gap-1.5 font-mono font-bold uppercase rounded-md tracking-wider border shadow-sm bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/50 ${
          size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[10px]'
        } ${className}`}
        title="High Priority - Attention needed within 24 hours"
      >
        {showIcon && <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400 shrink-0 ring-1 ring-amber-400/40" />}
        <span>High</span>
      </span>
    );
  }

  if (norm === 'medium') {
    return (
      <span 
        className={`inline-flex items-center gap-1.5 font-mono font-bold uppercase rounded-md tracking-wider border shadow-sm bg-sky-50 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-500/50 ${
          size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[10px]'
        } ${className}`}
        title="Medium Priority - Standard workflow follow-up"
      >
        {showIcon && <span className="w-2 h-2 rounded-full bg-sky-500 dark:bg-sky-400 shrink-0 ring-1 ring-sky-400/40" />}
        <span>Medium</span>
      </span>
    );
  }

  // Low Priority
  return (
    <span 
      className={`inline-flex items-center gap-1.5 font-mono font-bold uppercase rounded-md tracking-wider border shadow-sm bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/50 ${
        size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[10px]'
      } ${className}`}
      title="Low Priority - Routine or periodic check-in"
    >
      {showIcon && <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0 ring-1 ring-emerald-400/40" />}
      <span>Low</span>
    </span>
  );
};

interface RemindersTrackerProps {
  tasks: ActionItem[];
  onToggleTask: (taskId: string) => void;
  onAddTask: (task: ActionItem) => void;
  onDeleteTask: (taskId: string) => void;
  onDialScheduledCall?: (task: ActionItem) => void;
}

export const RemindersTracker: React.FC<RemindersTrackerProps> = ({
  tasks,
  onToggleTask,
  onAddTask,
  onDeleteTask,
  onDialScheduledCall
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { googleAccessToken } = useAuth();

  const [trackerMode, setTrackerMode] = useState<'reminders' | 'google_tasks'>('reminders');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  
  // New task form state
  const [newTaskText, setNewTaskText] = useState<string>('');
  const [newTaskDue, setNewTaskDue] = useState<string>('Tomorrow, 10:00 AM PST');
  const [newTaskPriority, setNewTaskPriority] = useState<'Urgent' | 'High' | 'Medium' | 'Low'>('High');
  const [newTaskCategory, setNewTaskCategory] = useState<'Audit Proposal' | 'Email Followup' | 'EHR Demo' | 'Contract' | 'Phone Call'>('Phone Call');
  const [isScheduledCallOption, setIsScheduledCallOption] = useState<boolean>(true);
  const [newDoctorName, setNewDoctorName] = useState<string>('');
  const [newPracticeName, setNewPracticeName] = useState<string>('');
  const [newPhone, setNewPhone] = useState<string>('');
  const [newAgenda, setNewAgenda] = useState<string>('');

  // Scheduled calls subset
  const scheduledCalls = tasks.filter((t) => t.isScheduledCall || t.category === 'Phone Call');
  const activeScheduledCalls = scheduledCalls.filter((t) => !t.completed);

  // Priority count calculations for active tasks
  const urgentCount = tasks.filter(t => !t.completed && t.priority === 'Urgent').length;
  const highCount = tasks.filter(t => !t.completed && t.priority === 'High').length;
  const mediumCount = tasks.filter(t => !t.completed && t.priority === 'Medium').length;
  const lowCount = tasks.filter(t => !t.completed && t.priority === 'Low').length;

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (filterCategory === 'All') return true;
    if (filterCategory === 'Scheduled Calls') return t.isScheduledCall || t.category === 'Phone Call';
    if (filterCategory === 'Active') return !t.completed;
    if (filterCategory === 'Completed') return t.completed;
    return t.priority === filterCategory;
  });

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;

    const task: ActionItem = {
      id: `task-${Date.now()}`,
      task: newTaskText.trim(),
      due: newTaskDue,
      priority: newTaskPriority,
      category: isScheduledCallOption ? 'Phone Call' : newTaskCategory,
      completed: false,
      isScheduledCall: isScheduledCallOption,
      practiceName: newPracticeName.trim() || undefined,
      doctorName: newDoctorName.trim() || undefined,
      phone: newPhone.trim() || undefined,
      notes: newAgenda.trim() || undefined
    };

    onAddTask(task);
    setNewTaskText('');
    setNewDoctorName('');
    setNewPracticeName('');
    setNewPhone('');
    setNewAgenda('');
    setShowAddModal(false);
    speechService.playTelephoneRing('transfer_chime');
  };

  const handleDraftEmail = (task: ActionItem) => {
    const subject = encodeURIComponent(`Pulsar Business Growth Follow-up: ${task.isScheduledCall ? 'Scheduled Call Confirmation' : 'Action Item'} for ${task.practiceName || 'Your Practice'}`);
    const body = encodeURIComponent(
      task.isScheduledCall 
        ? `Hi ${task.doctorName || 'Doctor'},\n\nConfirming our scheduled follow-up call regarding Pulsar business growth services for ${task.practiceName || 'your business'}.\n\nScheduled Date & Time: ${task.due}\nPhone: ${task.phone || 'Your office line'}\nAgenda: ${task.notes || task.task}\n\nLooking forward to speaking with you.\n\nBest regards,\nSales & Marketing Manager\nPulsar Business Growth`
        : `Hi Doctor / Administrator,\n\nFollowing up on our recent conversation regarding your business growth and sales performance. As discussed, I am preparing the next steps regarding: ${task.task}.\n\nLooking forward to speaking soon.\n\nBest regards,\nSales & Marketing Manager\nPulsar Business Growth`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className={`p-6 rounded-2xl border shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors duration-300 ${
        isDark
          ? 'bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950/40 border-slate-800'
          : 'bg-gradient-to-r from-white via-blue-50/40 to-white border-slate-200/90 shadow-[0_12px_35px_rgba(15,23,42,0.06)]'
      }`}>
        <div>
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-2 border ${
            isDark
              ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
              : 'bg-blue-50 border-blue-200 text-blue-700'
          }`}>
            <Calendar className="w-3.5 h-3.5" />
            Scheduled Calls & Pipeline Reminders
          </div>
          <h2 className={`text-xl sm:text-2xl font-black tracking-tight font-display ${
            isDark ? 'text-white' : 'text-slate-900'
          }`}>
            Scheduled Calls & Action Items Tracker
          </h2>
          <p className={`text-xs sm:text-sm mt-1 max-w-2xl ${
            isDark ? 'text-slate-400' : 'text-slate-600'
          }`}>
            Track booked appointments and prioritize client follow-ups with color-coded priority badges across Urgent, High, Medium, and Low tiers.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setIsScheduledCallOption(true);
              setNewTaskCategory('Phone Call');
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-xs font-bold shadow-lg shadow-emerald-500/25 transition cursor-pointer"
          >
            <CalendarPlus className="w-4 h-4" />
            <span>Schedule Follow-Up Call</span>
          </button>

          <button
            onClick={() => {
              setIsScheduledCallOption(false);
              setNewTaskCategory('Audit Proposal');
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/25 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-1.5 rounded-2xl border glass-base bg-black/20 border-white/5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTrackerMode('reminders')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              trackerMode === 'reminders'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Pulsar Pipeline Reminders ({tasks.length})</span>
          </button>

          <button
            onClick={() => setTrackerMode('google_tasks')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              trackerMode === 'google_tasks'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>Google Tasks Cloud Sync</span>
            {googleAccessToken ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                Connect
              </span>
            )}
          </button>
        </div>

        {trackerMode === 'reminders' && googleAccessToken && (
          <button
            onClick={() => setTrackerMode('google_tasks')}
            className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 transition cursor-pointer"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Switch to Google Tasks cloud list</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {trackerMode === 'google_tasks' ? (
        <GoogleTasksWorkspace
          localTasks={tasks}
          onImportToLocal={(imported) => imported.forEach(t => onAddTask(t))}
          onDialCall={(phone, doctorName, practiceName) => {
            if (onDialScheduledCall) {
              onDialScheduledCall({
                id: `call-${Date.now()}`,
                task: `Follow-up call with ${doctorName || 'Lead'}`,
                due: 'Scheduled via Google Tasks',
                priority: 'High',
                category: 'Phone Call',
                completed: false,
                isScheduledCall: true,
                phone,
                doctorName,
                practiceName
              });
            }
          }}
        />
      ) : (
        <>
          {/* Priority Matrix Overview Bar */}
          <div className={`p-4 rounded-2xl border shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
            isDark ? 'glass-card bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200/90 shadow-sm'
          }`}>
        <div className={`flex items-center gap-2 text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
          <Flame className="w-4 h-4 text-rose-500" />
          <span>Priority Triage Matrix:</span>
          <span className={`text-[11px] font-normal hidden md:inline ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Click any badge below to filter time-sensitive follow-ups instantly
          </span>
        </div>

        <div className="grid grid-cols-2 sm:flex items-center gap-2">
          {/* Urgent */}
          <button
            onClick={() => setFilterCategory(filterCategory === 'Urgent' ? 'All' : 'Urgent')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition cursor-pointer text-xs font-mono font-bold ${
              filterCategory === 'Urgent'
                ? 'bg-rose-500 text-slate-950 border-rose-400 shadow-md shadow-rose-500/20'
                : isDark 
                  ? 'bg-rose-950/40 text-rose-300 border-rose-500/30 hover:bg-rose-950/70' 
                  : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
            }`}
            title="Filter by Urgent Priority"
          >
            <span className={`w-2 h-2 rounded-full ${filterCategory === 'Urgent' ? 'bg-slate-950' : 'bg-rose-500 animate-pulse'}`} />
            <span>Urgent</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              filterCategory === 'Urgent' ? 'bg-slate-950/30 text-slate-950' : isDark ? 'bg-rose-500/20 text-rose-200' : 'bg-rose-100 text-rose-900'
            }`}>
              {urgentCount}
            </span>
          </button>

          {/* High */}
          <button
            onClick={() => setFilterCategory(filterCategory === 'High' ? 'All' : 'High')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition cursor-pointer text-xs font-mono font-bold ${
              filterCategory === 'High'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                : isDark 
                  ? 'bg-amber-950/40 text-amber-300 border-amber-500/30 hover:bg-amber-950/70' 
                  : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
            }`}
            title="Filter by High Priority"
          >
            <span className={`w-2 h-2 rounded-full ${filterCategory === 'High' ? 'bg-slate-950' : 'bg-amber-500'}`} />
            <span>High</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              filterCategory === 'High' ? 'bg-slate-950/30 text-slate-950' : isDark ? 'bg-amber-500/20 text-amber-200' : 'bg-amber-100 text-amber-900'
            }`}>
              {highCount}
            </span>
          </button>

          {/* Medium */}
          <button
            onClick={() => setFilterCategory(filterCategory === 'Medium' ? 'All' : 'Medium')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition cursor-pointer text-xs font-mono font-bold ${
              filterCategory === 'Medium'
                ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-md shadow-sky-500/20'
                : isDark 
                  ? 'bg-sky-950/40 text-sky-300 border-sky-500/30 hover:bg-sky-950/70' 
                  : 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100'
            }`}
            title="Filter by Medium Priority"
          >
            <span className={`w-2 h-2 rounded-full ${filterCategory === 'Medium' ? 'bg-slate-950' : 'bg-sky-500'}`} />
            <span>Medium</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              filterCategory === 'Medium' ? 'bg-slate-950/30 text-slate-950' : isDark ? 'bg-sky-500/20 text-sky-200' : 'bg-sky-100 text-sky-900'
            }`}>
              {mediumCount}
            </span>
          </button>

          {/* Low */}
          <button
            onClick={() => setFilterCategory(filterCategory === 'Low' ? 'All' : 'Low')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition cursor-pointer text-xs font-mono font-bold ${
              filterCategory === 'Low'
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20'
                : isDark 
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30 hover:bg-emerald-950/70' 
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
            }`}
            title="Filter by Low Priority"
          >
            <span className={`w-2 h-2 rounded-full ${filterCategory === 'Low' ? 'bg-slate-950' : 'bg-emerald-500'}`} />
            <span>Low</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              filterCategory === 'Low' ? 'bg-slate-950/30 text-slate-950' : isDark ? 'bg-emerald-500/20 text-emerald-200' : 'bg-emerald-100 text-emerald-900'
            }`}>
              {lowCount}
            </span>
          </button>
        </div>
      </div>

      {/* Featured Section: Scheduled Calls Queue */}
      <div className={`p-4 sm:p-5 rounded-2xl border shadow-xl space-y-4 transition-colors ${
        isDark 
          ? 'bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-blue-500/30' 
          : 'bg-gradient-to-b from-blue-50/40 via-white to-blue-50/20 border-blue-200 shadow-sm'
      }`}>
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b ${
          isDark ? 'border-slate-800' : 'border-blue-200'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl border ${
              isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-700 border-blue-200'
            }`}>
              <CalendarCheck className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className={`text-sm font-bold tracking-tight flex items-center gap-2 ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                Scheduled Calls
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 font-mono font-semibold border border-emerald-500/30">
                  {activeScheduledCalls.length} Upcoming
                </span>
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Follow-up phone calls booked with doctors, practice administrators, and billing directors
              </p>
            </div>
          </div>

          <span className={`text-xs font-mono ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
            Timezone: America/Los_Angeles (PST)
          </span>
        </div>

        {scheduledCalls.length === 0 ? (
          <div className={`py-8 text-center text-xs rounded-xl border p-6 ${
            isDark ? 'bg-slate-950/60 border-slate-800/80 text-slate-500' : 'bg-amber-50/50 border-amber-200 text-slate-600'
          }`}>
            <PhoneCall className={`w-8 h-8 mx-auto mb-2 opacity-60 ${isDark ? 'text-slate-600' : 'text-amber-500'}`} />
            <p className={`font-semibold ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>No scheduled calls yet.</p>
            <p className="mt-1 text-[11px]">
              Use the "Schedule Follow-Up" button in Call Studio or click "Schedule Follow-Up Call" above to book a callback.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {scheduledCalls.map((call) => (
              <div
                key={call.id}
                className={`p-4 rounded-xl border transition flex flex-col justify-between ${
                  call.completed
                    ? isDark ? 'bg-slate-950/40 border-slate-800/80 opacity-60' : 'bg-slate-100 border-slate-200 opacity-60'
                    : isDark ? 'bg-slate-900/95 border-amber-500/40 shadow-lg shadow-amber-500/5 hover:border-amber-500/60' : 'bg-white border-amber-300 shadow-md hover:border-amber-400'
                }`}
              >
                <div>
                  {/* Top Bar with Badge & Due Time */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 text-[10px] font-mono font-bold uppercase tracking-wider border border-amber-500/30">
                      <Calendar className="w-3 h-3" />
                      Scheduled Call
                    </span>
                    <PriorityBadge priority={call.priority} size="sm" />
                  </div>

                  {/* Practice & Doctor */}
                  <div className="space-y-0.5">
                    <h4 className={`text-sm font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {call.practiceName || 'Medical Practice'}
                    </h4>
                    <p className="text-xs text-teal-600 dark:text-teal-400 font-medium flex items-center gap-1.5">
                      <User className="w-3 h-3" />
                      {call.doctorName || 'Doctor / Decision Maker'}
                    </p>
                  </div>

                  {/* Date, Time & Phone */}
                  <div className={`mt-2.5 p-2.5 rounded-lg border space-y-1 text-xs font-mono ${
                    isDark ? 'bg-slate-950/80 border-slate-800/80' : 'bg-amber-50/70 border-amber-200'
                  }`}>
                    <div className={`flex items-center justify-between ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Date & Time:</span>
                      <strong className={isDark ? 'text-amber-300' : 'text-amber-700'}>{call.due}</strong>
                    </div>
                    {call.phone && (
                      <div className={`flex items-center justify-between ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                        <span className="text-slate-400">Phone:</span>
                        <strong className="text-emerald-400">{call.phone}</strong>
                      </div>
                    )}
                  </div>

                  {/* Agenda / Topic */}
                  {(call.notes || call.task) && (
                    <div className="mt-2.5 text-xs text-slate-300">
                      <span className="text-slate-400 text-[11px] block">Agenda / Topic:</span>
                      <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-2">
                        {call.notes || call.task}
                      </p>
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={call.completed}
                      onChange={() => onToggleTask(call.id)}
                      className="rounded border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
                    />
                    <span className={call.completed ? 'line-through text-slate-500' : ''}>
                      {call.completed ? 'Call Completed' : 'Mark Done'}
                    </span>
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDraftEmail(call)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                      title="Draft Confirmation Email"
                    >
                      <Mail className="w-3.5 h-3.5 text-teal-400" />
                    </button>
                    
                    {onDialScheduledCall && (
                      <button
                        onClick={() => onDialScheduledCall(call)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-md transition cursor-pointer"
                        title="Launch direct dialer in Call Studio for this scheduled appointment"
                      >
                        <PhoneCall className="w-3 h-3 fill-slate-950" />
                        <span>Dial Now</span>
                      </button>
                    )}

                    <button
                      onClick={() => onDeleteTask(call.id)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                      title="Cancel / Delete Scheduled Call"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filter Chips for All Reminders */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: 'All', label: 'All Items', count: tasks.length },
          { key: 'Scheduled Calls', label: 'Scheduled Calls', count: scheduledCalls.length, isCall: true },
          { key: 'Active', label: 'Active', count: tasks.filter(t => !t.completed).length },
          { key: 'Urgent', label: 'Urgent', count: urgentCount, color: 'rose' },
          { key: 'High', label: 'High', count: highCount, color: 'amber' },
          { key: 'Medium', label: 'Medium', count: mediumCount, color: 'sky' },
          { key: 'Low', label: 'Low', count: lowCount, color: 'emerald' },
          { key: 'Completed', label: 'Completed', count: tasks.filter(t => t.completed).length }
        ].map((item) => {
          const isSelected = filterCategory === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setFilterCategory(item.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                isSelected
                  ? item.color === 'rose'
                    ? 'bg-rose-500 text-slate-950 font-bold shadow-md shadow-rose-500/20'
                    : item.color === 'amber'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                    : item.color === 'sky'
                    ? 'bg-sky-500 text-slate-950 font-bold shadow-md shadow-sky-500/20'
                    : item.color === 'emerald'
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                    : 'bg-amber-500 text-slate-950 font-bold shadow-md'
                  : isDark 
                    ? 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800' 
                    : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-sm'
              }`}
            >
              {item.color === 'rose' && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-slate-950' : 'bg-rose-400'}`} />}
              {item.color === 'amber' && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-slate-950' : 'bg-amber-400'}`} />}
              {item.color === 'sky' && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-slate-950' : 'bg-sky-400'}`} />}
              {item.color === 'emerald' && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-slate-950' : 'bg-emerald-400'}`} />}
              <span>{item.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                isSelected 
                  ? 'bg-slate-950/20 text-slate-950' 
                  : isDark 
                    ? 'bg-slate-800 text-slate-400' 
                    : 'bg-slate-100 text-slate-600'
              }`}>
                {item.count}
              </span>
            </button>
          );
        })}
        <span className="text-xs text-slate-500 font-mono ml-auto">
          Showing {filteredTasks.length} of {tasks.length}
        </span>
      </div>

      {/* Full Task & Action Item List */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className={`p-12 text-center rounded-2xl border text-xs ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-500' : 'bg-white border-slate-200 text-slate-600'
          }`}>
            <Info className="w-8 h-8 mx-auto text-slate-500 mb-2" />
            <p className={`font-semibold ${isDark ? 'text-slate-400' : 'text-slate-800'}`}>No action items found for "{filterCategory}".</p>
            <p className="mt-1 text-[11px]">All tasks in this filter view have been handled or cleared.</p>
          </div>
        ) : (
          filteredTasks.map((t) => {
            const isCall = t.isScheduledCall || t.category === 'Phone Call';
            
            // Priority-specific card borders and subtle glow
            const priorityCardStyle = () => {
              if (t.completed) {
                return isDark 
                  ? 'bg-slate-950/40 border-slate-800/80 opacity-60 border-l-2 border-l-slate-700' 
                  : 'bg-slate-50 border-slate-200 opacity-60 border-l-2 border-l-slate-400';
              }
              if (isCall) {
                return isDark 
                  ? 'bg-gradient-to-r from-slate-900 via-amber-950/15 to-slate-900 border-amber-500/40 shadow-sm border-l-4 border-l-amber-500' 
                  : 'bg-white border-amber-300 shadow-sm border-l-4 border-l-amber-500';
              }
              
              switch (t.priority) {
                case 'Urgent':
                  return isDark 
                    ? 'bg-gradient-to-r from-rose-950/20 via-slate-900 to-slate-900 border-rose-500/50 shadow-lg shadow-rose-950/20 border-l-4 border-l-rose-500' 
                    : 'bg-rose-50/40 border-rose-200 shadow-sm border-l-4 border-l-rose-500';
                case 'High':
                  return isDark 
                    ? 'bg-slate-900/95 border-amber-500/30 hover:border-amber-500/50 border-l-4 border-l-amber-500' 
                    : 'bg-amber-50/30 border-amber-200 hover:border-amber-300 shadow-sm border-l-4 border-l-amber-500';
                case 'Medium':
                  return isDark 
                    ? 'bg-slate-900 border-slate-800 hover:border-slate-700 border-l-4 border-l-sky-500' 
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm border-l-4 border-l-sky-500';
                case 'Low':
                default:
                  return isDark 
                    ? 'bg-slate-900 border-slate-800 hover:border-slate-700 border-l-4 border-l-emerald-500' 
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm border-l-4 border-l-emerald-500';
              }
            };

            return (
              <div
                key={t.id}
                className={`p-4 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${priorityCardStyle()}`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={t.completed}
                    onChange={() => onToggleTask(t.id)}
                    className="mt-1 w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
                  />
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {isCall && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 text-[10px] font-mono font-bold uppercase tracking-wide border border-amber-500/30">
                          <PhoneCall className="w-2.5 h-2.5" />
                          Scheduled Call
                        </span>
                      )}
                      
                      {/* Color-coded priority badge displayed prominently */}
                      <PriorityBadge priority={t.priority} size="sm" />

                      <span className={`text-xs sm:text-sm font-semibold ${
                        t.completed 
                          ? 'line-through text-slate-400' 
                          : isDark ? 'text-white' : 'text-slate-900'
                      }`}>
                        {t.task}
                      </span>
                    </div>

                    {t.practiceName && (
                      <div className="text-[11px] text-teal-600 dark:text-teal-400 mt-0.5 font-medium flex items-center gap-2 flex-wrap">
                        <span>Practice: {t.practiceName}</span>
                        {t.doctorName && <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>• Contact: {t.doctorName}</span>}
                        {t.phone && <span className="text-emerald-600 dark:text-emerald-400 font-mono font-semibold">• {t.phone}</span>}
                      </div>
                    )}

                    <div className={`flex flex-wrap items-center gap-2 mt-2 font-mono text-[10px] ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded border ${
                        isDark ? 'bg-slate-950/80 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                      }`}>
                        <Clock className="w-3 h-3 text-slate-400" />
                        Due / Scheduled: <strong className={isDark ? 'text-amber-300 ml-1' : 'text-amber-700 ml-1'}>{t.due}</strong>
                      </span>
                      <span className={`px-2 py-0.5 rounded border ${
                        isDark ? 'bg-slate-800 text-slate-300 border-slate-700/60' : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {t.category}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {isCall && onDialScheduledCall && (
                    <button
                      onClick={() => onDialScheduledCall(t)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-sm transition cursor-pointer"
                      title="Launch Call Studio"
                    >
                      <PhoneCall className="w-3 h-3 fill-slate-950" />
                      <span>Dial</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleDraftEmail(t)}
                    className={`p-2 rounded-lg text-xs transition cursor-pointer border ${
                      isDark 
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' 
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-sm'
                    }`}
                    title="Draft Pre-Filled Follow-up Email"
                  >
                    <Mail className="w-3.5 h-3.5 text-teal-500 dark:text-teal-400" />
                  </button>
                  <button
                    onClick={() => onDeleteTask(t.id)}
                    className={`p-2 rounded-lg text-xs transition cursor-pointer border ${
                      isDark 
                        ? 'bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-400 border-slate-700' 
                        : 'bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 border-slate-200 shadow-sm'
                    }`}
                    title="Delete Reminder"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  )}

      {/* Add Task / Schedule Call Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <form 
            onSubmit={handleCreateTask}
            className={`w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4 border transition-all duration-300 ${
              isDark 
                ? 'glass-modal border-white/15 text-slate-100' 
                : 'bg-white/95 border-slate-200 text-slate-900 shadow-[0_25px_70px_rgba(15,23,42,0.18)]'
            }`}
          >
            <div className={`flex items-center justify-between pb-3 border-b ${
              isDark ? 'border-white/10' : 'border-slate-200'
            }`}>
              <h3 className={`text-base font-bold flex items-center gap-2 ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                {isScheduledCallOption ? <CalendarPlus className="w-5 h-5 text-amber-400" /> : <Plus className="w-5 h-5 text-amber-500" />}
                <span>{isScheduledCallOption ? 'Schedule Follow-Up Call' : 'Add Action Item / To-Do'}</span>
              </h3>
              <button 
                type="button"
                onClick={() => setShowAddModal(false)}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                ✕
              </button>
            </div>

            {/* Toggle between Scheduled Call vs General Task */}
            <div className={`flex rounded-xl p-1 border text-xs ${
              isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                type="button"
                onClick={() => {
                  setIsScheduledCallOption(true);
                  setNewTaskCategory('Phone Call');
                }}
                className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  isScheduledCallOption
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Scheduled Call</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsScheduledCallOption(false);
                  setNewTaskCategory('Audit Proposal');
                }}
                className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  !isScheduledCallOption
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>General Action Item</span>
              </button>
            </div>

            <div>
              <label className={`text-xs block mb-1 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                {isScheduledCallOption ? 'Call Title / Subject:' : 'Task Description:'}
              </label>
              <input
                type="text"
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                placeholder={isScheduledCallOption ? 'e.g. Scheduled Call: Dr. Vance - 50-Claim Audit Results' : 'e.g. Send 50-claim free audit agreement to practice admin'}
                className={`w-full rounded-xl px-3.5 py-2.5 text-xs transition border focus:outline-none focus:ring-2 focus:ring-amber-500/40 ${
                  isDark 
                    ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-500 focus:border-amber-500' 
                    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500 shadow-sm'
                }`}
                required
              />
            </div>

            <div className="space-y-2">
              <div>
                <label className={`text-xs block mb-1 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Scheduled Date & Time (PST):
                </label>
                <input
                  type="text"
                  value={newTaskDue}
                  onChange={(e) => setNewTaskDue(e.target.value)}
                  placeholder="e.g. Tomorrow, 10:00 AM PST"
                  className={`w-full rounded-xl px-3 py-2 text-xs transition border focus:outline-none focus:ring-2 focus:ring-amber-500/40 ${
                    isDark 
                      ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-500 focus:border-amber-500' 
                      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500 shadow-sm'
                  }`}
                  required
                />
              </div>

              {/* Priority Selector with Color-Coded Options */}
              <div>
                <label className={`text-xs block mb-1.5 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Priority Level (Color-Coded):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { value: 'Urgent', label: 'Urgent', sub: 'Immediate', dot: 'bg-rose-400 animate-pulse', border: 'border-rose-500/50', active: isDark ? 'bg-rose-950 border-rose-500 text-rose-200 ring-2 ring-rose-500/30' : 'bg-rose-50 border-rose-400 text-rose-800 ring-2 ring-rose-400/40' },
                    { value: 'High', label: 'High', sub: 'Within 24h', dot: 'bg-amber-400', border: 'border-amber-500/50', active: isDark ? 'bg-amber-950 border-amber-500 text-amber-200 ring-2 ring-amber-500/30' : 'bg-amber-50 border-amber-400 text-amber-800 ring-2 ring-amber-400/40' },
                    { value: 'Medium', label: 'Medium', sub: 'Standard', dot: 'bg-sky-400', border: 'border-sky-500/50', active: isDark ? 'bg-sky-950 border-sky-500 text-sky-200 ring-2 ring-sky-500/30' : 'bg-sky-50 border-sky-400 text-sky-800 ring-2 ring-sky-400/40' },
                    { value: 'Low', label: 'Low', sub: 'Routine', dot: 'bg-emerald-400', border: 'border-emerald-500/50', active: isDark ? 'bg-emerald-950 border-emerald-500 text-emerald-200 ring-2 ring-emerald-500/30' : 'bg-emerald-50 border-emerald-400 text-emerald-800 ring-2 ring-emerald-400/40' }
                  ].map((p) => {
                    const isSelected = newTaskPriority === p.value;
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setNewTaskPriority(p.value as any)}
                        className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                          isSelected 
                            ? p.active 
                            : isDark 
                              ? 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700' 
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`w-2 h-2 rounded-full ${p.dot}`} />
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                        <div className="mt-1">
                          <span className="text-xs font-bold font-mono block">{p.label}</span>
                          <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{p.sub}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {isScheduledCallOption ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={`text-xs block mb-1 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Practice Name:</label>
                    <input
                      type="text"
                      value={newPracticeName}
                      onChange={(e) => setNewPracticeName(e.target.value)}
                      placeholder="e.g. Austin Heart & Vascular"
                      className={`w-full rounded-xl px-3 py-2 text-xs transition border focus:outline-none focus:ring-2 focus:ring-amber-500/40 ${
                        isDark 
                          ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-500 focus:border-amber-500' 
                          : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500 shadow-sm'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`text-xs block mb-1 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Doctor / Contact Name:</label>
                    <input
                      type="text"
                      value={newDoctorName}
                      onChange={(e) => setNewDoctorName(e.target.value)}
                      placeholder="e.g. Dr. Marcus Vance"
                      className={`w-full rounded-xl px-3 py-2 text-xs transition border focus:outline-none focus:ring-2 focus:ring-amber-500/40 ${
                        isDark 
                          ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-500 focus:border-amber-500' 
                          : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500 shadow-sm'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`text-xs block mb-1 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Contact Phone Number:</label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="e.g. (512) 892-4100"
                    className={`w-full rounded-xl px-3 py-2 text-xs font-mono transition border focus:outline-none focus:ring-2 focus:ring-amber-500/40 ${
                      isDark 
                        ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-500 focus:border-amber-500' 
                        : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500 shadow-sm'
                    }`}
                  />
                </div>

                <div>
                  <label className={`text-xs block mb-1 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Agenda / Call Notes:</label>
                  <textarea
                    value={newAgenda}
                    onChange={(e) => setNewAgenda(e.target.value)}
                    placeholder="e.g. Discuss modifier 59 denials and walk through fee schedule options."
                    className={`w-full h-18 rounded-xl p-2.5 text-xs transition border focus:outline-none focus:ring-2 focus:ring-amber-500/40 ${
                      isDark 
                        ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-500 focus:border-amber-500' 
                        : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500 shadow-sm'
                    }`}
                  />
                </div>
              </>
            ) : (
              <div>
                <label className={`text-xs block mb-1 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Category:</label>
                <select
                  value={newTaskCategory}
                  onChange={(e) => setNewTaskCategory(e.target.value as any)}
                  className={`w-full rounded-xl px-3 py-2 text-xs transition border focus:outline-none focus:ring-2 focus:ring-amber-500/40 ${
                    isDark 
                      ? 'bg-slate-950 border-slate-700 text-white focus:border-amber-500' 
                      : 'bg-white border-slate-300 text-slate-900 focus:border-amber-500 shadow-sm'
                  }`}
                >
                  <option value="Audit Proposal">Audit Proposal</option>
                  <option value="Email Followup">Email Followup</option>
                  <option value="EHR Demo">EHR Demo</option>
                  <option value="Contract">Contract</option>
                  <option value="Phone Call">Phone Call</option>
                </select>
              </div>
            )}

            <div className={`pt-3 border-t flex justify-end gap-2 ${
              isDark ? 'border-white/10' : 'border-slate-200'
            }`}>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-xs font-bold shadow-md cursor-pointer transition transform active:scale-98"
              >
                {isScheduledCallOption ? 'Save Scheduled Call' : 'Save To-Do'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
