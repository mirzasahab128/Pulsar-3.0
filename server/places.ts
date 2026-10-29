/**
 * Google Places search, server side only (Phoenix line).
 *
 * This module never runs in the browser, never sends a key from the
 * browser, and never stores a key in the lead store. The real provider
 * reads the key only from the server environment variable
 * GOOGLE_PLACES_API_KEY and sends it only in the X-Goog-Api-Key header.
 * The key is never logged and never returned in any result.
 *
 * A lead draft from Places is preparation only. It is not a verified
 * contact, it never authorises contact, and it never replaces the
 * existing lead verification step or the Phase 7 consent gate. The
 * consent gate must still pass before any contact, and an opt-out
 * still stops email, text, and call at once.
 *
 * Review data is aggregate only: a rating and a review count, never
 * copied review text. A missing phone, website, rating, or review
 * count stays missing, never invented. There is no invented score.
 * No scraping is done here: Places is Google's official service.
 */

export const PLACES_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
export const PLACES_API_KEY_ENV = 'GOOGLE_PLACES_API_KEY';
export const PLACES_MAX_RESULTS = 20;

export const PLACES_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.regularOpeningHours',
  'places.businessStatus',
  'places.types'
].join(',');

export const PLACES_NOT_CONFIGURED_MESSAGE =
  'Live Google Places search is not set up yet. A server key has not been set, so no search was run. Ask a master admin to set the server key, then try again.';

export const PLACES_CONTACT_RULE =
  'A Places draft is not a verified contact and never authorises contact. The lead verification step and the Phase 7 consent gate must still pass first. An opt-out stops email, text, and call at once.';

export interface PlacesRawPlace {
  id?: string | null;
  displayName?: { text?: string | null } | null;
  formattedAddress?: string | null;
  nationalPhoneNumber?: string | null;
  internationalPhoneNumber?: string | null;
  websiteUri?: string | null;
  rating?: number | null;
  userRatingCount?: number | null;
  regularOpeningHours?: { weekdayDescriptions?: string[] | null } | null;
  businessStatus?: string | null;
  types?: string[] | null;
}

export interface PlacesProvider {
  search: (input: { industry: string; place: string }) => Promise<PlacesRawPlace[]>;
}

export interface PlacesLeadDraft {
  id: string;
  name: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number | null;
  openingHours: string[] | null;
  businessStatus: string | null;
  types: string[];
  status: 'places_draft_not_verified';
  verifiedContact: false;
  contactAuthorised: false;
  contactRule: string;
  provenance: {
    source: 'Google Places';
    placeId: string | null;
    method: 'Google Places Text Search (New)';
    industry: string;
    place: string;
    searchedAt: string;
    fieldsReturned: string[];
  };
  createdAt: string;
}

export interface PlacesSearchInput {
  industry: string;
  place: string;
}

export interface PlacesSearchResult {
  drafts: PlacesLeadDraft[];
  totalReturned: number;
  duplicatesRemoved: number;
  cappedAt: number;
  live: boolean;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function cleanNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** The key is read only here, from the server environment. Empty means unset. */
export function getPlacesApiKey(env: NodeJS.ProcessEnv = process.env): string | null {
  const key = (env[PLACES_API_KEY_ENV] || '').trim();
  return key ? key : null;
}

export function validatePlacesSearchInput(input: PlacesSearchInput): string | null {
  const industry = (input.industry || '').trim();
  const place = (input.place || '').trim();
  if (!industry) return 'INDUSTRY_REQUIRED';
  if (!place) return 'PLACE_REQUIRED';
  if (industry.length > 120) return 'INDUSTRY_TOO_LONG';
  if (place.length > 200) return 'PLACE_TOO_LONG';
  return null;
}

export function buildPlacesTextQuery(input: PlacesSearchInput): string {
  return `${input.industry.trim()} in ${input.place.trim()}`;
}

/**
 * Real provider. Throws when the key is missing, so a search is never
 * attempted without one. The key travels only in the header, never in
 * a URL, never in a log line, and never in a stored draft.
 */
export function createGooglePlacesProvider(
  apiKey: string | null,
  fetchFn: typeof fetch = fetch
): PlacesProvider {
  if (!apiKey || !apiKey.trim()) {
    throw new Error(PLACES_NOT_CONFIGURED_MESSAGE);
  }
  const key = apiKey.trim();
  return {
    async search(input: PlacesSearchInput): Promise<PlacesRawPlace[]> {
      const validation = validatePlacesSearchInput(input);
      if (validation) throw new Error(validation);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetchFn(PLACES_SEARCH_URL, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': key,
            'X-Goog-FieldMask': PLACES_FIELD_MASK
          },
          body: JSON.stringify({
            textQuery: buildPlacesTextQuery(input),
            maxResultCount: PLACES_MAX_RESULTS
          })
        });
        if (!response.ok) {
          throw new Error(`Google Places returned HTTP ${response.status}`);
        }
        const data = (await response.json()) as { places?: PlacesRawPlace[] };
        return Array.isArray(data.places) ? data.places : [];
      } finally {
        clearTimeout(timer);
      }
    }
  };
}

/** Test stub provider. It returns fixed places and never calls Google. */
export function createStubPlacesProvider(places: PlacesRawPlace[]): PlacesProvider {
  return {
    async search(_input: PlacesSearchInput): Promise<PlacesRawPlace[]> {
      return places;
    }
  };
}

function fieldsReturned(raw: PlacesRawPlace): string[] {
  const out: string[] = [];
  if (raw.id) out.push('id');
  if (raw.displayName?.text) out.push('displayName');
  if (raw.formattedAddress) out.push('formattedAddress');
  if (raw.nationalPhoneNumber || raw.internationalPhoneNumber) out.push('phone');
  if (raw.websiteUri) out.push('websiteUri');
  if (typeof raw.rating === 'number') out.push('rating');
  if (typeof raw.userRatingCount === 'number') out.push('userRatingCount');
  if (raw.regularOpeningHours) out.push('regularOpeningHours');
  if (raw.businessStatus) out.push('businessStatus');
  if (Array.isArray(raw.types) && raw.types.length > 0) out.push('types');
  return out;
}

export function mapPlaceToDraft(
  raw: PlacesRawPlace,
  input: PlacesSearchInput,
  at?: string
): PlacesLeadDraft {
  const now = at || new Date().toISOString();
  const phone = cleanText(raw.nationalPhoneNumber) || cleanText(raw.internationalPhoneNumber);
  return {
    id: newId('places-draft'),
    name: cleanText(raw.displayName?.text),
    address: cleanText(raw.formattedAddress),
    phone,
    website: cleanText(raw.websiteUri),
    rating: cleanNumber(raw.rating),
    reviewCount: cleanNumber(raw.userRatingCount),
    openingHours: Array.isArray(raw.regularOpeningHours?.weekdayDescriptions)
      ? raw.regularOpeningHours.weekdayDescriptions
      : null,
    businessStatus: cleanText(raw.businessStatus),
    types: Array.isArray(raw.types) ? raw.types.filter(t => typeof t === 'string') : [],
    status: 'places_draft_not_verified',
    verifiedContact: false,
    contactAuthorised: false,
    contactRule: PLACES_CONTACT_RULE,
    provenance: {
      source: 'Google Places',
      placeId: cleanText(raw.id),
      method: 'Google Places Text Search (New)',
      industry: input.industry.trim(),
      place: input.place.trim(),
      searchedAt: now,
      fieldsReturned: fieldsReturned(raw)
    },
    createdAt: now
  };
}

function normalizeName(name: string | null): string {
  return (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizePhone(phone: string | null): string {
  return (phone || '').replace(/\D/g, '');
}

function draftDedupeKey(draft: PlacesLeadDraft): string | null {
  if (draft.provenance.placeId) return `place:${draft.provenance.placeId}`;
  const name = normalizeName(draft.name);
  const phone = normalizePhone(draft.phone);
  if (name && phone) return `name-phone:${name}|${phone}`;
  return null;
}

/**
 * Dedupe by place id first, then by normalised name plus phone. A draft
 * with no place id and no phone is never merged on name alone, so two
 * different branches with the same name are not collapsed.
 */
export function dedupePlacesDrafts(drafts: PlacesLeadDraft[]): { drafts: PlacesLeadDraft[]; duplicatesRemoved: number } {
  const seen = new Set<string>();
  const kept: PlacesLeadDraft[] = [];
  let duplicatesRemoved = 0;
  for (const draft of drafts) {
    const key = draftDedupeKey(draft);
    if (key && seen.has(key)) {
      duplicatesRemoved += 1;
      continue;
    }
    if (key) seen.add(key);
    kept.push(draft);
  }
  return { drafts: kept, duplicatesRemoved };
}

export async function searchPlacesWithProvider(
  provider: PlacesProvider,
  input: PlacesSearchInput,
  at?: string
): Promise<PlacesSearchResult> {
  const validation = validatePlacesSearchInput(input);
  if (validation) throw new Error(validation);
  const raw = await provider.search(input);
  const totalReturned = raw.length;
  const capped = raw.slice(0, PLACES_MAX_RESULTS);
  const mapped = capped.map(p => mapPlaceToDraft(p, input, at));
  const deduped = dedupePlacesDrafts(mapped);
  return {
    drafts: deduped.drafts,
    totalReturned,
    duplicatesRemoved: deduped.duplicatesRemoved,
    cappedAt: PLACES_MAX_RESULTS,
    live: true
  };
}
