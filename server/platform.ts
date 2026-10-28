/**
 * Phases 1–3 — Platform identity, plans, master admins, audit, usage, and
 * dashboard aggregation (Phoenix line).
 *
 * The companion prompt models this data in Firestore (users/{uid},
 * plans/{planId}, platformConfig/masterAdmins, adminAudit/{id}) written by
 * the Express server via the Firebase Admin SDK. This environment has no
 * firebase-admin package and no Admin credentials (the same constraint
 * documented in Phase 0 for C8), so the model is persisted through
 * serverStore (server-data/store.json) behind these Firestore-shaped
 * interfaces. Swapping in a Firestore adapter later means replacing the
 * state accessors below, not the route handlers or middleware.
 *
 * Owner identity (Phase 0 / C7) is unchanged: OWNER_EMAILS env is the
 * break-glass master-admin source and fails closed when unset. The stored
 * platformConfig/masterAdmins list is the second source; the union is the
 * effective master-admin set. No email address is hardcoded anywhere.
 *
 * Migration rule: plan/status gates apply to users who HAVE a platform
 * record. Records are created when the client fetches GET /api/me/access
 * (the prompt's "on sign-in, the server ensures a users doc exists"), via
 * POST /api/me/register, or by an admin. Requests from authenticated users
 * with no record predate the platform model and pass the gates untouched,
 * which keeps the Phase 0 acceptance battery (whose tokens never touch
 * /api/me/*) green.
 */
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { loadStore, saveStore } from './serverStore.js';
import { OWNER_EMAILS, DecodedFirebaseToken } from './security.js';
import type { ConsentRecord, SuppressionRecord } from './contactGate.js';
import type { DraftMessage, FollowUpTask, OwnerSummary, PipelineStage } from './afterCall.js';
import type { OwnerAction } from './ownerDashboard.js';

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export const FEATURE_KEYS = [
  'lead_discovery',
  'npi_search',
  'campaigns',
  'email_outreach',
  'call_studio',
  'linkedin_workflows',
  'ai_assistant',
  'daily_briefing',
  'territory_maps',
  'google_sync'
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type PlatformRole = 'master_admin' | 'admin' | 'user';
export type PlatformStatus = 'pending_approval' | 'active' | 'disabled';

export interface PlatformUser {
  uid: string;
  email: string;
  displayName: string;
  /** Admin Command Center: free-form job title shown in the admin user
   *  list (e.g. 'Owner - Master Admin'). Admins pick from titles already
   *  in use plus standard titles, or type a custom one. A title never
   *  grants access; role and plan still decide that. */
  title?: string;
  role: PlatformRole;
  planId: string | null;
  status: PlatformStatus;
  /** Admin Command Center: per-user feature overrides applied on top of
   *  the plan — true grants an area the plan lacks, false revokes one the
   *  plan includes. Absent key = follow the plan. Effective access is
   *  computed server-side (see effectiveFeatures). */
  featureOverrides?: Record<string, boolean>;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionNote?: string;
  invitedBy?: string;
  lastSignInAt?: string;
  /** Access Gateway: organization the user gave on the Request Access
   *  form (also mirrored onto accessRequest). Free-text, self-reported. */
  organization?: string;
  /** Access Gateway: details submitted with the Request Access form.
   *  requestedPlanId is a preference the admin sees at approval time —
   *  it never grants anything by itself; approval still assigns the plan. */
  accessRequest?: {
    organization: string;
    requestedPlanId: string | null;
    termsAcceptedAt: string;
    submittedAt: string;
  };
}

/** Tombstone left when an admin deletes a user record. Without it, a
 *  deleted user (whose Firebase Auth account cannot be deleted from here
 *  — see DELETE /api/admin/users/:uid) would fall under the "no platform
 *  record = grandfathered" migration rule and keep API access until their
 *  next /api/me/access call recreated a pending record. Gate decisions
 *  consult tombstones first, so a deleted uid/email is rejected
 *  immediately. The tombstone is cleared if the person is re-created by
 *  an admin or signs up again (they then start over as pending_approval). */
export interface DeletedUserTombstone {
  uid: string;
  email: string;
  deletedAt: string;
  deletedBy: string;
}

export interface PlanLimits {
  leadsPerMonth: number;
  campaignsActive: number;
  seats: number;
  callsPerMonth: number;
  /** Phase 6: outbound sequence emails per month (Resend sends). Added
   *  additively — older persisted plans without it read as undefined and
   *  the send gate treats undefined as "no numeric cap configured". */
  sendsPerMonth?: number;
}

export interface Plan {
  id: string;
  name: string;
  priceNote: string;
  features: Record<string, boolean>;
  limits: PlanLimits;
  isDefault: boolean;
}

export interface AuditEntry {
  id: string;
  actorEmail: string;
  action: string;
  target: string;
  details: string;
  at: string;
}

export interface UsageCounters {
  month: string; // YYYY-MM
  leads: number;
  calls: number;
  /** Phase 6: sequence emails actually sent (mailer status 'sent'). */
  sends: number;
}

export interface SnapshotLead {
  id?: string;
  status?: string;
  createdAt?: string | null;
  lastContacted?: string | null;
}

export interface SnapshotCampaign {
  id: string;
  name: string;
  status: string;
  sent: number;
  opened: number;
  replied: number;
  createdAt?: string | null;
}

export interface SnapshotCallSession {
  at: string;
  outcome: string;
}

export interface SnapshotTask {
  id?: string;
  dueAt?: string | null;
  completed: boolean;
  completedAt?: string | null;
}

export interface WorkspaceSnapshot {
  workspaceId: string;
  updatedAt: string;
  leads: SnapshotLead[];
  campaigns: SnapshotCampaign[];
  callSessions: SnapshotCallSession[];
  tasks: SnapshotTask[];
}

/** Phase 7.1: consent ledger and internal suppression list. The live
 *  National DNC Registry is never queried from here (it requires paid
 *  registration); this list holds internal suppressions plus any
 *  user-supplied DNC list imported as CSV. */
export interface Phase71State {
  consents: ConsentRecord[];
  suppressions: SuppressionRecord[];
}

/** Phase 7.3: after-call pipeline, follow-up tasks, drafts (never sent
 *  by the server), and owner handoff summaries. Drafts are stored only
 *  as drafts; no route in this file sends them. */
export interface Phase73State {
  pipeline: Record<string, PipelineStage>;
  tasks: FollowUpTask[];
  drafts: DraftMessage[];
  ownerSummaries: OwnerSummary[];
}

/** Phase 7.4: owner dashboard action log. Actions are reversible and
 *  logged; the log itself never sends, calls, or changes consent. */
export interface Phase74State {
  actions: OwnerAction[];
}

export interface PlatformState {
  users: Record<string, PlatformUser>;
  plans: Record<string, Plan>;
  masterAdminEmails: string[];
  audit: AuditEntry[];
  usage: Record<string, UsageCounters>;
  snapshots: Record<string, WorkspaceSnapshot>;
  deletedUsers: DeletedUserTombstone[];
  phase71: Phase71State;
  phase73: Phase73State;
  phase74: Phase74State;
}

// ---------------------------------------------------------------------------
// Seed plans (prompt §3e) — admin-editable after first run.
// ---------------------------------------------------------------------------

function featureMap(on: FeatureKey[]): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const key of FEATURE_KEYS) map[key] = on.includes(key);
  return map;
}

export function getSeedPlans(): Record<string, Plan> {
  return {
    trial: {
      id: 'trial',
      name: 'Trial',
      priceNote: 'Free trial',
      features: featureMap(['lead_discovery', 'npi_search']),
      limits: { leadsPerMonth: 100, campaignsActive: 0, seats: 1, callsPerMonth: 0, sendsPerMonth: 0 },
      isDefault: true
    },
    starter: {
      id: 'starter',
      name: 'Starter',
      priceNote: '',
      features: featureMap(['lead_discovery', 'npi_search', 'campaigns', 'email_outreach', 'daily_briefing']),
      limits: { leadsPerMonth: 1000, campaignsActive: 5, seats: 3, callsPerMonth: 0, sendsPerMonth: 1000 },
      isDefault: false
    },
    growth: {
      id: 'growth',
      name: 'Growth',
      priceNote: '',
      features: featureMap([...FEATURE_KEYS]),
      limits: { leadsPerMonth: 5000, campaignsActive: 25, seats: 10, callsPerMonth: 2000, sendsPerMonth: 10000 },
      isDefault: false
    }
  };
}

export function emptyPlatformState(): PlatformState {
  return {
    users: {},
    plans: getSeedPlans(),
    masterAdminEmails: [],
    audit: [],
    usage: {},
    snapshots: {},
    deletedUsers: [],
    phase71: { consents: [], suppressions: [] },
    phase73: { pipeline: {}, tasks: [], drafts: [], ownerSummaries: [] },
    phase74: { actions: [] }
  };
}

// ---------------------------------------------------------------------------
// Persisted state access (single cached store object shared with server.ts)
// ---------------------------------------------------------------------------

const store = loadStore();

export function getPlatformState(): PlatformState {
  if (!store.platform || typeof store.platform !== 'object' || !store.platform.plans) {
    store.platform = emptyPlatformState();
    saveStore(store);
  }
  const state = store.platform as PlatformState;
  // Migration: states persisted before the Admin Command Center have no
  // tombstone list.
  if (!Array.isArray(state.deletedUsers)) state.deletedUsers = [];
  // Migration: states persisted before Phase 7.1 have no consent ledger.
  if (!state.phase71 || !Array.isArray(state.phase71.consents) || !Array.isArray(state.phase71.suppressions)) {
    state.phase71 = { consents: [], suppressions: [] };
  }
  // Migration: states persisted before Phase 7.3 have no after-call state.
  if (!state.phase73 || typeof state.phase73.pipeline !== 'object' || !Array.isArray(state.phase73.tasks)
    || !Array.isArray(state.phase73.drafts) || !Array.isArray(state.phase73.ownerSummaries)) {
    state.phase73 = { pipeline: {}, tasks: [], drafts: [], ownerSummaries: [] };
  }
  // Migration: states persisted before Phase 7.4 have no owner action log.
  if (!state.phase74 || !Array.isArray(state.phase74.actions)) {
    state.phase74 = { actions: [] };
  }
  return state;
}

export function persistPlatform(): void {
  saveStore(store);
}

// ---------------------------------------------------------------------------
// Master admins (prompt §3b, Phase 0 C7 constraints)
// ---------------------------------------------------------------------------

const normalizeEmail = (e: string) => e.trim().toLowerCase();

export function effectiveMasterAdmins(state: PlatformState, envEmails: string[] = OWNER_EMAILS): string[] {
  const set = new Set<string>();
  for (const e of envEmails) set.add(normalizeEmail(e));
  for (const e of state.masterAdminEmails || []) set.add(normalizeEmail(e));
  return [...set];
}

export function isMasterAdminEmail(state: PlatformState, email: string | undefined | null, envEmails: string[] = OWNER_EMAILS): boolean {
  if (!email) return false;
  return effectiveMasterAdmins(state, envEmails).includes(normalizeEmail(email));
}

/**
 * Guardrails for replacing the stored master-admin list (prompt §3b):
 * the actor cannot remove themselves, and the effective set (stored ∪ env)
 * can never become empty. Returns a 409 verdict or ok.
 */
export function validateMasterAdminUpdate(
  state: PlatformState,
  actorEmail: string,
  newStoredList: string[],
  envEmails: string[] = OWNER_EMAILS
): { ok: true } | { ok: false; status: 409; error: string } {
  const actor = normalizeEmail(actorEmail);
  const nextEffective = new Set<string>();
  for (const e of envEmails) nextEffective.add(normalizeEmail(e));
  for (const e of newStoredList) nextEffective.add(normalizeEmail(e));

  const currentEffective = effectiveMasterAdmins(state, envEmails);
  if (currentEffective.includes(actor) && !nextEffective.has(actor)) {
    return { ok: false, status: 409, error: 'You cannot remove yourself as a master admin.' };
  }
  if (nextEffective.size === 0) {
    return { ok: false, status: 409, error: 'At least one master admin is required; the last master admin cannot be removed.' };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// User records
// ---------------------------------------------------------------------------

export function findUser(state: PlatformState, uid?: string, email?: string): PlatformUser | null {
  if (uid && state.users[uid]) return state.users[uid];
  if (email) {
    const target = normalizeEmail(email);
    for (const u of Object.values(state.users)) {
      if (normalizeEmail(u.email) === target) return u;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Deleted-user tombstones (Admin Command Center delete semantics)
// ---------------------------------------------------------------------------

export function isDeletedUser(state: PlatformState, uid?: string, email?: string): boolean {
  for (const t of state.deletedUsers || []) {
    if (uid && t.uid === uid) return true;
    if (email && normalizeEmail(t.email) === normalizeEmail(email)) return true;
  }
  return false;
}

export function markUserDeleted(state: PlatformState, user: PlatformUser, deletedBy: string): void {
  clearDeletedUser(state, user.uid, user.email);
  state.deletedUsers.push({
    uid: user.uid,
    email: user.email,
    deletedAt: new Date().toISOString(),
    deletedBy
  });
}

export function clearDeletedUser(state: PlatformState, uid?: string, email?: string): void {
  if (!Array.isArray(state.deletedUsers)) state.deletedUsers = [];
  state.deletedUsers = state.deletedUsers.filter(t =>
    !(uid && t.uid === uid) && !(email && normalizeEmail(t.email) === normalizeEmail(email))
  );
}

/**
 * Ensure a platform record exists for an authenticated user (prompt §3a:
 * "on sign-in, the server ensures a users doc exists"). A record an admin
 * created ahead of sign-in (uid `invite:…`) is adopted by email and re-keyed
 * to the real uid, keeping its plan/status. Master admins are always
 * role master_admin + status active; everyone else starts pending_approval
 * with no plan and therefore no feature access.
 */
export function ensureUserRecord(
  state: PlatformState,
  claims: { uid: string; email: string; name?: string }
): { user: PlatformUser; created: boolean } {
  const now = new Date().toISOString();
  const master = isMasterAdminEmail(state, claims.email);
  // A record (re)appearing for this identity supersedes any delete
  // tombstone: the person starts over under the normal rules (a fresh
  // signup lands in pending_approval with zero access).
  clearDeletedUser(state, claims.uid, claims.email);

  const existing = findUser(state, claims.uid, claims.email);
  if (existing) {
    if (existing.uid !== claims.uid) {
      // Adopt the pre-created (invited) record under the real uid.
      delete state.users[existing.uid];
      existing.uid = claims.uid;
      state.users[claims.uid] = existing;
    }
    existing.lastSignInAt = now;
    if (master && (existing.role !== 'master_admin' || existing.status !== 'active')) {
      existing.role = 'master_admin';
      existing.status = 'active';
    }
    if (claims.name && (!existing.displayName || existing.displayName === existing.email)) {
      existing.displayName = claims.name;
    }
    return { user: existing, created: false };
  }

  const user: PlatformUser = {
    uid: claims.uid,
    email: claims.email,
    displayName: claims.name || claims.email,
    role: master ? 'master_admin' : 'user',
    planId: null,
    status: master ? 'active' : 'pending_approval',
    featureOverrides: {},
    createdAt: now,
    lastSignInAt: now
  };
  state.users[claims.uid] = user;
  return { user, created: true };
}

export interface AccessRequestInput {
  organization: string;
  requestedPlanId?: string | null;
  termsAcceptedAt: string;
}

/**
 * Access Gateway: record the details a user submitted with the Request
 * Access form (organization, requested plan, terms acceptance). Allowed
 * for pending_approval users — completing the request is the point of the
 * pending state — and harmless for active users (it just updates their
 * self-reported organization). The requested plan is validated against
 * the plan catalogue and stored as a preference only.
 */
export function submitAccessRequest(
  state: PlatformState,
  user: PlatformUser,
  input: AccessRequestInput
): { ok: true } | { ok: false; error: string } {
  const organization = (input.organization || '').trim();
  if (!organization) return { ok: false, error: 'ORGANIZATION_REQUIRED' };
  if (organization.length > 120) return { ok: false, error: 'ORGANIZATION_TOO_LONG' };
  let requestedPlanId: string | null = null;
  if (input.requestedPlanId) {
    if (!state.plans[input.requestedPlanId]) return { ok: false, error: 'UNKNOWN_PLAN' };
    requestedPlanId = input.requestedPlanId;
  }
  if (!input.termsAcceptedAt || Number.isNaN(Date.parse(input.termsAcceptedAt))) {
    return { ok: false, error: 'TERMS_ACCEPTANCE_REQUIRED' };
  }
  const now = new Date().toISOString();
  user.organization = organization;
  user.accessRequest = {
    organization,
    requestedPlanId,
    termsAcceptedAt: input.termsAcceptedAt,
    submittedAt: now
  };
  writeAudit(
    state,
    user.email,
    'user.access_request',
    user.email,
    `Access request details: org="${organization}", requestedPlan=${requestedPlanId || 'none'}`
  );
  return { ok: true };
}

export function defaultPlan(state: PlatformState): Plan | null {
  const plans = Object.values(state.plans);
  return plans.find(p => p.isDefault) || plans[0] || null;
}

// ---------------------------------------------------------------------------
// Access resolution & gates
// ---------------------------------------------------------------------------

export interface AccessInfo {
  uid: string;
  email: string;
  /** Identity only, for header display. Never grants access; role and plan decide that. */
  displayName: string | null;
  title: string | null;
  role: PlatformRole;
  status: PlatformStatus;
  planId: string | null;
  plan: Plan | null;
  /** Effective features: the plan's features modified by the user's
   *  per-user overrides (Admin Command Center). This is the ONLY feature
   *  map clients and gates should consult. */
  features: Record<string, boolean>;
  /** The raw per-user overrides behind `features` ({} when none). */
  featureOverrides: Record<string, boolean>;
  limits: PlanLimits | null;
  usage: UsageCounters;
  isMasterAdmin: boolean;
}

/**
 * Effective feature set for a user: start from the plan (all-off when the
 * user has no plan), then apply per-user overrides — `true` grants an area
 * the plan lacks, `false` revokes one the plan includes. Pure; the single
 * place this merge is defined so gates, /api/me/access, and the sequence
 * engine can never drift apart.
 */
export function effectiveFeatures(
  plan: Plan | null,
  overrides?: Record<string, boolean> | null
): Record<string, boolean> {
  const result = featureMap([]);
  if (plan) {
    for (const key of FEATURE_KEYS) result[key] = plan.features?.[key] === true;
  }
  if (overrides) {
    for (const key of FEATURE_KEYS) {
      if (typeof overrides[key] === 'boolean') result[key] = overrides[key];
    }
  }
  return result;
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function currentUsage(state: PlatformState, uid: string): UsageCounters {
  const month = currentMonth();
  const entry = state.usage[uid];
  if (!entry || entry.month !== month) {
    return { month, leads: 0, calls: 0, sends: 0 };
  }
  // Persisted entries from before Phase 6 have no `sends` counter.
  return { ...entry, sends: entry.sends ?? 0 };
}

export type UsageKind = 'leads' | 'calls' | 'sends';

export function recordUsage(state: PlatformState, uid: string, kind: UsageKind, n: number): void {
  if (!uid || n <= 0) return;
  const month = currentMonth();
  let entry = state.usage[uid];
  if (!entry || entry.month !== month) {
    entry = { month, leads: 0, calls: 0, sends: 0 };
    state.usage[uid] = entry;
  }
  entry[kind] = (entry[kind] ?? 0) + n;
}

export function resolveAccess(state: PlatformState, decoded: DecodedFirebaseToken): AccessInfo {
  const record = findUser(state, decoded.uid, decoded.email);
  const master = decoded.email_verified === true && isMasterAdminEmail(state, decoded.email);
  const usage = currentUsage(state, decoded.uid);

  if (master) {
    return {
      uid: decoded.uid,
      email: decoded.email || '',
      displayName: record?.displayName ?? null,
      title: record?.title ?? null,
      role: 'master_admin',
      status: 'active',
      planId: record?.planId ?? null,
      plan: record?.planId ? state.plans[record.planId] ?? null : null,
      features: featureMap([...FEATURE_KEYS]),
      featureOverrides: { ...(record?.featureOverrides ?? {}) },
      limits: null, // master admins bypass all plan gates (prompt §3e)
      usage,
      isMasterAdmin: true
    };
  }

  const plan = record?.planId ? state.plans[record.planId] ?? null : null;
  return {
    uid: decoded.uid,
    email: decoded.email || '',
    displayName: record?.displayName ?? null,
    title: record?.title ?? null,
    role: record?.role ?? 'user',
    status: record?.status ?? 'active', // no record = pre-platform user (see header)
    planId: record?.planId ?? null,
    plan,
    features: effectiveFeatures(plan, record?.featureOverrides),
    featureOverrides: { ...(record?.featureOverrides ?? {}) },
    limits: plan ? plan.limits : null,
    usage,
    isMasterAdmin: false
  };
}

export type GateVerdict =
  | { allow: true }
  | { allow: false; status: number; body: Record<string, any> };

/**
 * Status + feature gate decision for a platform-record user. Users with no
 * platform record are grandfathered (see header comment).
 */
export function featureGateDecision(
  state: PlatformState,
  decoded: DecodedFirebaseToken,
  feature: FeatureKey
): GateVerdict {
  const record = findUser(state, decoded.uid, decoded.email);
  if (!record) {
    // A deleted user's record is gone, but their tombstone keeps them
    // rejected (Admin Command Center delete semantics) instead of falling
    // under the grandfather rule below.
    if (isDeletedUser(state, decoded.uid, decoded.email)) {
      return {
        allow: false,
        status: 403,
        body: { success: false, error: 'ACCOUNT_NOT_ACTIVE', status: 'deleted' }
      };
    }
    return { allow: true };
  }
  if (record.status !== 'active') {
    return {
      allow: false,
      status: 403,
      body: { success: false, error: 'ACCOUNT_NOT_ACTIVE', status: record.status }
    };
  }
  const master = decoded.email_verified === true && isMasterAdminEmail(state, decoded.email);
  if (master) return { allow: true };
  const plan = record.planId ? state.plans[record.planId] : null;
  if (effectiveFeatures(plan, record.featureOverrides)[feature] !== true) {
    return {
      allow: false,
      status: 403,
      body: {
        success: false,
        error: 'PLAN_FEATURE_NOT_INCLUDED',
        feature,
        planId: record.planId ?? null
      }
    };
  }
  return { allow: true };
}

/** Monthly limit decision for metered kinds ('leads' | 'calls' | 'sends'). */
export function limitGateDecision(
  state: PlatformState,
  decoded: DecodedFirebaseToken,
  kind: UsageKind
): GateVerdict {
  const record = findUser(state, decoded.uid, decoded.email);
  if (!record || record.status !== 'active') return { allow: true }; // status gate runs first
  const master = decoded.email_verified === true && isMasterAdminEmail(state, decoded.email);
  if (master) return { allow: true };
  const plan = record.planId ? state.plans[record.planId] : null;
  if (!plan) return { allow: true };
  const limit = kind === 'leads'
    ? plan.limits.leadsPerMonth
    : kind === 'calls'
      ? plan.limits.callsPerMonth
      : plan.limits.sendsPerMonth;
  // A plan persisted before Phase 6 has no sendsPerMonth: treat as "no
  // numeric cap configured" rather than inventing one.
  if (kind === 'sends' && typeof limit !== 'number') return { allow: true };
  const usage = currentUsage(state, decoded.uid);
  const used = kind === 'leads' ? usage.leads : kind === 'calls' ? usage.calls : usage.sends;
  if (typeof limit === 'number' && used >= limit) {
    return {
      allow: false,
      status: 403,
      body: {
        success: false,
        error: 'PLAN_LIMIT_REACHED',
        limitKind: kind,
        limit,
        usage: used
      }
    };
  }
  return { allow: true };
}

// ---------------------------------------------------------------------------
// Audit log (prompt §3f: every admin action writes an entry)
// ---------------------------------------------------------------------------

export function writeAudit(
  state: PlatformState,
  actorEmail: string,
  action: string,
  target: string,
  details: string
): AuditEntry {
  const entry: AuditEntry = {
    id: `audit-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    actorEmail,
    action,
    target,
    details,
    at: new Date().toISOString()
  };
  state.audit.unshift(entry);
  if (state.audit.length > 500) state.audit = state.audit.slice(0, 500);
  return entry;
}

// ---------------------------------------------------------------------------
// Express middleware (bound to the persisted platform state)
// ---------------------------------------------------------------------------

function decodedOf(req: Request): DecodedFirebaseToken | undefined {
  return (req as any).user as DecodedFirebaseToken | undefined;
}

/** Master-admin gate for /api/admin/* (prompt §3f). Replaces the owner gate
 *  for the new surface; OWNER_EMAILS remains the break-glass source. */
export function requireMasterAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = decodedOf(req);
  if (!user || !user.email) {
    res.status(401).json({ success: false, error: 'Unauthorized: authentication required' });
    return;
  }
  if (user.email_verified !== true) {
    res.status(403).json({ success: false, error: 'Forbidden: master admin actions require a verified email address' });
    return;
  }
  const state = getPlatformState();
  if (!isMasterAdminEmail(state, user.email)) {
    res.status(403).json({ success: false, error: 'Forbidden: action restricted to Master Admin' });
    return;
  }
  next();
}

/** Feature gate factory (prompt §3e). Runs after global auth. */
export function requireFeature(feature: FeatureKey) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = decodedOf(req);
    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized: authentication required' });
      return;
    }
    const state = getPlatformState();
    const verdict = featureGateDecision(state, user, feature);
    if (!verdict.allow) {
      res.status(verdict.status).json(verdict.body);
      return;
    }
    next();
  };
}

/** Monthly-limit gate factory for metered endpoints (prompt §3e). */
export function requireWithinLimit(kind: UsageKind) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = decodedOf(req);
    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized: authentication required' });
      return;
    }
    const state = getPlatformState();
    const verdict = limitGateDecision(state, user, kind);
    if (!verdict.allow) {
      res.status(verdict.status).json(verdict.body);
      return;
    }
    next();
  };
}

/** Account-status gate for endpoints that are not feature-mapped but must
 *  still reject pending/disabled platform users (e.g. dashboard snapshot). */
export function requireActiveAccount(req: Request, res: Response, next: NextFunction): void {
  const user = decodedOf(req);
  if (!user) {
    res.status(401).json({ success: false, error: 'Unauthorized: authentication required' });
    return;
  }
  const state = getPlatformState();
  const record = findUser(state, user.uid, user.email);
  if (record && record.status !== 'active') {
    res.status(403).json({ success: false, error: 'ACCOUNT_NOT_ACTIVE', status: record.status });
    return;
  }
  if (!record && isDeletedUser(state, user.uid, user.email)) {
    res.status(403).json({ success: false, error: 'ACCOUNT_NOT_ACTIVE', status: 'deleted' });
    return;
  }
  next();
}

// ---------------------------------------------------------------------------
// Dashboard aggregation (prompt Part 2) — pure; unit-tested.
// Every figure derives from the synced snapshot records. Records without a
// usable timestamp count toward totals but never toward a dated series —
// history is never backfilled or invented. Deltas are returned only where
// both periods are computable from dated records; otherwise null.
// ---------------------------------------------------------------------------

export const QUALIFIED_LEAD_STATUSES = ['Audit Scheduled', 'Transferred to Manager'];
export const FUNNEL_STAGES = [
  'Ready for Call',
  'Calling',
  'Follow-up',
  'Voicemail',
  'Transferred to Manager',
  'Audit Scheduled',
  'Not Interested'
];
export const CALL_OUTCOMES = ['answered', 'voicemail', 'no_answer', 'callback_booked'];

function parseTime(v: string | null | undefined): number | null {
  if (!v || typeof v !== 'string') return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
}

function dayKey(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

export function aggregateDashboardStats(
  snapshot: WorkspaceSnapshot | null,
  rangeDays: number,
  now: Date = new Date()
) {
  const leads = snapshot?.leads ?? [];
  const campaigns = snapshot?.campaigns ?? [];
  const callSessions = snapshot?.callSessions ?? [];
  const tasks = snapshot?.tasks ?? [];

  const nowMs = now.getTime();
  const rangeMs = rangeDays * 24 * 60 * 60 * 1000;
  const rangeStart = nowMs - rangeMs;
  const prevStart = rangeStart - rangeMs;

  const inRange = (t: number | null) => t !== null && t >= rangeStart && t <= nowMs;
  const inPrev = (t: number | null) => t !== null && t >= prevStart && t < rangeStart;
  const deltaOf = (cur: number, prev: number) => cur - prev;

  // Leads
  const leadCreated = leads.map(l => parseTime(l.createdAt ?? null));
  const leadsNew = leadCreated.filter(t => inRange(t)).length;
  const leadsPrev = leadCreated.filter(t => inPrev(t)).length;
  const qualified = leads.filter(l => QUALIFIED_LEAD_STATUSES.includes(l.status || ''));
  const qualifiedNew = qualified.filter(l => inRange(parseTime(l.createdAt ?? null))).length;
  const qualifiedPrev = qualified.filter(l => inPrev(parseTime(l.createdAt ?? null))).length;

  // Funnel (current state, all stages zero-filled)
  const funnelCounts = new Map<string, number>();
  for (const stage of FUNNEL_STAGES) funnelCounts.set(stage, 0);
  for (const l of leads) {
    const s = l.status || 'Unknown';
    funnelCounts.set(s, (funnelCounts.get(s) ?? 0) + 1);
  }
  const funnel = [...funnelCounts.entries()].map(([stage, count]) => ({ stage, count }));

  // Leads over time (zero-filled per-day series across the range)
  const leadsByDay = new Map<string, number>();
  for (let i = rangeDays - 1; i >= 0; i--) {
    leadsByDay.set(dayKey(nowMs - i * 24 * 60 * 60 * 1000), 0);
  }
  for (const t of leadCreated) {
    if (inRange(t)) {
      const k = dayKey(t as number);
      if (leadsByDay.has(k)) leadsByDay.set(k, (leadsByDay.get(k) ?? 0) + 1);
    }
  }
  const leadsOverTime = [...leadsByDay.entries()].map(([date, count]) => ({ date, count }));

  // Campaigns (counters are current cumulative values on each record, so
  // totals are real but period deltas are not derivable → null).
  const activeCampaigns = campaigns.filter(c => c.status === 'running').length;
  const outreachSent = campaigns.reduce((sum, c) => sum + (Number(c.sent) || 0), 0);
  const outreachReplies = campaigns.reduce((sum, c) => sum + (Number(c.replied) || 0), 0);
  const campaignPerformance = campaigns.map(c => ({
    id: c.id,
    name: c.name,
    status: c.status,
    sent: Number(c.sent) || 0,
    opened: Number(c.opened) || 0,
    replied: Number(c.replied) || 0
  }));

  // Call sessions (Call Studio — simulated in-browser; flagged as such)
  const callTimes = callSessions.map(s => parseTime(s.at));
  const callsInRange = callTimes.filter(t => inRange(t)).length;
  const callsPrev = callTimes.filter(t => inPrev(t)).length;
  const callsByDay = new Map<string, number>();
  for (let i = rangeDays - 1; i >= 0; i--) {
    callsByDay.set(dayKey(nowMs - i * 24 * 60 * 60 * 1000), 0);
  }
  for (const t of callTimes) {
    if (inRange(t)) {
      const k = dayKey(t as number);
      if (callsByDay.has(k)) callsByDay.set(k, (callsByDay.get(k) ?? 0) + 1);
    }
  }
  const outcomeCounts = new Map<string, number>();
  for (const o of CALL_OUTCOMES) outcomeCounts.set(o, 0);
  for (const s of callSessions) {
    if (inRange(parseTime(s.at))) {
      const o = s.outcome || 'answered';
      outcomeCounts.set(o, (outcomeCounts.get(o) ?? 0) + 1);
    }
  }

  // Meetings booked = leads currently in 'Audit Scheduled'; "new" uses the
  // most recent dated signal on the record (lastContacted, else createdAt).
  const meetings = leads.filter(l => l.status === 'Audit Scheduled');
  const meetingTime = (l: SnapshotLead) => parseTime(l.lastContacted ?? null) ?? parseTime(l.createdAt ?? null);
  const meetingsNew = meetings.filter(l => inRange(meetingTime(l))).length;
  const meetingsPrev = meetings.filter(l => inPrev(meetingTime(l))).length;

  // Follow-up health (tasks)
  const todayKey = dayKey(nowMs);
  const dueToday = tasks.filter(t => !t.completed && t.dueAt && dayKey(parseTime(t.dueAt) as number) === todayKey).length;
  const startOfToday = Date.parse(`${todayKey}T00:00:00.000Z`);
  const overdue = tasks.filter(t => {
    if (t.completed) return false;
    const d = parseTime(t.dueAt ?? null);
    return d !== null && d < startOfToday;
  }).length;
  const completedByDay = new Map<string, number>();
  for (let i = rangeDays - 1; i >= 0; i--) {
    completedByDay.set(dayKey(nowMs - i * 24 * 60 * 60 * 1000), 0);
  }
  let completedInRange = 0;
  for (const t of tasks) {
    if (!t.completed) continue;
    const c = parseTime(t.completedAt ?? null);
    if (inRange(c)) {
      completedInRange++;
      const k = dayKey(c as number);
      if (completedByDay.has(k)) completedByDay.set(k, (completedByDay.get(k) ?? 0) + 1);
    }
  }

  return {
    rangeDays,
    workspaceId: snapshot?.workspaceId ?? null,
    snapshotUpdatedAt: snapshot?.updatedAt ?? null,
    kpis: {
      totalLeads: { value: leads.length, newInRange: leadsNew, delta: deltaOf(leadsNew, leadsPrev) },
      qualifiedLeads: { value: qualified.length, newInRange: qualifiedNew, delta: deltaOf(qualifiedNew, qualifiedPrev) },
      activeCampaigns: { value: activeCampaigns, newInRange: null, delta: null },
      outreachSent: { value: outreachSent, newInRange: null, delta: null },
      outreachReplies: { value: outreachReplies, newInRange: null, delta: null },
      callsMade: { value: callSessions.length, newInRange: callsInRange, delta: deltaOf(callsInRange, callsPrev) },
      meetingsBooked: { value: meetings.length, newInRange: meetingsNew, delta: deltaOf(meetingsNew, meetingsPrev) },
      tasksDueToday: { value: dueToday, newInRange: null, delta: null },
      tasksOverdue: { value: overdue, newInRange: null, delta: null }
    },
    funnel,
    leadsOverTime,
    campaignPerformance,
    callActivity: {
      // Honest caption (prompt Part 2 §5): these are Call Studio sessions
      // recorded in the app, NOT carrier/PSTN calls.
      caption: 'Call Studio sessions',
      simulated: true,
      perDay: [...callsByDay.entries()].map(([date, count]) => ({ date, count })),
      outcomes: [...outcomeCounts.entries()].map(([outcome, count]) => ({ outcome, count }))
    },
    followUpHealth: {
      dueToday,
      overdue,
      completedInRange,
      completedSeries: [...completedByDay.entries()].map(([date, completed]) => ({ date, completed }))
    }
  };
}
