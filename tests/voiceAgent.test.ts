// Phase 7.2 battery: voice call flow, gated by Phase 7.1 canContact.
// Test fixtures only: no real phone numbers, emails, calls, keys,
// or external services are used. The fake provider never dials.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const gate = await import('../server/contactGate.js');
const voice = await import('../server/voiceAgent.js');
const { grantConsent, addSuppression } = gate;
const {
  FakeVoiceProvider,
  buildCallNote,
  disclosureLine,
  openingScript,
  runVoiceCall,
  unconfiguredProvider
} = voice;

function verifiedContact(overrides: Record<string, any> = {}): any {
  return {
    id: 'contact-1',
    email: 'owner@example-business.com',
    phone: '+15551234567',
    phoneLineType: 'mobile',
    fieldVerifications: [
      { field: 'email', verified: true, provenance: 'test fixture', verifiedAt: '2026-10-28T00:00:00.000Z' },
      { field: 'phone', verified: true, provenance: 'test fixture', verifiedAt: '2026-10-28T00:00:00.000Z' },
      { field: 'business', verified: true, provenance: 'test fixture', verifiedAt: '2026-10-28T00:00:00.000Z' }
    ],
    ...overrides
  };
}

function brief(overrides: Record<string, any> = {}): any {
  return {
    contactId: 'contact-1',
    contactName: 'Alex',
    businessName: 'DemoFix Home Services',
    callingCompany: 'Pulsar Demo Company',
    painPoint: 'slow booking follow-up',
    proofOffer: 'a booking page draft',
    ownerName: 'Sam',
    ...overrides
  };
}

function pewcLedger(): any[] {
  const ledger: any[] = [];
  grantConsent(ledger, { contactId: 'contact-1', channel: 'voice', type: 'pewc', source: 'test form' });
  return ledger;
}

describe('voice script', () => {
  it('discloses that the caller is an AI assistant and that the call may be recorded', () => {
    const text = openingScript(brief());
    assert.match(text, /AI assistant/);
    assert.match(text, /may be recorded/);
    assert.match(text, /on behalf of/);
    assert.equal(disclosureLine(brief()).includes('AI assistant'), true);
  });
  it('uses the lead pain point and proof in the opener, with no invented result', () => {
    const text = openingScript(brief());
    assert.match(text, /slow booking follow-up/);
    assert.match(text, /booking page draft/);
  });
  it('uses no em dash in the script lines', () => {
    assert.equal(openingScript(brief()).includes('\u2014'), false);
    assert.equal(disclosureLine(brief()).includes('\u2014'), false);
  });
});

describe('gate-first voice flow', () => {
  it('allows a consented mobile and reaches transfer when the prospect is interested', async () => {
    const provider = new FakeVoiceProvider(['interested']);
    const result = await runVoiceCall({
      contact: verifiedContact(),
      brief: brief(),
      consents: pewcLedger(),
      suppressions: [],
      provider
    });
    assert.equal(result.outcome, 'transferred');
    assert.equal(result.providerStarted, true);
    assert.equal(result.providerTransferred, true);
    assert.equal(provider.transferred, true);
    assert.ok(result.transferSummary && result.transferSummary.includes('Sam'));
    assert.ok(result.transferSummary && result.transferSummary.includes('slow booking follow-up'));
  });
  it('blocks an unconsented mobile and never starts the provider', async () => {
    const provider = new FakeVoiceProvider(['interested']);
    const result = await runVoiceCall({
      contact: verifiedContact(),
      brief: brief(),
      consents: [],
      suppressions: [],
      provider
    });
    assert.equal(result.outcome, 'blocked');
    assert.equal(result.providerStarted, false);
    assert.equal(provider.started, false);
    assert.equal(provider.spoken.length, 0);
    assert.equal(result.gateVerdict.reasonCode, 'CONSENT_MISSING');
  });
  it('blocks a suppressed contact and never starts the provider', async () => {
    const suppressions: any[] = [];
    addSuppression(suppressions, {
      identifierType: 'contact',
      identifier: 'contact-1',
      reason: 'opt_out',
      source: 'test',
      addedBy: 'test'
    });
    const provider = new FakeVoiceProvider(['interested']);
    const result = await runVoiceCall({
      contact: verifiedContact(),
      brief: brief(),
      consents: pewcLedger(),
      suppressions,
      provider
    });
    assert.equal(result.outcome, 'blocked');
    assert.equal(result.gateVerdict.reasonCode, 'SUPPRESSED');
    assert.equal(provider.started, false);
  });
  it('blocks an unverified phone and never starts the provider', async () => {
    const contact = verifiedContact({
      fieldVerifications: [
        { field: 'email', verified: true, provenance: 'test fixture', verifiedAt: '2026-10-28T00:00:00.000Z' }
      ]
    });
    const provider = new FakeVoiceProvider(['interested']);
    const result = await runVoiceCall({
      contact,
      brief: brief(),
      consents: pewcLedger(),
      suppressions: [],
      provider
    });
    assert.equal(result.outcome, 'blocked');
    assert.equal(result.gateVerdict.reasonCode, 'UNVERIFIED');
    assert.equal(provider.started, false);
  });
  it('allows a landline with prior express consent and transfers on a price question', async () => {
    const ledger: any[] = [];
    grantConsent(ledger, { contactId: 'contact-1', channel: 'voice', type: 'pec', source: 'test form' });
    const provider = new FakeVoiceProvider(['how_much']);
    const result = await runVoiceCall({
      contact: verifiedContact({ phoneLineType: 'landline' }),
      brief: brief(),
      consents: ledger,
      suppressions: [],
      provider
    });
    assert.equal(result.outcome, 'transferred');
    assert.equal(provider.transferred, true);
  });
  it('does not allow AI voice to a mobile on landline-only consent', async () => {
    const ledger: any[] = [];
    grantConsent(ledger, { contactId: 'contact-1', channel: 'voice', type: 'pec', source: 'test form' });
    const provider = new FakeVoiceProvider(['interested']);
    const result = await runVoiceCall({
      contact: verifiedContact({ phoneLineType: 'mobile' }),
      brief: brief(),
      consents: ledger,
      suppressions: [],
      provider
    });
    assert.equal(result.outcome, 'blocked');
    assert.equal(provider.started, false);
  });
});

describe('objection branches', () => {
  it('handles not interested with an opt-out next step', async () => {
    const provider = new FakeVoiceProvider(['not_interested']);
    const result = await runVoiceCall({
      contact: verifiedContact(),
      brief: brief(),
      consents: pewcLedger(),
      suppressions: [],
      provider
    });
    assert.equal(result.outcome, 'not_interested');
    assert.match(result.nextStep, /opt-out/);
    assert.equal(provider.ended, true);
  });
  it('books a callback when the prospect is busy', async () => {
    const provider = new FakeVoiceProvider(['busy']);
    const result = await runVoiceCall({
      contact: verifiedContact(),
      brief: brief(),
      consents: pewcLedger(),
      suppressions: [],
      provider
    });
    assert.equal(result.outcome, 'callback_booked');
  });
  it('books a callback when the prospect asks to call back later', async () => {
    const provider = new FakeVoiceProvider(['call_back_later']);
    const result = await runVoiceCall({
      contact: verifiedContact(),
      brief: brief(),
      consents: pewcLedger(),
      suppressions: [],
      provider
    });
    assert.equal(result.outcome, 'callback_booked');
  });
  it('requests email when the prospect asks for email', async () => {
    const provider = new FakeVoiceProvider(['send_email']);
    const result = await runVoiceCall({
      contact: verifiedContact(),
      brief: brief(),
      consents: pewcLedger(),
      suppressions: [],
      provider
    });
    assert.equal(result.outcome, 'email_requested');
  });
  it('answers who are you honestly, then transfers on interest', async () => {
    const provider = new FakeVoiceProvider(['who_are_you', 'interested']);
    const result = await runVoiceCall({
      contact: verifiedContact(),
      brief: brief(),
      consents: pewcLedger(),
      suppressions: [],
      provider
    });
    assert.equal(result.outcome, 'transferred');
    assert.ok(provider.spoken.some((line: string) => line.includes('not a human employee')));
  });
  it('ends politely after repeated silence, without looping', async () => {
    const provider = new FakeVoiceProvider(['silence', 'silence']);
    const result = await runVoiceCall({
      contact: verifiedContact(),
      brief: brief(),
      consents: pewcLedger(),
      suppressions: [],
      provider
    });
    assert.equal(result.outcome, 'ended');
    assert.equal(provider.ended, true);
  });
});

describe('provider interface and after-call notes', () => {
  it('keeps a real provider unconfigured, with references only, never a key value', () => {
    const config = unconfiguredProvider('retell');
    assert.equal(config.configured, false);
    assert.equal(config.apiKeyEnvVar, 'VOICE_PROVIDER_API_KEY');
    assert.equal('apiKey' in config, false);
  });
  it('builds a call note from the actual outcome, with no invented result', async () => {
    const provider = new FakeVoiceProvider(['interested']);
    const result = await runVoiceCall({
      contact: verifiedContact(),
      brief: brief(),
      consents: pewcLedger(),
      suppressions: [],
      provider
    });
    const note = buildCallNote(result, brief());
    assert.equal(note.outcome, 'transferred');
    assert.ok(note.note.includes('transferred'));
    assert.ok(note.transferSummary && note.transferSummary.includes('Sam'));
    assert.equal(note.transcript.length, result.transcript.length);
  });
  it('records a blocked call note with the gate reason', async () => {
    const provider = new FakeVoiceProvider(['interested']);
    const result = await runVoiceCall({
      contact: verifiedContact(),
      brief: brief(),
      consents: [],
      suppressions: [],
      provider
    });
    const note = buildCallNote(result, brief());
    assert.equal(note.outcome, 'blocked');
    assert.match(note.note, /CONSENT_MISSING/);
  });
});
