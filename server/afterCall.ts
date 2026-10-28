/**
 * Phase 7.3 - After-call automation (Phoenix line).
 *
 * Pure module: no store, no network, no sending. It turns a completed
 * call note (from Phase 7.2) into a pipeline stage, a follow-up task,
 * and, where asked, a follow-up message DRAFT. Drafts are never sent
 * by this module: they carry status "draft" and sent false, and only
 * a human-approved send step outside this module may ever dispatch
 * one. Nothing here invents an outcome, a result, or an ROI figure:
 * every field comes from the call note and brief the caller passes in.
 *
 * Universal suppression: an opt-out from any channel stops all future
 * follow-ups for that lead, across email, voice, and text. A lead that
 * is already suppressed, or whose call outcome is not_interested, is
 * moved to opted_out, its pending follow-up tasks are cancelled, and
 * no draft is produced. A scheduled follow-up is cancelled the same
 * way by cancelScheduledFollowUps, which the server opt-out route and
 * the after-call flow both use.
 *
 * Pulsar is general, for all businesses and industries. Nothing in
 * this module is industry specific. A healthcare practice is one
 * example contact type, not the product.
 */

import type { CallOutcome } from './voiceAgent.js';
import type { SuppressionRecord } from './contactGate.js';

export type PipelineStage =
  | 'new'
  | 'contacted'
  | 'interested'
  | 'transferred_to_owner'
  | 'callback_booked'
  | 'nurture'
  | 'closed_won'
  | 'closed_lost'
  | 'opted_out';

export type FollowUpKind =
  | 'gate_review'
  | 'owner_follow_up'
  | 'callback'
  | 'email_draft_review'
  | 'nurture_check';

export type FollowUpStatus = 'pending' | 'done' | 'cancelled';

export interface FollowUpTask {
  id: string;
  contactId: string;
  kind: FollowUpKind;
  title: string;
  dueAt: string;
  status: FollowUpStatus;
  createdFrom: CallOutcome | 'opt_out';
  createdAt: string;
}

export interface DraftMessage {
  id: string;
  contactId: string;
  channel: 'email' | 'sms';
  subject: string | null;
  body: string;
  status: 'draft';
  sent: false;
  createdAt: string;
}

export interface OwnerSummary {
  contactId: string;
  contactName: string;
  businessName: string;
  painPoint: string;
  proofOffered: string;
  agreed: string | null;
  nextAction: string;
  ownerName: string;
  createdAt: string;
}

export interface CallNoteInput {
  contactId: string;
  outcome: CallOutcome;
  nextStep: string;
  transferSummary: string | null;
  /** Optional callback time the prospect gave, ISO string. */
  callbackAt?: string | null;
  /** Optional text of what was agreed on the call, if anything. */
  agreed?: string | null;
}

export interface CallBriefInput {
  contactName: string;
  businessName: string;
  callingCompany: string;
  painPoint: string;
  proofOffer: string;
  ownerName: string;
}

export interface AfterCallResult {
  stage: PipelineStage;
  tasks: FollowUpTask[];
  drafts: DraftMessage[];
  ownerSummary: OwnerSummary | null;
  suppressed: boolean;
  followUpsCancelled: number;
  auditEvents: string[];
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function addDays(isoNow: string, days: number): string {
  const d = new Date(isoNow);
  if (Number.isNaN(d.getTime())) return isoNow;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function makeTask(
  contactId: string,
  kind: FollowUpKind,
  title: string,
  dueAt: string,
  createdFrom: CallOutcome | 'opt_out',
  now: string
): FollowUpTask {
  return { id: newId('task'), contactId, kind, title, dueAt, status: 'pending', createdFrom, createdAt: now };
}

function emailDraft(
  contactId: string,
  brief: CallBriefInput,
  now: string
): DraftMessage {
  return {
    id: newId('draft'),
    contactId,
    channel: 'email',
    subject: `Following up: ${brief.proofOffer} for ${brief.businessName}`,
    body:
      `Hello ${brief.contactName},\n\n` +
      `Thanks for speaking with us about ${brief.painPoint} at ${brief.businessName}. ` +
      `As requested, here are the details on ${brief.proofOffer}.\n\n` +
      `Reply to this email if you would like to talk further, or reply STOP to opt out and we will not contact you again about this.\n\n` +
      `${brief.callingCompany}`,
    status: 'draft',
    sent: false,
    createdAt: now
  };
}

export function buildOwnerSummary(
  note: CallNoteInput,
  brief: CallBriefInput,
  now: string
): OwnerSummary {
  return {
    contactId: note.contactId,
    contactName: brief.contactName,
    businessName: brief.businessName,
    painPoint: brief.painPoint,
    proofOffered: brief.proofOffer,
    agreed: note.agreed || null,
    nextAction: note.nextStep,
    ownerName: brief.ownerName,
    createdAt: now
  };
}

export function formatOwnerSummary(summary: OwnerSummary): string {
  const lines = [
    `Lead: ${summary.contactName} at ${summary.businessName}`,
    `What they care about: ${summary.painPoint}`,
    `Proof offered: ${summary.proofOffered}`,
    `Agreed on the call: ${summary.agreed || 'Nothing agreed yet.'}`,
    `Next action for ${summary.ownerName}: ${summary.nextAction}`
  ];
  return lines.join('\n');
}

/**
 * Cancel every pending follow-up task for a contact. Drafts are not
 * sent by this module at all, so cancelling tasks is what stops the
 * scheduled follow-up. Returns the cancelled tasks and their count.
 */
export function cancelScheduledFollowUps(
  tasks: FollowUpTask[],
  contactId: string
): { cancelled: FollowUpTask[]; count: number } {
  const cancelled: FollowUpTask[] = [];
  for (const task of tasks) {
    if (task.contactId === contactId && task.status === 'pending') {
      task.status = 'cancelled';
      cancelled.push(task);
    }
  }
  return { cancelled, count: cancelled.length };
}

/**
 * Decide the next step for a completed call. Suppression is checked
 * first: a suppressed lead, or a not_interested outcome, always ends
 * at opted_out with pending follow-ups cancelled and no draft, even
 * if the caller also passed a transfer summary.
 */
export function processAfterCall(input: {
  note: CallNoteInput;
  brief: CallBriefInput;
  suppressions: SuppressionRecord[];
  existingTasks?: FollowUpTask[];
  now?: string;
}): AfterCallResult {
  const now = input.now || new Date().toISOString();
  const { note, brief } = input;
  const alreadySuppressed = input.suppressions.some(
    s => s.identifierType === 'contact' && s.identifier === note.contactId
  );
  const auditEvents: string[] = [];
  let followUpsCancelled = 0;

  if (alreadySuppressed || note.outcome === 'not_interested') {
    if (input.existingTasks) {
      followUpsCancelled = cancelScheduledFollowUps(input.existingTasks, note.contactId).count;
    }
    auditEvents.push(
      `after_call contact=${note.contactId} outcome=${note.outcome} stage=opted_out suppressed=true follow_ups_cancelled=${followUpsCancelled}`
    );
    return {
      stage: 'opted_out',
      tasks: [],
      drafts: [],
      ownerSummary: null,
      suppressed: true,
      followUpsCancelled,
      auditEvents
    };
  }

  switch (note.outcome) {
    case 'transferred': {
      const ownerSummary = buildOwnerSummary(note, brief, now);
      auditEvents.push(`after_call contact=${note.contactId} outcome=transferred stage=transferred_to_owner`);
      return {
        stage: 'transferred_to_owner',
        tasks: [makeTask(note.contactId, 'owner_follow_up', `Follow up with ${brief.businessName} after the live transfer`, addDays(now, 1), 'transferred', now)],
        drafts: [],
        ownerSummary,
        suppressed: false,
        followUpsCancelled: 0,
        auditEvents
      };
    }
    case 'callback_booked': {
      const dueAt = note.callbackAt || addDays(now, 2);
      auditEvents.push(`after_call contact=${note.contactId} outcome=callback_booked stage=callback_booked`);
      return {
        stage: 'callback_booked',
        tasks: [makeTask(note.contactId, 'callback', `Call back ${brief.businessName}`, dueAt, 'callback_booked', now)],
        drafts: [],
        ownerSummary: null,
        suppressed: false,
        followUpsCancelled: 0,
        auditEvents
      };
    }
    case 'email_requested': {
      auditEvents.push(`after_call contact=${note.contactId} outcome=email_requested stage=contacted draft_created=true sent=false`);
      return {
        stage: 'contacted',
        tasks: [makeTask(note.contactId, 'email_draft_review', `Review the follow-up email draft for ${brief.businessName} before sending`, addDays(now, 1), 'email_requested', now)],
        drafts: [emailDraft(note.contactId, brief, now)],
        ownerSummary: null,
        suppressed: false,
        followUpsCancelled: 0,
        auditEvents
      };
    }
    case 'blocked': {
      auditEvents.push(`after_call contact=${note.contactId} outcome=blocked stage=new`);
      return {
        stage: 'new',
        tasks: [makeTask(note.contactId, 'gate_review', `Resolve the gate reason for ${brief.businessName} before any follow-up`, addDays(now, 1), 'blocked', now)],
        drafts: [],
        ownerSummary: null,
        suppressed: false,
        followUpsCancelled: 0,
        auditEvents
      };
    }
    case 'ended':
    default: {
      auditEvents.push(`after_call contact=${note.contactId} outcome=${note.outcome} stage=nurture`);
      return {
        stage: 'nurture',
        tasks: [makeTask(note.contactId, 'nurture_check', `Check in with ${brief.businessName} in one week`, addDays(now, 7), note.outcome, now)],
        drafts: [],
        ownerSummary: null,
        suppressed: false,
        followUpsCancelled: 0,
        auditEvents
      };
    }
  }
}

/**
 * Apply an opt-out from any channel to a lead: cancel its pending
 * follow-up tasks and report what stopped. The caller is responsible
 * for also revoking consent and adding a suppression record through
 * the Phase 7.1 ledger, which is what makes the opt-out stick for
 * future gate checks.
 */
export function applyOptOut(input: {
  contactId: string;
  source: string;
  existingTasks: FollowUpTask[];
}): { stage: PipelineStage; followUpsCancelled: number; auditEvent: string } {
  const { count } = cancelScheduledFollowUps(input.existingTasks, input.contactId);
  return {
    stage: 'opted_out',
    followUpsCancelled: count,
    auditEvent: `opt_out contact=${input.contactId} source=${input.source} follow_ups_cancelled=${count} channels_stopped=email,voice,sms`
  };
}
