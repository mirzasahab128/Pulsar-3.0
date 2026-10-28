# Phase 7.2 - Voice call part (local only, not pushed, not deployed)

Built 2026-10-28 in the Phoenix line, dev copy only, then synced to staging.

## What was built
- server/voiceAgent.ts: provider-neutral voice flow. It runs the Phase 7.1
  canContact gate first; on a block it stops with a plain reason and the
  provider is never started, never speaks, never transfers.
- Script: opening disclosure (AI assistant, on behalf of the company,
  call may be recorded), pain-point opener, and objection branches:
  interested, not interested, busy, send email, how much, who are you,
  call back later, silence, other. Interested or price questions go to
  a live transfer branch with a transfer summary for the owner.
- VoiceProvider interface: startCall, speak, listen, interrupt, transfer,
  endCall. A real service (Retell, Vapi, or similar) is plugged in later
  only with a key and phone number supplied through the approved secure
  route. Phase 7.2 stores only env-var references, never a key value.
- FakeVoiceProvider: scripted test provider, never dials.
- After-call notes: buildCallNote / formatCallNote, from the actual
  outcome only, no invented results, in audit-log style.
- General business framing only. A healthcare practice is one example
  contact type, not the product. No em dashes in new user-facing copy.

## What was NOT built
- No real phone call, no phone number bought, no vendor account, no
  real voice service adapter, no live transfer to a real phone, no
  HTTP route, no UI screen. Those need a supplied key, number, and a
  separate approval step.
- No live National DNC lookup (see Phase 7.1 notes).

## Tests
- Before: tsc clean, npm 108/108, 32 suites.
- After: tsc clean, npm 126/126, 36 suites (18 new Phase 7.2 tests).
- Build: npm run build succeeded.
- Store: server-data/store.json unchanged vs pre-build backup.

## Files
- server/voiceAgent.ts (new)
- tests/voiceAgent.test.ts (new)
- PHASE7-2-NOTES.md (new)
