# Lead prep and signals (Pulsar 3.0, local only)

Built locally, not pushed, not deployed live. Nothing here sends, calls, fetches a page, or authorises contact. Test data only.

## New modules

- server/leadVerification.ts: email shape checks in order (syntax, domain shape, starter disposable list, stubbed MX when supplied). Per-field results with method and timestamp, no single score. A result without a live service is needs_live_check, never deliverable.
- server/companyResearch.ts: company brief from user-supplied text only. Extracts what the business does, services, locations, hiring signals, and generic pain themes. fetchedByPulsar is always false. Not found is reported as not found, never invented.
- server/signalMonitor.ts: watchlist and supplied-item classification only. Allowed kinds are rss_feed, job_posting, business_listing, own_mailbox, own_calendar. Excluded sources (private messages, DMs, de-anonymising, scraping, bulk social watching) are rejected. Every signal has contactAuthorised false and the rule that the Phase 7 consent gate must still pass first.

## Wiring

- server/platform.ts: new leadPrep state (emailChecks, companyBriefs, watches, signals) with migration for older stores.
- server.ts: master-admin routes under /api/admin/lead-prep/ (overview, email-check, company-brief, watch, signal), all audit logged.
- src/services/api.ts: lead prep client methods.
- src/components/LeadPrepPage.tsx: new page in the existing look, master-admin gated in App.tsx.
- src/components/SpatialSidebar.tsx: Lead prep and signals item under Outreach, marked NEW.
- src/types.ts: lead_prep module id.

## Tests

- tests/leadVerification.test.ts, tests/companyResearch.test.ts, tests/signalMonitor.test.ts.

## Still needed before production use

1. A live email verification service: real MX lookup, catch-all probe, and deliverability result, replacing the stubbed MX and the starter disposable list.
2. A live fetch service for company research: only for pages the user supplies or that are public and allowed, with a fetch log, and still never a claim that a brief authorises contact.
3. A live feed reader for RSS feeds the user adds, plus consented mailbox and calendar reads, each checked against its own terms.
4. A Google Maps route that is compliant: the official Places service with a proper key and terms, or user-supplied listings, or the existing live NPI Registry data. No Maps scraping is built here, on purpose.
5. HTTP route tests (same standing limitation as Phase 7: they need a Firebase token stub and a live test server) and a live phone check of the new page after deploy.
