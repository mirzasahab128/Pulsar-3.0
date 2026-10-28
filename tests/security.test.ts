import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { 
  isSafeOutboundUrl, 
  securityHeadersMiddleware, 
  createRateLimiter, 
  requireAuthMiddleware, 
  requireOwnerMiddleware,
  OWNER_EMAILS
} from '../server/security.js';

describe('Pulsar Security & Integrity Test Suite', () => {
  describe('SSRF Guard (isSafeOutboundUrl)', () => {
    it('blocks localhost and loopback IPv4 addresses', () => {
      const res1 = isSafeOutboundUrl('http://localhost:3000/api/keys');
      assert.equal(res1.safe, false);

      const res2 = isSafeOutboundUrl('http://127.0.0.1/admin');
      assert.equal(res2.safe, false);

      const res3 = isSafeOutboundUrl('http://0.0.0.0/');
      assert.equal(res3.safe, false);
    });

    it('blocks Cloud metadata service IP (169.254.169.254)', () => {
      const res = isSafeOutboundUrl('http://169.254.169.254/computeMetadata/v1/');
      assert.equal(res.safe, false);
    });

    it('blocks private RFC-1918 networks (10.x, 192.168.x, 172.16-31.x)', () => {
      assert.equal(isSafeOutboundUrl('http://10.1.2.3/internal').safe, false);
      assert.equal(isSafeOutboundUrl('http://192.168.0.1/router').safe, false);
      assert.equal(isSafeOutboundUrl('http://172.20.0.5/api').safe, false);
    });

    it('allows legitimate external HTTPS domains', () => {
      assert.equal(isSafeOutboundUrl('https://npiregistry.cms.hhs.gov/api/').safe, true);
      assert.equal(isSafeOutboundUrl('https://api.resend.com/emails').safe, true);
      assert.equal(isSafeOutboundUrl('https://generativelanguage.googleapis.com').safe, true);
    });

    it('rejects unsupported protocols (file, ftp, javascript)', () => {
      assert.equal(isSafeOutboundUrl('file:///etc/passwd').safe, false);
      assert.equal(isSafeOutboundUrl('ftp://ftp.example.com').safe, false);
    });
  });

  describe('Security Headers Middleware', () => {
    it('sets standard defensive HTTP response headers', () => {
      const headers: Record<string, string> = {};
      const mockRes: any = {
        setHeader: (k: string, v: string) => {
          headers[k] = v;
        }
      };
      let called = false;
      securityHeadersMiddleware({} as any, mockRes, () => {
        called = true;
      });

      assert.equal(called, true);
      assert.equal(headers['X-Content-Type-Options'], 'nosniff');
      assert.equal(headers['X-Frame-Options'], 'SAMEORIGIN');
      assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
      assert.ok(headers['Permissions-Policy']);
    });
  });

  describe('Rate Limiter', () => {
    it('throttles requests that exceed specified threshold', () => {
      const limiter = createRateLimiter({ windowMs: 1000, max: 2, message: 'Too many requests' });
      const req: any = { ip: '192.0.2.1', path: '/api/leads/scrape', headers: {} };
      let statusCode = 200;
      let responseBody: any = null;
      const res: any = {
        setHeader: () => {},
        status: (code: number) => {
          statusCode = code;
          return {
            json: (data: any) => {
              responseBody = data;
            }
          };
        }
      };

      // Call 1 - should pass
      limiter(req, res, () => {});
      assert.equal(statusCode, 200);

      // Call 2 - should pass
      limiter(req, res, () => {});
      assert.equal(statusCode, 200);

      // Call 3 - should be throttled (429)
      limiter(req, res, () => {});
      assert.equal(statusCode, 429);
      assert.equal(responseBody.success, false);
    });
  });

  describe('Authentication Middleware', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const req: any = { headers: {} };
      let statusCode = 200;
      let body: any = null;
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return { json: (d: any) => { body = d; } };
        }
      };

      await requireAuthMiddleware(req, res, () => {});
      assert.equal(statusCode, 401);
      assert.equal(body.success, false);
      assert.match(body.error, /missing or invalid/);
    });

    it('returns 401 when token is invalid or corrupted', async () => {
      const req: any = { headers: { authorization: 'Bearer invalid.token.payload' } };
      let statusCode = 200;
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return { json: () => {} };
        }
      };

      await requireAuthMiddleware(req, res, () => {});
      assert.equal(statusCode, 401);
    });
  });

  describe('Owner Authorization Middleware', () => {
    it('allows verified owner emails', () => {
      for (const email of OWNER_EMAILS) {
        const req: any = { user: { email, uid: 'owner-uid' } };
        let passed = false;
        const res: any = {
          status: () => ({ json: () => {} })
        };
        requireOwnerMiddleware(req, res, () => {
          passed = true;
        });
        assert.equal(passed, true, `Expected owner email ${email} to be permitted`);
      }
    });

    it('denies customer/non-owner accounts with 403 Forbidden', () => {
      const req: any = { user: { email: 'customer@hospital.org', uid: 'cust-123' } };
      let statusCode = 200;
      let body: any = null;
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return { json: (d: any) => { body = d; } };
        }
      };
      let passed = false;
      requireOwnerMiddleware(req, res, () => {
        passed = true;
      });

      assert.equal(passed, false);
      assert.equal(statusCode, 403);
      assert.equal(body.success, false);
    });
  });
});
