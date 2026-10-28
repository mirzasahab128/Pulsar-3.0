/**
 * Phase 7.4 - Owner dashboard (Phoenix line).
 *
 * Pure module: no store, no network, no sending, no calling. It builds
 * the owner view on top of the Phase 7.3 pipeline, tasks, drafts, and
 * owner summaries, and it applies owner actions that are reversible
 * and logged by the caller. Marking a lead won or lost stops its
 * automatic follow-ups by cancelling its pending tasks, exactly as a
 * Phase 7.3 opt-out does. Drafts stay drafts here: this module never
 * sends anything, and it never changes consent or gate state.
 *
 * No revenue or ROI figure is invented: the dashboard shows counts
 * and lead details only. An owner-entered value is only ever shown
 * when the caller passes one in, labelled as owner entered.
 *
 * Stuck means an active lead (not won, lost, or opted out) that has
 * no pending follow-up task, or whose earliest pending task is
 * already past its due time at the dashboard time given. Hot means
 * a lead in the interested stage. Handed over means transferred to
 * the owner. Waiting means a callback is booked.
 *
 * Pulsar is general, for all businesses and industries. Nothing in
 * this module is industry specific.
 */

import type { DraftMessage, FollowUpTask, OwnerSummary, PipelineStage } from './afterCall.js';
import { cancelScheduledFollowUps } from './afterCall.js';

export type OwnerActionKind =
  | 'mark_won'
  | 'mark_lost'
  | 'reopen'
  | 'snooze'
  | 'unsnooze'
  | 'confirm_next_step';

export interface OwnerAction {
  id: string;
  contactId: string;
  kind: OwnerActionKind;
  previousStage: PipelineStage | null;
  newStage: PipelineStage | null;
  taskId: string | null;
  previousDueAt: string | null;
  newDueAt: string | null;
  previousNextAction: string | null;
  newNextAction: string | null;
  cancelledTaskIds: string[];
  reason: string;
  reversed: boolean;
  reversedBy: string | null;
  createdAt: string;
}

export interface OwnerLeadView {
  contactId: string;
  stage: PipelineStage;
  contactName: string | null;
  businessName: string | null;
  painPoint: string | null;
  proofOffered: string | null;
  agreed: string | null;
  nextAction: string | null;
  pendingTasks: FollowUpTask[];
  drafts: DraftMessage[];
  /** Owner entered value, if any. Never invented by this module. */
  ownerValue: string | null;
}

export interface DashboardCounts {
  handedOver: number;
  hot: number;
  waitingCallback: number;
  stuck: number;
  won: number;
  lost: number;
  optedOut: number;
  active: number;
  total: number;
}

export interface OwnerDashboard {
  counts: DashboardCounts;
  handedOver: OwnerLeadView[];
  hot: OwnerLeadView[];
  waitingCallback: OwnerLeadView[];
  stuck: OwnerLeadView[];
  won: OwnerLeadView[];
  lost: OwnerLeadView[];
  optedOut: OwnerLeadView[];
  all: OwnerLeadView[];
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isActiveStage(stage: PipelineStage): boolean {
  return stage !== 'closed_won' && stage !== 'closed_lost' && stage !== 'opted_out';
}

export function buildOwnerDashboard(input: {
  pipeline: Record<string, PipelineStage>;
  tasks: FollowUpTask[];
  drafts: DraftMessage[];
  ownerSummaries: OwnerSummary[];
  ownerValues?: Record<string, string>;
  now?: string;
}): OwnerDashboard {
  const now = input.now || new Date().toISOString();
  const nowMs = new Date(now).getTime();
  const summaries = new Map(input.ownerSummaries.map(s => [s.contactId, s]));
  const all: OwnerLeadView[] = Object.entries(input.pipeline).map(([contactId, stage]) => {
    const summary = summaries.get(contactId) || null;
    const pendingTasks = input.tasks.filter(t => t.contactId === contactId && t.status === 'pending');
    return {
      contactId,
      stage,
      contactName: summary ? summary.contactName : null,
      businessName: summary ? summary.businessName : null,
      painPoint: summary ? summary.painPoint : null,
      proofOffered: summary ? summary.proofOffered : null,
      agreed: summary ? summary.agreed : null,
      nextAction: summary ? summary.nextAction : null,
      pendingTasks,
      drafts: input.drafts.filter(d => d.contactId === contactId && d.status === 'draft' && d.sent === false),
      ownerValue: input.ownerValues ? input.ownerValues[contactId] || null : null
    };
  });
  const byStage = (stage: PipelineStage): OwnerLeadView[] => all.filter(l => l.stage === stage);
  const stuck = all.filter(lead => {
    if (!isActiveStage(lead.stage)) return false;
    if (lead.pendingTasks.length === 0) return true;
    return lead.pendingTasks.some(t => {
      const due = new Date(t.dueAt).getTime();
      return !Number.isNaN(due) && due < nowMs;
    });
  });
  const counts: DashboardCounts = {
    handedOver: byStage('transferred_to_owner').length,
    hot: byStage('interested').length,
    waitingCallback: byStage('callback_booked').length,
    stuck: stuck.length,
    won: byStage('closed_won').length,
    lost: byStage('closed_lost').length,
    optedOut: byStage('opted_out').length,
    active: all.filter(l => isActiveStage(l.stage)).length,
    total: all.length
  };
  return {
    counts,
    handedOver: byStage('transferred_to_owner'),
    hot: byStage('interested'),
    waitingCallback: byStage('callback_booked'),
    stuck,
    won: byStage('closed_won'),
    lost: byStage('closed_lost'),
    optedOut: byStage('opted_out'),
    all
  };
}

/**
 * Mark a lead won or lost. Its pending follow-up tasks are cancelled,
 * so automatic follow-up stops for that lead, and the previous stage
 * plus the cancelled task ids are recorded on the action so the owner
 * can reopen it later. Only this contact is touched.
 */
export function markLeadOutcome(input: {
  pipeline: Record<string, PipelineStage>;
  tasks: FollowUpTask[];
  contactId: string;
  outcome: 'closed_won' | 'closed_lost';
  reason?: string;
  now?: string;
}): { stage: PipelineStage; followUpsCancelled: number; action: OwnerAction; auditEvent: string } {
  const now = input.now || new Date().toISOString();
  const previousStage = input.pipeline[input.contactId] || null;
  const pendingBefore = input.tasks.filter(t => t.contactId === input.contactId && t.status === 'pending');
  const { count } = cancelScheduledFollowUps(input.tasks, input.contactId);
  input.pipeline[input.contactId] = input.outcome;
  const action: OwnerAction = {
    id: newId('owner-action'),
    contactId: input.contactId,
    kind: input.outcome === 'closed_won' ? 'mark_won' : 'mark_lost',
    previousStage,
    newStage: input.outcome,
    taskId: null,
    previousDueAt: null,
    newDueAt: null,
    previousNextAction: null,
    newNextAction: null,
    cancelledTaskIds: pendingBefore.map(t => t.id),
    reason: input.reason || '',
    reversed: false,
    reversedBy: null,
    createdAt: now
  };
  return {
    stage: input.outcome,
    followUpsCancelled: count,
    action,
    auditEvent: `owner_action contact=${input.contactId} action=${action.kind} previous_stage=${previousStage || 'none'} follow_ups_cancelled=${count} reason=${input.reason || ''}`
  };
}

/**
 * Reverse a mark_won or mark_lost action: restore the previous stage
 * and return its cancelled tasks to pending. An already reversed
 * action, or an action of another kind, is left alone.
 */
export function reopenLead(input: {
  pipeline: Record<string, PipelineStage>;
  tasks: FollowUpTask[];
  action: OwnerAction;
  now?: string;
}): { restored: boolean; stage: PipelineStage | null; tasksRestored: number; reversal: OwnerAction | null } {
  const now = input.now || new Date().toISOString();
  if (input.action.reversed) return { restored: false, stage: null, tasksRestored: 0, reversal: null };
  if (input.action.kind !== 'mark_won' && input.action.kind !== 'mark_lost') {
    return { restored: false, stage: null, tasksRestored: 0, reversal: null };
  }
  const previousStage = input.action.previousStage;
  if (previousStage) input.pipeline[input.action.contactId] = previousStage;
  let tasksRestored = 0;
  for (const task of input.tasks) {
    if (input.action.cancelledTaskIds.includes(task.id) && task.status === 'cancelled') {
      task.status = 'pending';
      tasksRestored += 1;
    }
  }
  input.action.reversed = true;
  const reversal: OwnerAction = {
    id: newId('owner-action'),
    contactId: input.action.contactId,
    kind: 'reopen',
    previousStage: input.action.newStage,
    newStage: previousStage,
    taskId: null,
    previousDueAt: null,
    newDueAt: null,
    previousNextAction: null,
    newNextAction: null,
    cancelledTaskIds: [],
    reason: 'reopened by owner',
    reversed: false,
    reversedBy: null,
    createdAt: now
  };
  input.action.reversedBy = reversal.id;
  return { restored: true, stage: previousStage, tasksRestored, reversal };
}

/**
 * Move one follow-up task to a new due time. The old due time is
 * recorded on the action so the snooze can be undone.
 */
export function snoozeFollowUp(input: {
  tasks: FollowUpTask[];
  taskId: string;
  newDueAt: string;
  reason?: string;
  now?: string;
}): { snoozed: boolean; action: OwnerAction | null } {
  const now = input.now || new Date().toISOString();
  const task = input.tasks.find(t => t.id === input.taskId);
  if (!task || task.status !== 'pending') return { snoozed: false, action: null };
  const previousDueAt = task.dueAt;
  task.dueAt = input.newDueAt;
  return {
    snoozed: true,
    action: {
      id: newId('owner-action'),
      contactId: task.contactId,
      kind: 'snooze',
      previousStage: null,
      newStage: null,
      taskId: task.id,
      previousDueAt,
      newDueAt: input.newDueAt,
      previousNextAction: null,
      newNextAction: null,
      cancelledTaskIds: [],
      reason: input.reason || '',
      reversed: false,
      reversedBy: null,
      createdAt: now
    }
  };
}

/** Undo a snooze: restore the task due time recorded on the action. */
export function unsnoozeFollowUp(input: {
  tasks: FollowUpTask[];
  action: OwnerAction;
  now?: string;
}): { restored: boolean; reversal: OwnerAction | null } {
  const now = input.now || new Date().toISOString();
  if (input.action.reversed || input.action.kind !== 'snooze' || !input.action.taskId || !input.action.previousDueAt) {
    return { restored: false, reversal: null };
  }
  const task = input.tasks.find(t => t.id === input.action.taskId);
  if (!task) return { restored: false, reversal: null };
  task.dueAt = input.action.previousDueAt;
  input.action.reversed = true;
  const reversal: OwnerAction = {
    id: newId('owner-action'),
    contactId: input.action.contactId,
    kind: 'unsnooze',
    previousStage: null,
    newStage: null,
    taskId: task.id,
    previousDueAt: input.action.newDueAt,
    newDueAt: input.action.previousDueAt,
    previousNextAction: null,
    newNextAction: null,
    cancelledTaskIds: [],
    reason: 'snooze undone by owner',
    reversed: false,
    reversedBy: null,
    createdAt: now
  };
  input.action.reversedBy = reversal.id;
  return { restored: true, reversal };
}

/**
 * Confirm or replace the next step on an owner summary. The old next
 * step is recorded on the action so the change is visible in the log.
 * Returns false when the contact has no owner summary yet.
 */
export function confirmNextStep(input: {
  ownerSummaries: OwnerSummary[];
  contactId: string;
  nextStep: string;
  reason?: string;
  now?: string;
}): { confirmed: boolean; action: OwnerAction | null } {
  const now = input.now || new Date().toISOString();
  const summary = input.ownerSummaries.find(s => s.contactId === input.contactId);
  if (!summary) return { confirmed: false, action: null };
  const previousNextAction = summary.nextAction;
  summary.nextAction = input.nextStep;
  return {
    confirmed: true,
    action: {
      id: newId('owner-action'),
      contactId: input.contactId,
      kind: 'confirm_next_step',
      previousStage: null,
      newStage: null,
      taskId: null,
      previousDueAt: null,
      newDueAt: null,
      previousNextAction,
      newNextAction: input.nextStep,
      cancelledTaskIds: [],
      reason: input.reason || '',
      reversed: false,
      reversedBy: null,
      createdAt: now
    }
  };
}
