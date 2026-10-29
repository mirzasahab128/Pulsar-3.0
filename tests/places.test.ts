import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLACES_FIELD_MASK,
  PLACES_MAX_RESULTS,
  PLACES_NOT_CONFIGURED_MESSAGE,
  createGooglePlacesProvider,
  createStubPlacesProvider,
  dedupePlacesDrafts,
  getPlacesApiKey,
  mapPlaceToDraft,
  searchPlacesWithProvider,
  validatePlacesSearchInput
} from '../server/places.js';

const input = { industry: 'dental clinics', place: 'Austin, TX' };

describe('Google Places adapter', () => {
  it('fails closed when the server key is missing and never attempts a search', () => {
    assert.equal(getPlacesApiKey({}), null);
    assert.equal(getPlacesApiKey({ GOOGLE_PLACES_API_KEY: '   ' }), null);
    assert.throws(
      () => createGooglePlacesProvider(null),
      (err: any) => err.message === PLACES_NOT_CONFIGURED_MESSAGE
    );
    let fetchCalled = false;
    const neverFetch = (async () => { fetchCalled = true; return new Response('{}'); }) as unknown as typeof fetch;
    assert.throws(() => createGooglePlacesProvider('', neverFetch));
    assert.equal(fetchCalled, false);
  });

  it('sends the key only in the header and requests only the allowed field mask', async () => {
    let seenHeaders: any = null;
    let seenBody: any = null;
    const fakeFetch = (async (_url: string, opts: any) => {
      seenHeaders = opts.headers;
      seenBody = JSON.parse(opts.body);
      return new Response(JSON.stringify({ places: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = createGooglePlacesProvider('test-server-key', fakeFetch);
    await provider.search(input);
    assert.equal(seenHeaders['X-Goog-Api-Key'], 'test-server-key');
    assert.equal(seenHeaders['X-Goog-FieldMask'], PLACES_FIELD_MASK);
    assert.ok(!seenBody.textQuery.includes('test-server-key'));
    assert.ok(!JSON.stringify(seenHeaders).includes('places.googleapis.com'));
    assert.equal(seenBody.maxResultCount, 20);
    assert.match(PLACES_FIELD_MASK, /places\.rating/);
    assert.match(PLACES_FIELD_MASK, /places\.userRatingCount/);
    assert.ok(!PLACES_FIELD_MASK.includes('review'));
  });

  it('maps fields and keeps missing phone, website, rating, and review count missing', () => {
    const draft = mapPlaceToDraft(
      {
        id: 'ChIJdemo1',
        displayName: { text: 'Demo Dental' },
        formattedAddress: '1 Demo Street, Austin, TX'
      },
      input,
      '2026-10-29T00:00:00.000Z'
    );
    assert.equal(draft.name, 'Demo Dental');
    assert.equal(draft.phone, null);
    assert.equal(draft.website, null);
    assert.equal(draft.rating, null);
    assert.equal(draft.reviewCount, null);
    assert.equal(draft.status, 'places_draft_not_verified');
    assert.equal(draft.verifiedContact, false);
    assert.equal(draft.contactAuthorised, false);
    assert.equal(draft.provenance.source, 'Google Places');
    assert.equal(draft.provenance.placeId, 'ChIJdemo1');
    assert.equal(draft.provenance.method, 'Google Places Text Search (New)');
    assert.ok(!('score' in draft));
  });

  it('maps aggregate rating and review count only, never review text', () => {
    const draft = mapPlaceToDraft(
      {
        id: 'ChIJdemo2',
        displayName: { text: 'Demo Dental Two' },
        rating: 4.6,
        userRatingCount: 128,
        nationalPhoneNumber: '(512) 555-0100',
        websiteUri: 'https://demo.example'
      },
      input
    );
    assert.equal(draft.rating, 4.6);
    assert.equal(draft.reviewCount, 128);
    assert.ok(!JSON.stringify(draft).toLowerCase().includes('review text'));
  });

  it('dedupes by place id first', () => {
    const a = mapPlaceToDraft({ id: 'same-id', displayName: { text: 'One' } }, input);
    const b = mapPlaceToDraft({ id: 'same-id', displayName: { text: 'One Again' } }, input);
    const out = dedupePlacesDrafts([a, b]);
    assert.equal(out.drafts.length, 1);
    assert.equal(out.duplicatesRemoved, 1);
  });

  it('dedupes by normalised name plus phone when there is no place id', () => {
    const a = mapPlaceToDraft(
      { displayName: { text: 'Demo  Clinic' }, nationalPhoneNumber: '(512) 555-0100' },
      input
    );
    const b = mapPlaceToDraft(
      { displayName: { text: 'demo clinic' }, internationalPhoneNumber: '5125550100' },
      input
    );
    const out = dedupePlacesDrafts([a, b]);
    assert.equal(out.drafts.length, 1);
    assert.equal(out.duplicatesRemoved, 1);
  });

  it('does not merge same name drafts when phone is missing', () => {
    const a = mapPlaceToDraft({ displayName: { text: 'Same Name' } }, input);
    const b = mapPlaceToDraft({ displayName: { text: 'Same Name' } }, input);
    const out = dedupePlacesDrafts([a, b]);
    assert.equal(out.drafts.length, 2);
  });

  it('caps results at 20 per search', async () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      id: `place-${i}`,
      displayName: { text: `Place ${i}` }
    }));
    const result = await searchPlacesWithProvider(createStubPlacesProvider(many), input);
    assert.equal(result.totalReturned, 25);
    assert.equal(result.drafts.length, PLACES_MAX_RESULTS);
    assert.equal(result.cappedAt, 20);
  });

  it('rejects missing industry or place and overlong input', () => {
    assert.equal(validatePlacesSearchInput({ industry: '', place: 'Austin, TX' }), 'INDUSTRY_REQUIRED');
    assert.equal(validatePlacesSearchInput({ industry: 'dental', place: '  ' }), 'PLACE_REQUIRED');
    assert.equal(validatePlacesSearchInput({ industry: 'x'.repeat(121), place: 'Austin' }), 'INDUSTRY_TOO_LONG');
    assert.equal(validatePlacesSearchInput({ industry: 'dental', place: 'x'.repeat(201) }), 'PLACE_TOO_LONG');
    assert.equal(validatePlacesSearchInput(input), null);
  });

  it('rejects a search with missing input before calling the provider', async () => {
    let called = false;
    const provider = {
      async search() { called = true; return []; }
    };
    await assert.rejects(() => searchPlacesWithProvider(provider, { industry: '', place: 'Austin' }));
    assert.equal(called, false);
  });
});
