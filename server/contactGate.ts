/**
 * Phase 7.1 - Consent ledger, suppression, and contact gate (Phoenix line).
 *
 * Pure module: no store, no network, no external service. The server
 * routes in server.ts persist the ledger and suppression list through the
 * platform state and audit-log every change and gate check.
 *
 * Fail-closed rules, in order:
 *  1. Suppressed contacts are blocked on every channel.
 *  2. A revoked contact is blocked on every channel, even if an old
 *     consent record still exists. Revocation by any channel suppresses
 *     all channels.
 *  3. Unverified fields block their channel. Verification is per field,
 *     with provenance and a timestamp. There is no confidence score
 *     anywhere in this module, invented or otherwise.
 *  4. Consent is required per channel. AI voice to a mobile phone, or to
 *     a number whose line type is unknown, requires prior express
 *     written consent (PEWC). An unknown line type is treated as mobile:
 *     fail closed, never assumed to be a landline.
 *  5. Email requires an active email opt-in. SMS requires an active SMS
 *     opt-in. A landline voice call requires prior express consent
 *     (PEC) or PEWC.
 *
 * National DNC note: the real US National DNC Registry requires paid
 * registration and cannot be queried from here, so this gate never
 * claims a live national lookup. It uses the internal suppression list
 * plus any user-supplied DNC list imported as CSV. A number that is
 * not on either list is NOT thereby proven safe; consent and
 * verification still have to pass.
 *
 * Pulsar is general, for all businesses and industries. Nothing in this
 * module is industry specific. A healthcare practice is one example
 * contact type, not the product.
 */

export type ContactChannel = 'email' | 'voice' | 'sms';
export type ConsentType = 'pewc' | 'pec' | 'email_optin' | 'sms_optin';
export type PhoneLineType = 'mobile' | 'landline' | 'unknown';

export interface ConsentRecord {
  id: string;
  contactId: string;
  channel: ContactChannel;
  type: ConsentType;
  source: string;
  grantedAt: string;
  revokedAt: string | null;
  revokedSource: string | null;
}

export interface FieldVerification {
  field: 'email' | 'phone' | 'business' | 'identity';
  verified: boolean;
  provenance: string;
  verifiedAt: string;
}

export interface GateContact {
  id: string;
  email?: string | null;
  phone?: string | null;
  phoneLineType?: PhoneLineType;
  fieldVerifications: FieldVerification[];
}

export type SuppressionIdentifierType = 'email' | 'phone' | 'contact';
export type SuppressionReason = 'opt_out' | 'dnc_request' | 'dnc_import' | 'manual' | 'bounce' | 'complaint';

export interface SuppressionRecord {
  id: string;
  identifierType: SuppressionIdentifierType;
  identifier: string;
  reason: SuppressionReason;
  source: string;
  addedBy: string;
  addedAt: string;
}

export type GateReasonCode =
  | 'ALLOWED'
  | 'SUPPRESSED'
  | 'REVOKED'
  | 'UNVERIFIED'
  | 'CONSENT_MISSING';

export interface GateVerdict {
  allowed: boolean;
  reasonCode: GateReasonCode;
  reason: string;
  channel: ContactChannel;
  contactId: string;
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

export function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
}

export function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) return null;
    return `+${digits}`;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length >= 7 && digits.length <= 15) return `+${digits}`;
  return null;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Consent ledger
// ---------------------------------------------------------------------------

export const CHANNEL_CONSENT_TYPES: Record<ContactChannel, ConsentType[]> = {
  voice: ['pewc', 'pec'],
  email: ['email_optin'],
  sms: ['sms_optin']
};

export function grantConsent(
  ledger: ConsentRecord[],
  input: { contactId: string; channel: ContactChannel; type: ConsentType; source: string; at?: string }
): { ok: true; record: ConsentRecord } | { ok: false; error: string } {
  const contactId = (input.contactId || '').trim();
  if (!contactId) return { ok: false, error: 'CONTACT_ID_REQUIRED' };
  if (!CHANNEL_CONSENT_TYPES[input.channel]?.includes(input.type)) {
    return { ok: false, error: `Consent type ${input.type} does not apply to channel ${input.channel}` };
  }
  if (!input.source || !input.source.trim()) return { ok: false, error: 'CONSENT_SOURCE_REQUIRED' };
  const existing = ledger.find(
    r => r.contactId === contactId && r.channel === input.channel && r.type === input.type && r.revokedAt === null
  );
  if (existing) return { ok: true, record: existing };
  const record: ConsentRecord = {
    id: newId('consent'),
    contactId,
    channel: input.channel,
    type: input.type,
    source: input.source.trim(),
    grantedAt: input.at || new Date().toISOString(),
    revokedAt: null,
    revokedSource: null
  };
  ledger.push(record);
  return { ok: true, record };
}

/**
 * Revoke a contact on every channel. Revocation by any channel
 * immediately suppresses all channels: every active consent record for
 * the contact is marked revoked, and the caller should also add a
 * suppression record (the server route does this). Returns how many
 * active records were revoked.
 */
export function revokeContact(
  ledger: ConsentRecord[],
  contactId: string,
  source: string,
  at?: string
): { revoked: number } {
  const now = at || new Date().toISOString();
  let revoked = 0;
  for (const record of ledger) {
    if (record.contactId === contactId && record.revokedAt === null) {
      record.revokedAt = now;
      record.revokedSource = source;
      revoked++;
    }
  }
  return { revoked };
}

export function hasActiveConsent(
  ledger: ConsentRecord[],
  contactId: string,
  channel: ContactChannel,
  types: ConsentType[]
): boolean {
  return ledger.some(
    r => r.contactId === contactId && r.channel === channel && types.includes(r.type) && r.revokedAt === null
  );
}

export function hasRevocationAfterGrant(ledger: ConsentRecord[], contactId: string): boolean {
  const records = ledger.filter(r => r.contactId === contactId);
  if (records.length === 0) return false;
  const latestGrant = records.reduce((a, b) => (a.grantedAt > b.grantedAt ? a : b));
  return records.some(r => r.revokedAt !== null && r.revokedAt >= latestGrant.grantedAt);
}

// ---------------------------------------------------------------------------
// Suppression list
// ---------------------------------------------------------------------------

export function addSuppression(
  list: SuppressionRecord[],
  input: {
    identifierType: SuppressionIdentifierType;
    identifier: string;
    reason: SuppressionReason;
    source: string;
    addedBy: string;
  }
): { ok: true; record: SuppressionRecord; duplicate: boolean } | { ok: false; error: string } {
  let normalized: string | null;
  if (input.identifierType === 'email') normalized = normalizeEmail(input.identifier);
  else if (input.identifierType === 'phone') normalized = normalizePhone(input.identifier);
  else normalized = (input.identifier || '').trim() || null;
  if (!normalized) return { ok: false, error: 'INVALID_IDENTIFIER' };
  const existing = list.find(s => s.identifierType === input.identifierType && s.identifier === normalized);
  if (existing) return { ok: true, record: existing, duplicate: true };
  const record: SuppressionRecord = {
    id: newId('supp'),
    identifierType: input.identifierType,
    identifier: normalized,
    reason: input.reason,
    source: input.source || 'manual',
    addedBy: input.addedBy,
    addedAt: new Date().toISOString()
  };
  list.push(record);
  return { ok: true, record, duplicate: false };
}

export function isSuppressed(
  list: SuppressionRecord[],
  contact: { id: string; email?: string | null; phone?: string | null }
): SuppressionRecord | null {
  const email = normalizeEmail(contact.email);
  const phone = normalizePhone(contact.phone);
  for (const s of list) {
    if (s.identifierType === 'contact' && s.identifier === contact.id) return s;
    if (s.identifierType === 'email' && email && s.identifier === email) return s;
    if (s.identifierType === 'phone' && phone && s.identifier === phone) return s;
  }
  return null;
}

/**
 * Import a user-supplied DNC list as CSV of phone numbers, one per line
 * (a header row is skipped). Each number is normalized to E.164.
 * Invalid lines are reported, never silently added. This is an internal
 * list import only: it is not a live National DNC Registry lookup.
 */
export function importSuppressionCsv(
  csv: string,
  opts: { source: string; addedBy: string; reason?: SuppressionReason }
): { added: string[]; skipped: string[]; errors: string[] } {
  const added: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const rawLine of (csv || '').split(/\r?\n/)) {
    const line = rawLine.trim().replace(/^"|"$/g, '');
    if (!line) continue;
    const first = line.split(/[,;]/)[0].trim().replace(/^"|"$/g, '');
    if (/phone/i.test(first) && !/\d/.test(first)) continue;
    if (first.includes('@')) {
      errors.push(`Not a phone number: ${first}`);
      continue;
    }
    const normalized = normalizePhone(first);
    if (!normalized) {
      errors.push(`Invalid phone number: ${first}`);
      continue;
    }
    if (seen.has(normalized)) {
      skipped.push(normalized);
      continue;
    }
    seen.add(normalized);
    added.push(normalized);
  }
  return { added, skipped, errors };
}

// ---------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------

export function isFieldVerified(contact: GateContact, field: FieldVerification['field']): boolean {
  return contact.fieldVerifications.some(v => v.field === field && v.verified === true);
}

function blocked(channel: ContactChannel, contactId: string, reasonCode: GateReasonCode, reason: string): GateVerdict {
  return { allowed: false, reasonCode, reason, channel, contactId };
}

export function canContact(
  contact: GateContact,
  channel: ContactChannel,
  opts: { consents: ConsentRecord[]; suppressions: SuppressionRecord[] }
): GateVerdict {
  const contactId = contact.id;
  const suppressed = isSuppressed(opts.suppressions, contact);
  if (suppressed) {
    return blocked(channel, contactId, 'SUPPRESSED',
      `Blocked: contact is on the internal suppression list (${suppressed.reason}, source ${suppressed.source}). No live National DNC lookup is claimed.`);
  }
  if (hasRevocationAfterGrant(opts.consents, contactId)) {
    return blocked(channel, contactId, 'REVOKED',
      'Blocked: consent was revoked for this contact, which suppresses all channels.');
  }
  if (channel === 'email') {
    if (!contact.email || !isFieldVerified(contact, 'email')) {
      return blocked(channel, contactId, 'UNVERIFIED', 'Blocked: email is not verified for this contact.');
    }
    if (!hasActiveConsent(opts.consents, contactId, 'email', ['email_optin'])) {
      return blocked(channel, contactId, 'CONSENT_MISSING', 'Blocked: no active email opt-in for this contact.');
    }
    return { allowed: true, reasonCode: 'ALLOWED', reason: 'Allowed: email verified and email opt-in is active.', channel, contactId };
  }
  if (channel === 'sms') {
    if (!contact.phone || !isFieldVerified(contact, 'phone')) {
      return blocked(channel, contactId, 'UNVERIFIED', 'Blocked: phone is not verified for this contact.');
    }
    if (!hasActiveConsent(opts.consents, contactId, 'sms', ['sms_optin'])) {
      return blocked(channel, contactId, 'CONSENT_MISSING', 'Blocked: no active SMS opt-in for this contact.');
    }
    return { allowed: true, reasonCode: 'ALLOWED', reason: 'Allowed: phone verified and SMS opt-in is active.', channel, contactId };
  }
  // voice
  if (!contact.phone || !isFieldVerified(contact, 'phone')) {
    return blocked(channel, contactId, 'UNVERIFIED', 'Blocked: phone is not verified for this contact.');
  }
  const lineType = contact.phoneLineType || 'unknown';
  if (lineType === 'mobile' || lineType === 'unknown') {
    if (!hasActiveConsent(opts.consents, contactId, 'voice', ['pewc'])) {
      return blocked(channel, contactId, 'CONSENT_MISSING',
        'Blocked: AI voice consent is missing for a mobile phone (prior express written consent required; unknown line type is treated as mobile).');
    }
    return { allowed: true, reasonCode: 'ALLOWED', reason: 'Allowed: phone verified and prior express written consent is active for AI voice.', channel, contactId };
  }
  if (!hasActiveConsent(opts.consents, contactId, 'voice', ['pec', 'pewc'])) {
    return blocked(channel, contactId, 'CONSENT_MISSING', 'Blocked: no active voice consent for this landline number.');
  }
  return { allowed: true, reasonCode: 'ALLOWED', reason: 'Allowed: phone verified and voice consent is active.', channel, contactId };
}

export function gateAuditDetail(contact: GateContact, verdict: GateVerdict): string {
  return `Gate check channel=${verdict.channel} contact=${contact.id} allowed=${verdict.allowed} reason=${verdict.reasonCode}: ${verdict.reason}`;
}
