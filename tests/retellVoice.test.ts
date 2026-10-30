// Retell adapter tests. Stub fetch only. No real Retell call, no real
// key, no real phone number, no payment. The key in these tests is a
// test-only placeholder, never a live key.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const retell = await import('../server/retellVoice.js');
const {
  createRetellVoiceProviderFromEnv,
  getRetellStatus,
  retellAgentScript,
  RetellVoiceProvider
} = retell;

function brief(): any {
  return {
    contactId: 'contact-1',
    contactName: 'Alex',
    businessName: 'DemoFix Home Services',
    callingCompany: 'Pulsar Demo Company',
    painPoint: 'slow booking follow-up',
    proofOffer: 'a booking page draft',
    ownerName: 'Sam'
  };
}

function stubFetch(calls: any[]): any {
  return async (_url: string, options: any) => {
    calls.push({ url: _url, options });
    return {
      ok: true,
      status: 201,
      json: async () => ({ call_id: 'test-call-1' })
    };
  };
}

describe('retell status', () => {
  it('reports not configured when any part is missing, and never returns a key', () => {
    const status = getRetellStatus({ RETELL_API_KEY: 'test-key-only' } as any);
    assert.equal(status.configured, false);
    assert.equal(status.keySet, true);
    assert.equal(status.phoneNumberSet, false);
    assert.equal(JSON.stringify(status).includes('test-key-only'), false);
  });
  it('throws from env factory when configuration is incomplete, without logging a key', () => {
    assert.throws(() => createRetellVoiceProviderFromEnv({} as any), /not set up yet/);
  });
});

describe('retell provider with stub fetch', () => {
  it('creates a call with bearer header and from, to, and agent id, and records it', async () => {
    const calls: any[] = [];
    const provider = new RetellVoiceProvider({
      apiKey: 'test-key-only',
      phoneNumber: '+15550001111',
      agentId: 'test-agent-only',
      fetchFn: stubFetch(calls)
    });
    await provider.startCall({ id: 'contact-1', phone: '+15551234567' } as any);
    assert.equal(provider.started, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.retellai.com/v2/create-phone-call');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer test-key-only');
    const body = JSON.parse(calls[0].options.body);
    assert.equal(body.from_number, '+15550001111');
    assert.equal(body.to_number, '+15551234567');
    assert.equal(body.agent_id, 'test-agent-only');
    assert.equal(provider.calls[0].callId, 'test-call-1');
  });
  it('never starts a call without a contact phone, and never calls the stub', async () => {
    const calls: any[] = [];
    const provider = new RetellVoiceProvider({
      apiKey: 'test-key-only',
      phoneNumber: '+15550001111',
      agentId: 'test-agent-only',
      fetchFn: stubFetch(calls)
    });
    await assert.rejects(() => provider.startCall({ id: 'contact-1' } as any), /PHONE_REQUIRED/);
    assert.equal(calls.length, 0);
    assert.equal(provider.started, false);
  });
  it('records a transfer request without claiming a live transfer happened', async () => {
    const provider = new RetellVoiceProvider({
      apiKey: 'test-key-only',
      phoneNumber: '+15550001111',
      agentId: 'test-agent-only',
      fetchFn: stubFetch([])
    });
    await provider.transfer(brief());
    assert.equal(provider.transferRequested, true);
  });
  it('never fabricates a prospect reply from listen', async () => {
    const provider = new RetellVoiceProvider({
      apiKey: 'test-key-only',
      phoneNumber: '+15550001111',
      agentId: 'test-agent-only',
      fetchFn: stubFetch([])
    });
    await assert.rejects(() => provider.listen(), /webhook/);
  });
});

describe('retell agent script', () => {
  it('discloses AI assistant, recording notice, and live handoff, with no em dash', () => {
    const script = retellAgentScript(brief());
    assert.match(script, /AI assistant/);
    assert.match(script, /may be recorded/);
    assert.match(script, /not a human/);
    assert.match(script, /hand the call live/);
    assert.equal(script.includes('\u2014'), false);
  });
});
