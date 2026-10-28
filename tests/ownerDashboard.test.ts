// Phase 7.4 battery: owner dashboard lists, counts, and reversible
// owner actions. Test fixtures only: no real contacts, calls, sending,
// keys, or external services are used.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const dashboard = await import('../server/ownerDashboard.js');
const {
  buildOwnerDashboard,
  confirmNextStep,
  markLeadOutcome,
  reopenLead,
  snoozeFollowUp,
  unsnoozeFollowUp
} = dashboard;

const NOW = '2026-10-28T00:00:00.000Z';

function summary(contactId: string, overrides: Record<string, any> = {}): any {
  return {
    contactId,
    contactName: `Contact ${contactId}`,
    businessName: `Business ${contactId}`,
    painPoint: 'slow follow-up',
    proofOffered: 'a booking page draft',
    agreed: null,
    nextAction: 'Owner follows up.',
    ownerName: 'Sam',
    createdAt: NOW,
    ...overrides
  };
}

function task(id: string, contactId: string, overrides: Record<string, any> = {}): any {
  return {
    id,
    contactId,
    kind: 'owner_follow_up',
    title: `Follow up ${contactId}`,
    dueAt: '2026-10-29T00:00:00.000Z',
    status: 'pending',
    createdFrom: 'transferred',
    createdAt: NOW,
    ...overrides
  };
}

function state(): any {
  return {
    pipeline: {
      'lead-handed': 'transferred_to_owner',
      'lead-hot': 'interested',
      'lead-waiting': 'callback_booked',
      'lead-stuck': 'nurture',
      'lead-opted': 'opted_out'
    },
    tasks: [
      task('task-handed', 'lead-handed'),
      task('task-hot', 'lead-hot'),
      task('task-waiting', 'lead-waiting'),
      task('task-opted', 'lead-opted')
    ],
    drafts: [],
    ownerSummaries: [
      summary('lead-handed'),
      summary('lead-hot'),
      summary('lead-waiting'),
      summary('lead-stuck'),
      summary('lead-opted')
    ]
  };
}

describe('owner dashboard lists and counts', () => {
  it('puts a transferred lead in the handed-over list with its full detail', () => {
    const s = state();
    const view = buildOwnerDashboard({ ...s, now: NOW });
    assert.equal(view.counts.handedOver, 1);
    assert.equal(view.handedOver.length, 1);
    assert.equal(view.handedOver[0].contactId, 'lead-handed');
    assert.equal(view.handedOver[0].contactName, 'Contact lead-handed');
    assert.equal(view.handedOver[0].businessName, 'Business lead-handed');
    assert.equal(view.handedOver[0].painPoint, 'slow follow-up');
    assert.equal(view.handedOver[0].proofOffered, 'a booking page draft');
    assert.equal(view.handedOver[0].agreed, null);
    assert.equal(view.handedOver[0].nextAction, 'Owner follows up.');
    assert.equal(view.handedOver[0].pendingTasks.length, 1);
  });

  it('puts a callback lead in the waiting list', () => {
    const s = state();
    const view = buildOwnerDashboard({ ...s, now: NOW });
    assert.equal(view.counts.waitingCallback, 1);
    assert.deepEqual(view.waitingCallback.map((l: any) => l.contactId), ['lead-waiting']);
  });

  it('puts a hot interested lead in the hot list', () => {
    const s = state();
    const view = buildOwnerDashboard({ ...s, now: NOW });
    assert.equal(view.counts.hot, 1);
    assert.deepEqual(view.hot.map((l: any) => l.contactId), ['lead-hot']);
  });

  it('puts a lead with no pending task in the stuck list', () => {
    const s = state();
    const view = buildOwnerDashboard({ ...s, now: NOW });
    assert.ok(view.stuck.some((l: any) => l.contactId === 'lead-stuck'));
    assert.equal(view.counts.stuck, 1);
  });

  it('never puts an opted-out lead in any active list', () => {
    const s = state();
    const view = buildOwnerDashboard({ ...s, now: NOW });
    assert.equal(view.counts.optedOut, 1);
    assert.deepEqual(view.optedOut.map((l: any) => l.contactId), ['lead-opted']);
    for (const list of [view.handedOver, view.hot, view.waitingCallback, view.stuck]) {
      assert.equal(list.some((l: any) => l.contactId === 'lead-opted'), false);
    }
  });

  it('keeps drafts as drafts and never invents a value', () => {
    const s = state();
    s.drafts = [{ id: 'draft-1', contactId: 'lead-handed', channel: 'email', subject: 'Follow up', body: 'Hello', status: 'draft', sent: false, createdAt: NOW }];
    const view = buildOwnerDashboard({ ...s, now: NOW });
    assert.equal(view.handedOver[0].drafts.length, 1);
    assert.equal(view.handedOver[0].drafts[0].sent, false);
    assert.equal(view.handedOver[0].ownerValue, null);
  });

  it('uses no em dash in dashboard lead text', () => {
    const s = state();
    const view = buildOwnerDashboard({ ...s, now: NOW });
    const text = JSON.stringify(view.handedOver[0]);
    assert.equal(text.includes('\u2014'), false);
  });
});

describe('reversible owner actions', () => {
  it('marking won stops follow-ups for that lead only', () => {
    const s = state();
    const other = task('task-other', 'lead-hot');
    s.tasks.push(other);
    const result = markLeadOutcome({ pipeline: s.pipeline, tasks: s.tasks, contactId: 'lead-handed', outcome: 'closed_won', reason: 'Signed up.', now: NOW });
    assert.equal(result.stage, 'closed_won');
    assert.equal(s.pipeline['lead-handed'], 'closed_won');
    assert.equal(result.followUpsCancelled, 1);
    assert.equal(s.tasks.find((t: any) => t.id === 'task-handed').status, 'cancelled');
    assert.equal(s.tasks.find((t: any) => t.id === 'task-other').status, 'pending');
    assert.equal(s.pipeline['lead-hot'], 'interested');
    const view = buildOwnerDashboard({ ...s, now: NOW });
    assert.equal(view.counts.won, 1);
    assert.equal(view.handedOver.length, 0);
    assert.equal(view.stuck.some((l: any) => l.contactId === 'lead-handed'), false);
  });

  it('marking lost stops follow-ups and counts as lost', () => {
    const s = state();
    const result = markLeadOutcome({ pipeline: s.pipeline, tasks: s.tasks, contactId: 'lead-waiting', outcome: 'closed_lost', reason: 'Not a fit.', now: NOW });
    assert.equal(result.stage, 'closed_lost');
    assert.equal(s.tasks.find((t: any) => t.id === 'task-waiting').status, 'cancelled');
    const view = buildOwnerDashboard({ ...s, now: NOW });
    assert.equal(view.counts.lost, 1);
    assert.equal(view.waitingCallback.length, 0);
  });

  it('reopening a won lead restores its stage and its follow-up task', () => {
    const s = state();
    const marked = markLeadOutcome({ pipeline: s.pipeline, tasks: s.tasks, contactId: 'lead-handed', outcome: 'closed_won', reason: 'Signed up.', now: NOW });
    const reopened = reopenLead({ pipeline: s.pipeline, tasks: s.tasks, action: marked.action, now: NOW });
    assert.equal(reopened.restored, true);
    assert.equal(reopened.stage, 'transferred_to_owner');
    assert.equal(s.pipeline['lead-handed'], 'transferred_to_owner');
    assert.equal(reopened.tasksRestored, 1);
    assert.equal(s.tasks.find((t: any) => t.id === 'task-handed').status, 'pending');
    const again = reopenLead({ pipeline: s.pipeline, tasks: s.tasks, action: marked.action, now: NOW });
    assert.equal(again.restored, false);
  });

  it('snoozing moves one task and unsnoozing restores its due time', () => {
    const s = state();
    const snoozed = snoozeFollowUp({ tasks: s.tasks, taskId: 'task-waiting', newDueAt: '2026-11-05T00:00:00.000Z', reason: 'Owner away.', now: NOW });
    assert.equal(snoozed.snoozed, true);
    assert.equal(s.tasks.find((t: any) => t.id === 'task-waiting').dueAt, '2026-11-05T00:00:00.000Z');
    assert.equal(s.tasks.find((t: any) => t.id === 'task-handed').dueAt, '2026-10-29T00:00:00.000Z');
    assert.ok(snoozed.action);
    const undone = unsnoozeFollowUp({ tasks: s.tasks, action: snoozed.action, now: NOW });
    assert.equal(undone.restored, true);
    assert.equal(s.tasks.find((t: any) => t.id === 'task-waiting').dueAt, '2026-10-29T00:00:00.000Z');
  });

  it('confirming a next step updates only that lead summary', () => {
    const s = state();
    const result = confirmNextStep({ ownerSummaries: s.ownerSummaries, contactId: 'lead-handed', nextStep: 'Owner calls on Monday.', now: NOW });
    assert.equal(result.confirmed, true);
    assert.equal(s.ownerSummaries.find((x: any) => x.contactId === 'lead-handed').nextAction, 'Owner calls on Monday.');
    assert.equal(s.ownerSummaries.find((x: any) => x.contactId === 'lead-hot').nextAction, 'Owner follows up.');
    assert.ok(result.action);
    assert.equal(result.action.previousNextAction, 'Owner follows up.');
  });

  it('per-contact actions never affect other leads', () => {
    const s = state();
    markLeadOutcome({ pipeline: s.pipeline, tasks: s.tasks, contactId: 'lead-handed', outcome: 'closed_lost', reason: 'No.', now: NOW });
    snoozeFollowUp({ tasks: s.tasks, taskId: 'task-waiting', newDueAt: '2026-11-05T00:00:00.000Z', now: NOW });
    assert.equal(s.pipeline['lead-hot'], 'interested');
    assert.equal(s.tasks.find((t: any) => t.id === 'task-hot').status, 'pending');
    assert.equal(s.tasks.find((t: any) => t.id === 'task-hot').dueAt, '2026-10-29T00:00:00.000Z');
  });
});
