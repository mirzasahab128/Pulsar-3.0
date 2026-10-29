# Google Places search (Pulsar 3.0, local only)

Built locally only. Not pushed, not deployed live, no live Google API call made, no real API key used, no website scraped, nothing sent, nothing called.

## What was built

- server/places.ts: a pure server-side adapter with a provider interface.
  - The real provider uses Google Places Text Search (New): POST https://places.googleapis.com/v1/places:searchText.
  - The key is sent only in the X-Goog-Api-Key header, from the server environment only. It is never sent from the browser, never hardcoded, never logged, and never stored in the lead store.
  - If the key is missing, the provider fails closed with a clear plain language error and no search is attempted.
  - Request only uses this field mask: id, displayName, formattedAddress, nationalPhoneNumber, internationalPhoneNumber, websiteUri, rating, userRatingCount, regularOpeningHours, businessStatus, types.
  - Input rules: industry plus place are both required, results are capped at 20 per search, no bulk search, no automatic follow-on search.
  - Each place maps to a lead draft with provenance: source Google Places, place id, method, timestamp, and only the fields actually returned. A missing phone, website, rating, or review count stays missing, never invented.
  - Review data is aggregate only: rating and review count, never copied review text. No invented score.
  - Dedupe by place id first, then by normalised name plus phone. A draft with no place id and no phone is never merged on name alone.
  - A Places draft is preparation only. Its status is places_draft_not_verified, verifiedContact is false, and contactAuthorised is false. It never authorises contact. The existing lead verification step and the Phase 7 consent gate must still pass before any contact, and opt out still stops email, text, and call at once.
- Wiring, master-admin only, reusing the lead prep pattern:
  - server/platform.ts: placesDrafts added to the lead prep state, with migration for older stores.
  - server.ts: POST /api/admin/lead-prep/places-search, audit logged, plus placesDrafts and placesKeyConfigured in the lead prep overview. The overview flag says only whether a key is set, never the key itself.
  - src/services/api.ts: searchLeadPrepPlaces client method.
  - src/components/LeadPrepPage.tsx: a clearly labelled Google Places search section, with a visible note saying live Places is off until a server key is set.
  - No browser-side Maps or Places key was added, the existing browser Maps config was not touched, and the 2.0 site was not changed.
- Tests: tests/places.test.ts.

## Server environment variable

The exact server environment variable name is: GOOGLE_PLACES_API_KEY

Set it on the server only, never in the browser, never in chat, and never in a file that is pushed.

## Key rules for the live key

- The live key must be a separate server key restricted to the Places API only.
- Do not reuse the old browser key for this. The old browser key is for browser use and must stay separate.
- Do not paste any key in chat. The key is set on the server environment only.
- Google Cloud billing must be on for live use. Places is pay per request after any free credit, so check the cost per request in Google Cloud before running many searches.

## Fields returned

For each place, only the fields in the mask above are requested: id, displayName, formattedAddress, nationalPhoneNumber, internationalPhoneNumber, websiteUri, rating, userRatingCount, regularOpeningHours, businessStatus, types. Any of these may be missing in a real result, and a missing field stays missing in the draft.

## What is still needed for a live check

1. A real server key, set on the server only, restricted to the Places API only, with Google Cloud billing on. This needs his key and his approval.
2. One live search, only with his approval for that search, using one industry and one place he picks.
3. His check that the returned fields look right and that the cost shown in Google Cloud looks right.
4. A live phone check of the new Places section on the Lead Prep page after deploy.

## What Places alone does not prove

No Maps lead is verified from Places alone. A Places draft is not a verified contact. Before any contact, the lead verification step must run and the Phase 7 consent gate must pass, and an opt-out must still stop all channels at once.
