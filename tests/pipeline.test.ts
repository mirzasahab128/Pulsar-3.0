// Phases 4–6 — unit tests for server/pipeline.ts (lead registry, enrichment
// rules, suppressions, notes/tasks, daily stats, sequence engine, Resend
// webhook verification). Pure-function level; the HTTP surface is covered
// by tests-phase4-6.py.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  emptyPipelineState,
  normalizeIngestRecord,
  ingestLeads,
  enrichLead,
  addSuppression,
  matchSuppression,
  buildTemplateDraft,
  extractActionItemsFromTranscript,
  createTask,
  updateTaskStatus,
  computeDailyStats,
  renderTemplate,
  isWithinSendWindow,
  enrollLeadInSequence,
  processDueSequences,
  verifyResendWebhook,
  applyResendEvent,
  PipelineState,
  Sequence
} from '../server/pipeline.js';
import { emptyPlatformState, PlatformState } from '../server/platform.js';

const WS = 'ws_test';
const NOW = '2026-10-23T10:00:00.000Z';

function npiLead(overrides: Record<string, any> = {}) {
  return {
    practiceName: 'Lakeside Cardiology Associates',
    doctorName: 'Dr. Priya Nair',
    title: 'Practice Administrator',
    specialty: 'Cardiology',
    practiceSize: 'Multi-Provider Group',
    phone: '(512) 555-0142',
    email: 'admin@lakesidecardio.example',
    address: '100 Lake Way, Austin, TX 78701',
    state: 'TX',
    npiNumber: '1234567893',
    source: 'CMS NPI Registry (Verified)',
    provenance: {
      source: 'CMS NPI Registry (NPPES)',
      sourceId: '1234567893',
      retrievedAt: NOW,
      verifiedFields: ['npiNumber', 'practiceName', 'phone']
    },
    ...overrides
  };
}

function seedLead(state: PipelineState, overrides: Record<string, any> = {}) {
  const { results } = ingestLeads(state, WS, [npiLead(overrides)]);
  assert.equal(results[0].outcome, 'created');
  return state.leads[results[0].leadId!];
}

describe('ingest: provenance enforcement', () => {
  it('accepts a sourced NPI record and stamps full provenance', () => {
    const state = emptyPipelineState();
    const norm = normalizeIngestRecord(npiLead(), WS, NOW);
    assert.equal(norm.ok, true);
    if (norm.ok) {
      assert.equal(norm.lead.provenance.source, 'CMS NPI Registry (NPPES)');
      assert.equal(norm.lead.provenance.sourceId, '1234567893');
      assert.equal(norm.lead.provenance.retrievedAt, NOW);
      assert.equal(norm.lead.npiNumber, '1234567893');
    }
  });

  it('rejects a record with no source at all', () => {
    const norm = normalizeIngestRecord({ practiceName: 'Mystery Clinic' }, WS, NOW);
    assert.equal(norm.ok, false);
    if (!norm.ok) assert.match(norm.reason, /provenance/);
  });

  it('rejects simulated and demo records outright', () => {
    const sim = normalizeIngestRecord(npiLead({ simulated: true }), WS, NOW);
    assert.equal(sim.ok, false);
    const demo = normalizeIngestRecord(npiLead({ source: 'demo', provenance: undefined }), WS, NOW);
    assert.equal(demo.ok, false);
  });

  it('derives a stable sourceId for CSV-style rows without one', () => {
    const norm = normalizeIngestRecord({
      practiceName: 'CSV Clinic', email: 'a@csv.example', source: 'csv_import'
    }, WS, NOW);
    assert.equal(norm.ok, true);
    if (norm.ok) assert.equal(norm.lead.provenance.sourceId, 'a@csv.example');
  });
});

describe('ingest: dedupe', () => {
  it('dedupes on NPI even when other fields differ', () => {
    const state = emptyPipelineState();
    ingestLeads(state, WS, [npiLead()]);
    const { results } = ingestLeads(state, WS, [npiLead({ email: 'other@x.example', phone: '(999) 555-0000' })]);
    assert.equal(results[0].outcome, 'duplicate');
    assert.equal(Object.keys(state.leads).length, 1);
  });

  it('dedupes on phone number regardless of formatting', () => {
    const state = emptyPipelineState();
    ingestLeads(state, WS, [npiLead({ npiNumber: null, provenance: { source: 'csv_import', sourceId: 'r1', retrievedAt: NOW } })]);
    const { results } = ingestLeads(state, WS, [npiLead({
      npiNumber: null, phone: '512-555-0142', email: 'different@x.example',
      provenance: { source: 'csv_import', sourceId: 'r2', retrievedAt: NOW }
    })]);
    assert.equal(results[0].outcome, 'duplicate');
  });

  it('dedupes on practice name + address', () => {
    const state = emptyPipelineState();
    ingestLeads(state, WS, [npiLead({ npiNumber: null, email: '', phone: null, provenance: { source: 'csv_import', sourceId: 'r1', retrievedAt: NOW } })]);
    const { results } = ingestLeads(state, WS, [{
      practiceName: 'Lakeside Cardiology Associates', address: '100 Lake Way, Austin, TX 78701',
      source: 'csv_import'
    }]);
    assert.equal(results[0].outcome, 'duplicate');
  });

  it('does not dedupe across workspaces', () => {
    const state = emptyPipelineState();
    ingestLeads(state, WS, [npiLead()]);
    const { results } = ingestLeads(state, 'ws_other', [npiLead()]);
    assert.equal(results[0].outcome, 'created');
  });
});

describe('suppressions', () => {
  it('flags a lead at ingest when its email is suppressed', () => {
    const state = emptyPipelineState();
    addSuppression(state, WS, 'email', 'Admin@LakesideCardio.example', 'opt_out', 'owner@x.example');
    const { results } = ingestLeads(state, WS, [npiLead()]);
    assert.equal(results[0].outcome, 'created');
    assert.equal(results[0].suppressed, true);
    assert.equal(state.leads[results[0].leadId!].status, 'suppressed');
  });

  it('matches by phone digits and by NPI', () => {
    const state = emptyPipelineState();
    addSuppression(state, WS, 'phone', '(512) 555-0142', 'dnc_request', 'owner@x.example');
    assert.ok(matchSuppression(state, WS, { phone: '512.555.0142' }));
    assert.equal(matchSuppression(state, WS, { phone: '(212) 555-9999' }), null);
    addSuppression(state, WS, 'npi', '1234567893', 'registry', 'owner@x.example');
    assert.ok(matchSuppression(state, WS, { npiNumber: '1234567893' }));
  });

  it('is idempotent per identifier', () => {
    const state = emptyPipelineState();
    const a = addSuppression(state, WS, 'email', 'x@y.example', 'opt_out', 'o@x');
    const b = addSuppression(state, WS, 'email', 'x@y.example', 'opt_out', 'o@x');
    assert.equal(a.id, b.id);
    assert.equal(Object.keys(state.suppressions).length, 1);
  });
});

describe('enrichment: deterministic named rules, nothing invented', () => {
  it('scores a strong sourced lead and names every rule applied', () => {
    const state = emptyPipelineState();
    const lead = seedLead(state);
    const e = enrichLead(lead, NOW);
    const ruleNames = e.rulesApplied.map(r => r.rule);
    assert.ok(ruleNames.includes('specialty-fit'));
    assert.ok(ruleNames.includes('decision-maker-title'));
    assert.ok(ruleNames.includes('registry-verified-identity'));
    assert.ok(ruleNames.includes('has-phone'));
    assert.ok(ruleNames.includes('has-email'));
    assert.equal(e.fitScore, 100);
    assert.equal(e.derived.contactability.value, 'phone+email');
    assert.equal(e.derived.outreachReady.value, true);
    assert.match(e.fitReason, /Cardiology/i);
  });

  it('gives an unscored, honest reason when no rules match', () => {
    const state = emptyPipelineState();
    const { results } = ingestLeads(state, WS, [{
      practiceName: 'Unknown Entity', source: 'csv_import', phone: null, email: ''
    }]);
    const lead = state.leads[results[0].leadId!];
    const e = enrichLead(lead, NOW);
    assert.equal(e.fitScore, 0);
    assert.match(e.fitReason, /No fit rules matched/);
    assert.equal(e.derived.contactability.value, 'none');
  });

  it('never invents EHR / volume / pain-point fields', () => {
    const state = emptyPipelineState();
    const lead = seedLead(state);
    const e = enrichLead(lead, NOW) as any;
    assert.equal(e.ehrSystem, undefined);
    assert.equal(e.monthlyClaimVolume, undefined);
    assert.equal(e.painPoints, undefined);
  });
});

describe('linkedin assisted drafts', () => {
  it('builds a template draft from record fields only', () => {
    const draft = buildTemplateDraft({ prospectName: 'Dr. Priya Nair', practiceName: 'Lakeside Cardiology', specialty: 'Cardiology' });
    assert.match(draft, /Hi Priya/);
    assert.match(draft, /Lakeside Cardiology/);
    assert.match(draft, /ThriveMed RCM/);
  });
});

describe('notes → tasks (Phase 5)', () => {
  it('extracts action items only from lines that carry an action marker', () => {
    const transcript = [
      'Rep: Thanks for your time today.',
      'Prospect: Our denials are up this quarter.',
      'Action: Send over the audit checklist by Friday',
      'Prospect: Please send me the pricing sheet.',
      'Rep: Sounds good, talk soon.'
    ].join('\n');
    const items = extractActionItemsFromTranscript(transcript);
    assert.equal(items.length, 2);
    assert.equal(items[0].extraction, 'rule');
    assert.match(items[0].text, /audit checklist/);
    assert.match(items[1].text, /pricing sheet/);
  });

  it('extracts nothing from a transcript with no action language', () => {
    const items = extractActionItemsFromTranscript('Prospect: We bill in-house.\nRep: Understood, thanks.');
    assert.equal(items.length, 0);
  });

  it('marks a task done only via the explicit status path, with actor + time', () => {
    const state = emptyPipelineState();
    const task = createTask(state, WS, { title: 'Call back', owner: 'owner@x.example' }, 'owner@x.example');
    assert.equal(task.status, 'open');
    assert.equal(task.completedAt, null);
    updateTaskStatus(state, task, 'done', 'owner@x.example');
    assert.equal(task.status, 'done');
    assert.equal(task.completedBy, 'owner@x.example');
    assert.ok(task.completedAt);
  });
});

describe('daily stats: counted from records', () => {
  it('counts only records from the requested date', () => {
    const state = emptyPipelineState();
    const platform = emptyPlatformState();
    seedLead(state);
    createTask(state, WS, { title: 'Today task', owner: 'o@x' }, 'o@x');
    const today = new Date().toISOString().slice(0, 10);
    const stats = computeDailyStats(state, platform, WS, today);
    assert.equal(stats.counts.leadsIngested, 1);
    assert.equal(stats.counts.tasksCreated, 1);
    assert.equal(stats.hasActivity, true);
    const yesterday = computeDailyStats(state, platform, WS, '2020-01-01');
    assert.equal(yesterday.counts.leadsIngested, 0);
    assert.equal(yesterday.hasActivity, false);
    assert.match(yesterday.note, /genuinely zero/);
  });
});

describe('sequences (Phase 6)', () => {
  const step = (delayDays: number) => ({
    subject: 'Hello {{practiceName}}', body: 'Hi {{firstName}}, following up.',
    delayDays, windowStart: '00:00', windowEnd: '23:59'
  });

  function makeSequence(state: PipelineState, steps: any[]): Sequence {
    const seq: Sequence = {
      id: 'seq-test', workspaceId: WS, name: 'Test sequence', status: 'active',
      timezone: 'UTC', steps, createdBy: 'owner-test@example.com', createdByUid: 'user-123',
      createdAt: NOW, updatedAt: NOW
    };
    state.sequences[seq.id] = seq;
    return seq;
  }

  it('renders templates from lead fields and leaves unknown tokens intact', () => {
    const state = emptyPipelineState();
    const lead = seedLead(state);
    assert.equal(renderTemplate('Hello {{practiceName}}', lead), 'Hello Lakeside Cardiology Associates');
    assert.equal(renderTemplate('Hi {{firstName}}', lead), 'Hi Priya');
    assert.equal(renderTemplate('Ref {{unknown}}', lead), 'Ref {{unknown}}');
  });

  it('honours the send window', () => {
    const inWindow = { subject: 's', body: 'b', delayDays: 0, windowStart: '00:00', windowEnd: '23:59' };
    assert.equal(isWithinSendWindow(inWindow, 'UTC', new Date('2026-10-23T12:00:00Z')), true);
    const narrow = { ...inWindow, windowStart: '13:00', windowEnd: '14:00' };
    assert.equal(isWithinSendWindow(narrow, 'UTC', new Date('2026-10-23T12:00:00Z')), false);
  });

  it('refuses enrollment for suppressed or email-less leads', () => {
    const state = emptyPipelineState();
    const seq = makeSequence(state, [step(0)]);
    const lead = seedLead(state);
    addSuppression(state, WS, 'email', lead.email, 'opt_out', 'o@x');
    assert.equal(enrollLeadInSequence(state, seq, lead, 'o@x').outcome, 'suppressed');

    const state2 = emptyPipelineState();
    const seq2 = makeSequence(state2, [step(0)]);
    const { results } = ingestLeads(state2, WS, [{ practiceName: 'No Email Clinic', source: 'csv_import' }]);
    const noEmail = state2.leads[results[0].leadId!];
    assert.equal(enrollLeadInSequence(state2, seq2, noEmail, 'o@x').outcome, 'rejected');
  });

  it('advances only on a real send and completes after the last step', async () => {
    const state = emptyPipelineState();
    const platform = emptyPlatformState();
    const seq = makeSequence(state, [step(0), step(0)]);
    const lead = seedLead(state);
    enrollLeadInSequence(state, seq, lead, 'o@x');
    const send = async () => ({ status: 'sent' as const, messageId: 'msg-abc-123' });

    const s1 = await processDueSequences(state, platform, { workspaceId: WS, now: new Date(), send });
    assert.equal(s1.sent, 1);
    assert.equal(s1.deliveries[0].providerMessageId, 'msg-abc-123');
    const enr = Object.values(state.enrollments)[0];
    assert.equal(enr.currentStep, 1);
    assert.equal(enr.status, 'active');

    const s2 = await processDueSequences(state, platform, { workspaceId: WS, now: new Date(), send });
    assert.equal(s2.sent, 1);
    assert.equal(enr.status, 'completed');
    assert.equal(state.deliveries.length, 2);
  });

  it('never advances on not_configured — the send did not happen', async () => {
    const state = emptyPipelineState();
    const platform = emptyPlatformState();
    const seq = makeSequence(state, [step(0)]);
    const lead = seedLead(state);
    enrollLeadInSequence(state, seq, lead, 'o@x');
    const send = async () => ({ status: 'not_configured' as const, error: 'RESEND_API_KEY missing' });
    const s = await processDueSequences(state, platform, { workspaceId: WS, now: new Date(), send });
    assert.equal(s.notConfigured, 1);
    assert.equal(s.sent, 0);
    const enr = Object.values(state.enrollments)[0];
    assert.equal(enr.currentStep, 0);
    assert.equal(enr.status, 'active');
    assert.equal(state.deliveries[0].status, 'not_configured');
    assert.equal(state.deliveries[0].providerMessageId, null);
  });

  it('a paused sequence sends nothing', async () => {
    const state = emptyPipelineState();
    const platform = emptyPlatformState();
    const seq = makeSequence(state, [step(0)]);
    seq.status = 'paused';
    const lead = seedLead(state);
    enrollLeadInSequence(state, seq, lead, 'o@x');
    const s = await processDueSequences(state, platform, {
      workspaceId: WS, now: new Date(),
      send: async () => ({ status: 'sent' as const, messageId: 'x' })
    });
    assert.equal(s.processed, 0);
    assert.equal(state.deliveries.length, 0);
  });

  it('stops an enrollment whose address is suppressed after enrollment', async () => {
    const state = emptyPipelineState();
    const platform = emptyPlatformState();
    const seq = makeSequence(state, [step(0)]);
    const lead = seedLead(state);
    enrollLeadInSequence(state, seq, lead, 'o@x');
    addSuppression(state, WS, 'email', lead.email, 'opt_out', 'o@x');
    const s = await processDueSequences(state, platform, {
      workspaceId: WS, now: new Date(),
      send: async () => ({ status: 'sent' as const, messageId: 'x' })
    });
    assert.equal(s.skippedSuppressed, 1);
    assert.equal(s.sent, 0);
    assert.equal(Object.values(state.enrollments)[0].status, 'stopped');
  });

  it('enforces the plan send cap for the sequence creator', async () => {
    const state = emptyPipelineState();
    const platform = emptyPlatformState();
    // Creator has a platform record on Trial: email_outreach is off entirely.
    platform.users['user-123'] = {
      uid: 'user-123', email: 'owner-test@example.com', displayName: 'T', role: 'user',
      planId: 'trial', status: 'active', createdAt: NOW
    };
    const seq = makeSequence(state, [step(0)]);
    const lead = seedLead(state);
    enrollLeadInSequence(state, seq, lead, 'o@x');
    const s = await processDueSequences(state, platform, {
      workspaceId: WS, now: new Date(),
      send: async () => ({ status: 'sent' as const, messageId: 'x' })
    });
    assert.equal(s.skippedPlan, 1);
    assert.equal(s.sent, 0);
    assert.equal(state.deliveries.length, 0);
  });
});

describe('resend webhook', () => {
  const SECRET = 'whsec_' + Buffer.from('test-webhook-secret-32-bytes!!').toString('base64');

  function sign(id: string, ts: number, body: string): string {
    const key = Buffer.from(SECRET.slice('whsec_'.length), 'base64');
    const sig = crypto.createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64');
    return `v1,${sig}`;
  }

  it('accepts a correctly signed event and rejects tampering', () => {
    const ts = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({ type: 'email.delivered', data: { email_id: 'm1' } });
    const ok = verifyResendWebhook(SECRET, { id: 'evt1', timestamp: String(ts), signature: sign('evt1', ts, body) }, body, ts);
    assert.equal(ok.ok, true);
    const bad = verifyResendWebhook(SECRET, { id: 'evt1', timestamp: String(ts), signature: sign('evt1', ts, body) }, body + ' ', ts);
    assert.equal(bad.ok, false);
    const stale = verifyResendWebhook(SECRET, { id: 'evt1', timestamp: String(ts - 3600), signature: sign('evt1', ts - 3600, body) }, body, ts);
    assert.equal(stale.ok, false);
  });

  it('a bounce suppresses the address and stops enrollments', async () => {
    const state = emptyPipelineState();
    const platform = emptyPlatformState();
    const seq: Sequence = {
      id: 'seq-test', workspaceId: WS, name: 'S', status: 'active', timezone: 'UTC',
      steps: [{ subject: 's', body: 'b', delayDays: 0, windowStart: '00:00', windowEnd: '23:59' }],
      createdBy: 'owner-test@example.com', createdByUid: 'user-123', createdAt: NOW, updatedAt: NOW
    };
    state.sequences[seq.id] = seq;
    const lead = seedLead(state);
    enrollLeadInSequence(state, seq, lead, 'o@x');
    await processDueSequences(state, platform, {
      workspaceId: WS, now: new Date(),
      send: async () => ({ status: 'sent' as const, messageId: 'msg-bounce-1' })
    });
    const result = applyResendEvent(state, { type: 'email.bounced', data: { email_id: 'msg-bounce-1' } });
    assert.equal(result.matched, true);
    assert.ok(matchSuppression(state, WS, { email: lead.email }));
    assert.equal(state.leads[lead.id].suppressed, true);
    assert.equal(state.deliveries[0].status, 'bounced');
  });

  it('an unknown message id is acknowledged but changes nothing', () => {
    const state = emptyPipelineState();
    const result = applyResendEvent(state, { type: 'email.delivered', data: { email_id: 'nope' } });
    assert.equal(result.matched, false);
  });
});
