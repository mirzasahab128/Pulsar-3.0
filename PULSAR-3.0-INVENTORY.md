# Pulsar 3.0 - What Is In This Folder (Plain Language)

Status: pushed to GitHub on 2026-10-29, repo mirzasahab128/Pulsar-3.0,
branch main, commit dc1bd0365b7940b311f5fc983782ad903a1d0d36.
NOT deployed live. NOT changed on the live site. No real call, email, or
text was made. No real key and no real contact data was used.

The live site keeps its current look. This folder is the new line the user
asked for: everything discussed so far, built into a new Pulsar 3.0, with
no look change to the live site. The live site update is a separate second
step, and it must also keep its current look.

## How this folder was made

It is a clean copy of the Pulsar 2.0 staging folder
(~/workspace/projects/pulsar-2.0/), with one cleanup only, see below.
No screen, tab, page, button, or menu item was renamed, removed, or
restyled. The look is exactly the look that was already in Pulsar 2.0.

Cleanup, and why it changes nothing you can see:
- Two stray duplicate files were removed from this 3.0 copy only:
  src/SpatialSidebar.tsx and src/CalendarView.tsx. They sat in the wrong
  folder, they were never opened by the app, and the app uses the correct
  copies in src/components/ instead. Removing them fixed the type check
  and changed no screen at all. They are still present in Pulsar 2.0.
- One dead component file was kept on purpose:
  src/components/AdminAccessControlCenter.tsx. Nothing in the app opens
  it, but removing it was not needed for the build, so it stays until the
  user decides otherwise.

Local-only helpers, not part of any push:
- node_modules in this folder is a link to the dev copy's toolchain, so
  the checks could run here without copying 600 MB again. It is ignored
  by Git and must not be pushed.
- dist/ is the build output made during checking. It is also ignored by
  Git and must not be pushed.

## What is included, and where it came from

Pulsar is for every industry, not only RCM. Healthcare and RCM is
Industry Pack 1, one pack among others. A lead means a verified business
contact in any industry.

1. Pulsar 2.0 baseline (Phases 0 to 6)
   - Sign-in, Access Gateway, and the Admin Command Center with
     approvals, plan and feature limits, monthly limits, per-user feature
     overrides, titles, and a full audit log.
   - Master admin is set by environment setting only, never written
     into the code.
   - Dashboard, lead discovery, pipeline, campaigns, email outreach,
     calendar, maps, and the other existing tools, with the same look
     and the same menu items as before.
   - NPI search wired to the live CMS NPI Registry, one industry module
     for Healthcare and RCM.
   - Sample content stays labelled DEMO: the Network Builder contacts
     and the Sales and BD deals carry Demo banners and badges, and are
     sample examples only, not real leads, clients, or revenue.

2. General-industry wording rewire (Step 2, 2026-10-28, 27 files)
   - App wording now says business growth for every industry, not RCM
     only. Healthcare and RCM is labelled Industry Pack 1.
   - Sign-in says Full Name / Company Name. Lead views say Business
     Pain Points and Sales Pipeline Status. The chatbot is the Pulsar
     Business Growth Copilot, with Healthcare and RCM as one pack it
     can help with.
   - Open question, NOT changed here: the default industry pack for a
     new user is still Healthcare and RCM (labelled Industry Pack 1).
     Changing the default would change new-user behaviour, so it stays
     until the user decides.

3. Phase 7.1 - Permission book and contact gate
   (server/contactGate.ts, tests/contactGate.test.ts)
   - A consent record per contact per channel: email, voice, and text,
     with type, source, and time.
   - An internal suppression list, plus CSV import of a user-supplied
     do-not-call list. Invalid rows are reported, duplicates skipped.
   - One gate that answers yes or no before any contact: suppressed
     first, then revoked, then unverified, then missing consent.
   - Per-field verification with source and time, no invented
     confidence score. Every gate, consent, and suppression change is
     logged. A new Outreach Gates tab sits inside the Admin Command
     Center. The check route only evaluates, it never sends anything.

4. Phase 7.2 - Voice call part
   (server/voiceAgent.ts, tests/voiceAgent.test.ts)
   - Gate-first call flow: the Phase 7.1 gate runs before any voice
     provider starts. On a block, zero spoken lines, with a plain reason.
   - Call brief, script with AI disclosure and recording notice,
     pain-point opener, and objection answers: interested, not
     interested, busy, send email, how much, who are you, call back
     later, silence, and other.
   - Interested or price questions go to a live handoff to the owner,
     with a transfer summary. Not interested leads to an opt-out next
     step. Busy or call-back books a callback.
   - Provider-neutral plug: the config holds only setting names for a
     voice service key and phone number, and reports not configured.
     No real voice service is connected yet.

5. Phase 7.3 - After-call automation
   (server/afterCall.ts, tests/afterCall.test.ts)
   - After a call, the lead moves to the right stage: new, contacted,
     interested, handed to owner, callback booked, nurture, closed won,
     closed lost, or opted out.
   - Interested leads get a short owner summary and an owner follow-up
     task. Email requests get a draft only, never sent. Callbacks get a
     task at the time the prospect gave.
   - Opt-out on any channel cancels pending follow-ups and produces
     no draft and no owner summary. Suppression is per contact only.

6. Phase 7.4 - Owner dashboard
   (server/ownerDashboard.ts, tests/ownerDashboard.test.ts)
   - Owner view inside the Admin Command Center Outreach Gates tab:
     handed-over, hot, waiting for call-back, and stuck leads, plus
     counts for handed-over, hot, waiting, stuck, won, lost, and opted
     out.
   - Owner actions, all reversible and logged: mark won or lost (stops
     follow-ups), reopen (restores stage and tasks, once only), move a
     follow-up to later, and confirm the next step for one lead.
   - No separate owner-only screen outside the admin area yet. No
     revenue or ROI figure is invented; a value only shows if the
     owner entered it, and this step enters none.

7. Phase 7 plan and pricing, as documents (not live billing)
   - Plan file: Pulsar-Phase-7-Autonomous-Calling-Agent-Plan-2026-10-28.md
     in the SaaS goal files. It covers cold email as Step 0 before
     voice, the lead tracker (one timeline per lead across email, text,
     and call, automatic follow-up until won, lost, or opted out, opens
     as a weak signal only), and Build-to-Close (Level 1 automatic
     audit from public data only, Level 2 template prototype reviewed
     by a human, Level 3 custom build only after close, paid, never a
     full free build up front; reviews shown as aggregate stars, count,
     trend, and themes only).
   - Finalized pricing, not yet published and not yet built as billing:
     Starter $149 per month, up to 200 leads; Growth $299 per month,
     up to 1,000 leads; Scale $599 per month, up to 3,000 leads plus
     priority support. Per workspace, not per seat. 14-day free trial.
     Calling is a separate add-on, not in those tiers. Billing version 1
     is manual, admin-approved accounts.

## What is deliberately NOT included yet

- No real voice service adapter. No live transfer to a real phone.
  No real call has been made. Needs the user's voice service key and
  phone number, plus approval for that exact step.
- No real sending of any email or text. Drafts stay drafts. A human
  approved send step is still required before any draft goes out.
- No live US National Do Not Call lookup. The gate uses the internal
  suppression list and user-supplied CSV only, and fails closed.
  A live lookup needs paid registration.
- No live Maps enrichment. No LinkedIn enrichment, and never LinkedIn
  scraping. The data source decision is still open: compliant paid
  enrichment only.
- No real Gemini key. No live Gemini-powered search. No checkout or
  billing code. Pricing above is a document, not a payment system.
- No live deployment, no live database migration, and no change to the
  live site's look, menu, or screens. The live store file was not
  touched by the checks in this folder.

## Checks run in this folder

- Type check: clean, after the two stray duplicates above were removed.
  Before that cleanup, the type check failed only on those two stray
  files, which the app never opens.
- Tests: 149 passing, 39 suites, 0 failing. Before this assembly the
  dev copy was already at 149 passing, so the 3.0 copy matches it.
- Production build: succeeded, 3,127 modules transformed.
- Em dashes: none in the four new Phase 7 server files. Pre-existing
  em dashes remain only in comments inside src/services/api.ts, not in
  user-facing copy, and nothing new introduced any.
- Demo labelling: Demo banners and badges are still present in the
  Network Builder and Sales and BD tools.
- Limits of these checks: HTTP route tests were NOT run (they need a
  Firebase token stub and a live test server, same as Phases 7.1 to
  7.4). Routes are type-checked, and the logic they call is tested.
  This folder was NOT compiled from a separate clean install; it used
  the dev copy's toolchain through the link noted above.

## Files changed versus Pulsar 2.0 staging

Only these, plus this inventory file:
- REMOVED (3.0 only): src/SpatialSidebar.tsx, src/CalendarView.tsx
  (stray duplicates, never imported, see cleanup above).
- Everything else in this folder is byte-identical to Pulsar 2.0
  staging, including all Phase 7.1, 7.2, 7.3, and 7.4 files, the
  general-industry wording, the pricing documents are outside this
  folder, and the live look and menu.

## Exact next steps

Step A - Pulsar 3.0 repo (blocked on the user, nothing to do by Phoenix
until then):
1. The user creates a new private repo named Pulsar-3.0 on GitHub
   himself. Phoenix cannot create repos: the GitHub connector returns
   403 for repo creation. This stays the user's gate, with no nagging.
2. Once the repo exists, Phoenix pushes this folder to its main branch
   with the usual text-only push, then verifies the head commit and
   reads back key files, exactly as done for Pulsar 2.0.
3. Only after that push is verified can deployment of 3.0 be discussed.
   Do not deploy 3.0 to the live Pulsar address unless the user says
   so for that exact step.

Step B - Existing live site (separate step, NOT done here):
1. Add the same features from this inventory to the existing live
   Pulsar site, feature by feature, with NO look change: same screens,
   same menu, same colours, same buttons, only new options and
   functions added inside them.
2. The live site pieces to port, in order: Phase 7.1 gate, general
   wording (already decided, default pack question still open),
   Phase 7.2 voice plug, Phase 7.3 after-call automation, Phase 7.4
   owner dashboard, plus the finalized pricing copy only when the
   user approves the final pricing text for publishing.
3. Real calling, real sending, live Maps, and live enrichment stay
   gated on the user's keys, approvals, and the compliance review,
   exactly as in this inventory. Nothing live changes until the user
   gives a go-ahead for that exact live step.

## Visible sidebar items added 2026-10-29 (3.0 only, not pushed yet)

Same sidebar style, colours, and layout as the live look. Only three items added, all marked NEW:
- Outreach, after Follow-ups and Tasks: Consent Gates, opens Admin Command Center, Outreach Gates tab, Phase 7.1 section.
- Outreach, after Consent Gates: After-call follow-up, opens the same tab, Phase 7.3 section.
- Administration, after Admin Command Center: Owner dashboard, opens the same tab, Phase 7.4 section.
No existing sidebar item was removed, renamed, moved, or restyled. Calling and Voice Studio carries a short gate-first note, with no layout change. Non-master users see the same honest unavailable panel as for Admin Command Center, because the server gate still applies.

## Separate pages and mobile responsiveness (2026-10-29, not yet pushed)
- The three visible NEW sidebar items now open three separate pages, not the
  Admin Command Center page: Consent Gates, After-call follow-up, and Owner
  dashboard. Admin Command Center itself is unchanged and still reachable
  from its own sidebar item. All three pages reuse the existing Phase 7
  apiService methods and server actions; no sending or calling logic was
  duplicated, and drafts stay drafts.
- Mobile responsiveness: grids in Dashboard, Pipeline, Network, Sales/BD,
  Lead lists, Call Studio, and Admin now stack to one column on narrow
  phones and expand on larger screens, Admin form inputs are full width on
  mobile, and a new responsive-3.0.css safety net stops media and long
  words from pushing the page sideways. Colours and theme were not changed.
  No screen, tab, or button was removed.
