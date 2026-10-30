/**
 * Retell voice adapter (Phoenix line, local only, no live call made here).
 *
 * This adapter sits behind the VoiceProvider plug from voiceAgent.ts.
 * It creates a Retell phone call through the Retell API, using a key
 * that is read only from the server environment. The key is never
 * hardcoded, never logged, never returned, never stored in a lead,
 * and never sent from browser code.
 *
 * Hard rules, kept from voiceAgent.ts:
 * - The caller is always introduced as an AI assistant, never as a
 *   human, and the call carries a recording notice. Those words live
 *   in the approved script below and in openingScript in voiceAgent.ts.
 *   The Retell agent itself must be configured with that same script,
 *   because Retell speaks from its own agent prompt once a call starts.
 * - The Phase 7.1 consent gate must pass before any call. This file
 *   does not check consent itself. Callers must run canContact first,
 *   exactly as runVoiceCall does, and must never start this provider
 *   for a blocked contact.
 * - A prospect showing interest, or asking about price, is handed to
 *   a live owner. In Retell that warm transfer is configured in the
 *   Retell agent, to the owner number set by a master admin. This
 *   adapter records the transfer request; it does not invent a
 *   transfer that Retell did not perform.
 *
 * Honest limits of this adapter:
 * - startCall creates a call through the Retell API. It does not dial
 *   from this server directly.
 * - speak records the approved script line for the audit trail. It
 *   does not inject speech into a live Retell call, because Retell
 *   speaks from its agent prompt. Do not present a recorded line as
 *   proof that the prospect heard that exact line live.
 * - listen is not a live transcript. Retell calls are driven by
 *   Retell transcripts and webhooks, not by polling from this server.
 *   listen therefore throws a clear error, so no prospect reply is
 *   ever fabricated. A live call flow still needs webhook wiring,
 *   which is not built here.
 * - No phone number is bought here, no payment is made here, and no
 *   real Retell call is made by the tests. Tests use a stub fetch.
 */

import type { GateContact } from './contactGate.js';
import type {
  CallBrief,
  ProspectReply,
  VoiceProvider
} from './voiceAgent.js';

export const RETELL_API_URL = 'https://api.retellai.com/v2/create-phone-call';
export const RETELL_API_KEY_ENV = 'RETELL_API_KEY';
export const RETELL_PHONE_NUMBER_ENV = 'RETELL_PHONE_NUMBER';
export const RETELL_AGENT_ID_ENV = 'RETELL_AGENT_ID';

export const RETELL_NOT_CONFIGURED_MESSAGE =
  'Live Retell calling is not set up yet. A server key, a Retell phone number, and a Retell agent id have not all been set, so no call was started.';

export const RETELL_LISTEN_MESSAGE =
  'Retell calls are driven by Retell transcripts and webhooks, not by polling from this server. Live reply handling needs webhook wiring, which is not built yet, so no reply was invented here.';

export const RETELL_TRANSFER_NOTE =
  'Live handoff to the owner is configured in the Retell agent, to the owner number set by a master admin. This adapter records the transfer request; it does not claim a transfer that Retell did not perform.';

export interface RetellStatus {
  providerName: 'retell';
  configured: boolean;
  keySet: boolean;
  phoneNumberSet: boolean;
  agentIdSet: boolean;
  note: string;
}

/** Status only. This never returns a key value, a phone number, or an agent id. */
export function getRetellStatus(env: NodeJS.ProcessEnv = process.env): RetellStatus {
  const keySet = Boolean((env[RETELL_API_KEY_ENV] || '').trim());
  const phoneNumberSet = Boolean((env[RETELL_PHONE_NUMBER_ENV] || '').trim());
  const agentIdSet = Boolean((env[RETELL_AGENT_ID_ENV] || '').trim());
  const configured = keySet && phoneNumberSet && agentIdSet;
  return {
    providerName: 'retell',
    configured,
    keySet,
    phoneNumberSet,
    agentIdSet,
    note: configured
      ? 'Retell is configured on the server. A live call still needs a passed consent gate, a bought Retell phone number, and webhook wiring for live replies.'
      : RETELL_NOT_CONFIGURED_MESSAGE
  };
}

export interface RetellCallRecord {
  callId: string | null;
  toNumber: string;
  fromNumber: string;
  startedAt: string;
}

/**
 * The approved agent script for a Retell agent. It must match the
 * disclosure in voiceAgent.ts: AI assistant, on behalf of the calling
 * company, recording notice, never pretending to be human.
 */
export function retellAgentScript(brief: CallBrief): string {
  return (
    `You are an AI assistant calling on behalf of ${brief.callingCompany}. ` +
    `At the start of every call, say that you are an AI assistant and that ` +
    `this call may be recorded. You are not a human employee. ` +
    `Your proof offer is ${brief.proofOffer}. ` +
    `If the prospect shows interest or asks about price, hand the call live ` +
    `to ${brief.ownerName} at ${brief.callingCompany} using the warm transfer ` +
    `configured in this agent. If the prospect is not interested, thank them, ` +
    `stop, and do not call again about this.`
  );
}

export interface RetellProviderOptions {
  apiKey: string;
  phoneNumber: string;
  agentId: string;
  fetchFn?: typeof fetch;
}

export class RetellVoiceProvider implements VoiceProvider {
  providerName = 'retell';
  spoken: string[] = [];
  started = false;
  transferred = false;
  transferRequested = false;
  ended = false;
  calls: RetellCallRecord[] = [];
  private apiKey: string;
  private phoneNumber: string;
  private agentId: string;
  private fetchFn: typeof fetch;
  private callId: string | null = null;

  constructor(options: RetellProviderOptions) {
    if (!options.apiKey || !options.apiKey.trim()) throw new Error(RETELL_NOT_CONFIGURED_MESSAGE);
    if (!options.phoneNumber || !options.phoneNumber.trim()) throw new Error(RETELL_NOT_CONFIGURED_MESSAGE);
    if (!options.agentId || !options.agentId.trim()) throw new Error(RETELL_NOT_CONFIGURED_MESSAGE);
    this.apiKey = options.apiKey.trim();
    this.phoneNumber = options.phoneNumber.trim();
    this.agentId = options.agentId.trim();
    this.fetchFn = options.fetchFn || fetch;
  }

  async startCall(contact: GateContact): Promise<void> {
    if (!contact.phone || !contact.phone.trim()) {
      throw new Error('RETELL_CONTACT_PHONE_REQUIRED');
    }
    const response = await this.fetchFn(RETELL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        from_number: this.phoneNumber,
        to_number: contact.phone.trim(),
        agent_id: this.agentId
      })
    });
    if (!response.ok) {
      throw new Error(`Retell returned HTTP ${response.status}`);
    }
    const data = (await response.json()) as { call_id?: string | null; callId?: string | null };
    this.callId = data.call_id || data.callId || null;
    this.started = true;
    this.calls.push({
      callId: this.callId,
      toNumber: contact.phone.trim(),
      fromNumber: this.phoneNumber,
      startedAt: new Date().toISOString()
    });
  }

  async speak(text: string): Promise<void> {
    this.spoken.push(text);
  }

  async listen(): Promise<ProspectReply> {
    throw new Error(RETELL_LISTEN_MESSAGE);
  }

  async interrupt(): Promise<void> {
    // No live interruption is claimed here. A live Retell call is
    // controlled by its agent prompt, not by this server.
  }

  async transfer(_brief: CallBrief): Promise<void> {
    this.transferred = true;
    this.transferRequested = true;
  }

  async endCall(): Promise<void> {
    this.ended = true;
  }
}

/** Build a Retell provider from the server environment. Throws if any part is missing. */
export function createRetellVoiceProviderFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  fetchFn?: typeof fetch
): RetellVoiceProvider {
  const status = getRetellStatus(env);
  if (!status.configured) throw new Error(RETELL_NOT_CONFIGURED_MESSAGE);
  return new RetellVoiceProvider({
    apiKey: (env[RETELL_API_KEY_ENV] || '').trim(),
    phoneNumber: (env[RETELL_PHONE_NUMBER_ENV] || '').trim(),
    agentId: (env[RETELL_AGENT_ID_ENV] || '').trim(),
    fetchFn
  });
}
