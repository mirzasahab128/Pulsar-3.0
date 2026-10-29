import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildCompanyBrief } from '../server/companyResearch.js';

const TEXT = [
  'We provide home repair and plumbing services for busy families.',
  'Our services include leak repair, drain cleaning, and boiler checks.',
  'We are hiring two plumbers in Austin, TX, and our customers wait too long for a reply.',
  'Missed follow-up calls keep costing us repeat work.'
].join(' ');

describe('company research brief from supplied text', () => {
  it('extracts services, hiring, and pain themes without fetching', () => {
    const brief = buildCompanyBrief(
      { companyName: 'DemoFix Home Services', pageText: TEXT, source: 'user pasted text', sourceUrl: null, suppliedBy: 'admin' },
      '2026-10-29T00:00:00.000Z'
    );
    assert.equal(brief.fetchedByPulsar, false);
    assert.ok(brief.whatBusinessDoes.length > 0);
    assert.ok(brief.services.length > 0);
    assert.ok(brief.hiringSignals.length > 0);
    assert.ok(brief.painThemes.includes('missed follow-up'));
    assert.ok(brief.painThemes.includes('slow response time'));
    assert.deepEqual(brief.locations, ['Austin, TX']);
  });
  it('reports nothing found instead of inventing', () => {
    const brief = buildCompanyBrief(
      { companyName: 'Quiet Company', pageText: 'We sell chairs.', source: 'user pasted text' },
      '2026-10-29T00:00:00.000Z'
    );
    assert.deepEqual(brief.hiringSignals, []);
    assert.deepEqual(brief.painThemes, []);
    assert.match(brief.note, /did not fetch/);
  });
});
