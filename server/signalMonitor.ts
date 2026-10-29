/**
 * Signal monitoring stub, Huginn-style watchlists without surveillance
 * (Phoenix line).
 *
 * Pure module: no network, no feed fetching, no site visiting, no
 * scraping, no private messages, no DMs. The caller supplies items
 * from sources the user already owns or has added: the user's own
 * mailbox or calendar (consented only), a public RSS feed the user
 * added, a public job posting, or a public business listing the user
 * supplied. This module only classifies a supplied item into a
 * signal. It never goes out and gets items on its own.
 *
 * Hard rule, built into the result: a signal alone never authorises
 * contact. The function signalAuthorisesContact always returns false,
 * and the result carries that reason in plain words. The Phase 7
 * consent gate must still pass first, and an opt-out stops email,
 * text, and call at once. Confidence is labelled as supplied-data
 * only, never as a verified score.
 *
 * Explicitly excluded, and never built here: private messages, DMs,
 * de-anonymising people, bulk social surveillance, and scraping at
 * scale. A watchlist entry for any of those is rejected.
 */

export type WatchKind = 'rss_feed' | 'job_posting' | 'business_listing' | 'own_mailbox' | 'own_calendar';

export interface WatchlistItem {
  id: string;
  kind: WatchKind;
  label: string;
  source: string;
  addedBy: string;
  active: boolean;
  addedAt: string;
}

export interface SuppliedItem {
  watchId: string;
  title: string;
  body: string;
  publishedAt: string | null;
  source: string;
}

export type SignalKind = 'new_business' | 'hiring' | 'opening' | 'review_theme_change' | 'general_update';

export interface Signal {
  id: string;
  watchId: string;
  kind: SignalKind;
  title: string;
  summary: string;
  source: string;
  date: string | null;
  confidenceLabel: 'supplied-data only';
  contactAuthorised: false;
  contactRule: string;
  createdAt: string;
}

export const CONTACT_RULE =
  'A signal alone never authorises contact. The Phase 7 consent gate must still pass first.';

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const EXCLUDED_HINTS: RegExp[] = [
  /private message/i,
  /\bDM\b/,
  /direct message/i,
  /de-anonymi[sz]e/i,
  /scrape/i,
  /bulk social/i
];

export function addWatch(
  list: WatchlistItem[],
  input: { kind: WatchKind; label: string; source: string; addedBy: string; at?: string }
): { ok: true; watch: WatchlistItem } | { ok: false; error: string } {
  const label = (input.label || '').trim();
  const source = (input.source || '').trim();
  if (!label) return { ok: false, error: 'WATCH_LABEL_REQUIRED' };
  if (!source) return { ok: false, error: 'WATCH_SOURCE_REQUIRED' };
  if (EXCLUDED_HINTS.some(p => p.test(label) || p.test(source))) {
    return { ok: false, error: 'Excluded source: private messages, DMs, de-anonymising, and scraping are never monitored.' };
  }
  const watch: WatchlistItem = {
    id: newId('watch'),
    kind: input.kind,
    label,
    source,
    addedBy: input.addedBy || 'admin',
    active: true,
    addedAt: input.at || new Date().toISOString()
  };
  list.push(watch);
  return { ok: true, watch };
}

export function classifySuppliedItem(item: SuppliedItem, at?: string): Signal {
  const text = `${item.title} ${item.body}`;
  let kind: SignalKind = 'general_update';
  let summary = item.title || 'Supplied update';
  if (/new (business|company|practice|store|clinic)/i.test(text)) {
    kind = 'new_business';
    summary = `New business mentioned: ${item.title}`;
  } else if (/hiring|we (are|'re) hiring|job opening|now hiring/i.test(text)) {
    kind = 'hiring';
    summary = `Hiring signal: ${item.title}`;
  } else if (/opening soon|grand opening|new location|now open/i.test(text)) {
    kind = 'opening';
    summary = `Opening signal: ${item.title}`;
  } else if (/review/i.test(text)) {
    kind = 'review_theme_change';
    summary = `Review theme mentioned: ${item.title}`;
  }
  return {
    id: newId('signal'),
    watchId: item.watchId,
    kind,
    title: item.title,
    summary,
    source: item.source,
    date: item.publishedAt,
    confidenceLabel: 'supplied-data only',
    contactAuthorised: false,
    contactRule: CONTACT_RULE,
    createdAt: at || new Date().toISOString()
  };
}

export function signalAuthorisesContact(_signal: Signal): false {
  return false;
}
