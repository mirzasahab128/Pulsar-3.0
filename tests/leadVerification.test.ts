import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateEmailAddress, DISPOSABLE_DOMAINS_STARTER } from '../server/leadVerification.js';

describe('email validation, shape only', () => {
  it('passes a well shaped address but still needs a live check without a resolver', () => {
    const result = validateEmailAddress({ email: 'owner@demo-company.com', contactId: 'c1', at: '2026-10-29T00:00:00.000Z' });
    assert.equal(result.verdict, 'needs_live_check');
    assert.equal(result.domain, 'demo-company.com');
    assert.ok(result.checks.every(c => c.method && c.at));
    assert.match(result.note, /live verification/);
  });
  it('rejects a bad address and flags a disposable domain', () => {
    const bad = validateEmailAddress({ email: 'not-an-email', at: '2026-10-29T00:00:00.000Z' });
    assert.equal(bad.verdict, 'invalid');
    const disposable = validateEmailAddress({ email: `user@${DISPOSABLE_DOMAINS_STARTER[0]}`, at: '2026-10-29T00:00:00.000Z' });
    assert.equal(disposable.verdict, 'invalid');
    assert.ok(disposable.checks.find(c => c.check === 'disposable_domain' && c.passed === false));
  });
  it('uses a stubbed MX result without claiming a live lookup', () => {
    const result = validateEmailAddress({
      email: 'owner@demo-company.com',
      mxResolver: { hasMx: () => true },
      at: '2026-10-29T00:00:00.000Z'
    });
    assert.equal(result.verdict, 'valid_shape');
    assert.match(result.checks.find(c => c.check === 'mx_stub')?.detail || '', /test stub/);
    assert.ok(!JSON.stringify(result).includes('deliverable') || result.note.includes('before any claim'));
  });
  it('never produces a single invented score', () => {
    const result = validateEmailAddress({ email: 'owner@demo-company.com', at: '2026-10-29T00:00:00.000Z' });
    assert.ok(!('score' in result));
    assert.ok(result.checks.every(c => !('score' in c)));
  });
});
