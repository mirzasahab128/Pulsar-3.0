// Phase 7.3 battery: after-call automation, pipeline, drafts, and
// universal suppression. Test fixtures only: no real phone numbers,
// emails, calls, keys, sending, or external services are used.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const afterCall = await import('../server/afterCall.js');
const {
  applyOptOut,
  cancelScheduledFollowUps,
  formatOwnerSummary,
  processAfterCall
} = afterCall;

const NOW = '2026-10-28T00:00:00.000Z';

function note(overrides: Record<string, any> = {}): any {
  return {
    contactId: 'contact-1',
    outcome: 'transferred',
    nextStep: 'Owner takes the live call and closes.',
    transferSummary: 'Live transfer to Sam. Prospect showed interest.',
    callbackAt: null,
    agreed: null,
    ...overrides
  };
}

function brief(overrides: Record<string, any> = {}): any {
  return {
    contactName: 'Alex',
    businessName: 'DemoFix Home Services',
    callingCompany: 'Pulsar Demo Company',
    painPoint: 'slow booking follow-up',
    proofOffer: 'a booking page draft',
    ownerName: 'Sam',
    ...overrides
  };
}

function pendingTask(id: string): any {
  return {
    id,
    contactId: 'contact-1',
    kind: 'nurture_check',
    title: 'Check in',
    dueAt: '2026-11-04T00:00:00.000Z',
    status: 'pending',
    createdFrom: 'ended',
    createdAt: NOW
  };
}

describe('after-call pipeline decisions', () => {
  it('moves an interested transferred lead to transferred_to_owner with an owner summary', () => {
    const result = processAfterCall({ note: note(), brief: brief(), suppressions: [], now: NOW });
    assert.equal(result.stage, 'transferred_to_owner');
    assert.ok(result.ownerSummary);
    assert.equal(result.ownerSummary.contactName, 'Alex');
    assert.equal(result.ownerSummary.businessName, 'DemoFix Home Services');
    assert.equal(result.ownerSummary.painPoint, 'slow booking follow-up');
    assert.equal(result.ownerSummary.proofOffered, 'a booking page draft');
    assert.equal(result.tasks.length, 1);
    assert.equal(result.tasks[0].kind, 'owner_follow_up');
    assert.equal(result.tasks[0].status, 'pending');
    assert.equal(result.drafts.length, 0);
    assert.equal(result.suppressed, false);
    const text = formatOwnerSummary(result.ownerSummary);
    assert.match(text, /Alex/);
    assert.match(text, /DemoFix Home Services/);
    assert.match(text, /slow booking follow-up/);
    assert.match(text, /a booking page draft/);
    assert.match(text, /Sam/);
  });

  it('moves a not_interested lead to opted_out, cancels pending follow-ups, and creates no draft', () => {
    const tasks = [pendingTask('task-1'), pendingTask('task-2')];
    const result = processAfterCall({
      note: note({ outcome: 'not_interested', nextStep: 'Record the opt-out.' }),
      brief: brief(),
      suppressions: [],
      existingTasks: tasks,
      now: NOW
    });
    assert.equal(result.stage, 'opted_out');
    assert.equal(result.suppressed, true);
    assert.equal(result.followUpsCancelled, 2);
    assert.equal(tasks.every(t => t.status === 'cancelled'), true);
    assert.equal(result.tasks.length, 0);
    assert.equal(result.drafts.length, 0);
    assert.equal(result.ownerSummary, null);
  });

  it('gives a callback lead a callback task at the time the prospect gave', () => {
    const result = processAfterCall({
      note: note({ outcome: 'callback_booked', callbackAt: '2026-10-30T15:00:00.000Z' }),
      brief: brief(),
      suppressions: [],
      now: NOW
    });
    assert.equal(result.stage, 'callback_booked');
    assert.equal(result.tasks.length, 1);
    assert.equal(result.tasks[0].kind, 'callback');
    assert.equal(result.tasks[0].dueAt, '2026-10-30T15:00:00.000Z');
    assert.equal(result.tasks[0].status, 'pending');
  });

  it('gives a send-email lead a draft only, never a sent message', () => {
    const result = processAfterCall({
      note: note({ outcome: 'email_requested', nextStep: 'Send the details by email once.' }),
      brief: brief(),
      suppressions: [],
      now: NOW
    });
    assert.equal(result.stage, 'contacted');
    assert.equal(result.drafts.length, 1);
    assert.equal(result.drafts[0].status, 'draft');
    assert.equal(result.drafts[0].sent, false);
    assert.match(result.drafts[0].body, /slow booking follow-up/);
    assert.match(result.drafts[0].body, /opt out/i);
    assert.equal(result.tasks.length, 1);
    assert.equal(result.tasks[0].kind, 'email_draft_review');
  });

  it('stops a scheduled follow-up when an opt-out arrives after a call', () => {
    const tasks = [pendingTask('task-1')];
    const other = { ...pendingTask('task-2'), contactId: 'contact-2' };
    const result = applyOptOut({ contactId: 'contact-1', source: 'email reply', existingTasks: [...tasks, other] });
    assert.equal(result.stage, 'opted_out');
    assert.equal(result.followUpsCancelled, 1);
    assert.equal(tasks[0].status, 'cancelled');
    assert.equal(other.status, 'pending');
    assert.match(result.auditEvent, /channels_stopped=email,voice,sms/);
  });

  it('lets an already suppressed lead override even a transfer outcome', () => {
    const tasks = [pendingTask('task-1')];
    const result = processAfterCall({
      note: note(),
      brief: brief(),
      suppressions: [{ id: 'supp-1', identifierType: 'contact', identifier: 'contact-1', reason: 'opt_out', source: 'test', addedBy: 'test', addedAt: NOW }],
      existingTasks: tasks,
      now: NOW
    });
    assert.equal(result.stage, 'opted_out');
    assert.equal(result.suppressed, true);
    assert.equal(result.followUpsCancelled, 1);
    assert.equal(result.ownerSummary, null);
    assert.equal(result.drafts.length, 0);
  });

  it('gives a blocked call a gate review task and no draft', () => {
    const result = processAfterCall({
      note: note({ outcome: 'blocked', nextStep: 'Do not call.' }),
      brief: brief(),
      suppressions: [],
      now: NOW
    });
    assert.equal(result.stage, 'new');
    assert.equal(result.tasks[0].kind, 'gate_review');
    assert.equal(result.drafts.length, 0);
  });

  it('moves an ended call to nurture with a one-week check', () => {
    const result = processAfterCall({
      note: note({ outcome: 'ended', nextStep: 'Call ended politely.' }),
      brief: brief(),
      suppressions: [],
      now: NOW
    });
    assert.equal(result.stage, 'nurture');
    assert.equal(result.tasks[0].kind, 'nurture_check');
    assert.equal(result.tasks[0].dueAt, '2026-11-04T00:00:00.000Z');
  });

  it('cancels only the opted-out contact follow-ups', () => {
    const mine = pendingTask('task-1');
    const other = { ...pendingTask('task-2'), contactId: 'contact-2' };
    const { count } = cancelScheduledFollowUps([mine, other], 'contact-1');
    assert.equal(count, 1);
    assert.equal(mine.status, 'cancelled');
    assert.equal(other.status, 'pending');
  });

  it('uses no em dash in drafts or owner summaries', () => {
    const result = processAfterCall({
      note: note({ outcome: 'email_requested' }),
      brief: brief(),
      suppressions: [],
      now: NOW
    });
    assert.equal(result.drafts[0].body.includes('\u2014'), false);
    const transferred = processAfterCall({ note: note(), brief: brief(), suppressions: [], now: NOW });
    assert.ok(transferred.ownerSummary);
    assert.equal(formatOwnerSummary(transferred.ownerSummary).includes('\u2014'), false);
  });
});
