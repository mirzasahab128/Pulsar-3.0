// Phase 0 regression tests (Phoenix line).
//
// These tests set a throwaway OWNER_EMAILS *before* importing the security
// module, and stub only the certificate SOURCE via __setCertFetcherForTests.
// Signature verification itself runs for real against a locally generated
// RSA keypair — there is no auth bypass anywhere in this file or the module.
process.env.OWNER_EMAILS = 'owner-test@example.com';

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

const sec = await import('../server/security.js');
const {
  verifyFirebaseIdToken,
  requireOwnerMiddleware,
  assertSafeOutboundUrl,
  createRateLimiter,
  OWNER_EMAILS,
  FIREBASE_PROJECT_ID,
  __setCertFetcherForTests,
  __setDnsResolverForTests
} = sec;

// --- Local RSA keypair standing in for Google's signing keys ---------------
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const otherPrivPem = other.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

function b64u(obj: any): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function mint(overrides: Record<string, any> = {}, signKey: string = privPem): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', kid: 'test-kid', typ: 'JWT' };
  const payload = {
    sub: 'user-123',
    aud: FIREBASE_PROJECT_ID,
    iss: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
    iat: now,
    exp: now + 3600,
    email: 'owner-test@example.com',
    email_verified: true,
    ...overrides
  };
  const data = `${b64u(header)}.${b64u(payload)}`;
  const sig = crypto.createSign('RSA-SHA256').update(data).sign(signKey).toString('base64url');
  return `${data}.${sig}`;
}

before(() => {
  __setCertFetcherForTests(async () => ({ 'test-kid': pubPem }));
});
after(() => {
  __setCertFetcherForTests(null);
  __setDnsResolverForTests(null);
});

describe('Phase 0 — owner identity (C7)', () => {
  it('OWNER_EMAILS comes only from the environment', () => {
    assert.deepEqual(OWNER_EMAILS, ['owner-test@example.com']);
    assert.equal(OWNER_EMAILS.includes('drarshalooz@gmail.com'), false);
    assert.equal(OWNER_EMAILS.includes('mirzann66@gmail.com'), false);
  });
});

describe('Phase 0 — token verification (C3, C4)', () => {
  it('accepts a correctly signed token for this project', async () => {
    const decoded = await verifyFirebaseIdToken(mint());
    assert.equal(decoded.uid, 'user-123');
    assert.equal(decoded.email, 'owner-test@example.com');
  });

  it('rejects a token minted for a DIFFERENT Firebase project (aud)', async () => {
    await assert.rejects(() => verifyFirebaseIdToken(mint({ aud: 'someone-elses-project' })), /audience/);
  });

  it('rejects a token with the wrong issuer', async () => {
    await assert.rejects(
      () => verifyFirebaseIdToken(mint({ iss: 'https://securetoken.google.com/someone-elses-project' })),
      /issuer/
    );
  });

  it('rejects an expired token', async () => {
    const now = Math.floor(Date.now() / 1000);
    await assert.rejects(() => verifyFirebaseIdToken(mint({ exp: now - 60, iat: now - 7200 })), /expired/);
  });

  it('rejects a token signed with the wrong key', async () => {
    await assert.rejects(() => verifyFirebaseIdToken(mint({}, otherPrivPem)), /signature/);
  });

  it('rejects a self-minted token with a garbage signature (C3 regression)', async () => {
    const now = Math.floor(Date.now() / 1000);
    const header = b64u({ alg: 'RS256', kid: 'test-kid', typ: 'JWT' });
    const payload = b64u({
      sub: 'attacker', aud: FIREBASE_PROJECT_ID,
      iss: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      iat: now, exp: now + 3600, email: 'owner-test@example.com', email_verified: true
    });
    await assert.rejects(() => verifyFirebaseIdToken(`${header}.${payload}.AAAA`), /signature/);
  });
});

describe('Phase 0 — owner middleware', () => {
  function run(user: any) {
    const outcome = { passed: false, status: 200, body: null as any };
    const res: any = {
      status: (code: number) => {
        outcome.status = code;
        return { json: (d: any) => { outcome.body = d; } };
      }
    };
    requireOwnerMiddleware({ user } as any, res, () => { outcome.passed = true; });
    return outcome;
  }

  it('passes a verified owner', () => {
    const o = run({ email: 'owner-test@example.com', email_verified: true, uid: 'u1' });
    assert.equal(o.passed, true);
  });

  it('rejects an owner email whose email is NOT verified (C4)', () => {
    const o = run({ email: 'owner-test@example.com', email_verified: false, uid: 'u1' });
    assert.equal(o.passed, false);
    assert.equal(o.status, 403);
    assert.match(o.body.error, /verified email/);
  });

  it('rejects a verified non-owner', () => {
    const o = run({ email: 'customer@hospital.org', email_verified: true, uid: 'u2' });
    assert.equal(o.passed, false);
    assert.equal(o.status, 403);
  });
});

describe('Phase 0 — SSRF guard with DNS resolution (C5)', () => {
  it('rejects a hostname that resolves to loopback (rebinding)', async () => {
    __setDnsResolverForTests(async () => [{ address: '127.0.0.1', family: 4 }]);
    const r = await assertSafeOutboundUrl('https://hooks.example.com/crm');
    assert.equal(r.safe, false);
  });

  it('rejects a hostname that resolves to a private address among public ones', async () => {
    __setDnsResolverForTests(async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.5', family: 4 }
    ]);
    const r = await assertSafeOutboundUrl('https://hooks.example.com/crm');
    assert.equal(r.safe, false);
  });

  it('allows a hostname that resolves only to public addresses', async () => {
    __setDnsResolverForTests(async () => [{ address: '93.184.216.34', family: 4 }]);
    const r = await assertSafeOutboundUrl('https://hooks.example.com/crm');
    assert.equal(r.safe, true);
  });

  it('rejects the cloud metadata literal without any DNS lookup', async () => {
    const r = await assertSafeOutboundUrl('http://169.254.169.254/computeMetadata/v1/');
    assert.equal(r.safe, false);
  });

  it('rejects reserved benchmarking space (198.18.0.0/15)', async () => {
    const r = await assertSafeOutboundUrl('http://198.19.0.2/hook');
    assert.equal(r.safe, false);
  });
});

describe('Phase 0 — rate limiter ignores spoofed X-Forwarded-For (M3)', () => {
  it('rotating XFF values do not reset the bucket when TRUST_PROXY is unset', () => {
    delete process.env.TRUST_PROXY;
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2, message: 'Too many requests' });
    const mkReq = (xff: string): any => ({
      ip: '203.0.113.5',
      path: '/api/chat',
      headers: { 'x-forwarded-for': xff },
      socket: { remoteAddress: '203.0.113.5' }
    });
    const mkRes = (): any => {
      const r: any = { headers: {}, statusCode: 200 };
      r.setHeader = (k: string, v: any) => { r.headers[k] = v; };
      r.status = (code: number) => { r.statusCode = code; return { json: (d: any) => { r.body = d; } }; };
      return r;
    };
    let res = mkRes();
    limiter(mkReq('1.1.1.1'), res, () => {});
    assert.equal(res.statusCode, 200);
    res = mkRes();
    limiter(mkReq('2.2.2.2'), res, () => {});
    assert.equal(res.statusCode, 200);
    res = mkRes();
    limiter(mkReq('3.3.3.3'), res, () => {});
    assert.equal(res.statusCode, 429);
  });
});
