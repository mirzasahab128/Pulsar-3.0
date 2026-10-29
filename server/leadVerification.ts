/**
 * Lead prep: email validation, shape only (Phoenix line).
 *
 * Pure module: no network, no live DNS lookup, no SMTP probe, no
 * sending. It answers only what can be known from the address itself
 * plus a stubbed domain check the caller supplies. A live verification
 * service is still required before production use: a real MX lookup,
 * a catch-all probe, and a deliverability result. Until that service
 * exists, no result here claims an address is deliverable.
 *
 * Checks run in order: syntax, domain shape, disposable domain flag,
 * and the stubbed MX result when one is supplied. Results are per
 * field, each with a method and a timestamp. There is no single
 * invented 0-100 score anywhere in this module.
 *
 * Pulsar is general, for all businesses and industries. Nothing in
 * this module is industry specific. A lead is a verified business
 * contact in any industry, never a purchased list entry.
 */

export interface MxResolver {
  hasMx: (domain: string) => boolean;
}

export type EmailCheckKind = 'syntax' | 'domain_shape' | 'disposable_domain' | 'mx_stub';

export interface EmailCheck {
  check: EmailCheckKind;
  passed: boolean;
  method: string;
  detail: string;
  at: string;
}

export type EmailVerdict = 'valid_shape' | 'invalid' | 'needs_live_check';

export interface EmailCheckResult {
  id: string;
  contactId: string | null;
  email: string;
  domain: string | null;
  checks: EmailCheck[];
  verdict: EmailVerdict;
  checkedAt: string;
  note: string;
}

/**
 * Starter disposable domain list, labelled as such. It is small on
 * purpose: it catches the most common throwaway domains, and it is
 * not a claim to cover every disposable provider. A live verification
 * service should replace this list before production use.
 */
export const DISPOSABLE_DOMAINS_STARTER: string[] = [
  'mailinator.com',
  'guerrillamail.com',
  '10minutemail.com',
  'tempmail.com',
  'yopmail.com',
  'trashmail.com'
];

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function splitEmail(email: string): { local: string; domain: string } | null {
  const value = (email || '').trim().toLowerCase();
  const at = value.lastIndexOf('@');
  if (at <= 0 || at === value.length - 1) return null;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (!local || !domain || value.includes(' ') || value.split('@').length !== 2) return null;
  return { local, domain };
}

export function validateEmailAddress(input: {
  email: string;
  contactId?: string | null;
  mxResolver?: MxResolver | null;
  at?: string;
}): EmailCheckResult {
  const now = input.at || new Date().toISOString();
  const raw = (input.email || '').trim().toLowerCase();
  const parts = splitEmail(raw);
  const checks: EmailCheck[] = [];
  const syntaxOk = parts !== null && /^[a-z0-9._%+-]+$/.test(parts.local);
  checks.push({
    check: 'syntax',
    passed: syntaxOk,
    method: 'local syntax check, no network',
    detail: syntaxOk ? 'Address has one @ sign, a local part, and a domain.' : 'Address fails the syntax check.',
    at: now
  });
  const domain = parts ? parts.domain : null;
  const domainOk = !!domain && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) && !domain.startsWith('.') && !domain.endsWith('.');
  checks.push({
    check: 'domain_shape',
    passed: domainOk,
    method: 'domain shape check, no network',
    detail: domainOk ? `Domain shape looks valid: ${domain}.` : 'Domain shape is invalid.',
    at: now
  });
  const disposable = !!domain && DISPOSABLE_DOMAINS_STARTER.includes(domain);
  checks.push({
    check: 'disposable_domain',
    passed: !disposable,
    method: 'starter disposable domain list, no network',
    detail: disposable
      ? `Domain ${domain} is on the starter disposable list. Treat with caution.`
      : 'Domain is not on the starter disposable list. That list is small and is not proof the domain is permanent.',
    at: now
  });
  if (input.mxResolver && domain) {
    const hasMx = input.mxResolver.hasMx(domain);
    checks.push({
      check: 'mx_stub',
      passed: hasMx,
      method: 'stubbed MX result supplied by the caller, no live lookup',
      detail: hasMx
        ? `Stubbed MX result says ${domain} accepts mail. This is a test stub, not a live DNS result.`
        : `Stubbed MX result says ${domain} has no mail server. This is a test stub, not a live DNS result.`,
      at: now
    });
  }
  let verdict: EmailVerdict;
  if (!syntaxOk || !domainOk || disposable) {
    verdict = 'invalid';
  } else if (!input.mxResolver) {
    verdict = 'needs_live_check';
  } else {
    verdict = checks.every(c => c.passed) ? 'valid_shape' : 'needs_live_check';
  }
  return {
    id: newId('emailcheck'),
    contactId: input.contactId || null,
    email: raw,
    domain,
    checks,
    verdict,
    checkedAt: now,
    note: 'Shape check only. A live verification service is still required before any claim that this address is deliverable.'
  };
}
