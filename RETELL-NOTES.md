# Retell voice adapter (Pulsar 3.0, local only)

Built locally only. Not pushed, not deployed live, no live Retell call
made, no phone number bought, no payment made, no real API key used.

## What was built

- server/retellVoice.ts: a Retell adapter behind the VoiceProvider plug
  from server/voiceAgent.ts.
  - The real call creation uses POST
    https://api.retellai.com/v2/create-phone-call, with the key only in
    the Authorization Bearer header, from the server environment only.
  - Server environment variables: RETELL_API_KEY, RETELL_PHONE_NUMBER,
    RETELL_AGENT_ID. All three must be set, or the provider refuses
    to start and no call is attempted.
  - The key is never hardcoded, never logged, never returned, never
    stored in a lead, and never sent from browser code. The status
    function reports only whether each part is set, never its value.
  - A call is never started without a contact phone number.
  - The approved agent script discloses that the caller is an AI
    assistant, that the call may be recorded, and that it is not a
    human employee. The Retell agent itself must be configured with
    that script, because Retell speaks from its own agent prompt once
    a call starts.
  - On interest or a price question, the flow records a live handoff
    request to the owner. Warm transfer itself is configured in the
    Retell agent, to the owner number set by a master admin. This
    adapter does not claim a transfer that Retell did not perform.
  - speak records the approved script line for the audit trail. It
    does not inject speech into a live Retell call, and a recorded
    line must not be presented as proof that the prospect heard that
    exact line live.
  - listen throws a clear error instead of inventing a prospect
    reply. Retell calls are driven by Retell transcripts and
    webhooks, not by polling from this server, so live reply handling
    needs webhook wiring, which is not built here.
- Tests: tests/retellVoice.test.ts, using a stub fetch only.

## What this adapter does NOT do yet

1. It does not buy a Retell phone number. That purchase needs his
   approval before any card step.
2. It does not wire Retell transcripts or webhooks back into Pulsar,
   so a full live call flow with live replies is not yet possible.
3. It does not check consent itself. Callers must run the Phase 7.1
   consent gate first, exactly as runVoiceCall does, and must never
   start this provider for a blocked contact.
4. It does not configure the Retell agent, its voice, or its warm
   transfer target. Those are set in Retell by a master admin.
5. It does not send email or text, and it does not charge anyone.

## Still needed for one live test call

1. A bought Retell US phone number, with his approval before any
   card step.
2. A Retell agent configured with the approved disclosure script and
   a warm transfer to the owner.
3. Webhook wiring for live replies, or a clearly supervised manual
   test that does not claim automated reply handling.
4. His approval for that one consented test call, with a verified
   contact and a passed consent gate.
