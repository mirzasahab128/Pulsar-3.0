import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addWatch, classifySuppliedItem, signalAuthorisesContact } from '../server/signalMonitor.js';

describe('signal monitor stub', () => {
  it('classifies a supplied hiring item and never authorises contact', () => {
    const signal = classifySuppliedItem(
      { watchId: 'w1', title: 'Now hiring two plumbers', body: 'Join our team in Austin.', publishedAt: '2026-10-29', source: 'public job posting supplied by user' },
      '2026-10-29T00:00:00.000Z'
    );
    assert.equal(signal.kind, 'hiring');
    assert.equal(signal.contactAuthorised, false);
    assert.equal(signal.confidenceLabel, 'supplied-data only');
    assert.equal(signalAuthorisesContact(signal), false);
    assert.match(signal.contactRule, /consent gate must still pass/);
  });
  it('rejects private message and scraping watchlists', () => {
    const list: any[] = [];
    const rejected = addWatch(list, { kind: 'rss_feed', label: 'Private messages watch', source: 'DM feed', addedBy: 'admin' });
    assert.equal(rejected.ok, false);
    assert.equal(list.length, 0);
    const accepted = addWatch(list, { kind: 'rss_feed', label: 'Local business news', source: 'public RSS feed added by user', addedBy: 'admin' });
    assert.equal(accepted.ok, true);
    assert.equal(list.length, 1);
  });
  it('classifies new business, opening, and review items', () => {
    assert.equal(classifySuppliedItem({ watchId: 'w1', title: 'New business opens downtown', body: '', publishedAt: null, source: 'listing' }).kind, 'new_business');
    assert.equal(classifySuppliedItem({ watchId: 'w1', title: 'Grand opening this week', body: '', publishedAt: null, source: 'listing' }).kind, 'opening');
    assert.equal(classifySuppliedItem({ watchId: 'w1', title: 'Review theme: slow replies', body: '', publishedAt: null, source: 'listing' }).kind, 'review_theme_change');
  });
});
