/**
 * Lead prep: company research brief from supplied text (Phoenix line).
 *
 * Pure module: no web fetching, no network, no scraping. The caller
 * passes in text the user supplied, or public page text the user
 * pasted in, plus the source it came from. The module never fetches
 * a URL on its own, never visits a site, and never invents a fact
 * that is not in the supplied text. Anything not found is reported
 * as not found, never guessed.
 *
 * Output is a structured brief for pitch prep only: what the business
 * does, services named, locations named, hiring signals, and pain
 * themes named in the text. A brief is preparation, not permission:
 * it never authorises contact. The Phase 7 consent gate must still
 * pass first, and an opt-out stops all channels at once.
 *
 * Pulsar is general, for all businesses and industries. Pain themes
 * below are generic business themes, not one industry's themes.
 * Healthcare and RCM is Industry Pack 1 only, not the product.
 */

export interface CompanyResearchInput {
  companyName: string;
  pageText: string;
  source: string;
  sourceUrl?: string | null;
  suppliedBy?: string | null;
}

export type PainTheme =
  | 'missed follow-up'
  | 'slow collections'
  | 'staffing shortage'
  | 'manual work'
  | 'lost leads'
  | 'slow response time'
  | 'growing demand';

export interface CompanyBrief {
  id: string;
  companyName: string;
  source: string;
  sourceUrl: string | null;
  suppliedBy: string | null;
  whatBusinessDoes: string[];
  services: string[];
  locations: string[];
  hiringSignals: string[];
  painThemes: PainTheme[];
  fetchedByPulsar: false;
  createdAt: string;
  note: string;
}

const PAIN_PATTERNS: { theme: PainTheme; patterns: RegExp[] }[] = [
  { theme: 'missed follow-up', patterns: [/missed follow[- ]?up/i, /no follow[- ]?up/i, /forgot to follow/i] },
  { theme: 'slow collections', patterns: [/slow (payment|collection)/i, /unpaid (invoice|bill)/i, /overdue (payment|invoice)/i, /collections? (backlog|delay)/i] },
  { theme: 'staffing shortage', patterns: [/staff(ing)? shortage/i, /understaffed/i, /short[- ]?staffed/i, /hiring (urgently|now)/i] },
  { theme: 'manual work', patterns: [/manual (work|process|data entry)/i, /spreadsheet/i, /paperwork/i] },
  { theme: 'lost leads', patterns: [/lost leads?/i, /missed (calls?|leads?|enquiries)/i, /leads? slipping/i] },
  { theme: 'slow response time', patterns: [/slow response/i, /customers? waiting/i, /wait(ing)? too long/i, /long wait/i, /response time/i] },
  { theme: 'growing demand', patterns: [/growing demand/i, /expanding/i, /new location/i, /opening soon/i] }
];

const HIRING_PATTERNS: RegExp[] = [
  /we (are|'re) hiring/i,
  /now hiring/i,
  /job opening/i,
  /open (position|role|vacancy)/i,
  /join our team/i,
  /careers page/i
];

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function sentences(text: string): string[] {
  return (text || '')
    .split(/(?<=[.!?])\s+|\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function uniqueCapped(values: string[], cap: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= cap) break;
  }
  return out;
}

export function buildCompanyBrief(input: CompanyResearchInput, at?: string): CompanyBrief {
  const now = at || new Date().toISOString();
  const text = input.pageText || '';
  const lines = sentences(text);
  const whatBusinessDoes = uniqueCapped(
    lines.filter(s => /we (provide|offer|help|speciali[sz]e in|serve|build|deliver)/i.test(s)),
    5
  );
  const services = uniqueCapped(
    lines
      .filter(s => /services?|solutions?|offerings?/i.test(s))
      .map(s => s.replace(/^[^a-z0-9]+/i, '')),
    8
  );
  const locationMatches = text.match(/\b[A-Z][a-z]+(?: [A-Z][a-z]+)?, [A-Z]{2}\b/g) || [];
  const locations = uniqueCapped(locationMatches, 8);
  const hiringSignals = uniqueCapped(lines.filter(s => HIRING_PATTERNS.some(p => p.test(s))), 5);
  const painThemes: PainTheme[] = [];
  for (const entry of PAIN_PATTERNS) {
    if (entry.patterns.some(p => p.test(text)) && !painThemes.includes(entry.theme)) {
      painThemes.push(entry.theme);
    }
  }
  return {
    id: newId('brief'),
    companyName: (input.companyName || '').trim(),
    source: (input.source || '').trim(),
    sourceUrl: input.sourceUrl || null,
    suppliedBy: input.suppliedBy || null,
    whatBusinessDoes,
    services,
    locations,
    hiringSignals,
    painThemes,
    fetchedByPulsar: false,
    createdAt: now,
    note: 'Built only from text supplied by the user. Pulsar did not fetch any page. A brief is pitch prep only and never authorises contact.'
  };
}
