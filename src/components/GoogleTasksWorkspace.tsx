import React, { useState, useEffect, useCallback } from 'react';
import { 
  CheckSquare, 
  Plus, 
  RefreshCw, 
  Trash2, 
  Calendar, 
  Clock, 
  ExternalLink, 
  Filter, 
  AlertCircle, 
  CheckCircle2, 
  Layers, 
  PhoneCall, 
  Sparkles, 
  FolderPlus, 
  ArrowRight,
  ShieldCheck,
  Check,
  X,
  FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { googleTasksService, GoogleTask, GoogleTaskList } from '../services/googleTasksService';
import { GoogleSignInButton } from './GoogleSignInButton';
import { GoogleWorkspaceConfirmModal, ConfirmDialogState } from './GoogleWorkspaceConfirmModal';
import { ActionItem } from '../types';

interface GoogleTasksWorkspaceProps {
  localTasks?: ActionItem[];
  onImportToLocal?: (tasks: ActionItem[]) => void;
  onDialCall?: (phone: string, doctorName?: string, practiceName?: string) => void;
}

export const GoogleTasksWorkspace: React.FC<GoogleTasksWorkspaceProps> = ({
  localTasks = [],
  onImportToLocal,
  onDialCall
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { currentUser, googleAccessToken, acquireGoogleTasksToken } = useAuth();

  // State
  const [taskLists, setTaskLists] = useState<GoogleTaskList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [tasks, setTasks] = useState<GoogleTask[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filterState, setFilterState] = useState<'all' | 'needsAction' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // New Task form state
  const [showCreateTask, setShowCreateTask] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newNotes, setNewNotes] = useState<string>('');
  const [newDueDate, setNewDueDate] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // New TaskList form state
  const [showCreateList, setShowCreateList] = useState<boolean>(false);
  const [newListTitle, setNewListTitle] = useState<string>('');

  // Destructive Action Confirmation Modal state (Mandatory per Skill Constitution)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    title: '',
    description: '',
    confirmButtonText: 'Confirm',
    confirmVariant: 'danger',
    onConfirm: () => {},
    onCancel: () => setConfirmDialog(prev => ({ ...prev, isOpen: false })),
    isLoading: false
  });

  // Success toast feedback
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setSyncFeedback(msg);
    setTimeout(() => setSyncFeedback(null), 4000);
  };

  /**
   * Load Task Lists
   */
  const loadTaskLists = useCallback(async (token: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const lists = await googleTasksService.listTaskLists(token);
      setTaskLists(lists);
      if (lists.length > 0 && !selectedListId) {
        // Find default or first
        const defaultList = lists.find(l => l.title.includes('Pulsar')) || lists[0];
        setSelectedListId(defaultList.id);
      }
    } catch (err: any) {
      console.error('Failed to load Google Task lists:', err);
      setError(err?.message || 'Could not load Google Task lists');
    } finally {
      setIsLoading(false);
    }
  }, [selectedListId]);

  /**
   * Load Tasks in the active list
   */
  const loadTasks = useCallback(async (token: string, listId: string) => {
    if (!listId) return;
    try {
      setIsLoading(true);
      setError(null);
      const items = await googleTasksService.listTasks(token, listId, true);
      setTasks(items);
    } catch (err: any) {
      console.error('Failed to load Google Tasks:', err);
      setError(err?.message || 'Could not load tasks from Google Tasks');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize data if token is present
  useEffect(() => {
    if (googleAccessToken) {
      loadTaskLists(googleAccessToken);
    }
  }, [googleAccessToken, loadTaskLists]);

  useEffect(() => {
    if (googleAccessToken && selectedListId) {
      loadTasks(googleAccessToken, selectedListId);
    }
  }, [googleAccessToken, selectedListId, loadTasks]);

  /**
   * Connect / Re-authenticate Google Tasks
   */
  const handleConnectGoogleTasks = async () => {
    try {
      setIsAuthenticating(true);
      setError(null);
      const token = await acquireGoogleTasksToken();
      if (token) {
        showToast('Successfully authenticated with Google Tasks!');
        await loadTaskLists(token);
      }
    } catch (err: any) {
      console.error('OAuth connection error:', err);
      setError(err?.message || 'Failed to authenticate with Google Tasks');
    } finally {
      setIsAuthenticating(false);
    }
  };

  /**
   * Handle Create Task
   */
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleAccessToken || !selectedListId || !newTitle.trim()) return;

    try {
      setIsSubmitting(true);
      let rfcDueDate: string | undefined = undefined;
      if (newDueDate) {
        // Format to ISO 8601 / RFC 3339
        rfcDueDate = new Date(newDueDate).toISOString();
      }

      const created = await googleTasksService.createTask(googleAccessToken, selectedListId, {
        title: newTitle.trim(),
        notes: newNotes.trim() || undefined,
        due: rfcDueDate
      });

      setTasks(prev => [created, ...prev]);
      setNewTitle('');
      setNewNotes('');
      setNewDueDate('');
      setShowCreateTask(false);
      showToast(`Task "${created.title}" created in Google Tasks.`);
    } catch (err: any) {
      console.error('Error creating task:', err);
      setError(err?.message || 'Failed to create task in Google Tasks');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle Create New TaskList
   */
  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleAccessToken || !newListTitle.trim()) return;

    try {
      setIsSubmitting(true);
      const newList = await googleTasksService.createTaskList(googleAccessToken, newListTitle.trim());
      setTaskLists(prev => [...prev, newList]);
      setSelectedListId(newList.id);
      setNewListTitle('');
      setShowCreateList(false);
      showToast(`Task list "${newList.title}" created.`);
    } catch (err: any) {
      console.error('Error creating task list:', err);
      setError(err?.message || 'Failed to create task list');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Toggle task completion status
   */
  const handleToggleTaskStatus = async (task: GoogleTask) => {
    if (!googleAccessToken || !selectedListId) return;
    const isCompleted = task.status === 'completed';
    const nextStatus = isCompleted ? 'needsAction' : 'completed';

    // Optimistic UI update
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: nextStatus } : t));

    try {
      await googleTasksService.toggleTaskStatus(googleAccessToken, selectedListId, task.id, !isCompleted);
      showToast(`Task marked as ${nextStatus === 'completed' ? 'completed' : 'pending'}.`);
    } catch (err: any) {
      console.error('Error toggling task:', err);
      // Revert optimistic update
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status } : t));
      setError(err?.message || 'Failed to update task status');
    }
  };

  /**
   * Request confirmation and delete task
   * MANDATORY: explicit confirmation dialog required for destructive operations
   */
  const promptDeleteTask = (task: GoogleTask) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Google Task?',
      description: `Are you sure you want to permanently delete this task from your Google Tasks account? This operation modifies your Google Workspace data and cannot be undone.`,
      details: [`Task: "${task.title}"`, task.notes ? `Notes: ${task.notes.slice(0, 80)}...` : 'No notes attached'],
      confirmButtonText: 'Delete Task',
      confirmVariant: 'danger',
      isLoading: false,
      onConfirm: async () => {
        if (!googleAccessToken || !selectedListId) return;
        try {
          setConfirmDialog(prev => ({ ...prev, isLoading: true }));
          await googleTasksService.deleteTask(googleAccessToken, selectedListId, task.id);
          setTasks(prev => prev.filter(t => t.id !== task.id));
          setConfirmDialog(prev => ({ ...prev, isOpen: false, isLoading: false }));
          showToast(`Deleted task "${task.title}".`);
        } catch (err: any) {
          console.error('Error deleting task:', err);
          setError(err?.message || 'Failed to delete task');
          setConfirmDialog(prev => ({ ...prev, isLoading: false }));
        }
      },
      onCancel: () => setConfirmDialog(prev => ({ ...prev, isOpen: false }))
    });
  };

  /**
   * Request confirmation and clear completed tasks
   * MANDATORY: explicit confirmation dialog required for destructive operations
   */
  const promptClearCompleted = () => {
    const completedTasks = tasks.filter(t => t.status === 'completed');
    if (completedTasks.length === 0) return;

    setConfirmDialog({
      isOpen: true,
      title: `Clear ${completedTasks.length} Completed Task(s)?`,
      description: `Are you sure you want to permanently clear all completed tasks from the active Google Tasks list? This mutates your Google Workspace data.`,
      details: completedTasks.map(t => t.title),
      confirmButtonText: `Clear ${completedTasks.length} Task(s)`,
      confirmVariant: 'warning',
      isLoading: false,
      onConfirm: async () => {
        if (!googleAccessToken || !selectedListId) return;
        try {
          setConfirmDialog(prev => ({ ...prev, isLoading: true }));
          await googleTasksService.clearCompletedTasks(googleAccessToken, selectedListId);
          setTasks(prev => prev.filter(t => t.status !== 'completed'));
          setConfirmDialog(prev => ({ ...prev, isOpen: false, isLoading: false }));
          showToast(`Cleared ${completedTasks.length} completed tasks.`);
        } catch (err: any) {
          console.error('Error clearing tasks:', err);
          setError(err?.message || 'Failed to clear completed tasks');
          setConfirmDialog(prev => ({ ...prev, isLoading: false }));
        }
      },
      onCancel: () => setConfirmDialog(prev => ({ ...prev, isOpen: false }))
    });
  };

  /**
   * Sync local Pulsar reminders to Google Tasks
   */
  const handleSyncLocalToGoogle = async () => {
    if (!googleAccessToken || !selectedListId) return;
    if (localTasks.length === 0) {
      showToast('No local reminders found to synchronize.');
      return;
    }

    try {
      setIsLoading(true);
      let syncedCount = 0;

      for (const item of localTasks) {
        // Check if task with identical title already exists
        const exists = tasks.some(t => t.title.toLowerCase() === item.task.toLowerCase());
        if (!exists) {
          const notes = [
            item.practiceName ? `Practice: ${item.practiceName}` : '',
            item.doctorName ? `Contact: ${item.doctorName}` : '',
            item.phone ? `Phone: ${item.phone}` : '',
            item.category ? `Category: ${item.category}` : '',
            item.notes ? `Agenda: ${item.notes}` : ''
          ].filter(Boolean).join('\n');

          await googleTasksService.createTask(googleAccessToken, selectedListId, {
            title: item.task,
            notes: notes || undefined
          });
          syncedCount++;
        }
      }

      await loadTasks(googleAccessToken, selectedListId);
      showToast(`Pushed ${syncedCount} new task(s) into Google Tasks.`);
    } catch (err: any) {
      console.error('Sync error:', err);
      setError(err?.message || 'Failed to sync tasks to Google Tasks');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Import Google Tasks into Pulsar local reminders
   */
  const handleImportToLocal = () => {
    if (!onImportToLocal || tasks.length === 0) return;

    const imported: ActionItem[] = tasks.map((gt, idx) => ({
      id: `gt-${gt.id || Date.now()}-${idx}`,
      task: gt.title,
      due: gt.due ? new Date(gt.due).toLocaleDateString() : 'Scheduled via Google Tasks',
      priority: 'High',
      category: 'Phone Call',
      completed: gt.status === 'completed',
      isScheduledCall: true,
      notes: gt.notes || 'Imported from Google Tasks'
    }));

    onImportToLocal(imported);
    showToast(`Imported ${imported.length} tasks into Pulsar local pipeline.`);
  };

  // Filtered tasks
  const filteredTasks = tasks.filter(t => {
    if (filterState === 'needsAction' && t.status === 'completed') return false;
    if (filterState === 'completed' && t.status !== 'completed') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchNotes = t.notes?.toLowerCase().includes(q);
      if (!matchTitle && !matchNotes) return false;
    }
    return true;
  });

  const activeCount = tasks.filter(t => t.status === 'needsAction').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {syncFeedback && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-fade-in shadow-lg">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{syncFeedback}</span>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-[var(--pv-muted)] hover:text-[var(--pv-ink)] text-xs cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Connection & Status Banner */}
      <div className={`p-6 rounded-3xl border glass-elevated transition-colors ${
        isDark ? 'bg-slate-900/60 border-white/[0.08]' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-mono font-semibold tracking-wider text-[var(--pv-accent)]">
              <CheckSquare className="w-4 h-4" />
              <span>GOOGLE WORKSPACE · TASKS API INTEGRATION</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[var(--pv-ink)] font-display tracking-tight flex items-center gap-2.5">
              <span>Google Tasks Cloud Synchronization</span>
              {googleAccessToken && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  OAuth Token Active
                </span>
              )}
            </h2>
            <p className="text-xs text-[var(--pv-muted)] max-w-2xl leading-relaxed">
              Synchronize doctor appointments, follow-up calls, and outreach reminders across your personal Google Tasks, Google Calendar, and mobile devices in real time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!googleAccessToken ? (
              <GoogleSignInButton
                onClick={handleConnectGoogleTasks}
                disabled={isAuthenticating}
                label={isAuthenticating ? 'Connecting Google Tasks...' : 'Connect Google Tasks'}
                className="shadow-lg shadow-violet-500/10 cursor-pointer"
              />
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => selectedListId && loadTasks(googleAccessToken, selectedListId)}
                  disabled={isLoading}
                  className="p-2.5 rounded-xl border border-[var(--pv-border)] hover:border-[var(--pv-accent)] bg-[var(--pv-card-soft)] hover:bg-[var(--pv-mint)] text-[var(--pv-ink)] hover:text-[var(--pv-ink)] transition cursor-pointer"
                  title="Refresh tasks from Google"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[var(--pv-accent)]' : ''}`} />
                </button>

                <button
                  onClick={handleSyncLocalToGoogle}
                  disabled={isLoading || localTasks.length === 0}
                  className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[var(--pv-green)] hover:bg-[var(--pv-accent)] text-white text-xs font-bold shadow-md transition cursor-pointer disabled:opacity-50"
                  title="Push local reminders to Google Tasks"
                >
                  <Sparkles className="w-3.5 h-3.5 text-violet-200" />
                  <span>Push Reminders to Google</span>
                </button>

                {onImportToLocal && (
                  <button
                    onClick={handleImportToLocal}
                    disabled={tasks.length === 0}
                    className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-cyan-500/40 bg-cyan-500/10 hover:bg-[var(--pv-mint)] text-[var(--pv-green)] text-xs font-bold transition cursor-pointer disabled:opacity-50"
                    title="Import Google Tasks into local reminders list"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>Import to Pulsar</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* User Account Details when authenticated */}
        {googleAccessToken && (
          <div className="mt-6 pt-4 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-violet-600/30 border border-violet-500/40 flex items-center justify-center font-bold text-violet-300 text-xs">
                {currentUser?.email ? currentUser.email.charAt(0).toUpperCase() : 'G'}
              </div>
              <div>
                <span className="text-[var(--pv-muted)]">Authenticated Account: </span>
                <span className="font-semibold text-[var(--pv-ink)]">{currentUser?.email || 'Not signed in'}</span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-[var(--pv-muted)] font-mono text-[11px]">
              <div>
                Active: <span className="text-[var(--pv-accent)] font-bold">{activeCount}</span>
              </div>
              <div>
                Completed: <span className="text-emerald-400 font-bold">{completedCount}</span>
              </div>
              <div>
                Total: <span className="text-[var(--pv-ink)] font-bold">{tasks.length}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* When Not Authenticated: Feature Showcase */}
      {!googleAccessToken && (
        <div className={`p-8 rounded-3xl border glass-base text-center space-y-4 ${
          isDark ? 'bg-slate-900/40 border-white/[0.05]' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto text-[var(--pv-accent)]">
            <CheckSquare className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-[var(--pv-ink)]">Connect Your Google Workspace Account</h3>
          <p className="text-xs text-[var(--pv-muted)] max-w-lg mx-auto">
            Authorize Google Tasks to enable two-way synchronization between Pulsar CRM action items and your Google Tasks account with permission from the app's users.
          </p>
          <div className="pt-2">
            <GoogleSignInButton
              onClick={handleConnectGoogleTasks}
              disabled={isAuthenticating}
              label={isAuthenticating ? 'Connecting Google Tasks...' : 'Connect Google Tasks with Google'}
            />
          </div>
        </div>
      )}

      {/* When Authenticated: Controls & Task Lists */}
      {googleAccessToken && (
        <>
          {/* List Selector & Filter Controls */}
          <div className={`p-4 rounded-2xl border glass-base flex flex-col md:flex-row md:items-center justify-between gap-4 ${
            isDark ? 'bg-slate-900/40 border-white/[0.08]' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex flex-wrap items-center gap-3">
              {/* TaskList Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--pv-muted)] font-mono">List:</span>
                <select
                  value={selectedListId}
                  onChange={(e) => setSelectedListId(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-[var(--pv-border)] bg-[var(--pv-card-soft)] text-[var(--pv-ink)] text-xs font-semibold focus:outline-none focus:border-[var(--pv-accent)] cursor-pointer"
                >
                  {taskLists.map(list => (
                    <option key={list.id} value={list.id}>
                      {list.title}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setShowCreateList(true)}
                  className="p-1.5 rounded-lg border border-[var(--pv-border)] hover:border-[var(--pv-accent)] bg-[var(--pv-card-soft)] hover:bg-[var(--pv-mint)] text-[var(--pv-ink)] hover:text-[var(--pv-ink)] transition cursor-pointer"
                  title="Create new Google Task list"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Status Filter */}
              <div className="flex items-center bg-[var(--pv-card-soft)] p-1 rounded-xl border border-white/5 text-xs font-semibold">
                <button
                  onClick={() => setFilterState('all')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    filterState === 'all' ? 'bg-[var(--pv-mint)] text-[var(--pv-green)] font-bold' : 'text-[var(--pv-muted)] hover:text-[var(--pv-ink)]'
                  }`}
                >
                  All ({tasks.length})
                </button>
                <button
                  onClick={() => setFilterState('needsAction')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    filterState === 'needsAction' ? 'bg-[var(--pv-mint)] text-[var(--pv-green)] font-bold' : 'text-[var(--pv-muted)] hover:text-[var(--pv-ink)]'
                  }`}
                >
                  Pending ({activeCount})
                </button>
                <button
                  onClick={() => setFilterState('completed')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    filterState === 'completed' ? 'bg-[var(--pv-mint)] text-[var(--pv-green)] font-bold' : 'text-[var(--pv-muted)] hover:text-[var(--pv-ink)]'
                  }`}
                >
                  Completed ({completedCount})
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Search */}
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-[var(--pv-border)] bg-[var(--pv-card-soft)] text-[var(--pv-ink)] placeholder-[var(--pv-muted)] text-xs focus:outline-none focus:border-[var(--pv-accent)] w-44"
              />

              {/* Add Task Button */}
              <button
                onClick={() => setShowCreateTask(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[var(--pv-green)] hover:bg-[var(--pv-accent)] text-white text-xs font-bold shadow-md transition cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Task</span>
              </button>

              {/* Clear Completed Tasks */}
              {completedCount > 0 && (
                <button
                  onClick={promptClearCompleted}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-medium transition cursor-pointer shrink-0"
                  title="Clear all completed tasks"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Completed</span>
                </button>
              )}
            </div>
          </div>

          {/* Create Task Inline Modal / Drawer */}
          {showCreateTask && (
            <form 
              onSubmit={handleCreateTask}
              className={`p-5 rounded-2xl border glass-elevated space-y-4 animate-fade-in ${
                isDark ? 'bg-slate-900/90 border-cyan-500/30' : 'bg-white border-cyan-500/30 shadow-lg'
              }`}
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-[var(--pv-ink)] flex items-center gap-2">
                  <Plus className="w-4 h-4 text-[var(--pv-accent)]" />
                  <span>Create New Task in Google Tasks</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setShowCreateTask(false)}
                  className="text-[var(--pv-muted)] hover:text-[var(--pv-ink)] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-[var(--pv-muted)]">Task Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Follow-up demo call with Dr. Henderson"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--pv-border)] bg-[var(--pv-card-soft)] text-[var(--pv-ink)] text-xs focus:outline-none focus:border-[var(--pv-accent)]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-[var(--pv-muted)]">Due Date (Optional)</label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--pv-border)] bg-[var(--pv-card-soft)] text-[var(--pv-ink)] text-xs focus:outline-none focus:border-[var(--pv-accent)]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono text-[var(--pv-muted)]">Notes / Agenda / Doctor Contact Details</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Phone: 415-555-0199 | Practice: Bay Area Cardiology | Agenda: Review 98% clean claim recovery proposal"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pv-border)] bg-[var(--pv-card-soft)] text-[var(--pv-ink)] text-xs focus:outline-none focus:border-[var(--pv-accent)]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateTask(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-[var(--pv-border)] text-[var(--pv-ink)] text-xs font-semibold hover:bg-[var(--pv-card-soft)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newTitle.trim()}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-[var(--pv-green)] hover:bg-[var(--pv-accent)] text-white text-xs font-bold transition shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting && <RefreshCw className="w-3 h-3 animate-spin" />}
                  <span>Save to Google Tasks</span>
                </button>
              </div>
            </form>
          )}

          {/* Create Task List Modal */}
          {showCreateList && (
            <form 
              onSubmit={handleCreateList}
              className={`p-4 rounded-2xl border glass-elevated flex items-center gap-3 animate-fade-in ${
                isDark ? 'bg-slate-900/90 border-cyan-500/30' : 'bg-white border-cyan-500/30'
              }`}
            >
              <div className="flex-1">
                <input
                  type="text"
                  required
                  placeholder="New Google Task List Name (e.g. Q4 Executive Outreach)"
                  value={newListTitle}
                  onChange={(e) => setNewListTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pv-border)] bg-[var(--pv-card-soft)] text-[var(--pv-ink)] text-xs focus:outline-none focus:border-[var(--pv-accent)]"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting || !newListTitle.trim()}
                className="px-4 py-2 rounded-xl bg-[var(--pv-green)] hover:bg-[var(--pv-accent)] text-white text-xs font-bold transition cursor-pointer"
              >
                Create List
              </button>
              <button
                type="button"
                onClick={() => setShowCreateList(false)}
                className="p-2 text-[var(--pv-muted)] hover:text-[var(--pv-ink)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Tasks List */}
          <div className="space-y-2.5">
            {isLoading && tasks.length === 0 ? (
              <div className="p-12 text-center text-[var(--pv-muted)] text-xs space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin text-[var(--pv-accent)] mx-auto" />
                <p>Loading tasks from Google Tasks...</p>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className={`p-10 rounded-2xl border glass-base text-center space-y-2 ${
                isDark ? 'bg-slate-900/30 border-white/[0.05]' : 'bg-slate-50 border-slate-200'
              }`}>
                <CheckSquare className="w-8 h-8 text-[var(--pv-muted)] mx-auto" />
                <p className="text-sm font-semibold text-[var(--pv-ink)]">No tasks found</p>
                <p className="text-xs text-[var(--pv-muted)]">
                  {searchQuery ? 'No tasks match your search query.' : 'This Google Task list is currently empty. Click "New Task" or push Pulsar reminders.'}
                </p>
              </div>
            ) : (
              filteredTasks.map((task) => {
                const isCompleted = task.status === 'completed';
                // Detect phone number in notes or title for instant click-to-dial
                const phoneMatch = task.notes?.match(/(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
                const detectedPhone = phoneMatch ? phoneMatch[0] : null;

                return (
                  <div
                    key={task.id}
                    className={`p-4 rounded-2xl border glass-standard transition-all group flex items-start justify-between gap-4 ${
                      isCompleted 
                        ? 'opacity-60 bg-[var(--pv-card-soft)] border-white/[0.03]' 
                        : 'hover:border-[var(--pv-accent)] bg-slate-900/40 border-white/[0.08]'
                    }`}
                  >
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      {/* Completion Checkbox */}
                      <button
                        onClick={() => handleToggleTaskStatus(task)}
                        className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 transition cursor-pointer ${
                          isCompleted
                            ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                            : 'border-slate-500/60 hover:border-cyan-400 bg-[var(--pv-card-soft)]'
                        }`}
                        title={isCompleted ? 'Mark as pending' : 'Mark as completed'}
                      >
                        {isCompleted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </button>

                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-sm font-semibold tracking-tight ${
                            isCompleted ? 'line-through text-[var(--pv-muted)]' : 'text-[var(--pv-ink)]'
                          }`}>
                            {task.title}
                          </span>

                          {task.due && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-cyan-500/10 text-[var(--pv-accent)] border border-cyan-500/20">
                              <Calendar className="w-3 h-3" />
                              <span>{new Date(task.due).toLocaleDateString()}</span>
                            </span>
                          )}

                          {isCompleted && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                              Completed
                            </span>
                          )}
                        </div>

                        {task.notes && (
                          <p className="text-xs text-[var(--pv-muted)] whitespace-pre-line leading-relaxed font-sans line-clamp-2">
                            {task.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {detectedPhone && onDialCall && (
                        <button
                          onClick={() => onDialCall(detectedPhone, task.title)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition cursor-pointer"
                          title={`Dial detected phone: ${detectedPhone}`}
                        >
                          <PhoneCall className="w-3 h-3" />
                          <span>Call</span>
                        </button>
                      )}

                      <button
                        onClick={() => promptDeleteTask(task)}
                        className="p-1.5 rounded-lg text-[var(--pv-muted)] hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer opacity-70 group-hover:opacity-100"
                        title="Delete from Google Tasks"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Mandatory Destructive Action Confirmation Modal */}
      <GoogleWorkspaceConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        description={confirmDialog.description}
        details={confirmDialog.details}
        confirmButtonText={confirmDialog.confirmButtonText}
        confirmVariant={confirmDialog.confirmVariant}
        isLoading={confirmDialog.isLoading}
        onConfirm={confirmDialog.onConfirm}
        onCancel={confirmDialog.onCancel}
      />
    </div>
  );
};
