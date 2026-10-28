import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dns from 'dns';

// ---------------------------------------------------------------------------
// Owner identity (Phase 0 / C7)
//
// Owner emails come ONLY from the OWNER_EMAILS environment variable
// (comma-separated). There are deliberately NO hardcoded addresses in this
// file or in firestore.rules. If OWNER_EMAILS is unset/empty the owner list
// is empty and every owner-gated route fails CLOSED (403) — a loud warning
// is logged at startup so the misconfiguration is impossible to miss.
// Production owner selection is a founder decision; do not add addresses here.
// ---------------------------------------------------------------------------
function parseOwnerEmails(): string[] {
  const raw = process.env.OWNER_EMAILS || '';
  return raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

export const OWNER_EMAILS: string[] = parseOwnerEmails();

export function getOwnerEmails(): string[] {
  return OWNER_EMAILS;
}

export function isOwnerEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return OWNER_EMAILS.includes(email.toLowerCase().trim());
}

if (OWNER_EMAILS.length === 0) {
  console.warn('\n' +
    '********************************************************************************\n' +
    '* [SECURITY WARNING] OWNER_EMAILS is not set (or empty).                        *\n' +
    '* The owner list is EMPTY and all Master Admin / owner-gated routes will       *\n' +
    '* fail closed with 403 until OWNER_EMAILS is configured in the environment.    *\n' +
    '* There is intentionally no hardcoded default owner.                             *\n' +
    '********************************************************************************\n');
}

// ---------------------------------------------------------------------------
// Firebase project identity (Phase 0 / C4)
//
// Token audience/issuer are enforced against the Firebase project ID, taken
// from FIREBASE_PROJECT_ID or, by default, firebase-applet-config.json.
// ---------------------------------------------------------------------------
function resolveFirebaseProjectId(): string {
  if (process.env.FIREBASE_PROJECT_ID) return process.env.FIREBASE_PROJECT_ID.trim();
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (parsed && typeof parsed.projectId === 'string' && parsed.projectId) {
      return parsed.projectId;
    }
  } catch {
    // fall through — handled by caller as a hard configuration error
  }
  return '';
}

export const FIREBASE_PROJECT_ID: string = resolveFirebaseProjectId();

export interface DecodedFirebaseToken {
  uid: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  sub: string;
  iss: string;
  aud: string;
  auth_time: number;
  iat?: number;
  exp: number;
}

/** Thrown when Google's cert endpoint cannot be reached and no cache exists. */
export class AuthUpstreamUnavailableError extends Error {
  code = 'AUTH_UPSTREAM_UNAVAILABLE';
  constructor(message = 'Token verification upstream unavailable') {
    super(message);
    this.name = 'AuthUpstreamUnavailableError';
  }
}

// In-memory cache for Google public certificates
interface CertCache {
  certs: Record<string, string>;
  fetchedAt: number;
}
let googleCertCache: CertCache | null = null;
const CERT_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours
const CERT_FETCH_TIMEOUT_MS = 3000;

// The cert source is injectable so the test suite can stub the *source of
// certificates* at import time (it still runs the real RS256 verification
// against the injected certs). There is NO code path that skips signature
// verification — see verifyFirebaseIdToken.
type CertFetcher = () => Promise<Record<string, string>>;

async function fetchGooglePublicCerts(): Promise<Record<string, string>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CERT_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com', {
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`Failed to fetch public certs: ${res.statusText}`);
    return await res.json() as Record<string, string>;
  } finally {
    clearTimeout(timer);
  }
}

let certFetcher: CertFetcher = fetchGooglePublicCerts;

/** Test-only hook: replace the certificate source. Never an auth bypass. */
export function __setCertFetcherForTests(fn: CertFetcher | null): void {
  certFetcher = fn ?? fetchGooglePublicCerts;
}

async function getGooglePublicCerts(): Promise<Record<string, string>> {
  if (googleCertCache && (Date.now() - googleCertCache.fetchedAt < CERT_CACHE_MAX_AGE_MS)) {
    return googleCertCache.certs;
  }
  try {
    const certs = await certFetcher();
    googleCertCache = { certs, fetchedAt: Date.now() };
    return certs;
  } catch (err) {
    if (googleCertCache) return googleCertCache.certs;
    // No cache and upstream unreachable: fail fast and explicitly (M2) instead
    // of hanging the request.
    throw new AuthUpstreamUnavailableError(
      `Unable to fetch Google token-verification certificates: ${(err as Error)?.message || 'unknown error'}`
    );
  }
}

/**
 * Verify Firebase ID Token using Google's public x509 certificates.
 * Zero external admin SDK dependencies required.
 *
 * Phase 0 (C3/C4): signature verification is unconditional — there is no
 * test-mode or environment-based bypass of any kind. Audience and issuer are
 * enforced against the configured Firebase project.
 */
export async function verifyFirebaseIdToken(token: string): Promise<DecodedFirebaseToken> {
  if (!token || typeof token !== 'string') {
    throw new Error('Token is missing or not a string');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT token structure');
  }

  // Parse header and payload
  let header: { alg?: string; kid?: string };
  let payload: DecodedFirebaseToken;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    throw new Error('Failed to parse JWT header or payload');
  }

  if (header.alg !== 'RS256') {
    throw new Error(`Unsupported token algorithm: ${header.alg}`);
  }

  if (!FIREBASE_PROJECT_ID) {
    throw new AuthUpstreamUnavailableError(
      'Firebase project ID is not configured (set FIREBASE_PROJECT_ID or firebase-applet-config.json); cannot verify tokens'
    );
  }

  // Audience + issuer enforcement (C4): the same Google certs sign tokens for
  // every Firebase project, so without these checks a token minted in ANY
  // other project would satisfy this API.
  if (payload.aud !== FIREBASE_PROJECT_ID) {
    throw new Error('Invalid token audience');
  }
  if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) {
    throw new Error('Invalid token issuer');
  }

  // Check expiration / issued-at sanity
  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp <= nowInSeconds) {
    throw new Error('Token has expired');
  }
  if (payload.iat && payload.iat > nowInSeconds + 300) {
    throw new Error('Token issued-at time is in the future');
  }
  if (!payload.sub) {
    throw new Error('Token is missing subject (sub)');
  }

  // Verify signature against Google certificates — unconditionally.
  if (!header.kid) {
    throw new Error('Token header missing "kid"');
  }

  const certs = await getGooglePublicCerts();
  const publicKey = certs[header.kid];
  if (!publicKey) {
    throw new Error('No matching public key found for token kid');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${parts[0]}.${parts[1]}`);
  const isSignatureValid = verifier.verify(publicKey, Buffer.from(parts[2], 'base64url'));

  if (!isSignatureValid) {
    throw new Error('Invalid token signature');
  }

  // Normalize uid from sub for downstream consumers
  payload.uid = payload.sub;

  return payload;
}

// ---------------------------------------------------------------------------
// SSRF guard (Phase 0 / C5)
//
// isSafeOutboundUrl: fast synchronous string-level check (kept for existing
// callers/tests). assertSafeOutboundUrl: additionally resolves the hostname
// and rejects when ANY resolved address is loopback/private/link-local/
// metadata (DNS-rebinding defense). safeFetch: redirect-following fetch that
// re-validates every redirect target and caps redirects at 3.
// ---------------------------------------------------------------------------
export function isPrivateOrReservedIp(ip: string): boolean {
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const a = parseInt(v4[1], 10);
    const b = parseInt(v4[2], 10);
    if (a === 0) return true;                              // 0.0.0.0/8 "this host"
    if (a === 10) return true;                             // 10.0.0.0/8 private
    if (a === 127) return true;                            // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true;               // 169.254.0.0/16 link-local / metadata
    if (a === 172 && b >= 16 && b <= 31) return true;      // 172.16.0.0/12 private
    if (a === 192 && b === 168) return true;               // 192.168.0.0/16 private
    if (a === 198 && (b === 18 || b === 19)) return true;  // 198.18.0.0/15 benchmarking (reserved)
    if (a === 100 && b >= 64 && b <= 127) return true;     // 100.64.0.0/10 CGNAT
    if (a >= 224) return true;                             // multicast / reserved
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true; // fe80::/10 link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // fc00::/7 unique local
  if (lower.startsWith('::ffff:')) {
    const mapped = lower.slice('::ffff:'.length);
    return isPrivateOrReservedIp(mapped);
  }
  return false;
}

export function isSafeOutboundUrl(targetUrl: string): { safe: boolean; reason?: string } {
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { safe: false, reason: 'Invalid protocol. Only HTTP and HTTPS are permitted.' };
    }

    // URL parsing normalizes encoded/decimal/hex IPv4 forms to dotted-quad.
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

    if (
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local') ||
      host === 'metadata.google.internal'
    ) {
      return { safe: false, reason: 'Outbound requests to loopback or metadata endpoints are blocked.' };
    }

    if (isPrivateOrReservedIp(host)) {
      return { safe: false, reason: 'Outbound requests to private, loopback, or link-local addresses are blocked.' };
    }

    return { safe: true };
  } catch {
    return { safe: false, reason: 'Malformed URL provided.' };
  }
}

type DnsResolver = (hostname: string) => Promise<Array<{ address: string; family: number }>>;
let dnsResolver: DnsResolver = (hostname) =>
  dns.promises.lookup(hostname, { all: true, verbatim: true }) as Promise<Array<{ address: string; family: number }>>;

/** Test-only hook: replace DNS resolution for assertSafeOutboundUrl. */
export function __setDnsResolverForTests(fn: DnsResolver | null): void {
  dnsResolver = fn ?? ((hostname) =>
    dns.promises.lookup(hostname, { all: true, verbatim: true }) as Promise<Array<{ address: string; family: number }>>);
}

function looksLikeIpLiteral(host: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host.includes(':');
}

export async function assertSafeOutboundUrl(targetUrl: string): Promise<{ safe: boolean; reason?: string }> {
  const basic = isSafeOutboundUrl(targetUrl);
  if (!basic.safe) return basic;

  let host: string;
  try {
    host = new URL(targetUrl).hostname.toLowerCase().replace(/^\[|\]$/g, '');
  } catch {
    return { safe: false, reason: 'Malformed URL provided.' };
  }

  if (looksLikeIpLiteral(host)) {
    return { safe: true }; // literal already range-checked above
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await dnsResolver(host);
  } catch {
    return { safe: false, reason: `Could not resolve hostname: ${host}` };
  }
  if (!addresses || addresses.length === 0) {
    return { safe: false, reason: `Could not resolve hostname: ${host}` };
  }
  for (const { address } of addresses) {
    if (isPrivateOrReservedIp(address)) {
      return { safe: false, reason: `Hostname ${host} resolves to a blocked address (${address}).` };
    }
  }
  return { safe: true };
}

/**
 * Fetch that validates the target (incl. DNS) before connecting and follows
 * at most `maxRedirects` redirects, re-validating every hop.
 */
export async function safeFetch(
  targetUrl: string,
  init: RequestInit = {},
  options: { maxRedirects?: number; timeoutMs?: number } = {}
): Promise<globalThis.Response> {
  const maxRedirects = options.maxRedirects ?? 3;
  const timeoutMs = options.timeoutMs ?? 8000;
  let currentUrl = targetUrl;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const check = await assertSafeOutboundUrl(currentUrl);
    if (!check.safe) {
      throw new Error(`SSRF guard blocked outbound request: ${check.reason}`);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: globalThis.Response;
    try {
      res = await fetch(currentUrl, { ...init, redirect: 'manual', signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) return res;
      if (hop === maxRedirects) {
        throw new Error(`Too many redirects (max ${maxRedirects})`);
      }
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }
    return res;
  }
  throw new Error(`Too many redirects (max ${maxRedirects})`);
}

/**
 * Security headers middleware enforcing OWASP and transport hygiene
 */
export function securityHeadersMiddleware(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
  next();
}

/**
 * In-memory sliding-window Rate Limiter
 *
 * Phase 0 (M3): buckets are keyed on the verified user id when the request
 * has already been authenticated, falling back to the connection IP.
 * X-Forwarded-For is honored ONLY when TRUST_PROXY=true is explicitly set
 * for a deployment behind a known proxy — a client-supplied XFF header can
 * otherwise never reset or split a bucket.
 */
interface RateLimitBucket {
  count: number;
  resetAt: number;
}
const rateLimitStore = new Map<string, RateLimitBucket>();

export function createRateLimiter(options: { windowMs: number; max: number; message?: string }) {
  const { windowMs, max, message } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Exclude health check from rate limiting
    if (req.path === '/api/health') {
      return next();
    }

    const authedUser = (req as any).user as DecodedFirebaseToken | undefined;
    let identity: string;
    if (authedUser?.uid) {
      identity = `user:${authedUser.uid}`;
    } else if (process.env.TRUST_PROXY === 'true') {
      identity = `ip:${(req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown'}`;
    } else {
      identity = `ip:${req.ip || (req.socket as any)?.remoteAddress || 'unknown'}`;
    }
    const key = `${identity}:${req.path.split('/')[2] || 'general'}`;
    const now = Date.now();

    let bucket = rateLimitStore.get(key);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 1, resetAt: now + windowMs };
      rateLimitStore.set(key, bucket);
    } else {
      bucket.count += 1;
    }

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - bucket.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(bucket.resetAt / 1000));

    if (bucket.count > max) {
      res.status(429).json({
        success: false,
        error: message || 'Too many requests. Please slow down.'
      });
      return;
    }

    next();
  };
}

/**
 * Authentication middleware enforcing valid Firebase ID tokens on protected endpoints
 */
export async function requireAuthMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized: missing or invalid Authorization Bearer header'
    });
    return;
  }

  const token = authHeader.slice(7).trim();
  try {
    const decoded = await verifyFirebaseIdToken(token);
    (req as any).user = decoded;
    next();
  } catch (err: any) {
    if (err instanceof AuthUpstreamUnavailableError || err?.code === 'AUTH_UPSTREAM_UNAVAILABLE') {
      // Upstream (Google cert endpoint) unreachable and no cache: fail fast
      // with an explicit 503 rather than hanging (M2).
      res.status(503).json({
        success: false,
        error: 'AUTH_UPSTREAM_UNAVAILABLE',
        message: err?.message || 'Token verification upstream unavailable'
      });
      return;
    }
    res.status(401).json({
      success: false,
      error: `Unauthorized: ${err?.message || 'Token verification failed'}`
    });
  }
}

/**
 * Owner authorization guard - restricts routes to verified Master Admin accounts
 *
 * Phase 0 (C4/C7): owner = email in the env-configured OWNER_EMAILS list AND
 * the token's email_verified claim is true. Empty owner list = nobody passes.
 */
export function requireOwnerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user as DecodedFirebaseToken | undefined;
  if (!user || !user.email) {
    res.status(401).json({ success: false, error: 'Unauthorized: authentication required' });
    return;
  }

  if (user.email_verified !== true) {
    res.status(403).json({
      success: false,
      error: 'Forbidden: owner actions require a verified email address'
    });
    return;
  }

  if (!isOwnerEmail(user.email)) {
    res.status(403).json({
      success: false,
      error: 'Forbidden: action restricted to Master Admin / Workspace Owner'
    });
    return;
  }

  next();
}
