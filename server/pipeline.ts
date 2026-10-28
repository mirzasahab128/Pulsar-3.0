/**
 * Phases 4–6 — Pipeline operations (Phoenix line): lead registry with
 * provenance + dedupe + deterministic enrichment (Phase 4 / Blueprint
 * Phase 1), notes → tasks → counted daily stats (Phase 5 / Blueprint
 * Phase 2), and email outreach sequencing through the real Resend mailer
 * (Phase 6 / Blueprint Phase 3).
 *
 * Same persistence constraint as Phases 0–3: no Firebase Admin SDK or
 * credentials exist in this environment, so this state is persisted
 * through serverStore (server-data/store.json) behind Firestore-shaped
 * collections (leads / suppressions / linkedinAssists / notes / tasks /
 * sequences / enrollments / deliveries). A Firestore adapter can replace
 * the accessors below without touching route handlers.
 *
 * Honesty rules (master prompt, every phase):
 * - Every registry lead carries provenance { source, sourceId,
 *   retrievedAt }. Records without a source, and demo/simulated records,
 *   are refused at ingest — never silently upgraded to "real".
 * - Enrichment is deterministic rules only. A derived field names the
 *   rule that produced it; fields no source reports (EHR system, claim
 *   volume, pain points) are never invented.
 * - A delivery record exists for every send attempt and carries the
 *   mailer's real status and provider message id. An enrollment advances
 *   only when the mailer reports 'sent'.
 * - Tasks are marked done only by an explicit human action (the PATCH
 *   route), never by inference.
 */
import crypto from 'crypto';
import { loadStore, saveStore } from './serverStore.js';
import {
  PlatformState,
  currentUsage,
  recordUsage,
  findUser,
  isMasterAdminEmail,
  effectiveFeatures
} from './platform.js';

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export interface LeadProvenance {
  source: string;
  sourceId: string;
  retrievedAt: string;
}

export interface EnrichmentRuleHit {
  rule: string;
  detail: string;
}

export interface LeadEnrichment {
  enrichedAt: string;
  ruleset: string;
  fitScore: number;
  fitReason: string;
  rulesApplied: EnrichmentRuleHit[];
  derived: Record<string, { value: string | boolean; rule: string }>;
}

export interface PipelineLead {
  id: string;
  workspaceId: string;
  practiceName: string;
  doctorName: string;
  title: string;
  specialty: string;
  practiceSize: string;
  phone: string | null;
  email: string;
  address: string;
  state: string;
  linkedInProfile: string;
  adminContact: string;
  npiNumber: string | null;
  status: string;
  provenance: LeadProvenance;
  verifiedFields: string[];
  estimates: Record<string, any> | null;
  suppressed: boolean;
  suppressionId: string | null;
  enrichment: LeadEnrichment | null;
  createdAt: string;
  updatedAt: string;
}

export type SuppressionIdentifierType = 'email' | 'phone' | 'npi' | 'practice';
export type SuppressionReason = 'opt_out' | 'dnc_request' | 'registry' | 'manual' | 'bounce' | 'complaint';

export interface Suppression {
  id: string;
  workspaceId: string;
  identifierType: SuppressionIdentifierType;
  identifier: string; // stored normalized
  reason: SuppressionReason;
  createdBy: string;
  createdAt: string;
}

export type AssistOutcome = 'sent_manually' | 'accepted' | 'replied' | 'declined' | 'no_response';

export interface LinkedInAssist {
  id: string;
  workspaceId: string;
  leadId: string | null;
  prospectName: string;
  practiceName: string;
  linkedInUrl: string;
  draftMessage: string;
  draftSource: 'template' | 'gemini';
  status: 'prepared' | AssistOutcome;
  outcomeNote: string | null;
  outcomeAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoteActionItem {
  text: string;
  extraction: 'gemini' | 'rule' | 'manual';
  lineRef?: string;
}

export interface PipelineNote {
  id: string;
  workspaceId: string;
  leadId: string | null;
  type: 'manual' | 'transcript';
  title: string;
  transcript: string | null;
  summary: string | null;
  summarySource: 'gemini' | 'manual' | 'deterministic' | 'none';
  interestLevel: string | null;
  objections: string[];
  nextStep: string | null;
  actionItems: NoteActionItem[];
  createdBy: string;
  createdAt: string;
}

export type PipelineTaskStatus = 'open' | 'done' | 'dismissed';

export interface PipelineTask {
  id: string;
  workspaceId: string;
  leadId: string | null;
  noteId: string | null;
  title: string;
  owner: string;
  dueAt: string | null;
  priority: 'Urgent' | 'High' | 'Medium' | 'Low';
  status: PipelineTaskStatus;
  createdBy: string;
  createdAt: string;
  completedAt: string | null;
  completedBy: string | null;
}

export interface SequenceStep {
  subject: string;
  body: string;
  delayDays: number;
  windowStart: string; // "HH:MM" in the sequence timezone
  windowEnd: string;
}

export type SequenceStatus = 'draft' | 'active' | 'paused';

export interface Sequence {
  id: string;
  workspaceId: string;
  name: string;
  status: SequenceStatus;
  timezone: string;
  steps: SequenceStep[];
  createdBy: string;
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
}

export type EnrollmentStatus = 'active' | 'completed' | 'stopped';

export interface Enrollment {
  id: string;
  workspaceId: string;
  sequenceId: string;
  leadId: string;
  email: string;
  currentStep: number;
  status: EnrollmentStatus;
  stopReason: string | null;
  nextDueAt: string | null;
  lastDeliveryId: string | null;
  enrolledBy: string;
  enrolledAt: string;
  updatedAt: string;
}

export type DeliveryStatus =
  | 'sent' | 'delivered' | 'failed' | 'not_configured'
  | 'bounced' | 'complained' | 'skipped_suppressed';

export interface DeliveryRecord {
  id: string;
  workspaceId: string;
  sequenceId: string;
  enrollmentId: string;
  leadId: string;
  stepIndex: number;
  to: string;
  subject: string;
  status: DeliveryStatus;
  provider: 'resend';
  providerMessageId: string | null;
  providerStatus: string | null;
  error: string | null;
  at: string;
}

export interface PipelineState {
  leads: Record<string, PipelineLead>;
  suppressions: Record<string, Suppression>;
  assists: Record<string, LinkedInAssist>;
  notes: Record<string, PipelineNote>;
  tasks: Record<string, PipelineTask>;
  sequences: Record<string, Sequence>;
  enrollments: Record<string, Enrollment>;
  deliveries: DeliveryRecord[];
}

// ---------------------------------------------------------------------------
// Persisted state access (single cached store object shared with server.ts)
// ---------------------------------------------------------------------------

const store = loadStore();

export function emptyPipelineState(): PipelineState {
  return {
    leads: {},
    suppressions: {},
    assists: {},
    notes: {},
    tasks: {},
    sequences: {},
    enrollments: {},
    deliveries: []
  };
}

export function getPipelineState(): PipelineState {
  if (!store.pipeline || typeof store.pipeline !== 'object' || !store.pipeline.leads) {
    store.pipeline = emptyPipelineState();
    saveStore(store);
  }
  return store.pipeline as PipelineState;
}

export function persistPipeline(): void {
  saveStore(store);
}

// ---------------------------------------------------------------------------
// Normalization helpers (dedupe + suppression share these)
// ---------------------------------------------------------------------------

export const normalizeEmail = (v: string) => String(v || '').trim().toLowerCase();
export const normalizePhone = (v: string) => String(v || '').replace(/\D/g, '');
export const normalizeNameAddr = (v: string) =>
  String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function sha1(s: string): string {
  return crypto.createHash('sha1').update(s).digest('hex');
}

function str(v: any): string {
  return typeof v === 'string' ? v.trim() : v == null ? '' : String(v);
}

// ---------------------------------------------------------------------------
// Suppressions (Blueprint §7: checked before EVERY outreach)
// ---------------------------------------------------------------------------

export function normalizeIdentifier(type: SuppressionIdentifierType, value: string): string {
  if (type === 'email') return normalizeEmail(value);
  if (type === 'phone') return normalizePhone(value);
  if (type === 'practice') return normalizeNameAddr(value);
  return String(value || '').trim();
}

export function addSuppression(
  state: PipelineState,
  workspaceId: string,
  identifierType: SuppressionIdentifierType,
  identifier: string,
  reason: SuppressionReason,
  createdBy: string
): Suppression {
  const normalized = normalizeIdentifier(identifierType, identifier);
  for (const s of Object.values(state.suppressions)) {
    if (s.workspaceId === workspaceId && s.identifierType === identifierType && s.identifier === normalized) {
      return s; // already suppressed — idempotent
    }
  }
  const entry: Suppression = {
    id: `sup-${crypto.randomUUID()}`,
    workspaceId,
    identifierType,
    identifier: normalized,
    reason,
    createdBy,
    createdAt: new Date().toISOString()
  };
  state.suppressions[entry.id] = entry;
  return entry;
}

/** Live suppression check against a set of identifiers (any match wins). */
export function matchSuppression(
  state: PipelineState,
  workspaceId: string,
  ids: { email?: string | null; phone?: string | null; npiNumber?: string | null; practiceName?: string | null }
): Suppression | null {
  const email = ids.email ? normalizeEmail(ids.email) : '';
  const phone = ids.phone ? normalizePhone(ids.phone) : '';
  const npi = ids.npiNumber ? String(ids.npiNumber).trim() : '';
  const practice = ids.practiceName ? normalizeNameAddr(ids.practiceName) : '';
  for (const s of Object.values(state.suppressions)) {
    if (s.workspaceId !== workspaceId) continue;
    if (s.identifierType === 'email' && email && s.identifier === email) return s;
    if (s.identifierType === 'phone' && phone && phone.length >= 7 && s.identifier === phone) return s;
    if (s.identifierType === 'npi' && npi && s.identifier === npi) return s;
    if (s.identifierType === 'practice' && practice && s.identifier === practice) return s;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Phase 4 — Lead ingest: provenance enforcement + dedupe + suppression
// ---------------------------------------------------------------------------

export interface IngestResult {
  index: number;
  outcome: 'created' | 'duplicate' | 'rejected';
  leadId?: string;
  reason?: string;
  suppressed?: boolean;
}

/** Strong dedupe keys for a candidate lead, most trusted first. */
export function dedupeKeys(c: {
  npiNumber?: string | null; email?: string | null; phone?: string | null;
  practiceName?: string | null; address?: string | null;
}): string[] {
  const keys: string[] = [];
  if (c.npiNumber) keys.push(`npi:${String(c.npiNumber).trim()}`);
  const email = c.email ? normalizeEmail(c.email) : '';
  if (email) keys.push(`email:${email}`);
  const phone = c.phone ? normalizePhone(c.phone) : '';
  if (phone.length >= 10) keys.push(`phone:${phone.slice(-10)}`);
  const name = c.practiceName ? normalizeNameAddr(c.practiceName) : '';
  const addr = c.address ? normalizeNameAddr(c.address) : '';
  if (name && addr) keys.push(`nameaddr:${name}|${addr}`);
  return keys;
}

function leadKeys(lead: PipelineLead): string[] {
  return dedupeKeys({
    npiNumber: lead.npiNumber,
    email: lead.email,
    phone: lead.phone,
    practiceName: lead.practiceName,
    address: lead.address
  });
}

export function findDuplicateLead(
  state: PipelineState,
  workspaceId: string,
  candidate: { npiNumber?: string | null; email?: string | null; phone?: string | null; practiceName?: string | null; address?: string | null }
): PipelineLead | null {
  const keys = new Set(dedupeKeys(candidate));
  if (keys.size === 0) return null;
  for (const lead of Object.values(state.leads)) {
    if (lead.workspaceId !== workspaceId) continue;
    if (leadKeys(lead).some(k => keys.has(k))) return lead;
  }
  return null;
}

/**
 * Normalize + validate one raw record into a registry lead, or explain why
 * it is refused. The registry never holds a record without provenance and
 * never holds demo/simulated records.
 */
export function normalizeIngestRecord(
  raw: any,
  workspaceId: string,
  now: string
): { ok: true; lead: PipelineLead } | { ok: false; reason: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, reason: 'record is not an object' };
  }
  if (raw.simulated === true) {
    return { ok: false, reason: 'simulated/demo records are not ingested into the registry' };
  }
  const practiceName = str(raw.practiceName || raw.organization_name || raw.practice);
  const doctorName = str(raw.doctorName || raw.fullName);
  if (!practiceName && !doctorName) {
    return { ok: false, reason: 'record has neither a practice name nor a contact name' };
  }

  const provIn = (raw.provenance && typeof raw.provenance === 'object') ? raw.provenance : {};
  const source = str(provIn.source || raw.source);
  if (!source) {
    return { ok: false, reason: 'missing provenance source — every registry lead must name its source' };
  }
  if (/demo/i.test(source)) {
    return { ok: false, reason: 'demo records are not ingested into the registry' };
  }
  const npiNumber = str(raw.npiNumber || raw.npi) || null;
  const email = str(raw.email);
  const phone = str(raw.phone) || null;
  const address = str(raw.address);
  let sourceId = str(provIn.sourceId);
  if (!sourceId && npiNumber) sourceId = npiNumber;
  if (!sourceId && email) sourceId = email;
  if (!sourceId) {
    sourceId = `row:${sha1(`${email}|${phone || ''}|${practiceName}|${address}`).slice(0, 16)}`;
  }
  const retrievedAt = str(provIn.retrievedAt) || now;

  const lead: PipelineLead = {
    id: `lead-${crypto.randomUUID()}`,
    workspaceId,
    practiceName: practiceName || doctorName,
    doctorName,
    title: str(raw.title),
    specialty: str(raw.specialty),
    practiceSize: str(raw.practiceSize),
    phone,
    email,
    address,
    state: str(raw.state),
    linkedInProfile: str(raw.linkedInProfile || raw.linkedInUrl),
    adminContact: str(raw.adminContact),
    npiNumber,
    status: str(raw.status) || 'Ready for Call',
    provenance: { source, sourceId, retrievedAt },
    verifiedFields: Array.isArray(provIn.verifiedFields) ? provIn.verifiedFields.map(str).filter(Boolean) : [],
    estimates: raw.estimates && typeof raw.estimates === 'object' ? raw.estimates : null,
    suppressed: false,
    suppressionId: null,
    enrichment: null,
    createdAt: now,
    updatedAt: now
  };
  return { ok: true, lead };
}

export function ingestLeads(
  state: PipelineState,
  workspaceId: string,
  rawLeads: any[]
): { results: IngestResult[]; created: number } {
  const now = new Date().toISOString();
  const results: IngestResult[] = [];
  let created = 0;
  rawLeads.forEach((raw, index) => {
    const norm = normalizeIngestRecord(raw, workspaceId, now);
    if (!norm.ok) {
      results.push({ index, outcome: 'rejected', reason: norm.reason });
      return;
    }
    const lead = norm.lead;
    const dup = findDuplicateLead(state, workspaceId, lead);
    if (dup) {
      results.push({ index, outcome: 'duplicate', leadId: dup.id, reason: 'matches an existing registry lead on NPI / email / phone / name+address' });
      return;
    }
    const sup = matchSuppression(state, workspaceId, lead);
    if (sup) {
      lead.suppressed = true;
      lead.suppressionId = sup.id;
      lead.status = 'suppressed';
    }
    state.leads[lead.id] = lead;
    created++;
    results.push({ index, outcome: 'created', leadId: lead.id, suppressed: lead.suppressed });
  });
  return { results, created };
}

// ---------------------------------------------------------------------------
// Phase 4 — Deterministic enrichment (named rules; nothing invented)
// ---------------------------------------------------------------------------

/**
 * ThriveMed ICP fit ruleset v1 — a code-level default the founder can
 * revise (Blueprint D2 is still an open founder decision). Every point a
 * lead earns names the rule that awarded it; fields no source reports
 * (EHR, claim volume, pain points) are never filled in here.
 */
export const FIT_RULESET_ID = 'thrivemed-default-v1';
const TARGET_SPECIALTY_KEYWORDS = [
  'cardiology', 'orthopedic', 'orthopaedic', 'pathology', 'dermatology',
  'pediatrics', 'paediatric', 'radiology', 'oncology', 'gastroenterology',
  'neurology', 'surgery', 'surgical', 'ophthalmology', 'psychiatry',
  'family medicine', 'internal medicine', 'hospital', 'laboratory', 'lab'
];
const DECISION_MAKER_MARKERS = [
  'administrator', 'owner', 'partner', 'cmo', 'chief', 'cfo', 'director',
  'president', 'manager', 'managing'
];

export function enrichLead(lead: PipelineLead, now: string = new Date().toISOString()): LeadEnrichment {
  const rules: EnrichmentRuleHit[] = [];
  let score = 0;
  const add = (rule: string, points: number, detail: string) => {
    score += points;
    rules.push({ rule, detail: `${detail} (+${points})` });
  };

  const specialtyText = `${lead.specialty} ${lead.practiceName}`.toLowerCase();
  const matchedSpecialty = TARGET_SPECIALTY_KEYWORDS.find(k => specialtyText.includes(k));
  if (matchedSpecialty) {
    add('specialty-fit', 30, `Specialty/practice matches the ThriveMed target list ("${matchedSpecialty}")`);
  }

  const titleText = `${lead.title} ${lead.adminContact}`.toLowerCase();
  const matchedTitle = DECISION_MAKER_MARKERS.find(k => titleText.includes(k));
  if (matchedTitle) {
    add('decision-maker-title', 20, `Contact role indicates buying authority ("${matchedTitle}")`);
  }

  if (lead.npiNumber && /npi|cms|nppes/i.test(lead.provenance.source)) {
    add('registry-verified-identity', 15, 'Identity verified against the CMS NPI Registry record');
  }

  const sizeText = `${lead.practiceSize} ${lead.practiceName}`.toLowerCase();
  if (/hospital|group|multi|center|centre|clinic network/.test(sizeText) || lead.practiceName !== lead.doctorName && /llc|inc|associates|partners/.test(sizeText)) {
    add('org-scale', 15, 'Organisation-scale practice (group / facility indicators in sourced fields)');
  }

  if (lead.phone) add('has-phone', 10, 'A sourced phone number is on record');
  if (lead.email) add('has-email', 10, 'A sourced email address is on record');

  score = Math.min(100, score);
  const fitReason = rules.length > 0
    ? rules.map(r => r.detail.replace(/ \(\+\d+\)$/, '')).join('; ')
    : 'No fit rules matched — insufficient sourced data to score this lead.';

  const contactability = lead.phone && lead.email ? 'phone+email' : lead.phone ? 'phone' : lead.email ? 'email' : 'none';
  return {
    enrichedAt: now,
    ruleset: FIT_RULESET_ID,
    fitScore: score,
    fitReason,
    rulesApplied: rules,
    derived: {
      contactability: { value: contactability, rule: 'derived:contactability (sourced phone/email presence)' },
      outreachReady: { value: Boolean(lead.email) && !lead.suppressed, rule: 'derived:outreach-ready (sourced email present and not suppressed)' }
    }
  };
}

export function enrichWorkspaceLeads(
  state: PipelineState,
  workspaceId: string,
  leadIds?: string[]
): PipelineLead[] {
  const now = new Date().toISOString();
  const enriched: PipelineLead[] = [];
  for (const lead of Object.values(state.leads)) {
    if (lead.workspaceId !== workspaceId) continue;
    if (leadIds && leadIds.length > 0 && !leadIds.includes(lead.id)) continue;
    lead.enrichment = enrichLead(lead, now);
    lead.updatedAt = now;
    enriched.push(lead);
  }
  return enriched;
}

// ---------------------------------------------------------------------------
// Phase 4 — LinkedIn founder-assisted flow (no unattended automation)
// ---------------------------------------------------------------------------

/**
 * Deterministic connection-request / InMail draft built ONLY from fields
 * on the (sourced) record. Missing fields change the wording — nothing is
 * invented to fill a gap.
 */
export function buildTemplateDraft(p: {
  prospectName?: string; practiceName?: string; specialty?: string;
}): string {
  const first = (p.prospectName || '').replace(/^Dr\.?\s+/i, '').split(/\s+/)[0] || 'there';
  const practice = p.practiceName ? ` at ${p.practiceName}` : '';
  const specialty = p.specialty ? ` ${p.specialty}` : '';
  return `Hi ${first} — I lead operations at ThriveMed RCM, where we help${specialty} practices${practice} cut claim denials and days in AR. I'd value connecting with peers working on the same problems. If billing capacity or denial follow-up is ever a pressure point, I'm happy to share what we're seeing across practices like yours — no pitch attached.`;
}

export function createAssist(
  state: PipelineState,
  workspaceId: string,
  input: {
    leadId?: string | null; prospectName: string; practiceName: string;
    linkedInUrl: string; draftMessage: string; draftSource: 'template' | 'gemini';
  },
  createdBy: string
): LinkedInAssist {
  const now = new Date().toISOString();
  const assist: LinkedInAssist = {
    id: `assist-${crypto.randomUUID()}`,
    workspaceId,
    leadId: input.leadId ?? null,
    prospectName: input.prospectName,
    practiceName: input.practiceName,
    linkedInUrl: input.linkedInUrl,
    draftMessage: input.draftMessage,
    draftSource: input.draftSource,
    status: 'prepared',
    outcomeNote: null,
    outcomeAt: null,
    createdBy,
    createdAt: now,
    updatedAt: now
  };
  state.assists[assist.id] = assist;
  return assist;
}

export function logAssistOutcome(
  state: PipelineState,
  assist: LinkedInAssist,
  outcome: AssistOutcome,
  note?: string
): LinkedInAssist {
  assist.status = outcome;
  assist.outcomeNote = note || null;
  assist.outcomeAt = new Date().toISOString();
  assist.updatedAt = assist.outcomeAt;
  return assist;
}

// ---------------------------------------------------------------------------
// Phase 5 — Notes & tasks
// ---------------------------------------------------------------------------

/**
 * Conservative rule-based action-item extraction from a REAL transcript:
 * an item is created only when a transcript line itself carries an action
 * marker, and the item text quotes that line. Nothing is paraphrased or
 * invented; the summary remains the human's / Gemini's job.
 */
const ACTION_MARKER = /^(action( item)?|todo|to-do|follow[- ]?up)\s*[:\-]/i;
const ACTION_PHRASES = [
  'please send', 'send over', 'send me', 'schedule a', 'book a', 'call back',
  'call me', 'email me', 'follow up with', 'share the', 'get back to'
];

export function extractActionItemsFromTranscript(transcript: string): NoteActionItem[] {
  const items: NoteActionItem[] = [];
  const lines = String(transcript || '').split(/\r?\n/);
  lines.forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (line.length < 8 || line.length > 400) return;
    const lower = line.toLowerCase();
    if (ACTION_MARKER.test(line) || ACTION_PHRASES.some(p => lower.includes(p))) {
      items.push({
        text: line.replace(ACTION_MARKER, '').trim(),
        extraction: 'rule',
        lineRef: `line ${i + 1}`
      });
    }
  });
  return items.slice(0, 20);
}

export function createTask(
  state: PipelineState,
  workspaceId: string,
  input: {
    title: string; owner: string; leadId?: string | null; noteId?: string | null;
    dueAt?: string | null; priority?: PipelineTask['priority'];
  },
  createdBy: string
): PipelineTask {
  const task: PipelineTask = {
    id: `task-${crypto.randomUUID()}`,
    workspaceId,
    leadId: input.leadId ?? null,
    noteId: input.noteId ?? null,
    title: input.title,
    owner: input.owner || createdBy,
    dueAt: input.dueAt ?? null,
    priority: input.priority || 'Medium',
    status: 'open',
    createdBy,
    createdAt: new Date().toISOString(),
    completedAt: null,
    completedBy: null
  };
  state.tasks[task.id] = task;
  return task;
}

/** The ONLY path that changes a task's status — an explicit human action.
 *  `done` stamps who did it and when; nothing auto-completes a task. */
export function updateTaskStatus(
  state: PipelineState,
  task: PipelineTask,
  status: PipelineTaskStatus,
  actorEmail: string
): PipelineTask {
  task.status = status;
  if (status === 'done') {
    task.completedAt = new Date().toISOString();
    task.completedBy = actorEmail;
  } else {
    task.completedAt = null;
    task.completedBy = null;
  }
  return task;
}

// ---------------------------------------------------------------------------
// Phase 5 — Daily stats, counted from records (never narrated)
// ---------------------------------------------------------------------------

function onDate(iso: string | null | undefined, dateKey: string): boolean {
  return typeof iso === 'string' && iso.slice(0, 10) === dateKey;
}

export function computeDailyStats(
  state: PipelineState,
  platform: PlatformState,
  workspaceId: string,
  dateKey: string
) {
  const leads = Object.values(state.leads).filter(l => l.workspaceId === workspaceId);
  const notes = Object.values(state.notes).filter(n => n.workspaceId === workspaceId);
  const tasks = Object.values(state.tasks).filter(t => t.workspaceId === workspaceId);
  const deliveries = state.deliveries.filter(d => d.workspaceId === workspaceId);
  const suppressions = Object.values(state.suppressions).filter(s => s.workspaceId === workspaceId);
  const assists = Object.values(state.assists).filter(a => a.workspaceId === workspaceId);

  const snapshot = platform.snapshots[workspaceId];
  const callSessions = (snapshot?.callSessions ?? []).filter(s => onDate(s.at, dateKey));

  const counts = {
    leadsIngested: leads.filter(l => onDate(l.createdAt, dateKey)).length,
    notesCreated: notes.filter(n => onDate(n.createdAt, dateKey)).length,
    tasksCreated: tasks.filter(t => onDate(t.createdAt, dateKey)).length,
    tasksCompleted: tasks.filter(t => t.status === 'done' && onDate(t.completedAt, dateKey)).length,
    outreachSent: deliveries.filter(d => (d.status === 'sent' || d.status === 'delivered') && onDate(d.at, dateKey)).length,
    outreachDelivered: deliveries.filter(d => d.status === 'delivered' && onDate(d.at, dateKey)).length,
    outreachFailed: deliveries.filter(d => d.status === 'failed' && onDate(d.at, dateKey)).length,
    outreachNotConfigured: deliveries.filter(d => d.status === 'not_configured' && onDate(d.at, dateKey)).length,
    suppressionsAdded: suppressions.filter(s => onDate(s.createdAt, dateKey)).length,
    linkedinOutcomesLogged: assists.filter(a => a.status !== 'prepared' && onDate(a.outcomeAt, dateKey)).length,
    // Call Studio sessions recorded in the app — simulated in-browser,
    // NOT carrier calls (Phase 7 has not run; labelling stays honest).
    callStudioSessions: callSessions.length
  };

  const needsFounder = tasks
    .filter(t => t.status === 'open' && t.dueAt && t.dueAt.slice(0, 10) <= dateKey)
    .sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)))
    .map(t => ({ taskId: t.id, title: t.title, owner: t.owner, dueAt: t.dueAt, leadId: t.leadId }));

  const totalActivity = Object.values(counts).reduce((a, b) => a + b, 0);
  return {
    date: dateKey,
    workspaceId,
    counts,
    callActivity: { caption: 'Call Studio sessions', simulated: true, sessions: counts.callStudioSessions },
    needsFounder,
    hasActivity: totalActivity > 0,
    note: totalActivity > 0
      ? 'Every figure is counted from records created on this date in this workspace.'
      : 'No activity was recorded for this date — all counts are genuinely zero.'
  };
}

// ---------------------------------------------------------------------------
// Phase 6 — Email sequences
// ---------------------------------------------------------------------------

export function renderTemplate(tpl: string, lead: PipelineLead | null, extra?: Record<string, string>): string {
  const first = lead?.doctorName ? lead.doctorName.replace(/^Dr\.?\s+/i, '').split(/\s+/)[0] : '';
  const values: Record<string, string> = {
    practiceName: lead?.practiceName || '',
    doctorName: lead?.doctorName || '',
    firstName: first,
    specialty: lead?.specialty || '',
    state: lead?.state || '',
    adminContact: lead?.adminContact || '',
    ...(extra || {})
  };
  return String(tpl || '').replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (m, key) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : m
  );
}

export function isWithinSendWindow(step: SequenceStep, timezone: string, now: Date): boolean {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, hour12: false, hour: '2-digit', minute: '2-digit'
    }).formatToParts(now);
    const get = (t: string) => parts.find(p => p.type === t)?.value || '00';
    const cur = parseInt(get('hour'), 10) * 60 + parseInt(get('minute'), 10);
    const [sh, sm] = step.windowStart.split(':').map(n => parseInt(n, 10));
    const [eh, em] = step.windowEnd.split(':').map(n => parseInt(n, 10));
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    if (start <= end) return cur >= start && cur < end;
    return cur >= start || cur < end; // overnight window
  } catch {
    return true; // unknown timezone string — the step's own window fields were validated at creation
  }
}

export function enrollLeadInSequence(
  state: PipelineState,
  sequence: Sequence,
  lead: PipelineLead,
  enrolledBy: string
): { outcome: 'enrolled' | 'duplicate' | 'suppressed' | 'rejected'; reason?: string; enrollment?: Enrollment } {
  if (lead.workspaceId !== sequence.workspaceId) {
    return { outcome: 'rejected', reason: 'lead belongs to a different workspace' };
  }
  for (const e of Object.values(state.enrollments)) {
    if (e.sequenceId === sequence.id && e.leadId === lead.id && e.status === 'active') {
      return { outcome: 'duplicate', enrollment: e, reason: 'lead already has an active enrollment in this sequence' };
    }
  }
  const sup = matchSuppression(state, sequence.workspaceId, lead);
  if (sup || lead.suppressed) {
    return { outcome: 'suppressed', reason: `lead is on the suppression list (${sup?.reason || 'suppressed'})` };
  }
  if (!lead.email) {
    return { outcome: 'rejected', reason: 'lead has no sourced email address' };
  }
  const now = new Date();
  const firstStep = sequence.steps[0];
  const enrollment: Enrollment = {
    id: `enr-${crypto.randomUUID()}`,
    workspaceId: sequence.workspaceId,
    sequenceId: sequence.id,
    leadId: lead.id,
    email: lead.email,
    currentStep: 0,
    status: 'active',
    stopReason: null,
    nextDueAt: new Date(now.getTime() + (firstStep?.delayDays || 0) * 86400000).toISOString(),
    lastDeliveryId: null,
    enrolledBy,
    enrolledAt: now.toISOString(),
    updatedAt: now.toISOString()
  };
  state.enrollments[enrollment.id] = enrollment;
  return { outcome: 'enrolled', enrollment };
}

export interface MailerSendResult {
  status: 'sent' | 'not_configured' | 'failed';
  messageId?: string;
  error?: string;
}

export interface TickSummary {
  processed: number;
  sent: number;
  failed: number;
  notConfigured: number;
  skippedSuppressed: number;
  skippedWindow: number;
  skippedPlan: number;
  planLimitReached: boolean;
  deliveries: DeliveryRecord[];
}

const FAILURE_RETRY_MS = 10 * 60 * 1000;

/**
 * Process every due enrollment (one workspace, or all when workspaceId is
 * null — the background interval uses null). Suppression is re-checked at
 * send time, the sequence must be active (pausing stops future steps on
 * the next tick), the plan's email_outreach feature + monthly send cap
 * are enforced for the sequence creator, and an enrollment advances ONLY
 * on a real 'sent' from the mailer.
 */
export async function processDueSequences(
  state: PipelineState,
  platform: PlatformState,
  opts: {
    workspaceId?: string | null;
    now?: Date;
    send: (p: { to: string; subject: string; html: string; text?: string }) => Promise<MailerSendResult>;
  }
): Promise<TickSummary> {
  const now = opts.now || new Date();
  const summary: TickSummary = {
    processed: 0, sent: 0, failed: 0, notConfigured: 0,
    skippedSuppressed: 0, skippedWindow: 0, skippedPlan: 0,
    planLimitReached: false, deliveries: []
  };

  // Per-creator plan context, resolved once per tick.
  const creatorContext = new Map<string, { blocked: boolean; limitReached: boolean }>();
  const contextFor = (seq: Sequence) => {
    const cached = creatorContext.get(seq.id);
    if (cached) return cached;
    let ctx = { blocked: false, limitReached: false };
    const record = findUser(platform, seq.createdByUid, seq.createdBy);
    const master = isMasterAdminEmail(platform, seq.createdBy);
    if (record && !master) {
      const plan = record.planId ? platform.plans[record.planId] : null;
      // Effective access (plan ± per-user overrides), same as the gates.
      if (!plan || effectiveFeatures(plan, record.featureOverrides).email_outreach !== true) ctx.blocked = true;
      else if (typeof plan.limits.sendsPerMonth === 'number'
        && currentUsage(platform, seq.createdByUid).sends >= plan.limits.sendsPerMonth) {
        ctx.limitReached = true;
      }
    }
    creatorContext.set(seq.id, ctx);
    return ctx;
  };

  for (const seq of Object.values(state.sequences)) {
    if (seq.status !== 'active') continue; // paused/draft: no sends, ever
    if (opts.workspaceId && seq.workspaceId !== opts.workspaceId) continue;
    const ctx = contextFor(seq);

    const due = Object.values(state.enrollments)
      .filter(e => e.sequenceId === seq.id && e.status === 'active'
        && e.nextDueAt && Date.parse(e.nextDueAt) <= now.getTime())
      .sort((a, b) => String(a.nextDueAt).localeCompare(String(b.nextDueAt)));

    for (const enrollment of due) {
      const lead = state.leads[enrollment.leadId] || null;
      const step = seq.steps[enrollment.currentStep];
      if (!step) {
        enrollment.status = 'completed';
        enrollment.nextDueAt = null;
        enrollment.updatedAt = now.toISOString();
        continue;
      }
      summary.processed++;

      // Suppression is re-checked at send time (Blueprint §7).
      const sup = matchSuppression(state, seq.workspaceId, {
        email: enrollment.email, phone: lead?.phone, npiNumber: lead?.npiNumber, practiceName: lead?.practiceName
      });
      if (sup || lead?.suppressed) {
        enrollment.status = 'stopped';
        enrollment.stopReason = 'suppressed';
        enrollment.nextDueAt = null;
        enrollment.updatedAt = now.toISOString();
        const rec: DeliveryRecord = {
          id: `dlv-${crypto.randomUUID()}`,
          workspaceId: seq.workspaceId, sequenceId: seq.id, enrollmentId: enrollment.id,
          leadId: enrollment.leadId, stepIndex: enrollment.currentStep,
          to: enrollment.email, subject: renderTemplate(step.subject, lead),
          status: 'skipped_suppressed', provider: 'resend',
          providerMessageId: null, providerStatus: null,
          error: 'Recipient is on the suppression list; nothing was sent.', at: now.toISOString()
        };
        state.deliveries.unshift(rec);
        enrollment.lastDeliveryId = rec.id;
        summary.skippedSuppressed++;
        summary.deliveries.push(rec);
        continue;
      }

      if (ctx.blocked) { summary.skippedPlan++; continue; }
      if (ctx.limitReached) { summary.planLimitReached = true; continue; }

      if (!isWithinSendWindow(step, seq.timezone, now)) {
        summary.skippedWindow++;
        continue;
      }

      const subject = renderTemplate(step.subject, lead);
      const text = renderTemplate(step.body, lead);
      const html = `<p>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>`;
      const result = await opts.send({ to: enrollment.email, subject, html, text });

      const rec: DeliveryRecord = {
        id: `dlv-${crypto.randomUUID()}`,
        workspaceId: seq.workspaceId, sequenceId: seq.id, enrollmentId: enrollment.id,
        leadId: enrollment.leadId, stepIndex: enrollment.currentStep,
        to: enrollment.email, subject,
        status: result.status, provider: 'resend',
        providerMessageId: result.messageId ?? null, providerStatus: null,
        error: result.error ?? null, at: now.toISOString()
      };
      state.deliveries.unshift(rec);
      enrollment.lastDeliveryId = rec.id;
      enrollment.updatedAt = now.toISOString();
      summary.deliveries.push(rec);

      if (result.status === 'sent') {
        summary.sent++;
        recordUsage(platform, seq.createdByUid, 'sends', 1);
        // Re-evaluate the cap for the next send in this same tick.
        const record = findUser(platform, seq.createdByUid, seq.createdBy);
        const plan = record?.planId ? platform.plans[record.planId] : null;
        if (record && plan && typeof plan.limits.sendsPerMonth === 'number'
          && currentUsage(platform, seq.createdByUid).sends >= plan.limits.sendsPerMonth) {
          ctx.limitReached = true;
        }
        enrollment.currentStep++;
        if (enrollment.currentStep >= seq.steps.length) {
          enrollment.status = 'completed';
          enrollment.nextDueAt = null;
        } else {
          const nextStep = seq.steps[enrollment.currentStep];
          enrollment.nextDueAt = new Date(now.getTime() + (nextStep.delayDays || 0) * 86400000).toISOString();
        }
      } else if (result.status === 'not_configured') {
        summary.notConfigured++;
        enrollment.nextDueAt = new Date(now.getTime() + FAILURE_RETRY_MS).toISOString();
      } else {
        summary.failed++;
        enrollment.nextDueAt = new Date(now.getTime() + FAILURE_RETRY_MS).toISOString();
      }
    }
  }

  if (state.deliveries.length > 2000) state.deliveries = state.deliveries.slice(0, 2000);
  return summary;
}

// ---------------------------------------------------------------------------
// Phase 6 — Resend webhook (Standard Webhooks / Svix signature scheme)
// ---------------------------------------------------------------------------

export function verifyResendWebhook(
  secret: string,
  headers: { id?: string; timestamp?: string; signature?: string },
  rawBody: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): { ok: true } | { ok: false; reason: string } {
  if (!secret) return { ok: false, reason: 'RESEND_WEBHOOK_SECRET is not configured' };
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return { ok: false, reason: 'missing svix signature headers' };
  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > 300) {
    return { ok: false, reason: 'webhook timestamp outside the 5-minute tolerance' };
  }
  const secretB64 = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  let key: Buffer;
  try {
    key = Buffer.from(secretB64, 'base64');
  } catch {
    return { ok: false, reason: 'webhook secret is not valid base64' };
  }
  const expected = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${rawBody}`).digest();
  for (const part of signature.split(' ')) {
    const [version, sig] = part.split(',');
    if (version !== 'v1' || !sig) continue;
    let candidate: Buffer;
    try {
      candidate = Buffer.from(sig, 'base64');
    } catch {
      continue;
    }
    if (candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected)) {
      return { ok: true };
    }
  }
  return { ok: false, reason: 'signature verification failed' };
}

/**
 * Apply a verified Resend event. Deliveries are matched by the provider
 * message id recorded at send time. Bounces and complaints suppress the
 * address and stop its active enrollments — automatically, because a
 * complaint/opt-out must be honoured immediately (Blueprint §4.4).
 */
export function applyResendEvent(
  state: PipelineState,
  event: any
): { matched: boolean; action: string; deliveryId?: string } {
  const type = String(event?.type || '');
  const emailId = String(event?.data?.email_id || event?.data?.id || '');
  if (!emailId) return { matched: false, action: 'ignored: event carries no email_id' };
  const delivery = state.deliveries.find(d => d.providerMessageId === emailId);
  if (!delivery) return { matched: false, action: 'ignored: unknown provider message id' };

  delivery.providerStatus = type;
  if (type === 'email.delivered' && delivery.status === 'sent') {
    delivery.status = 'delivered';
    return { matched: true, action: 'delivery marked delivered', deliveryId: delivery.id };
  }
  if (type === 'email.bounced' || type === 'email.complained') {
    const isComplaint = type === 'email.complained';
    delivery.status = isComplaint ? 'complained' : 'bounced';
    addSuppression(state, delivery.workspaceId, 'email', delivery.to,
      isComplaint ? 'complaint' : 'bounce', 'resend-webhook');
    for (const e of Object.values(state.enrollments)) {
      if (e.workspaceId === delivery.workspaceId && normalizeEmail(e.email) === normalizeEmail(delivery.to) && e.status === 'active') {
        e.status = 'stopped';
        e.stopReason = isComplaint ? 'complained' : 'bounced';
        e.nextDueAt = null;
        e.updatedAt = new Date().toISOString();
      }
    }
    const lead = state.leads[delivery.leadId];
    if (lead) {
      lead.suppressed = true;
      lead.status = 'suppressed';
      lead.updatedAt = new Date().toISOString();
    }
    return { matched: true, action: `recipient suppressed (${isComplaint ? 'complaint' : 'bounce'}); active enrollments stopped`, deliveryId: delivery.id };
  }
  return { matched: true, action: `provider status recorded (${type})`, deliveryId: delivery.id };
}
