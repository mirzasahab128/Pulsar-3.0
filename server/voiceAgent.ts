/**
 * Phase 7.2 - Voice call part (Phoenix line).
 *
 * Pure call flow, no network, no real phone call, no vendor account.
 * A real voice service (Retell, Vapi, or similar) is plugged in later
 * through the VoiceProvider interface, once the user supplies a key
 * and a phone number through the approved secure route. This module
 * never holds a key, a phone number for dialing, or a vendor account.
 *
 * Hard rule: before any voice step, the Phase 7.1 gate runs. If
 * canContact blocks, the flow stops with a plain reason and the
 * provider is never started. There is no dial, no speak, no transfer
 * on a blocked contact.
 *
 * Pulsar is general, for all businesses and industries. Nothing in
 * this module is industry specific. A healthcare practice is one
 * example contact type, not the product.
 */

import {
  canContact,
  type ConsentRecord,
  type GateContact,
  type GateVerdict,
  type SuppressionRecord
} from './contactGate.js';

export type ProspectReply =
  | 'interested'
  | 'not_interested'
  | 'busy'
  | 'send_email'
  | 'how_much'
  | 'who_are_you'
  | 'call_back_later'
  | 'silence'
  | 'other';

export type CallOutcome =
  | 'blocked'
  | 'transferred'
  | 'callback_booked'
  | 'email_requested'
  | 'not_interested'
  | 'ended';

export interface CallBrief {
  contactId: string;
  contactName: string;
  businessName: string;
  callingCompany: string;
  painPoint: string;
  proofOffer: string;
  ownerName: string;
}

export interface TranscriptEntry {
  speaker: 'agent' | 'prospect' | 'system';
  text: string;
}

export interface VoiceProvider {
  providerName: string;
  startCall(contact: GateContact): Promise<void>;
  speak(text: string): Promise<void>;
  listen(): Promise<ProspectReply>;
  interrupt(): Promise<void>;
  transfer(brief: CallBrief): Promise<void>;
  endCall(): Promise<void>;
}

/**
 * Configuration for a future real provider. Only references are stored
 * here, never a key value and never a dialing number. The real adapter
 * is not built in Phase 7.2.
 */
export interface VoiceProviderConfig {
  providerName: string;
  apiKeyEnvVar: string;
  phoneNumberEnvVar: string;
  configured: boolean;
}

export function unconfiguredProvider(providerName: string): VoiceProviderConfig {
  return {
    providerName,
    apiKeyEnvVar: 'VOICE_PROVIDER_API_KEY',
    phoneNumberEnvVar: 'VOICE_PROVIDER_PHONE_NUMBER',
    configured: false
  };
}

export interface CallResult {
  outcome: CallOutcome;
  gateVerdict: GateVerdict;
  transcript: TranscriptEntry[];
  transferSummary: string | null;
  nextStep: string;
  providerStarted: boolean;
  providerTransferred: boolean;
}

export interface CallNote {
  contactId: string;
  outcome: CallOutcome;
  nextStep: string;
  transferSummary: string | null;
  transcript: TranscriptEntry[];
  note: string;
}

export function openingScript(brief: CallBrief): string {
  return (
    `Hello ${brief.contactName}, this is an AI assistant calling on behalf of ${brief.callingCompany}. ` +
    `This call may be recorded so we can follow up accurately. ` +
    `I noticed ${brief.painPoint} at ${brief.businessName}, and I wanted to share ${brief.proofOffer}. ` +
    `Do you have two minutes to talk about that?`
  );
}

export function disclosureLine(brief: CallBrief): string {
  return `This is an AI assistant calling on behalf of ${brief.callingCompany}, and this call may be recorded.`;
}

export function painPointOpener(brief: CallBrief): string {
  return `For ${brief.businessName}, the issue we see is ${brief.painPoint}. Our proof for that is ${brief.proofOffer}.`;
}

export function transferLine(brief: CallBrief): string {
  return (
    `Thank you, I will connect you now to ${brief.ownerName} at ${brief.callingCompany}, ` +
    `who can talk through the next step with you.`
  );
}

const OBJECTION_LINES: Record<string, string> = {
  not_interested: 'Thank you for your time, I will not call again about this.',
  busy: 'No problem at all. When would be a better time for a short call?',
  send_email: 'Of course, I can send the details by email instead. What is the best email for that?',
  how_much: 'Pricing depends on the size of the work, so I will connect you to someone who can give you an exact answer.',
  who_are_you: 'I am an AI assistant calling on behalf of the company I named at the start of this call, and I am not a human employee. I can connect you to a person if you would like.',
  call_back_later: 'Of course, I will book a callback and we will not keep calling in the meantime.',
  silence: 'Are you still there? I can repeat that in one short sentence if it helps.',
  other: 'Thank you for telling me that. Can you say a little more about what would be useful for you?'
};

export function objectionLine(reply: ProspectReply): string {
  return OBJECTION_LINES[reply] || OBJECTION_LINES.other;
}

/**
 * Run one voice call flow against a provider. The provider is an
 * interface, so tests use a scripted fake and a real service is
 * plugged in later. The flow listens at most twice after a
 * clarification or silence, then closes politely, so it never loops.
 */
export async function runVoiceCall(input: {
  contact: GateContact;
  brief: CallBrief;
  consents: ConsentRecord[];
  suppressions: SuppressionRecord[];
  provider: VoiceProvider;
}): Promise<CallResult> {
  const { contact, brief, provider } = input;
  const verdict = canContact(contact, 'voice', {
    consents: input.consents,
    suppressions: input.suppressions
  });
  const transcript: TranscriptEntry[] = [];
  if (!verdict.allowed) {
    transcript.push({ speaker: 'system', text: `Call blocked by the contact gate: ${verdict.reason}` });
    return {
      outcome: 'blocked',
      gateVerdict: verdict,
      transcript,
      transferSummary: null,
      nextStep: 'Do not call. Fix the gate reason first: verification, consent, or suppression.',
      providerStarted: false,
      providerTransferred: false
    };
  }

  await provider.startCall(contact);
  const opening = openingScript(brief);
  transcript.push({ speaker: 'agent', text: opening });
  await provider.speak(opening);

  let rounds = 0;
  while (rounds < 3) {
    rounds += 1;
    const reply = await provider.listen();
    transcript.push({ speaker: 'prospect', text: `Prospect reply: ${reply}` });

    if (reply === 'interested' || reply === 'how_much') {
      const line = transferLine(brief);
      transcript.push({ speaker: 'agent', text: line });
      await provider.speak(line);
      await provider.transfer(brief);
      await provider.endCall();
      const summary =
        `Live transfer to ${brief.ownerName}. Prospect showed interest. ` +
        `Pain point: ${brief.painPoint}. Proof offered: ${brief.proofOffer}.`;
      return {
        outcome: 'transferred',
        gateVerdict: verdict,
        transcript,
        transferSummary: summary,
        nextStep: 'Owner takes the live call and closes. Log the transfer summary for the owner.',
        providerStarted: true,
        providerTransferred: true
      };
    }
    if (reply === 'not_interested') {
      const line = objectionLine(reply);
      transcript.push({ speaker: 'agent', text: line });
      await provider.speak(line);
      await provider.endCall();
      return {
        outcome: 'not_interested',
        gateVerdict: verdict,
        transcript,
        transferSummary: null,
        nextStep: 'Record the opt-out across email, voice, and text. Do not call again about this.',
        providerStarted: true,
        providerTransferred: false
      };
    }
    if (reply === 'busy' || reply === 'call_back_later') {
      const line = objectionLine(reply);
      transcript.push({ speaker: 'agent', text: line });
      await provider.speak(line);
      await provider.endCall();
      return {
        outcome: 'callback_booked',
        gateVerdict: verdict,
        transcript,
        transferSummary: null,
        nextStep: 'Book a callback at the time the prospect gave. Do not keep calling in the meantime.',
        providerStarted: true,
        providerTransferred: false
      };
    }
    if (reply === 'send_email') {
      const line = objectionLine(reply);
      transcript.push({ speaker: 'agent', text: line });
      await provider.speak(line);
      await provider.endCall();
      return {
        outcome: 'email_requested',
        gateVerdict: verdict,
        transcript,
        transferSummary: null,
        nextStep: 'Send the details by email once, with a clear opt-out, then stop if there is no reply.',
        providerStarted: true,
        providerTransferred: false
      };
    }
    // who_are_you, silence, and other: answer once, then listen again.
    const line = objectionLine(reply);
    transcript.push({ speaker: 'agent', text: line });
    await provider.speak(line);
    if (reply === 'silence' && rounds >= 2) {
      await provider.endCall();
      return {
        outcome: 'ended',
        gateVerdict: verdict,
        transcript,
        transferSummary: null,
        nextStep: 'Call ended after silence. Log the outcome and try a different channel once, if allowed.',
        providerStarted: true,
        providerTransferred: false
      };
    }
  }

  await provider.endCall();
  return {
    outcome: 'ended',
    gateVerdict: verdict,
    transcript,
    transferSummary: null,
    nextStep: 'Call ended politely. Log the outcome and set the next follow-up, if allowed.',
    providerStarted: true,
    providerTransferred: false
  };
}

/**
 * After-call notes, in audit-log style. Only what the call actually
 * produced is recorded. Nothing is invented about the prospect.
 */
export function buildCallNote(result: CallResult, brief: CallBrief): CallNote {
  const lines = [
    `Voice call for ${brief.businessName} (${brief.contactId}): outcome ${result.outcome}.`,
    `Gate: ${result.gateVerdict.reasonCode}.`,
    `Next step: ${result.nextStep}`
  ];
  if (result.transferSummary) lines.push(`Transfer: ${result.transferSummary}`);
  return {
    contactId: brief.contactId,
    outcome: result.outcome,
    nextStep: result.nextStep,
    transferSummary: result.transferSummary,
    transcript: result.transcript,
    note: lines.join(' ')
  };
}

export function formatCallNote(note: CallNote): string {
  return note.note;
}

/**
 * Scripted fake provider for tests and demos only. It never dials.
 * It plays back the replies it was given, in order, and records
 * whether start, transfer, and end were called.
 */
export class FakeVoiceProvider implements VoiceProvider {
  providerName = 'fake-test-provider';
  spoken: string[] = [];
  started = false;
  transferred = false;
  ended = false;
  private replies: ProspectReply[];
  private index = 0;

  constructor(replies: ProspectReply[]) {
    this.replies = replies;
  }

  async startCall(): Promise<void> {
    this.started = true;
  }

  async speak(text: string): Promise<void> {
    this.spoken.push(text);
  }

  async listen(): Promise<ProspectReply> {
    const reply = this.replies[this.index] || 'silence';
    this.index += 1;
    return reply;
  }

  async interrupt(): Promise<void> {
    // Test fake: interruption is recorded by ending the current speak
    // turn, which the flow models as the next listen round.
  }

  async transfer(): Promise<void> {
    this.transferred = true;
  }

  async endCall(): Promise<void> {
    this.ended = true;
  }
}
