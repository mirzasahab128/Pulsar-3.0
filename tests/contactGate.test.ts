// Phase 7.1 battery: consent ledger, suppression, and contact gate.
// Pure-function coverage for server/contactGate.ts. Test fixtures only:
// no real phone numbers, emails, or external services are used.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const gate = await import('../server/contactGate.js');
const {
  grantConsent,
  revokeContact,
  hasActiveConsent,
  addSuppression,
  isSuppressed,
  importSuppressionCsv,
  canContact,
  normalizePhone,
  normalizeEmail
} = gate;

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

function consentedLedger(): any[] {
  const ledger: any[] = [];
  grantConsent(ledger, { contactId: 'contact-1', channel: 'voice', type: 'pewc', source: 'test form' });
  grantConsent(ledger, { contactId: 'contact-1', channel: 'email', type: 'email_optin', source: 'test form' });
  grantConsent(ledger, { contactId: 'contact-1', channel: 'sms', type: 'sms_optin', source: 'test form' });
  return ledger;
}

describe('phone and email normalization', () => {
  it('normalizes a US 10-digit number to E.164', () => {
    assert.equal(normalizePhone('(555) 123-4567'), '+15551234567');
    assert.equal(normalizePhone('555-123-4567'), '+15551234567');
  });
  it('keeps an international number and rejects a too-short number', () => {
    assert.equal(normalizePhone('+44 20 7946 0958'), '+442079460958');
    assert.equal(normalizePhone('123'), null);
  });
  it('normalizes email case and rejects a bad email', () => {
    assert.equal(normalizeEmail(' Owner@Example-Business.COM '), 'owner@example-business.com');
    assert.equal(normalizeEmail('not-an-email'), null);
  });
});

describe('consent ledger', () => {
  it('grants consent and reports it active', () => {
    const ledger: any[] = [];
    const r = grantConsent(ledger, { contactId: 'contact-1', channel: 'voice', type: 'pewc', source: 'test form' });
    assert.equal(r.ok, true);
    assert.equal(hasActiveConsent(ledger, 'contact-1', 'voice', ['pewc']), true);
  });
  it('rejects a consent type that does not apply to the channel', () => {
    const ledger: any[] = [];
    const r = grantConsent(ledger, { contactId: 'contact-1', channel: 'email', type: 'pewc', source: 'test form' });
    assert.equal(r.ok, false);
  });
  it('does not duplicate an active grant', () => {
    const ledger = consentedLedger();
    grantConsent(ledger, { contactId: 'contact-1', channel: 'voice', type: 'pewc', source: 'test form' });
    assert.equal(ledger.filter((c: any) => c.channel === 'voice').length, 1);
  });
  it('revocation by one channel revokes every channel', () => {
    const ledger = consentedLedger();
    const { revoked } = revokeContact(ledger, 'contact-1', 'test revoke');
    assert.equal(revoked, 3);
    assert.equal(hasActiveConsent(ledger, 'contact-1', 'voice', ['pewc']), false);
    assert.equal(hasActiveConsent(ledger, 'contact-1', 'email', ['email_optin']), false);
    assert.equal(hasActiveConsent(ledger, 'contact-1', 'sms', ['sms_optin']), false);
  });
  it('a revoked contact is blocked on all channels by the gate', () => {
    const ledger = consentedLedger();
    revokeContact(ledger, 'contact-1', 'test revoke');
    for (const channel of ['voice', 'email', 'sms'] as const) {
      const v = canContact(verifiedContact(), channel, { consents: ledger, suppressions: [] });
      assert.equal(v.allowed, false, channel);
    }
  });
});

describe('suppression list', () => {
  it('adds a phone suppression normalized to E.164 and matches it', () => {
    const list: any[] = [];
    const r = addSuppression(list, { identifierType: 'phone', identifier: '(555) 123-4567', reason: 'manual', source: 'test', addedBy: 'admin@test' });
    assert.equal(r.ok, true);
    assert.equal(r.record.identifier, '+15551234567');
    assert.notEqual(isSuppressed(list, { id: 'other', phone: '5551234567' }), null);
  });
  it('does not duplicate a suppression', () => {
    const list: any[] = [];
    addSuppression(list, { identifierType: 'phone', identifier: '5551234567', reason: 'manual', source: 'test', addedBy: 'admin@test' });
    const r = addSuppression(list, { identifierType: 'phone', identifier: '+15551234567', reason: 'manual', source: 'test', addedBy: 'admin@test' });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.duplicate, true);
    assert.equal(list.length, 1);
  });
  it('a suppressed contact is blocked on all channels', () => {
    const list: any[] = [];
    addSuppression(list, { identifierType: 'contact', identifier: 'contact-1', reason: 'opt_out', source: 'test', addedBy: 'admin@test' });
    for (const channel of ['voice', 'email', 'sms'] as const) {
      const v = canContact(verifiedContact(), channel, { consents: consentedLedger(), suppressions: list });
      assert.equal(v.allowed, false, channel);
      assert.equal(v.reasonCode, 'SUPPRESSED');
    }
  });
  it('imports a CSV of phone numbers, normalizes, dedupes, and reports invalid lines', () => {
    const parsed = importSuppressionCsv('phone\n(555) 123-4567\n+1 555 123 4567\nnot-a-number\n\n5559876543', { source: 'test', addedBy: 'admin@test' });
    assert.deepEqual(parsed.added, ['+15551234567', '+15559876543']);
    assert.deepEqual(parsed.skipped, ['+15551234567']);
    assert.equal(parsed.errors.length, 1);
  });
});

describe('contact gate', () => {
  it('allows a verified and consented contact on voice, email, and SMS', () => {
    const ledger = consentedLedger();
    for (const channel of ['voice', 'email', 'sms'] as const) {
      const v = canContact(verifiedContact(), channel, { consents: ledger, suppressions: [] });
      assert.equal(v.allowed, true, channel);
      assert.equal(v.reasonCode, 'ALLOWED');
    }
  });
  it('blocks AI voice when consent is unknown for a mobile', () => {
    const v = canContact(verifiedContact(), 'voice', { consents: [], suppressions: [] });
    assert.equal(v.allowed, false);
    assert.equal(v.reasonCode, 'CONSENT_MISSING');
  });
  it('blocks AI voice when only prior express consent (not written) exists for a mobile', () => {
    const ledger: any[] = [];
    grantConsent(ledger, { contactId: 'contact-1', channel: 'voice', type: 'pec', source: 'test form' });
    const v = canContact(verifiedContact(), 'voice', { consents: ledger, suppressions: [] });
    assert.equal(v.allowed, false);
    assert.equal(v.reasonCode, 'CONSENT_MISSING');
  });
  it('allows a landline voice call with prior express consent, and blocks an unknown line type without written consent', () => {
    const ledger: any[] = [];
    grantConsent(ledger, { contactId: 'contact-1', channel: 'voice', type: 'pec', source: 'test form' });
    const landline = canContact(verifiedContact({ phoneLineType: 'landline' }), 'voice', { consents: ledger, suppressions: [] });
    assert.equal(landline.allowed, true);
    const unknown = canContact(verifiedContact({ phoneLineType: 'unknown' }), 'voice', { consents: ledger, suppressions: [] });
    assert.equal(unknown.allowed, false);
    assert.equal(unknown.reasonCode, 'CONSENT_MISSING');
  });
  it('blocks an unverified contact on every channel', () => {
    const unverified = verifiedContact({
      fieldVerifications: [
        { field: 'email', verified: false, provenance: 'test fixture', verifiedAt: '2026-10-28T00:00:00.000Z' },
        { field: 'phone', verified: false, provenance: 'test fixture', verifiedAt: '2026-10-28T00:00:00.000Z' }
      ]
    });
    for (const channel of ['voice', 'email', 'sms'] as const) {
      const v = canContact(unverified, channel, { consents: consentedLedger(), suppressions: [] });
      assert.equal(v.allowed, false, channel);
      assert.equal(v.reasonCode, 'UNVERIFIED');
    }
  });
  it('blocks cold email when email opt-in is missing, even if voice consent exists', () => {
    const ledger: any[] = [];
    grantConsent(ledger, { contactId: 'contact-1', channel: 'voice', type: 'pewc', source: 'test form' });
    const v = canContact(verifiedContact(), 'email', { consents: ledger, suppressions: [] });
    assert.equal(v.allowed, false);
    assert.equal(v.reasonCode, 'CONSENT_MISSING');
  });
  it('never returns a confidence score in a verdict', () => {
    const v = canContact(verifiedContact(), 'voice', { consents: consentedLedger(), suppressions: [] });
    assert.equal('confidence' in v, false);
    assert.equal('score' in v, false);
  });
  it('returns a stable, auditable reason for every blocked verdict', () => {
    const v = canContact(verifiedContact(), 'voice', { consents: [], suppressions: [] });
    assert.ok(v.reason.length > 10);
    assert.ok(v.reason.includes('consent'));
  });
});
