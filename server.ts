import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  securityHeadersMiddleware,
  createRateLimiter,
  requireAuthMiddleware,
  requireOwnerMiddleware,
  isSafeOutboundUrl,
  assertSafeOutboundUrl,
  safeFetch,
  OWNER_EMAILS
} from './server/security.js';
import { loadStore, saveStore } from './server/serverStore.js';
import {
  getPlatformState,
  persistPlatform,
  ensureUserRecord,
  submitAccessRequest,
  resolveAccess,
  findUser,
  defaultPlan,
  isMasterAdminEmail,
  effectiveMasterAdmins,
  validateMasterAdminUpdate,
  markUserDeleted,
  clearDeletedUser,
  writeAudit,
  recordUsage,
  requireMasterAdmin,
  requireFeature,
  requireWithinLimit,
  requireActiveAccount,
  aggregateDashboardStats,
  FEATURE_KEYS,
  PlatformUser,
  Plan,
  WorkspaceSnapshot
} from './server/platform.js';
import {
  getPipelineState,
  persistPipeline,
  ingestLeads,
  enrichWorkspaceLeads,
  addSuppression,
  matchSuppression,
  buildTemplateDraft,
  createAssist,
  logAssistOutcome,
  extractActionItemsFromTranscript,
  createTask,
  updateTaskStatus,
  computeDailyStats,
  enrollLeadInSequence,
  processDueSequences,
  verifyResendWebhook,
  applyResendEvent,
  PipelineNote,
  Sequence,
  SequenceStep
} from './server/pipeline.js';
import {
  canContact,
  grantConsent,
  revokeContact,
  addSuppression as addPhase71Suppression,
  importSuppressionCsv,
  gateAuditDetail,
  normalizeEmail as normalizePhase71Email,
  normalizePhone as normalizePhase71Phone,
  type ContactChannel,
  type ConsentType,
  type GateContact,
  type SuppressionReason
} from './server/contactGate.js';
import {
  applyOptOut as applyPhase73OptOut,
  formatOwnerSummary,
  processAfterCall
} from './server/afterCall.js';
import type { CallOutcome } from './server/voiceAgent.js';
import {
  buildOwnerDashboard,
  confirmNextStep,
  markLeadOutcome,
  reopenLead,
  snoozeFollowUp,
  unsnoozeFollowUp
} from './server/ownerDashboard.js';
import {
  BILLING_PLANS,
  canAddLead,
  cancelSubscription,
  createTestCheckoutSession,
  expireTrialIfDue,
  formatPriceCents,
  getBillingPlan,
  getBillingProviderConfig,
  leadsRemaining,
  recordLeadUse,
  recordManualPayment,
  renewPeriod,
  selectPlan,
  startTrial,
  trialDaysRemaining,
  type BillingPlanId
} from './server/billing.js';
import {
  validateEmailAddress
} from './server/leadVerification.js';
import {
  buildCompanyBrief
} from './server/companyResearch.js';
import {
  addWatch as addSignalWatch,
  classifySuppliedItem
} from './server/signalMonitor.js';
import {
  PLACES_MAX_RESULTS,
  PLACES_NOT_CONFIGURED_MESSAGE,
  createGooglePlacesProvider,
  dedupePlacesDrafts,
  getPlacesApiKey,
  searchPlacesWithProvider,
  validatePlacesSearchInput
} from './server/places.js';
import crypto from 'crypto';
import { 
  sendEmailViaResend, 
  generateDailyBriefingHtml,
  DailyReportStatsPayload 
} from './server/mailer.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable('x-powered-by');

// Phase 0 (0.2): a served process must never run with NODE_ENV=test.
// (The old test-mode auth bypass has been deleted entirely; this warning is
// defence-in-depth so the misconfiguration is loud if it ever happens.)
if (process.env.NODE_ENV === 'test') {
  console.warn('\n*** [SECURITY WARNING] NODE_ENV=test in a SERVED process. Test settings must never be deployed. ***\n');
}

// Phase 0 (C8): persisted server-owned state (scheduler + AI quotas),
// loaded once at boot from server-data/store.json.
const store = loadStore();

function getPort(): number {
  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    const parsed = parseInt(process.argv[portArgIndex + 1], 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  const envPort = process.env.PORT ? parseInt(process.env.PORT, 10) : NaN;
  // If envPort is 8080 (which is the platform nginx reverse proxy), default to 3000 to prevent EADDRINUSE
  if (!isNaN(envPort) && envPort !== 8080 && envPort > 0) {
    return envPort;
  }
  return 3000;
}

function getHost(): string {
  const hostArgIndex = process.argv.indexOf('--host');
  if (hostArgIndex !== -1 && process.argv[hostArgIndex + 1]) {
    return process.argv[hostArgIndex + 1];
  }
  return '0.0.0.0';
}

const PORT = getPort();
const HOST = getHost();
const isProd = process.env.NODE_ENV === 'production';

// The raw body is captured alongside the parsed JSON because the Resend
// webhook (Phase 6) verifies its Standard-Webhooks signature over the
// exact bytes received.
app.use(express.json({
  limit: '10mb',
  verify: (req: any, _res: any, buf: Buffer) => { req.rawBody = buf; }
}));

// Phase 0 (0.1): every API write must carry a JSON *object* body. A scalar,
// array, or null body is a 400 here instead of a downstream TypeError.
app.use('/api', (req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body !== undefined) {
    if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
      return res.status(400).json({ success: false, error: 'Request body must be a JSON object' });
    }
  }
  return next();
});

app.use(securityHeadersMiddleware);
app.use(createRateLimiter({ windowMs: 60 * 1000, max: 120 }));

// Protect all /api routes except /api/health with Firebase ID-token verification.
// /api/webhooks/resend is also exempt from Firebase auth: its caller is
// Resend, and the route authenticates the request by verifying the
// Standard-Webhooks (Svix) signature over the raw body instead.
app.use('/api', (req, res, next) => {
  if (req.path === '/health' || req.path === '/webhooks/resend') {
    return next();
  }
  return requireAuthMiddleware(req, res, next);
});

// ---------------------------------------------------------------------------
// Phase 0 helpers (0.1 validation, 0.8 AI quota)
// ---------------------------------------------------------------------------

/** Wrap async handlers so rejections reach the global error handler instead
 *  of becoming unhandled rejections that kill the process (C2). */
const ah = (fn: (req: any, res: any, next: any) => Promise<any>) =>
  (req: any, res: any, next: any) => { Promise.resolve(fn(req, res, next)).catch(next); };

type FieldType = 'string' | 'number' | 'boolean' | 'array' | 'object';

/** Returns an error message when a present field has the wrong type, else null. */
function validateFields(body: any, spec: Record<string, FieldType>): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Request body must be a JSON object';
  for (const [field, type] of Object.entries(spec)) {
    const v = body[field];
    if (v === undefined || v === null) continue;
    if (type === 'array' && !Array.isArray(v)) return `Field "${field}" must be an array`;
    if (type === 'object' && (typeof v !== 'object' || Array.isArray(v))) return `Field "${field}" must be an object`;
    if (type === 'string' && typeof v !== 'string') return `Field "${field}" must be a string`;
    if (type === 'number' && (typeof v !== 'number' || Number.isNaN(v))) return `Field "${field}" must be a number`;
    if (type === 'boolean' && typeof v !== 'boolean') return `Field "${field}" must be a boolean`;
  }
  return null;
}

function badRequest(res: any, message: string) {
  return res.status(400).json({ success: false, error: message });
}

/** Honest "feature not configured" response — never fabricated content. */
function notConfigured(res: any, message: string) {
  return res.json({ success: false, status: 'not_configured', simulated: false, error: message });
}

// Per-user daily quota on Gemini-backed routes (M7). Config-driven cap;
// counters persist across restarts via serverStore (C8).
const AI_DAILY_QUOTA_PER_USER = (() => {
  const n = parseInt(process.env.AI_DAILY_QUOTA_PER_USER || '', 10);
  return Number.isFinite(n) && n > 0 ? n : 200;
})();

function aiQuotaMiddleware(req: any, res: any, next: any) {
  const uid = req.user?.uid || req.user?.sub || `ip:${req.ip || 'unknown'}`;
  const today = new Date().toISOString().slice(0, 10);
  let entry = store.aiQuota[uid];
  if (!entry || entry.date !== today) {
    entry = { date: today, count: 0 };
    store.aiQuota[uid] = entry;
  }
  if (entry.count >= AI_DAILY_QUOTA_PER_USER) {
    return res.status(429).json({
      success: false,
      error: 'AI_QUOTA_EXCEEDED',
      limit: AI_DAILY_QUOTA_PER_USER,
      used: entry.count
    });
  }
  entry.count += 1;
  saveStore(store);
  return next();
}

// Initialize Google GenAI
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// DEMO-ONLY sample leads (Phase 0 / C1). These invented records are never
// returned in production: /api/leads/scrape serves them only when
// DEMO_MODE=true, with simulated:true on the response and every record.
const DEMO_RCM_LEADS = [
  {
    id: 'lead-1',
    practiceName: 'Austin Heart & Vascular Institute',
    doctorName: 'Dr. Marcus Vance, MD, FACC',
    title: 'Managing Partner & Interventional Cardiologist',
    specialty: 'Cardiology & Electrophysiology',
    practiceSize: '6 Physicians, 2 PAs',
    phone: '(512) 892-4100',
    email: 'mvance@austinheartandvascular.com',
    address: '4201 Medical Pkwy, Suite 320, Austin, TX 78756',
    state: 'TX',
    ehrSystem: 'eClinicalWorks',
    monthlyClaimVolume: '$420,000 / mo (approx. 1,800 claims)',
    painPoints: ['High denial rates on cardiac catheterization coding (16%)', 'Days in AR lingering at 54 days', 'Front-desk prior auth bottlenecks'],
    linkedInProfile: 'https://linkedin.com/in/dr-marcus-vance-austin-heart',
    adminContact: 'Brenda Miller - Practice Administrator',
    source: 'Web & NPI Registry Scraper',
    status: 'Ready for Call'
  },
  {
    id: 'lead-2',
    practiceName: 'Northwest Orthopedic & Spine Surgery',
    doctorName: 'Dr. Elena Rostova, MD',
    title: 'Chief Medical Officer & Orthopedic Surgeon',
    specialty: 'Orthopedic Surgery & Sports Medicine',
    practiceSize: '9 Surgeons, 4 PT Facilities',
    phone: '(206) 781-9920',
    email: 'erostova@northwestorthospine.org',
    address: '1100 9th Ave, Seattle, WA 98101',
    state: 'WA',
    ehrSystem: 'AthenaHealth',
    monthlyClaimVolume: '$890,000 / mo (approx. 3,400 claims)',
    painPoints: ['Workers comp & out-of-network fee schedule underpayments', 'Denials for surgical modifier 59/25', 'Understaffed in-house billing department'],
    linkedInProfile: 'https://linkedin.com/in/elena-rostova-ortho-wa',
    adminContact: 'David Sterling - Director of Revenue Cycle',
    source: 'LinkedIn Health Discovery',
    status: 'Ready for Call'
  },
  {
    id: 'lead-3',
    practiceName: 'Beacon Hill Pediatric & Adolescent Medicine',
    doctorName: 'Dr. Jonathan Blake, MD, FAAP',
    title: 'Founding Pediatrician',
    specialty: 'Pediatrics & Adolescent Care',
    practiceSize: '4 Pediatricians, 3 Nurse Practitioners',
    phone: '(617) 523-8840',
    email: 'jblake@beaconhillpediatrics.com',
    address: '15 Cambridge St, Boston, MA 02114',
    state: 'MA',
    ehrSystem: 'Epic (Community Connect)',
    monthlyClaimVolume: '$290,000 / mo (approx. 2,100 claims)',
    painPoints: ['Vaccine administration reimbursement disputes with Medicaid MCOs', 'Delayed credentialing for new mid-level providers', 'AR over 90 days exceeded 22%'],
    linkedInProfile: 'https://linkedin.com/in/jonathan-blake-boston-peds',
    adminContact: 'Sarah Jennings - Clinic Operations Manager',
    source: 'Google Places & State Medical Board',
    status: 'Ready for Call'
  },
  {
    id: 'lead-4',
    practiceName: 'Apex Precision Diagnostic & Pathology Labs',
    doctorName: 'Dr. Anita Desai, MD, FCAP',
    title: 'Laboratory Medical Director',
    specialty: 'Independent Clinical & Pathology Laboratory',
    practiceSize: 'Commercial Testing Lab (3 Collection Centers)',
    phone: '(404) 636-7200',
    email: 'anita.desai@apexpathlabs.com',
    address: '2200 Century Pkwy NE, Atlanta, GA 30345',
    state: 'GA',
    ehrSystem: 'LigoLab LIS / Kareo Billing',
    monthlyClaimVolume: '$640,000 / mo (approx. 6,200 claims)',
    painPoints: ['Molecular pathology CPT code unbundling rejections', 'Massive Medicare LCD requirement denials', 'Need specialized laboratory billing team'],
    linkedInProfile: 'https://linkedin.com/in/anita-desai-pathology',
    adminContact: 'Robert Hughes - Chief Financial Officer',
    source: 'CLIA Lab Directory Scraper',
    status: 'Ready for Call'
  },
  {
    id: 'lead-5',
    practiceName: 'Sunshine Coast Dermatology & Mohs Center',
    doctorName: 'Dr. Gregory Kim, MD, FAAD',
    title: 'Lead Dermatologist & Mohs Surgeon',
    specialty: 'Dermatology & Mohs Micrographic Surgery',
    practiceSize: '3 Dermatologists, 1 Dermatopathologist',
    phone: '(305) 538-4411',
    email: 'gkim@sunshinedermfl.com',
    address: '4300 Alton Rd, Suite 400, Miami Beach, FL 33140',
    state: 'FL',
    ehrSystem: 'Modernizing Medicine (EMA)',
    monthlyClaimVolume: '$510,000 / mo (approx. 2,600 claims)',
    painPoints: ['Biopsy pathology split-billing payment delays', 'Aging self-pay deductible collections', 'Denial overturn turnaround taking >60 days'],
    linkedInProfile: 'https://linkedin.com/in/gregory-kim-fl-derm',
    adminContact: 'Claudia Morales - Office Billing Lead',
    source: 'LinkedIn Executive Search',
    status: 'Ready for Call'
  },
  {
    id: 'lead-6',
    practiceName: 'Great Lakes Regional Community Hospital',
    doctorName: 'Dr. Thomas Sterling, MD',
    title: 'VP of Medical Affairs & Physician Network',
    specialty: 'Critical Access Hospital & Multi-Specialty Clinic',
    practiceSize: '45 Bed Hospital + 3 Outpatient Clinics',
    phone: '(312) 942-5000',
    email: 'tsterling@greatlakeshealth.org',
    address: '1653 W Congress Pkwy, Chicago, IL 60612',
    state: 'IL',
    ehrSystem: 'Cerner / Oracle Health',
    monthlyClaimVolume: '$2,400,000 / mo',
    painPoints: ['Complex DRG cross-coding denials', 'Aged hospital accounts receivable exceeding $1.8M', 'Staff turnover in central billing office (CBO)'],
    linkedInProfile: 'https://linkedin.com/in/thomas-sterling-healthcare-exec',
    adminContact: 'Danielle Brooks - VP Revenue Cycle Management',
    source: 'AHA Hospital Directory Scraper',
    status: 'Ready for Call'
  }
];

// Health check endpoint (Public)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'pulsar', timestamp: new Date().toISOString() });
});

// Shared NPPES -> lead mapping, used by both /api/leads/npi-search and
// /api/leads/scrape so discovery returns the same real, provenanced records.
// Phone is null when CMS reports none (no placeholders); EHR, claim volume
// and pain points are unknown, never measured, so they live under `estimates`.
function mapNpiEntryToLead(entry: any, index: number, fallbackState?: string) {
  const basic = entry.basic || {};
  const addresses = entry.addresses || [];
  const primaryAddr = addresses.find((a: any) => a.address_purpose === 'LOCATION') || addresses[0] || {};
  const taxonomy = entry.taxonomies?.[0] || {};

  const isOrg = entry.enumeration_type === 'NPI-2';
  const doctorName = isOrg
    ? `${basic.authorized_official_first_name || ''} ${basic.authorized_official_last_name || ''}`.trim()
    : `${basic.first_name || ''} ${basic.last_name || ''}${basic.credential ? ', ' + basic.credential : ''}`.trim();
  const practiceName = isOrg
    ? (basic.organization_name || basic.name)
    : `${basic.first_name || ''} ${basic.last_name || ''} Practice`;

  return {
    id: `npi-${entry.number || Date.now()}-${index}`,
    npiNumber: String(entry.number),
    practiceName: practiceName || 'Healthcare Provider Practice',
    doctorName: doctorName || 'Physician Administrator',
    title: isOrg ? 'Chief Medical Officer / Practice Administrator' : 'Managing Physician / Owner',
    specialty: taxonomy.desc || 'General Medical Practice',
    practiceSize: isOrg ? 'Multi-Provider Group' : 'Solo / Small Group Practice',
    phone: primaryAddr.telephone_number || null,
    email: '',
    address: `${primaryAddr.address_1 || ''}, ${primaryAddr.city || ''}, ${primaryAddr.state || ''} ${primaryAddr.postal_code || ''}`.trim(),
    state: primaryAddr.state || fallbackState || 'US',
    estimates: {
      estimated: true,
      note: 'Not reported by CMS NPI Registry; values are unknown, not measured.',
      ehrSystem: null,
      monthlyClaimVolume: null,
      painPoints: []
    },
    linkedInProfile: '',
    adminContact: isOrg ? `${basic.authorized_official_title || 'Billing Administrator'}` : 'Practice Billing Coordinator',
    source: 'CMS NPI Registry (Verified)',
    provenance: {
      source: 'CMS NPI Registry (NPPES)',
      retrievedAt: new Date().toISOString(),
      verifiedFields: ['npiNumber', 'practiceName', 'doctorName', 'specialty', 'phone', 'address']
    },
    status: 'Ready for Call',
    verified: true,
    lawfulBasis: 'Public Federal Healthcare Registry (NPPES)',
    lastVerifiedDate: new Date().toISOString()
  };
}

// NPI Registry Direct Search (Verified CMS Public Healthcare Data)
// Phases 1–3: plan-gated (npi_search) with the monthly leads limit (§3e).
app.post('/api/leads/npi-search', requireFeature('npi_search'), requireWithinLimit('leads'), ah(async (req, res) => {
  try {
    const fieldErr = validateFields(req.body, {
      city: 'string', state: 'string', postal_code: 'string', taxonomy_description: 'string'
    });
    if (fieldErr) return badRequest(res, fieldErr);
    const { city, state, postal_code, taxonomy_description, limit = 10 } = req.body;
    const params = new URLSearchParams({
      version: '2.1',
      limit: String(Math.min(25, Number(limit) || 10))
    });
    if (city) params.append('city', city);
    if (state) params.append('state', state);
    if (postal_code) params.append('postal_code', postal_code);
    if (taxonomy_description) params.append('taxonomy_description', taxonomy_description);

    const npiUrl = `https://npiregistry.cms.hhs.gov/api/?${params.toString()}`;
    const safety = isSafeOutboundUrl(npiUrl);
    if (!safety.safe) {
      return res.status(400).json({ success: false, error: safety.reason });
    }

    const npiController = new AbortController();
    const npiTimer = setTimeout(() => npiController.abort(), 8000);
    const npiResponse = await fetch(npiUrl, { signal: npiController.signal }).finally(() => clearTimeout(npiTimer));
    if (!npiResponse.ok) {
      throw new Error(`NPI Registry returned HTTP ${npiResponse.status}`);
    }
    const npiData = await npiResponse.json() as any;

    const leads = (npiData.results || []).map((entry: any, index: number) => mapNpiEntryToLead(entry, index, state));

    // Meter the leads this search produced against the caller's plan (§3e).
    if ((req as any).user?.uid && leads.length > 0) {
      recordUsage(getPlatformState(), (req as any).user.uid, 'leads', leads.length);
      persistPlatform();
    }

    res.json({
      success: true,
      result_count: npiData.result_count || leads.length,
      leads
    });
  } catch (err: any) {
    console.error('NPI Registry Search error:', err);
    res.status(500).json({ success: false, error: err?.message || 'Failed to query CMS NPI Registry' });
  }
}));

// 1. Scrape / Discover Leads Endpoint
// Phase 0 (C1): the previous implementation generated "hyper-realistic"
// (invented) leads with Gemini, or returned hardcoded invented practices as
// if they were registry data. That is a build failure — deleted. Lead
// discovery returns results only from real sources. This endpoint's live
// source is the CMS NPI Registry (same mapping as /api/leads/npi-search):
// - DEMO_MODE=true  -> demo records, every one flagged simulated: true
// - otherwise       -> live NPPES discovery (status: 'live_source'); an
//   NPPES failure is an honest 500, never invented leads.
app.post('/api/leads/scrape', requireFeature('lead_discovery'), requireWithinLimit('leads'), ah(async (req, res) => {
  const fieldErr = validateFields(req.body, {
    specialty: 'string', state: 'string', query: 'string', count: 'number'
  });
  if (fieldErr) return badRequest(res, fieldErr);
  const { specialty, state, count } = req.body;

  if (process.env.DEMO_MODE === 'true') {
    const filtered = DEMO_RCM_LEADS.filter(l => {
      if (specialty && specialty !== 'All') {
        return l.specialty.toLowerCase().includes(specialty.toLowerCase());
      }
      if (state && state !== 'All') {
        return l.state.toLowerCase() === state.toLowerCase();
      }
      return true;
    });
    const candidates = filtered.length > 0 ? filtered : DEMO_RCM_LEADS;
    const demoLeads = candidates.map((l, idx) => ({
      ...l,
      id: `demo-${Date.now()}-${idx}`,
      simulated: true,
      source: 'demo'
    }));
    if ((req as any).user?.uid && demoLeads.length > 0) {
      recordUsage(getPlatformState(), (req as any).user.uid, 'leads', demoLeads.length);
      persistPlatform();
    }
    return res.json({
      success: true,
      simulated: true,
      demoMode: true,
      source: 'demo',
      leads: demoLeads
    });
  }

  // Live source: the public CMS NPI Registry, the same mapping as
  // /api/leads/npi-search. The scraper no longer reports "no live source":
  // it performs a real registry discovery, metered like any other search.
  // (It still returns nothing invented: an NPPES failure is a 500, and the
  // client surfaces it as an honest error.)
  try {
    const params = new URLSearchParams({
      version: '2.1',
      limit: String(Math.min(25, Number(count) || 10))
    });
    if (state && state !== 'All') params.append('state', state);
    if (specialty && specialty !== 'All') params.append('taxonomy_description', specialty);

    const npiUrl = `https://npiregistry.cms.hhs.gov/api/?${params.toString()}`;
    const safety = isSafeOutboundUrl(npiUrl);
    if (!safety.safe) {
      return res.status(400).json({ success: false, error: safety.reason });
    }

    const npiController = new AbortController();
    const npiTimer = setTimeout(() => npiController.abort(), 8000);
    const npiResponse = await fetch(npiUrl, { signal: npiController.signal }).finally(() => clearTimeout(npiTimer));
    if (!npiResponse.ok) {
      throw new Error(`NPI Registry returned HTTP ${npiResponse.status}`);
    }
    const npiData = await npiResponse.json() as any;
    const leads = (npiData.results || []).map((entry: any, index: number) => mapNpiEntryToLead(entry, index, state));

    if ((req as any).user?.uid && leads.length > 0) {
      recordUsage(getPlatformState(), (req as any).user.uid, 'leads', leads.length);
      persistPlatform();
    }

    return res.json({
      success: true,
      simulated: false,
      status: 'live_source',
      source: 'CMS NPI Registry (NPPES)',
      result_count: npiData.result_count || leads.length,
      leads
    });
  } catch (err: any) {
    console.error('Lead scrape (NPI) error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to query CMS NPI Registry' });
  }
}));

// 1b. Google Maps Grounded Healthcare Provider Discovery (using gemini-3.5-flash with googleMaps)
app.post('/api/leads/maps-search', requireFeature('lead_discovery'), aiQuotaMiddleware, ah(async (req, res) => {
  try {
    const fieldErr = validateFields(req.body, { query: 'string', location: 'string' });
    if (fieldErr) return badRequest(res, fieldErr);
    const { query, location } = req.body;
    const searchQuery = query || `Medical clinics and specialist physicians in ${location || 'Austin, TX'}`;

    if (process.env.GEMINI_API_KEY) {
      const prompt = `Identify real medical practices, physician clinics, and specialty healthcare facilities for: "${searchQuery}".
Provide detailed information including practice name, estimated specialty, address, and key characteristics useful for medical billing outreach.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          tools: [{ googleMaps: {} }]
        }
      });

      const text = response.text || '';
      const groundingMetadata = response.candidates?.[0]?.groundingMetadata || {};
      const groundingChunks = groundingMetadata.groundingChunks || [];

      return res.json({
        success: true,
        text,
        groundingMetadata,
        groundingChunks,
        source: 'google-maps-grounding'
      });
    }
  } catch (err: any) {
    console.warn('Maps Grounding error:', err?.message);
    return res.status(500).json({ success: false, error: err?.message || 'Maps Grounding failed' });
  }

  // Phase 0 (C1): no Gemini key -> honest not_configured, never canned text
  // presented as verified practices.
  return notConfigured(res, 'Maps discovery is not configured (GEMINI_API_KEY missing). No results were generated.');
}));

// 1c. Google Search Grounding for Live 2026 Payer Policies & Medicare LCDs (using gemini-3.5-flash with googleSearch)
app.post('/api/rcm/search-grounding', requireFeature('ai_assistant'), aiQuotaMiddleware, ah(async (req, res) => {
  try {
    const fieldErr = validateFields(req.body, { query: 'string' });
    if (fieldErr) return badRequest(res, fieldErr);
    const { query } = req.body;
    const searchQuery = query || '2026 Medicare physician fee schedule conversion factor and commercial claim denial rates';

    if (process.env.GEMINI_API_KEY) {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: searchQuery,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      const text = response.text || '';
      const groundingMetadata = response.candidates?.[0]?.groundingMetadata || {};
      const webSearchQueries = groundingMetadata.webSearchQueries || [];
      const groundingChunks = groundingMetadata.groundingChunks || [];

      return res.json({
        success: true,
        text,
        groundingMetadata,
        webSearchQueries,
        groundingChunks,
        source: 'google-search-grounding'
      });
    }
  } catch (err: any) {
    console.warn('Search Grounding error:', err?.message);
    return res.status(500).json({ success: false, error: err?.message || 'Search Grounding failed' });
  }

  return notConfigured(res, 'Search grounding is not configured (GEMINI_API_KEY missing). No results were generated.');
}));

// 1d. Audio Transcription (using gemini-3.5-transcribe)
app.post('/api/audio/transcribe', requireFeature('ai_assistant'), aiQuotaMiddleware, ah(async (req, res) => {
  try {
    const fieldErr = validateFields(req.body, { base64Audio: 'string', mimeType: 'string' });
    if (fieldErr) return badRequest(res, fieldErr);
    const { base64Audio, mimeType = 'audio/webm' } = req.body;

    if (!base64Audio) {
      return res.status(400).json({ success: false, error: 'base64Audio is required' });
    }

    if (process.env.GEMINI_API_KEY) {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: [
          {
            inlineData: {
              mimeType,
              data: base64Audio.replace(/^data:[^;]+;base64,/, '')
            }
          },
          'Transcribe this healthcare audio recording verbatim with high clinical and medical billing precision. Include speaker labels if multiple voices are audible.'
        ]
      });

      return res.json({
        success: true,
        transcription: response.text || '',
        model: 'gemini-3.5-transcribe'
      });
    }
  } catch (err: any) {
    console.warn('Audio transcription error:', err?.message);
    return res.status(500).json({ success: false, error: err?.message || 'Transcription failed' });
  }

  // Phase 0 (C1): no Gemini key -> not_configured. Never an invented transcript.
  return notConfigured(res, 'Audio transcription is not configured (GEMINI_API_KEY missing). No transcript was generated.');
}));

// 1e. Gemini Multi-Turn Chatbot with Role-Based System Instructions
app.post('/api/chat', requireFeature('ai_assistant'), aiQuotaMiddleware, ah(async (req, res) => {
  try {
    const fieldErr = validateFields(req.body, {
      messages: 'array', role: 'string', model: 'string'
    });
    if (fieldErr) return badRequest(res, fieldErr);
    const { messages, role = 'strategist', model = 'gemini-3.5-flash' } = req.body;

    // Define role-specific system instructions
    const roleInstructions: Record<string, string> = {
      strategist: `You are the Lead Medical Billing Growth Strategist for Pulsar.
Your role: Provide deep revenue cycle insights, analyze physician practice collections, recommend high-yield CPT coding strategies, advise on fee schedules, and guide sales reps on closing medical practices for billing audits. Keep responses structured, authoritative, and actionable.`,
      denials_expert: `You are the Senior Clinical Denial Overturn Specialist for Pulsar.
Your role: You specialize in overturning commercial and Medicare denials for CPT modifiers 25, 59, 79, prior authorization disputes, timely filing appeals, and LCD/NCD medical necessity defenses. Provide exact appeal language and citations.`,
      objection_coach: `You are the Rapid Cold Calling & Objection Handling Coach for medical sales reps.
Your role: When the sales rep encounters objections like "We do billing in-house", "Your fee is too high", "Doctors don't have time", or "Send an email", give 2-3 instant, witty, respectful, high-converting talk tracks to overcome the objection and bridge to a meeting.`
    };

    const systemInstruction = roleInstructions[role] || roleInstructions.strategist;

    // Model selection based on task complexity as required by user prompt
    // Complex tasks: gemini-3.1-pro-preview
    // Fast tasks: gemini-3.1-flash-lite
    // General tasks: gemini-3.5-flash
    const targetModel = model || 'gemini-3.5-flash';

    if (process.env.GEMINI_API_KEY) {
      // Format messages into contents array
      const contents = (messages || []).map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text || m.content || '' }]
      }));

      const response = await ai.models.generateContent({
        model: targetModel,
        contents,
        config: {
          systemInstruction,
          temperature: 0.7
        }
      });

      return res.json({
        success: true,
        reply: response.text || '',
        model: targetModel,
        role
      });
    }
  } catch (err: any) {
    console.warn('Chatbot error:', err?.message);
    return res.status(500).json({ success: false, error: err?.message || 'Chatbot execution failed' });
  }

  // No Gemini key: static placeholder reply, honestly flagged (Rule 1).
  return res.json({
    success: true,
    simulated: true,
    status: 'not_configured',
    reply: "I am ready to assist with your medical billing optimization, denial overturns, or practice outreach strategy.",
    model: 'fallback-chatbot',
    role: req.body.role || 'strategist'
  });
}));

// 1f. Live Voice Conversation Session (using gemini-3.8-live)
app.post('/api/live/voice-turn', requireFeature('call_studio'), aiQuotaMiddleware, ah(async (req, res) => {
  try {
    const fieldErr = validateFields(req.body, {
      transcript: 'string', promptText: 'string', doctorName: 'string'
    });
    if (fieldErr) return badRequest(res, fieldErr);
    const { transcript, promptText, doctorName = 'Doctor' } = req.body;

    if (process.env.GEMINI_API_KEY) {
      const systemInstruction = `You are Sarah, Pulsar's top voice representative speaking in real time with ${doctorName}.
You are speaking via Live Voice Telephony. Keep your speech spoken, conversational, warm, concise, and focused on offering a free 50-claim billing audit.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-live',
        contents: promptText || 'Hello, Sarah?',
        config: {
          systemInstruction,
          temperature: 0.6
        }
      });

      return res.json({
        success: true,
        spokenResponse: response.text || '',
        model: 'gemini-3.8-live'
      });
    }
  } catch (err: any) {
    console.warn('Live API voice turn error:', err?.message);
  }

  // CallStudio is a labeled simulation; the server flags it too (Rule 1).
  return res.json({
    success: true,
    simulated: true,
    spokenResponse: "Hello! This is Sarah with Pulsar. We'd love to share our 50-claim complimentary billing audit with your team.",
    model: 'gemini-3.8-live-fallback'
  });
}));

// 2. LinkedIn Decision-Maker Prospector Endpoint
// Phase 0 (C1): the previous implementation invented "realistic" LinkedIn
// profiles with Gemini, or returned hardcoded invented prospects. Deleted.
// Until Phase 4's compliant, founder-assisted flow exists, this endpoint
// returns an honest empty result — never invented people.
app.post('/api/leads/linkedin-search', requireFeature('lead_discovery'), ah(async (req, res) => {
  const fieldErr = validateFields(req.body, {
    targetRole: 'string', industry: 'string', state: 'string'
  });
  if (fieldErr) return badRequest(res, fieldErr);

  return res.json({
    success: true,
    simulated: false,
    status: 'not_configured',
    source: 'none',
    result_count: 0,
    prospects: [],
    message: 'LinkedIn prospect search is not connected to a compliant data source. No prospects were generated.'
  });
}));

// 2b. LinkedIn Gemini Smart Filtering Endpoint (Evaluates Decision-Maker Authority & Fit)
app.post('/api/linkedin/smart-filter', requireFeature('linkedin_workflows'), aiQuotaMiddleware, ah(async (req, res) => {
  try {
    const fieldErr = validateFields(req.body, { prospect: 'object', criteria: 'object' });
    if (fieldErr) return badRequest(res, fieldErr);
    const { prospect, criteria } = req.body;

    if (process.env.GEMINI_API_KEY) {
      const prompt = `You are a healthcare revenue cycle management (RCM) sales intelligence analyst.
Analyze the following LinkedIn prospect to verify if this individual is an authentic Medical Decision-Maker with vendor contracting/purchasing authority or strong influence over practice billing, clearinghouse software, and RCM services.

Target Specialty Criteria: ${criteria?.nicheSpecialty || 'Specialty Medicine'}
Target Role Criteria: ${criteria?.targetRole || 'Practice Administrator / Executive'}
Target Location: ${criteria?.targetLocation || 'United States'}
Target Practice Size: ${criteria?.practiceSize || 'Medical Practice'}

Candidate Prospect:
- Name: ${prospect?.fullName}
- Headline: ${prospect?.headline}
- Organization / Practice: ${prospect?.practice}
- Stated Specialty: ${prospect?.specialty || 'General Medicine'}
- Location: ${prospect?.location}
- Background & Experience: ${prospect?.experience || 'Healthcare professional'}

Evaluate the prospect and respond in strict JSON format:
{
  "isDecisionMaker": boolean (true if Practice Administrator, CMO, Managing Partner, Owner, CFO, VP RCM, Clinical Operations Director; false if bedside nurse, student, medical assistant, junior tech, non-buying staff),
  "confidence": number (integer 0 to 100),
  "authorityLevel": "High (Direct Signer)" | "Moderate (Key Influencer)" | "Low (Non-Buyer)",
  "reasoning": string (concise 1-2 sentence assessment of their buying authority and clinical specialty fit),
  "recommendedAngle": string (concise recommended value proposition hook)
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.3
        }
      });

      const cleanJson = (response.text || '').trim();
      const parsed = JSON.parse(cleanJson);
      return res.json({
        success: true,
        result: {
          ...parsed,
          source: 'gemini',
          verifiedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ' PST'
        }
      });
    }
  } catch (err: any) {
    console.warn('Smart filter Gemini API fallback:', err?.message);
  }

  // Robust Heuristic Fallback
  const prospect = req.body?.prospect || {};
  const text = `${prospect.headline || ''} ${prospect.fullName || ''} ${prospect.experience || ''}`.toLowerCase();
  const isHigh = text.includes('administrator') || text.includes('director') || text.includes('partner') || text.includes('cmo') || text.includes('owner') || text.includes('md') || text.includes('do') || text.includes('cfo') || text.includes('vice president') || text.includes('vp');
  const isNonBuyer = text.includes('student') || text.includes('intern') || text.includes('nurse') || text.includes('assistant') || text.includes('technician') || text.includes('triage');

  const isDecisionMaker = isHigh && !isNonBuyer;

  // Phase 0 (C1): heuristic fallback is labeled as such and returns a band,
  // not fabricated precision (the old code claimed "94%" confidence).
  return res.json({
    success: true,
    result: {
      source: 'heuristic',
      isDecisionMaker,
      confidence: null,
      confidenceBand: isDecisionMaker ? 'high' : 'low',
      authorityLevel: isDecisionMaker 
        ? (text.includes('administrator') || text.includes('partner') || text.includes('owner') ? 'High (Direct Signer)' : 'Moderate (Key Influencer)') 
        : 'Low (Non-Buyer)',
      reasoning: isDecisionMaker
        ? 'Confirmed healthcare administrative and physician leadership authority over clinical revenue cycle contracts.'
        : 'Identified as clinical support staff or non-executive; lacks vendor procurement signing power.',
      recommendedAngle: 'Complimentary 50-claim diagnostic billing audit benchmark',
      verifiedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ' PST'
    }
  });
}));

// 2c. LinkedIn Send Connection Request Endpoint
// Phase 0 (C6): the previous implementation flipped a Math.random() coin and
// replied "Connection invitation safely dispatched" when nothing had been
// sent. Deleted. Unattended LinkedIn automation is excluded by the MVP
// blueprint (ban risk); until Phase 4's founder-assisted flow ships, this
// endpoint is honestly not connected.
app.post('/api/linkedin/send-connection', requireFeature('linkedin_workflows'), ah(async (req, res) => {
  const fieldErr = validateFields(req.body, {
    prospectId: 'string', prospectName: 'string', practiceName: 'string', note: 'string'
  });
  if (fieldErr) return badRequest(res, fieldErr);

  return res.status(501).json({
    success: false,
    simulated: true,
    status: 'not_connected',
    error: 'LinkedIn sending is not connected'
  });
}));

// 2d. LinkedIn CRM Webhook Sync Endpoint
// Phase 0 (C5): the target URL is user-supplied, so it goes through the SSRF
// guard (string checks + DNS resolution) before any connection is attempted,
// dispatch is awaited via safeFetch, and each record carries its REAL
// delivery outcome. The old hardcoded 'DELIVERED_200' is gone.
app.post('/api/linkedin/crm-webhook-sync', requireFeature('linkedin_workflows'), ah(async (req, res) => {
  const fieldErr = validateFields(req.body, {
    webhookUrl: 'string', provider: 'string', authToken: 'string', events: 'array'
  });
  if (fieldErr) return badRequest(res, fieldErr);
  const {
    webhookUrl,
    provider = 'salesforce',
    authToken,
    events
  } = req.body;

  if (webhookUrl) {
    const safety = await assertSafeOutboundUrl(webhookUrl);
    if (!safety.safe) {
      return res.status(400).json({ success: false, error: `Webhook URL rejected: ${safety.reason}` });
    }
  }

  const payloadEvents = Array.isArray(events) ? events : [req.body];
  const syncedRecords: any[] = [];

  for (const event of payloadEvents) {
    const record: any = {
      crmEventId: `crm-sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      targetCRM: provider,
      prospectName: event.prospectName || event.prospect?.fullName,
      practiceName: event.practiceName || event.prospect?.practice,
      headline: event.prospect?.headline,
      specialty: event.prospect?.specialty,
      location: event.prospect?.location,
      connectionStatus: event.status || 'sent',
      isAccepted: event.status === 'accepted' || !!event.simulatedAccepted,
      personalizedNote: event.personalizedNote || event.note,
      smartFilterScore: event.smartFilter?.confidence ?? null,
      decisionMakerAuthority: event.smartFilter?.authorityLevel ?? null,
      timestamp: new Date().toISOString(),
      deliveryStatus: 'not_dispatched',
      deliveryStatusCode: null as number | null,
      deliveredToWebhook: 'NOT_DISPATCHED'
    };

    if (webhookUrl) {
      try {
        const hookRes = await safeFetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Pulsar-LinkedIn-CRM-Sync/1.0',
            ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
          },
          body: JSON.stringify({
            source: 'Pulsar_LinkedIn_Outreach_Automator',
            event: 'linkedin.connection.sync',
            data: record
          })
        }, { timeoutMs: 6000 });
        record.deliveryStatusCode = hookRes.status;
        if (hookRes.ok) {
          record.deliveryStatus = 'delivered';
          record.deliveredToWebhook = `DELIVERED_${hookRes.status}`;
        } else {
          record.deliveryStatus = 'failed';
          record.deliveryError = `Webhook responded with HTTP ${hookRes.status}`;
          record.deliveredToWebhook = `FAILED_${hookRes.status}`;
        }
      } catch (e: any) {
        record.deliveryStatus = 'failed';
        record.deliveryError = e?.message || 'Webhook dispatch failed';
        record.deliveredToWebhook = 'FAILED_NETWORK';
      }
    }

    syncedRecords.push(record);
  }

  const deliveredCount = syncedRecords.filter(r => r.deliveryStatus === 'delivered').length;
  const failedCount = syncedRecords.filter(r => r.deliveryStatus === 'failed').length;

  return res.json({
    success: true,
    message: webhookUrl
      ? `Synchronized ${syncedRecords.length} LinkedIn outreach record(s) to ${String(provider).toUpperCase()} CRM: ${deliveredCount} delivered, ${failedCount} failed.`
      : `Recorded ${syncedRecords.length} LinkedIn outreach record(s) locally for ${String(provider).toUpperCase()} CRM. No webhook URL was provided, so nothing was dispatched.`,
    syncedCount: syncedRecords.length,
    deliveredCount,
    failedCount,
    syncedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ' PST',
    records: syncedRecords
  });
}));

// 2e. Test CRM Webhook Connectivity Endpoint
// Phase 0 (C5): a handshake test that cannot fail is a defect. This returns
// the REAL status reached; fetch errors and non-2xx responses are failures.
app.post('/api/linkedin/crm-webhook-test', requireFeature('linkedin_workflows'), ah(async (req, res) => {
  const fieldErr = validateFields(req.body, {
    webhookUrl: 'string', provider: 'string', authToken: 'string'
  });
  if (fieldErr) return badRequest(res, fieldErr);
  const { webhookUrl, provider = 'salesforce', authToken } = req.body;

  if (!webhookUrl) {
    return res.status(400).json({ success: false, error: 'webhookUrl is required' });
  }

  const safety = await assertSafeOutboundUrl(webhookUrl);
  if (!safety.safe) {
    return res.status(400).json({ success: false, error: `Webhook URL rejected: ${safety.reason}` });
  }

  const testPayload = {
    testEvent: 'pulsar_webhook_handshake',
    provider,
    status: 'active',
    testedAt: new Date().toISOString()
  };

  try {
    const hookRes = await safeFetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
      },
      body: JSON.stringify(testPayload)
    }, { timeoutMs: 6000 });

    const ok = hookRes.ok;
    return res.json({
      success: ok,
      statusCode: hookRes.status,
      provider,
      message: ok
        ? `Webhook handshake confirmed for ${String(provider).toUpperCase()} (HTTP ${hookRes.status}).`
        : `Webhook endpoint responded with HTTP ${hookRes.status}; the handshake did not succeed.`,
      verifiedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ' PST',
      testPayload
    });
  } catch (e: any) {
    return res.json({
      success: false,
      statusCode: null,
      provider,
      error: e?.message || 'Webhook fetch failed',
      message: `Webhook handshake failed for ${String(provider).toUpperCase()}: ${e?.message || 'network error'}`,
      verifiedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ' PST',
      testPayload
    });
  }
}));

// 3. AI Cold Calling Engine (Conversational Script & Objection Handling)
app.post('/api/call/ai-turn', requireFeature('call_studio'), requireWithinLimit('calls'), aiQuotaMiddleware, ah(async (req, res) => {
  try {
    const fieldErr = validateFields(req.body, {
      lead: 'object', userSpeech: 'string', conversationHistory: 'array',
      managerPhone: 'string', callMode: 'string', agentConfig: 'object',
      targetPersona: 'object', nicheName: 'string'
    });
    if (fieldErr) return badRequest(res, fieldErr);
    // Nested shape guards: the audit crash was objectionHandlers arriving as
    // a string and being .find()/.map()'d in both branches below.
    const cfgCheck = req.body.agentConfig;
    if (cfgCheck) {
      if (cfgCheck.objectionHandlers !== undefined && !Array.isArray(cfgCheck.objectionHandlers)) {
        return badRequest(res, 'Field "agentConfig.objectionHandlers" must be an array');
      }
      if (cfgCheck.escalationTriggers !== undefined && !Array.isArray(cfgCheck.escalationTriggers)) {
        return badRequest(res, 'Field "agentConfig.escalationTriggers" must be an array');
      }
    }
    const { lead, userSpeech, conversationHistory, managerPhone, callMode, agentConfig, targetPersona, nicheName } = req.body;

    const agentName = agentConfig?.agentName || 'Sarah';
    const industry = nicheName || 'Healthcare RCM & Medical Billing';
    const valueProp = agentConfig?.valueProposition || '98%+ clean claims and 15-20% net revenue boost';
    const primaryOffer = agentConfig?.primaryOffer || 'Free zero-obligation audit on 50 recent claims';
    const tone = agentConfig?.tone || 'Consultative and professional';
    const objectionList = (Array.isArray(agentConfig?.objectionHandlers) ? agentConfig.objectionHandlers : [])
      .filter((o: any) => o && typeof o === 'object')
      .map((o: any) => `- When prospect objects "${String(o.objection ?? '')}": Rebuttal is "${String(o.rebuttal ?? '')}"`).join('\n');
    const escalationList = (Array.isArray(agentConfig?.escalationTriggers) ? agentConfig.escalationTriggers : []).join(', ') || 'Pricing, interested in proposal, agrees to speak with manager';

    if (process.env.GEMINI_API_KEY) {
      const prompt = `You are "${agentName}", an exceptionally articulate, warm, and top-tier ${industry} Business Development Representative calling a prospective decision-maker.
Tone & Style: ${tone}
Context:
- Target Organization: ${lead?.practiceName || 'Target Organization'}
- Decision Maker / Contact: ${lead?.doctorName || 'Decision Maker'}
- Sub-domain / Specialty: ${lead?.specialty || industry}
- Current Tech / System: ${lead?.ehrSystem || 'their current system'}
- Known Pain Points: ${JSON.stringify(lead?.painPoints || targetPersona?.corePainPoints || ['operational overhead', 'inefficient workflows'])}
- Value Proposition: ${valueProp}
- Approved Primary Offer: ${primaryOffer}
- Key Metric / Guarantee: ${agentConfig?.keyMetricOrGuarantee || 'Significant operational improvement'}
- Approved Objection Handlers:
${objectionList}
- Escalation & Warm Transfer Triggers:
${escalationList}

Goal:
1. Speak conversationally in brief, natural spoken cadence (1-3 sentences max). No robotic jargon, markdown or bullet points.
2. If the prospect objects, respond with empathy using the approved rebuttal guidelines.
3. IMPORTANT: When the person sounds interested, agrees to chat, asks specific questions about pricing, or says "tell me more" or "who is this?", offer to instantly link them directly to our Operations & Sales Director (${managerPhone || 'on line 1'}).
4. If they agree to speak with the manager or if transfer condition is met, flag "shouldWarmTransfer": true.

Conversation history so far:
${JSON.stringify(conversationHistory || [])}

Latest prospect response: "${userSpeech || 'Hello?'}"

Generate a natural, human-sounding response.
Return strict JSON:
{
  "speechText": "What ${agentName} should say next (conversational, professional, human)",
  "shouldWarmTransfer": true/false,
  "transferReason": "Reason why transferring to manager",
  "sentiment": "positive" | "neutral" | "skeptical" | "objection",
  "detectedPainPoint": "Brief note if any specific issue was mentioned"
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: { temperature: 0.6 }
      });

      const cleanJson = (response.text || '').replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      if ((req as any).user?.uid) {
        recordUsage(getPlatformState(), (req as any).user.uid, 'calls', 1);
        persistPlatform();
      }
      return res.json({ success: true, ...parsed });
    }
  } catch (err: any) {
    console.warn('Call AI turn fallback triggered:', err?.message);
  }

  // Fallback intelligent conversation engine with niche customization
  const { lead, userSpeech, agentConfig, nicheName } = req.body;
  const agentName = agentConfig?.agentName || 'Sarah';
  const speech = (userSpeech || '').toLowerCase();
  let speechText = `Hi ${lead?.doctorName || 'there'}, this is ${agentName} with ${nicheName || 'our advisory group'}. I know you're busy, so I'll be brief. We help organizations using ${lead?.ehrSystem || 'your tech stack'} with ${agentConfig?.valueProposition || 'recovering lost revenue and streamlining operations'}. Would you be open to a quick 60-second summary?`;
  let shouldWarmTransfer = false;
  let sentiment: 'positive' | 'neutral' | 'skeptical' | 'objection' = 'neutral';
  let transferReason = '';

  // Check matching objections (entries sanitized: non-object entries and
  // non-string objections can never throw here — Phase 0 / C2)
  const handlers = (Array.isArray(agentConfig?.objectionHandlers) ? agentConfig.objectionHandlers : [])
    .filter((o: any) => o && typeof o === 'object' && typeof o.objection === 'string');
  if (handlers.length) {
    const matched = handlers.find((o: any) =>
      speech.includes(o.objection.toLowerCase().slice(0, 15)) ||
      (speech.includes('in-house') && o.objection.toLowerCase().includes('in-house')) ||
      (speech.includes('already have') && o.objection.toLowerCase().includes('already')) ||
      (speech.includes('expensive') && o.objection.toLowerCase().includes('cost')) ||
      (speech.includes('send') && o.objection.toLowerCase().includes('email'))
    );
    if (matched) {
      speechText = `${matched.rebuttal} I actually have our Director on standby right now—could I bridge him into the line for just 60 seconds?`;
      sentiment = 'objection';
    }
  }

  if (speech.includes('yes') || speech.includes('sure') || speech.includes('transfer') || speech.includes('talk') || speech.includes('pricing') || speech.includes('cost') || speech.includes('how much') || speech.includes('tell me more')) {
    speechText = `Fantastic! Our offer is ${agentConfig?.primaryOffer || 'completely performance-backed'}. Let me link you directly to our Operations & Sales Director on the line right now. Bridging you over in one second!`;
    shouldWarmTransfer = true;
    sentiment = 'positive';
    transferReason = 'Prospect inquired about offer / agreed to bridge to manager';
  } else if (speech.includes('send') || speech.includes('email') || speech.includes('busy')) {
    speechText = `I completely understand. I'd be glad to email you our 1-page overview and breakdown. What is the best email to reach your team?`;
    sentiment = 'skeptical';
  }

  // No Gemini key: deterministic scripted reply for the (client-labeled)
  // CallStudio simulation — flagged simulated here too (Rule 1).
  if ((req as any).user?.uid) {
    recordUsage(getPlatformState(), (req as any).user.uid, 'calls', 1);
    persistPlatform();
  }
  return res.json({
    success: true,
    simulated: true,
    speechText,
    shouldWarmTransfer,
    transferReason,
    sentiment,
    detectedPainPoint: agentConfig?.keyMetricOrGuarantee || 'Operational efficiency'
  });
}));

// 4. Post-Call AI Transcription Analysis & Meeting Notes
// Phase 0 (C1): the previous fallback manufactured executive notes — always
// "Hot Lead", invented action items — from nothing, even for an empty
// transcript. Deleted. Notes are generated only from a transcript that was
// actually supplied, and only when Gemini is configured.
app.post('/api/call/generate-notes', requireFeature('call_studio'), aiQuotaMiddleware, ah(async (req, res) => {
  const fieldErr = validateFields(req.body, {
    transcript: 'string', lead: 'object', callDuration: 'string',
    agentConfig: 'object', nicheName: 'string'
  });
  if (fieldErr) return badRequest(res, fieldErr);
  const { transcript, lead, callDuration, agentConfig, nicheName } = req.body;
  const industry = nicheName || 'Healthcare RCM & Medical Billing';
  const agentName = agentConfig?.agentName || 'Sarah';

  if (!process.env.GEMINI_API_KEY) {
    return notConfigured(res, 'Meeting-notes generation is not configured (GEMINI_API_KEY missing). No notes were generated.');
  }
  if (!transcript || !transcript.trim()) {
    return badRequest(res, 'A non-empty transcript is required to generate meeting notes');
  }

  const prompt = `You are an expert ${industry} Executive Business Development Analyst.
Analyze the following cold call transcript between our AI Agent (${agentName}), the Prospect / Decision Maker, and our Sales & Operations Director (after warm transfer).
Organization: ${lead?.practiceName} (${lead?.specialty || industry})
Decision Maker: ${lead?.doctorName}
System/Tech: ${lead?.ehrSystem}
Call Duration: ${callDuration || '2 mins 45 secs'}

Transcript:
${JSON.stringify(transcript)}

Generate comprehensive, executive-ready Sales Meeting Notes and Action Items for ${industry}.
Return strict JSON only:
{
  "executiveSummary": "Concise 2-3 sentence overview of the conversation and outcome.",
  "qualificationStatus": "Hot Lead" | "Warm Opportunity" | "Follow-up Required" | "Not Qualified",
  "statedBillingPainPoints": ["Pain point 1", "Pain point 2"],
  "currentSoftwareAndStaffing": "Current tech stack / staffing mentioned",
  "commercialTermsDiscussed": "Pricing, trial, audit or engagement model discussed",
  "decisionMakersIdentified": "Names and titles",
  "actionItems": [
    {
      "id": "act-1",
      "task": "Specific actionable to-do for the sales director",
      "due": "e.g. Tomorrow 10:00 AM PST",
      "priority": "Urgent" | "High" | "Medium",
      "category": "Audit Proposal" | "Email Followup" | "EHR Demo" | "Contract"
    }
  ],
  "recommendedFollowUpStrategy": "Specific commercial guidance on how to close this deal."
}`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: prompt,
    config: { temperature: 0.5 }
  });

  const cleanJson = (response.text || '').replace(/```json/g, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleanJson);
  return res.json({ success: true, notes: parsed });
}));

// 5. Daily 4:00 PM PST Progress Executive Briefing Generator
// Phase 0 (C1): the invented fallback briefing (46 calls, named practices,
// $168,000 pipeline) and the invented default stats seeded into the Gemini
// prompt (42/18/6/35/3/$145,000) are deleted. A briefing may only contain
// numbers supplied by the caller from real daily_stats/scheduler inputs;
// missing stats are zeros and the briefing says data is insufficient.
app.post('/api/briefing/generate', requireFeature('daily_briefing'), aiQuotaMiddleware, ah(async (req, res) => {
  const fieldErr = validateFields(req.body, {
    date: 'string', stats: 'object', recentActivities: 'array',
    warmTransfers: 'array', managerName: 'string'
  });
  if (fieldErr) return badRequest(res, fieldErr);
  const { date, stats, recentActivities, warmTransfers, managerName = 'Sales Manager' } = req.body;

  const realStats = {
    callsPlaced: Number(stats?.callsPlaced) || 0,
    humanConnects: Number(stats?.humanConnects) || 0,
    warmTransfersBridged: Number(stats?.warmTransfersBridged) || 0,
    leadsScraped: Number(stats?.leadsScraped) || 0,
    auditsBooked: Number(stats?.auditsBooked) || 0,
    pipelineAdded: typeof stats?.pipelineAdded === 'string' ? stats.pipelineAdded : '$0 / mo'
  };
  const hasAnyActivity = realStats.callsPlaced > 0 || realStats.humanConnects > 0 ||
    realStats.warmTransfersBridged > 0 || realStats.leadsScraped > 0 || realStats.auditsBooked > 0;

  if (process.env.GEMINI_API_KEY) {
    const prompt = `You are the Autonomous AI Growth & Telephony Dispatch Bot for Pulsar, a leading US Medical Billing company.
Your duty is to generate the official "4:00 PM PST Daily Progress Executive Briefing" for the Business Development, Sales & Marketing Manager (${managerName}).

Data for today (use ONLY these numbers — do not invent, estimate, or embellish any metric):
- Date: ${date || 'Today'}
- Cold Calls Placed: ${realStats.callsPlaced}
- Live Human Connects: ${realStats.humanConnects}
- Instant Warm Transfers Bridged to Manager Phone: ${realStats.warmTransfersBridged}
- Practices Scraped / Enriched: ${realStats.leadsScraped}
- Free Billing Audits Booked: ${realStats.auditsBooked}
- Estimated Potential Monthly Pipeline Added: ${realStats.pipelineAdded}
- Key Transferred Calls: ${JSON.stringify(warmTransfers || [])}
- Recent Activities: ${JSON.stringify(recentActivities || [])}
${hasAnyActivity ? '' : '- NOTE: all figures are zero. State plainly that no activity was recorded today; do not fabricate highlights.'}

Create an authoritative Executive Briefing in Markdown with clean sections:
1. Executive Performance Snapshot (with bold metrics)
2. Warm Transfer Highlights (what occurred when connected to Manager's phone)
3. Provider Insights & Common EHR Objections Overcome
4. Immediate Action Items & Reminders for Manager this evening & tomorrow morning
5. Tomorrow's Autonomous Scraper & Dialer Campaign Targets

Keep it crisp, professional, and tailored strictly to US medical billing economics (clean claims, AR reduction, denials, credentialing).`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: { temperature: 0.6 }
    });

    return res.json({
      success: true,
      briefingMarkdown: response.text,
      generatedAtPST: '4:00 PM PST',
      stats: realStats
    });
  }

  // No Gemini key: a deterministic briefing built ONLY from the supplied
  // stats (zeros when absent). Nothing here is invented.
  const insufficient = hasAnyActivity ? '' : `\n**Insufficient data:** no activity was recorded for this period, so there is nothing to summarize.\n`;
  const markdown = `## 4:00 PM PST Daily Executive Briefing
**To:** ${managerName}
**Date:** ${date || new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
**Generated:** deterministic summary (GEMINI_API_KEY not configured — figures below are exactly those supplied by the caller)
${insufficient}
### Performance Snapshot
* **Cold Calls Placed:** ${realStats.callsPlaced}
* **Live Human Connects:** ${realStats.humanConnects}
* **Warm Transfers Bridged:** ${realStats.warmTransfersBridged}
* **Leads Scraped / Enriched:** ${realStats.leadsScraped}
* **Billing Audits Booked:** ${realStats.auditsBooked}
* **Estimated Pipeline Added:** ${realStats.pipelineAdded}
`;
  return res.json({
    success: true,
    source: 'deterministic',
    briefingMarkdown: markdown,
    generatedAtPST: '4:00 PM PST',
    stats: realStats
  });
}));

// -------------------------------------------------------------
// 6. Automated Background Scheduler: 4:00 PM PST Daily Email Summary
// -------------------------------------------------------------
interface SchedulerConfig {
  enabled: boolean;
  scheduledTimePST: string; // e.g. "16:00"
  timezone: string; // "America/Los_Angeles"
  recipientEmail: string;
  includeCallPerformance: boolean;
  includeAuditPipeline: boolean;
  lastTriggeredDate: string; // YYYY-MM-DD
  lastTriggeredTimestamp: string | null;
  lastStatus: 'IDLE' | 'SCHEDULED' | 'TRIGGERED' | 'DISPATCHED' | 'NOT_CONFIGURED' | 'FAILED';
  latestReportStats?: any;
  history: Array<{
    id: string;
    timestamp: string;
    pstTime: string;
    recipient: string;
    subject: string;
    success: boolean;
    status: 'sent' | 'not_configured' | 'failed';
    messageId?: string;
    error?: string;
    statsSnapshot: any;
  }>;
}

// Phase 0 (C7/C8): the default recipient comes from the BRIEFING_RECIPIENT_EMAIL
// env var — never a hardcoded personal address — and the whole scheduler state
// is persisted via serverStore so config, stats, and history survive restarts.
const DEFAULT_SCHEDULER_STATE: SchedulerConfig = {
  enabled: true,
  scheduledTimePST: '16:00',
  timezone: 'America/Los_Angeles',
  recipientEmail: process.env.BRIEFING_RECIPIENT_EMAIL || '',
  includeCallPerformance: true,
  includeAuditPipeline: true,
  lastTriggeredDate: '',
  lastTriggeredTimestamp: null,
  lastStatus: 'SCHEDULED',
  history: []
};

const schedulerState: SchedulerConfig = (() => {
  const persisted: any = (store as any).scheduler;
  if (persisted && typeof persisted === 'object') {
    return {
      ...DEFAULT_SCHEDULER_STATE,
      ...persisted,
      history: Array.isArray(persisted.history) ? persisted.history : []
    };
  }
  return { ...DEFAULT_SCHEDULER_STATE };
})();

function persistSchedulerState(): void {
  (store as any).scheduler = schedulerState;
  saveStore(store);
}

if (!schedulerState.recipientEmail) {
  console.warn('[SCHEDULER] No briefing recipient configured (BRIEFING_RECIPIENT_EMAIL unset and no persisted config). Daily dispatch will report not_configured until a recipient is set.');
}

// Dispatch helper function using real Resend mailer
async function dispatchDailySummaryEmail(statsPayload?: any, customRecipient?: string, forceManual: boolean = false) {
  const now = new Date();
  const pstFormatted = now.toLocaleString("en-US", { 
    timeZone: "America/Los_Angeles", 
    dateStyle: "full", 
    timeStyle: "short" 
  });
  const recipient = customRecipient || schedulerState.recipientEmail;
  if (!recipient) {
    const error = 'No briefing recipient configured. Set BRIEFING_RECIPIENT_EMAIL or update the scheduler config; no email was sent.';
    const historyItem = {
      id: `sched-hist-${Date.now()}`,
      timestamp: now.toISOString(),
      pstTime: pstFormatted,
      recipient: '',
      subject: '',
      success: false,
      status: 'not_configured' as const,
      error,
      statsSnapshot: statsPayload || schedulerState.latestReportStats || null
    };
    schedulerState.history.unshift(historyItem);
    if (schedulerState.history.length > 25) schedulerState.history = schedulerState.history.slice(0, 25);
    schedulerState.lastStatus = 'NOT_CONFIGURED';
    persistSchedulerState();
    return { success: false, status: 'not_configured', error, historyItem, dispatchedAt: pstFormatted, recipient: '', subject: '' };
  }

  const stats = statsPayload || schedulerState.latestReportStats || {
    callsPlaced: 0,
    humanConnects: 0,
    warmTransfersBridged: 0,
    auditsBooked: 0,
    leadsScraped: 0,
    pipelineAdded: '$0 / mo'
  };

  const subject = `[Pulsar Executive Briefing] Official 4:00 PM PST Daily Stats & Call Performance Report - ${now.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', year: 'numeric' })}`;
  const htmlContent = generateDailyBriefingHtml(stats, recipient, pstFormatted);

  console.log(`[PULSAR SCHEDULER] 📧 Dispatching 4:00 PM PST Daily Summary Email to ${recipient} (manual=${forceManual})`);
  
  // Real Resend mail dispatch
  const mailResult = await sendEmailViaResend({
    to: recipient,
    subject,
    html: htmlContent
  });

  const historyItem = {
    id: `sched-hist-${Date.now()}`,
    timestamp: now.toISOString(),
    pstTime: pstFormatted,
    recipient,
    subject,
    success: mailResult.status === 'sent',
    status: mailResult.status,
    messageId: mailResult.messageId,
    error: mailResult.error,
    statsSnapshot: stats
  };

  schedulerState.lastTriggeredTimestamp = now.toISOString();
  schedulerState.lastStatus = mailResult.status === 'sent' 
    ? 'DISPATCHED' 
    : (mailResult.status === 'not_configured' ? 'NOT_CONFIGURED' : 'FAILED');
    
  schedulerState.history.unshift(historyItem);
  if (schedulerState.history.length > 25) {
    schedulerState.history = schedulerState.history.slice(0, 25);
  }
  persistSchedulerState();

  return {
    // Phase 0 (M5): success is true ONLY when the mailer actually sent.
    // 'not_configured' is not a success.
    success: mailResult.status === 'sent',
    status: mailResult.status,
    messageId: mailResult.messageId,
    error: mailResult.error,
    historyItem, 
    dispatchedAt: pstFormatted, 
    recipient, 
    subject 
  };
}

// Background scheduler interval (checks every 20 seconds for 4:00 PM PST)
setInterval(() => {
  if (!schedulerState.enabled) return;

  const now = new Date();
  const pstParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).formatToParts(now);

  const partMap: Record<string, string> = {};
  pstParts.forEach(p => { partMap[p.type] = p.value; });

  const currentHour = partMap.hour;
  const currentMinute = partMap.minute;
  const currentDateKey = `${partMap.year}-${partMap.month}-${partMap.day}`;

  const [targetHour, targetMinute] = (schedulerState.scheduledTimePST || '16:00').split(':');

  if (currentHour === targetHour && currentMinute === targetMinute) {
    if (schedulerState.lastTriggeredDate !== currentDateKey) {
      // Transactional check-and-set on the persisted date (C8): the in-memory
      // snapshot is updated and saved synchronously BEFORE dispatching, so a
      // restart (or this same tick re-firing) cannot send twice for one day.
      schedulerState.lastTriggeredDate = currentDateKey;
      persistSchedulerState();
      console.log(`[SCHEDULER TRIGGER] ⏰ Target ${schedulerState.scheduledTimePST} PST reached! Automatically sending daily stats & call performance email summary.`);
      dispatchDailySummaryEmail();
    }
  }
}, 20000);

// Record daily stats snapshot from client
app.post('/api/scheduler/report-stats', (req, res) => {
  const fieldErr = validateFields(req.body, { stats: 'object', workspaceId: 'string' });
  if (fieldErr) return badRequest(res, fieldErr);
  const { stats, workspaceId } = req.body;
  if (stats) {
    schedulerState.latestReportStats = {
      ...stats,
      workspaceId: workspaceId || 'ws_pulsar_master',
      reportedAt: new Date().toISOString()
    };
    persistSchedulerState();
  }
  res.json({ success: true, message: 'Daily stats recorded for 4 PM scheduler.' });
});

// Scheduler Status Endpoint
app.get('/api/scheduler/status', requireOwnerMiddleware, (_req, res) => {
  const now = new Date();
  const pstString = now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
  res.json({
    success: true,
    config: schedulerState,
    currentServerTimePST: pstString,
    nextScheduledRun: `Today / Next Day at ${schedulerState.scheduledTimePST} PST`
  });
});

// Scheduler Configuration Update Endpoint (Owner Only)
app.post('/api/scheduler/config', requireOwnerMiddleware, (req, res) => {
  const { 
    enabled, 
    scheduledTimePST, 
    recipientEmail, 
    includeCallPerformance, 
    includeAuditPipeline 
  } = req.body;

  const fieldErr = validateFields(req.body, {
    enabled: 'boolean', scheduledTimePST: 'string', recipientEmail: 'string',
    includeCallPerformance: 'boolean', includeAuditPipeline: 'boolean'
  });
  if (fieldErr) return badRequest(res, fieldErr);
  if (scheduledTimePST !== undefined && !/^\d{2}:\d{2}$/.test(scheduledTimePST)) {
    return badRequest(res, 'Field "scheduledTimePST" must be in HH:MM format');
  }

  if (typeof enabled === 'boolean') schedulerState.enabled = enabled;
  if (scheduledTimePST) schedulerState.scheduledTimePST = scheduledTimePST;
  if (recipientEmail) schedulerState.recipientEmail = recipientEmail;
  if (typeof includeCallPerformance === 'boolean') schedulerState.includeCallPerformance = includeCallPerformance;
  if (typeof includeAuditPipeline === 'boolean') schedulerState.includeAuditPipeline = includeAuditPipeline;

  schedulerState.lastStatus = schedulerState.enabled ? 'SCHEDULED' : 'IDLE';
  persistSchedulerState();

  console.log('[SCHEDULER CONFIG UPDATED]', {
    enabled: schedulerState.enabled,
    time: schedulerState.scheduledTimePST,
    recipient: schedulerState.recipientEmail
  });

  res.json({
    success: true,
    message: `Background scheduler updated. Set for ${schedulerState.scheduledTimePST} PST to ${schedulerState.recipientEmail}.`,
    config: schedulerState
  });
});

// Force / Test Trigger Scheduler Endpoint (Owner Only)
app.post('/api/scheduler/trigger-now', requireOwnerMiddleware, ah(async (req, res) => {
  try {
    const { stats, recipientEmail } = req.body;
    const result = await dispatchDailySummaryEmail(stats, recipientEmail, true);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to dispatch test summary' });
  }
}));

// -------------------------------------------------------------
// Phases 1–3 — Platform: identity, plans, master admins, audit, dashboard
// (see server/platform.ts for the model and the Firestore-adapter rationale)
// -------------------------------------------------------------

function actorOf(req: any): { uid: string; email: string; name?: string } {
  const u = req.user || {};
  return { uid: u.uid || u.sub, email: u.email || '', name: u.name };
}

/** The caller's workspace id, mirroring the client's convention
 *  (master workspace for master admins, ws_<uid> otherwise). */
function callerWorkspaceId(req: any): string {
  const state = getPlatformState();
  const u = req.user || {};
  if (u.email && u.email_verified === true && isMasterAdminEmail(state, u.email)) {
    return 'ws_pulsar_master';
  }
  return `ws_${u.uid || u.sub}`;
}

function isCallerMasterAdmin(req: any): boolean {
  const state = getPlatformState();
  const u = req.user || {};
  return !!u.email && u.email_verified === true && isMasterAdminEmail(state, u.email);
}

// On sign-in the client calls this (or GET /api/me/access) so the server
// ensures a platform users record exists (prompt §3a).
app.post('/api/me/register', ah(async (req, res) => {
  const state = getPlatformState();
  const { user, created } = ensureUserRecord(state, actorOf(req));
  persistPlatform();
  return res.json({ success: true, created, access: resolveAccess(state, req.user) , user });
}));

app.get('/api/me/access', ah(async (req, res) => {
  const state = getPlatformState();
  ensureUserRecord(state, actorOf(req));
  persistPlatform();
  return res.json({ success: true, access: resolveAccess(state, req.user) });
}));

// Access Gateway: the Request Access form submits its details here right
// after the Firebase account is created. Reachable while the account is
// pending_approval (that is the normal state at submit time); the details
// land on the platform record for the admin's Signup Approvals queue.
app.post('/api/me/access-request', ah(async (req, res) => {
  const state = getPlatformState();
  const { user } = ensureUserRecord(state, actorOf(req));
  const body = (req.body || {}) as {
    organization?: string;
    requestedPlanId?: string | null;
    termsAcceptedAt?: string;
  };
  const result = submitAccessRequest(state, user, {
    organization: typeof body.organization === 'string' ? body.organization : '',
    requestedPlanId: typeof body.requestedPlanId === 'string' ? body.requestedPlanId : null,
    termsAcceptedAt: typeof body.termsAcceptedAt === 'string' ? body.termsAcceptedAt : ''
  });
  if (!result.ok) {
    return res.status(400).json({ success: false, error: result.error });
  }
  persistPlatform();
  return res.json({ success: true, access: resolveAccess(state, req.user), user });
}));

// --- Admin: users -----------------------------------------------------------

app.get('/api/admin/users', requireMasterAdmin, ah(async (_req, res) => {
  const state = getPlatformState();
  const users = Object.values(state.users).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return res.json({ success: true, users });
}));

app.post('/api/admin/users', requireMasterAdmin, ah(async (req, res) => {
  const fieldErr = validateFields(req.body, {
    email: 'string', displayName: 'string', planId: 'string', role: 'string'
  });
  if (fieldErr) return badRequest(res, fieldErr);
  const { email, displayName, planId, role } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return badRequest(res, 'A valid email is required');
  }
  const normalizedEmail = email.trim().toLowerCase();
  const state = getPlatformState();
  if (findUser(state, undefined, normalizedEmail)) {
    return res.status(409).json({ success: false, error: 'A user with this email already exists' });
  }
  const plan = planId ? state.plans[planId] : defaultPlan(state);
  if (planId && !plan) return badRequest(res, `Unknown planId: ${planId}`);
  const assignedRole = role === 'admin' ? 'admin' : 'user';

  // Without the Firebase Admin SDK the server cannot mint the Auth account;
  // the record is created active with the chosen plan and adopted by email
  // on the invitee's first sign-in (see ensureUserRecord). The invite email
  // says exactly that, and its delivery status is reported honestly.
  const newUser: PlatformUser = {
    uid: `invite:${crypto.randomUUID()}`,
    email: normalizedEmail,
    displayName: (displayName || '').trim() || normalizedEmail,
    role: assignedRole as PlatformUser['role'],
    planId: plan ? plan.id : null,
    status: 'active',
    featureOverrides: {},
    createdAt: new Date().toISOString(),
    invitedBy: actorOf(req).email
  };
  state.users[newUser.uid] = newUser;
  // Re-creating a previously deleted email revives the identity under the
  // new record; the delete tombstone no longer applies.
  clearDeletedUser(state, undefined, normalizedEmail);
  writeAudit(state, actorOf(req).email, 'user.create', newUser.email,
    `Created user on plan ${newUser.planId || 'none'} with role ${newUser.role}`);
  persistPlatform();

  const invite = await sendEmailViaResend({
    to: normalizedEmail,
    subject: 'Your Pulsar account is ready',
    html: `<p>Hello ${newUser.displayName},</p>
<p>An administrator has set up Pulsar access for this email address${plan ? ` on the <strong>${plan.name}</strong> plan` : ''}.</p>
<p>To activate it, sign up or sign in to Pulsar using this email address — your plan and access are assigned automatically on first sign-in.</p>
<p>If you did not expect this invitation, you can ignore this email.</p>`
  });

  return res.status(201).json({
    success: true,
    user: newUser,
    invite: { status: invite.status, error: invite.error, messageId: invite.messageId }
  });
}));

app.patch('/api/admin/users/:uid', requireMasterAdmin, ah(async (req, res) => {
  const fieldErr = validateFields(req.body, {
    planId: 'string', role: 'string', status: 'string', displayName: 'string', title: 'string'
  });
  if (fieldErr) return badRequest(res, fieldErr);
  const state = getPlatformState();
  const target = state.users[req.params.uid];
  if (!target) return res.status(404).json({ success: false, error: 'User not found' });

  const actor = actorOf(req);
  const isSelf = target.uid === actor.uid || target.email.toLowerCase() === actor.email.toLowerCase();
  const { planId, role, status, displayName, title } = req.body;
  const changes: string[] = [];

  if (planId !== undefined) {
    if (planId !== null && !state.plans[planId]) return badRequest(res, `Unknown planId: ${planId}`);
    target.planId = planId;
    changes.push(`plan=${planId || 'none'}`);
  }
  if (role !== undefined) {
    if (!['admin', 'user'].includes(role)) {
      return badRequest(res, 'role must be "admin" or "user" (master_admin is managed via the master-admin list)');
    }
    if (target.role === 'master_admin') {
      // Demoting a master admin happens by removing their address in the
      // Master Control tab (guarded there), never by editing this record.
      return res.status(409).json({ success: false, error: 'Master admin role is managed via the master-admin list; it cannot be changed here.' });
    }
    target.role = role;
    changes.push(`role=${role}`);
  }
  if (status !== undefined) {
    if (!['active', 'disabled', 'pending_approval'].includes(status)) {
      return badRequest(res, 'status must be active, disabled, or pending_approval');
    }
    if (status === 'disabled' && isSelf) {
      return res.status(409).json({ success: false, error: 'You cannot disable your own account.' });
    }
    if (status === 'disabled' && isMasterAdminEmail(state, target.email)
      && effectiveMasterAdmins(state).length <= 1) {
      return res.status(409).json({ success: false, error: 'The last master admin cannot be disabled.' });
    }
    target.status = status;
    changes.push(`status=${status}`);
  }
  if (displayName !== undefined && displayName.trim()) {
    target.displayName = displayName.trim();
    changes.push('displayName updated');
  }
  if (title !== undefined) {
    const t = title.trim();
    if (t.length > 80) return badRequest(res, 'title must be at most 80 characters');
    if (t) { target.title = t; changes.push(`title=${t}`); }
    else { delete target.title; changes.push('title cleared'); }
  }
  if (changes.length === 0) return badRequest(res, 'No updatable fields provided');

  writeAudit(state, actor.email, 'user.update', target.email, changes.join(', '));
  persistPlatform();
  return res.json({ success: true, user: target });
}));

app.delete('/api/admin/users/:uid', requireMasterAdmin, ah(async (req, res) => {
  const state = getPlatformState();
  const target = state.users[req.params.uid];
  if (!target) return res.status(404).json({ success: false, error: 'User not found' });
  const actor = actorOf(req);
  if (target.uid === actor.uid || target.email.toLowerCase() === actor.email.toLowerCase()) {
    return res.status(409).json({ success: false, error: 'You cannot delete your own account.' });
  }
  if (isMasterAdminEmail(state, target.email) && effectiveMasterAdmins(state).length <= 1) {
    return res.status(409).json({ success: false, error: 'The last master admin cannot be deleted.' });
  }
  delete state.users[target.uid];
  // Tombstone: the deleted identity is rejected by the platform gates
  // immediately, even though its (undeletable-from-here) Firebase Auth
  // account could otherwise still present a valid token.
  markUserDeleted(state, target, actor.email);
  writeAudit(state, actor.email, 'user.delete', target.email, 'Platform record deleted');
  persistPlatform();
  // Honest scope: without the Firebase Admin SDK the underlying Firebase
  // Auth account cannot be deleted from here; only the platform record is.
  return res.json({ success: true, platformRecordDeleted: true, authAccountDeleted: false });
}));

// --- Admin: per-user feature overrides (Admin Command Center) ----------------
// Body: a map of feature key -> true (grant an area the plan lacks),
// false (revoke an area the plan includes), or null (clear the override
// and fall back to the plan). Effective on the user's next request.
app.put('/api/admin/users/:uid/access', requireMasterAdmin, ah(async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return badRequest(res, 'Body must be an object mapping feature keys to true, false, or null');
  }
  const entries = Object.entries(body);
  if (entries.length === 0) return badRequest(res, 'No feature overrides provided');
  for (const [key, value] of entries) {
    if (!FEATURE_KEYS.includes(key as any)) return badRequest(res, `Unknown feature key: ${key}`);
    if (value !== null && typeof value !== 'boolean') {
      return badRequest(res, `Override for "${key}" must be true, false, or null`);
    }
  }
  const state = getPlatformState();
  const target = state.users[req.params.uid];
  if (!target) return res.status(404).json({ success: false, error: 'User not found' });

  const overrides: Record<string, boolean> = { ...(target.featureOverrides ?? {}) };
  const plan = target.planId ? state.plans[target.planId] : null;
  const changes: string[] = [];
  for (const [key, value] of entries) {
    const planDefault = plan?.features?.[key] === true;
    if (value === null) {
      if (key in overrides) {
        delete overrides[key];
        changes.push(`${key} override cleared (plan default ${planDefault ? 'on' : 'off'})`);
      } else {
        changes.push(`${key} already on plan default (${planDefault ? 'on' : 'off'})`);
      }
    } else if (value === true) {
      overrides[key] = true;
      changes.push(`${key} granted`);
    } else {
      overrides[key] = false;
      changes.push(`${key} revoked`);
    }
  }
  target.featureOverrides = overrides;
  writeAudit(state, actorOf(req).email, 'user.access_update', target.email, changes.join('; '));
  persistPlatform();
  return res.json({ success: true, user: target });
}));

// --- Admin: password reset trigger (Admin Command Center) --------------------
// The server has no Firebase Admin SDK, so it cannot mint Firebase's own
// reset link; consistent with the sign-in page's forgot-password flow
// (which uses Firebase's sendPasswordResetEmail client-side), this action
// emails the user through the Resend mailer telling them a reset was
// requested and how to complete it. The mail outcome is reported honestly
// (sent / not_configured / failed) — never faked.
app.post('/api/admin/users/:uid/password-reset', requireMasterAdmin, ah(async (req, res) => {
  const state = getPlatformState();
  const target = state.users[req.params.uid];
  if (!target) return res.status(404).json({ success: false, error: 'User not found' });
  const actor = actorOf(req);

  const mail = await sendEmailViaResend({
    to: target.email,
    subject: 'Reset your Pulsar password',
    html: `<p>Hello ${target.displayName},</p>
<p>An administrator has requested a password reset for your Pulsar account.</p>
<p>To set a new password, open the Pulsar sign-in page, choose <strong>Forgot password</strong>, and enter this email address — you will receive a secure reset link to complete the change.</p>
<p>If you did not expect this, you can ignore this email; your current password keeps working until a reset is completed.</p>`
  });

  writeAudit(state, actor.email, 'user.password_reset', target.email,
    `Password reset requested; notification email status: ${mail.status}`);
  persistPlatform();
  return res.json({
    success: true,
    reset: { status: mail.status, error: mail.error, messageId: mail.messageId }
  });
}));

// --- Admin: signup approvals -------------------------------------------------

app.get('/api/admin/signup-requests', requireMasterAdmin, ah(async (_req, res) => {
  const state = getPlatformState();
  const requests = Object.values(state.users)
    .filter(u => u.status === 'pending_approval')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return res.json({ success: true, requests });
}));

app.post('/api/admin/signup-requests/:uid/approve', requireMasterAdmin, ah(async (req, res) => {
  const fieldErr = validateFields(req.body, { planId: 'string' });
  if (fieldErr) return badRequest(res, fieldErr);
  const state = getPlatformState();
  const target = state.users[req.params.uid];
  if (!target) return res.status(404).json({ success: false, error: 'User not found' });
  if (target.status !== 'pending_approval') {
    return badRequest(res, `User is not awaiting approval (status: ${target.status})`);
  }
  const plan = req.body.planId ? state.plans[req.body.planId] : defaultPlan(state);
  if (req.body.planId && !plan) return badRequest(res, `Unknown planId: ${req.body.planId}`);

  target.status = 'active';
  target.planId = plan ? plan.id : target.planId;
  target.approvedBy = actorOf(req).email;
  target.approvedAt = new Date().toISOString();
  delete target.rejectionNote;
  writeAudit(state, actorOf(req).email, 'signup.approve', target.email,
    `Approved on plan ${target.planId || 'none'}`);
  persistPlatform();

  const mail = await sendEmailViaResend({
    to: target.email,
    subject: 'Your Pulsar account has been approved',
    html: `<p>Hello ${target.displayName},</p>
<p>Your Pulsar account has been approved${plan ? ` on the <strong>${plan.name}</strong> plan` : ''}. You can now sign in with this email address.</p>`
  });

  return res.json({
    success: true,
    user: target,
    approvalEmail: { status: mail.status, error: mail.error, messageId: mail.messageId }
  });
}));

app.post('/api/admin/signup-requests/:uid/reject', requireMasterAdmin, ah(async (req, res) => {
  const fieldErr = validateFields(req.body, { note: 'string' });
  if (fieldErr) return badRequest(res, fieldErr);
  const state = getPlatformState();
  const target = state.users[req.params.uid];
  if (!target) return res.status(404).json({ success: false, error: 'User not found' });
  if (target.status !== 'pending_approval') {
    return badRequest(res, `User is not awaiting approval (status: ${target.status})`);
  }
  target.status = 'disabled';
  target.rejectionNote = (req.body.note || '').trim();
  writeAudit(state, actorOf(req).email, 'signup.reject', target.email,
    target.rejectionNote ? `Rejected: ${target.rejectionNote}` : 'Rejected');
  persistPlatform();
  return res.json({ success: true, user: target });
}));

// --- Admin: plans ------------------------------------------------------------

app.get('/api/admin/plans', requireMasterAdmin, ah(async (_req, res) => {
  const state = getPlatformState();
  return res.json({ success: true, plans: Object.values(state.plans), featureKeys: FEATURE_KEYS });
}));

app.put('/api/admin/plans/:planId', requireMasterAdmin, ah(async (req, res) => {
  const fieldErr = validateFields(req.body, {
    name: 'string', priceNote: 'string', features: 'object', limits: 'object', isDefault: 'boolean'
  });
  if (fieldErr) return badRequest(res, fieldErr);
  const state = getPlatformState();
  const planId = String(req.params.planId || '').trim();
  if (!/^[a-z0-9][a-z0-9-_]*$/i.test(planId)) return badRequest(res, 'Invalid planId');
  const existing = state.plans[planId];
  const { name, priceNote, features, limits, isDefault } = req.body;

  const nextFeatures: Record<string, boolean> = existing ? { ...existing.features } : {};
  if (features !== undefined) {
    for (const [k, v] of Object.entries(features)) {
      if (!FEATURE_KEYS.includes(k as any)) return badRequest(res, `Unknown feature key: ${k}`);
      if (typeof v !== 'boolean') return badRequest(res, `Feature "${k}" must be a boolean`);
      nextFeatures[k] = v;
    }
  }
  for (const k of FEATURE_KEYS) {
    if (nextFeatures[k] === undefined) nextFeatures[k] = false;
  }

  const nextLimits = existing
    ? { ...existing.limits }
    : { leadsPerMonth: 0, campaignsActive: 0, seats: 1, callsPerMonth: 0, sendsPerMonth: 0 };
  if (limits !== undefined) {
    for (const k of ['leadsPerMonth', 'campaignsActive', 'seats', 'callsPerMonth', 'sendsPerMonth']) {
      if (limits[k] !== undefined) {
        if (typeof limits[k] !== 'number' || Number.isNaN(limits[k]) || limits[k] < 0) {
          return badRequest(res, `Limit "${k}" must be a non-negative number`);
        }
        (nextLimits as any)[k] = Math.floor(limits[k]);
      }
    }
  }

  const plan: Plan = {
    id: planId,
    name: (name ?? existing?.name ?? planId).toString(),
    priceNote: (priceNote ?? existing?.priceNote ?? '').toString(),
    features: nextFeatures,
    limits: nextLimits,
    isDefault: isDefault ?? existing?.isDefault ?? false
  };
  if (plan.isDefault) {
    for (const p of Object.values(state.plans)) p.isDefault = false;
  }
  state.plans[planId] = plan;
  writeAudit(state, actorOf(req).email, existing ? 'plan.update' : 'plan.create', planId,
    `Plan "${plan.name}" saved`);
  persistPlatform();
  return res.json({ success: true, plan });
}));

// --- Admin: master-admin configuration ---------------------------------------

app.get('/api/admin/config/master-admins', requireMasterAdmin, ah(async (_req, res) => {
  const state = getPlatformState();
  return res.json({
    success: true,
    stored: state.masterAdminEmails,
    env: OWNER_EMAILS,
    effective: effectiveMasterAdmins(state)
  });
}));

app.put('/api/admin/config/master-admins', requireMasterAdmin, ah(async (req, res) => {
  const fieldErr = validateFields(req.body, { emails: 'array' });
  if (fieldErr) return badRequest(res, fieldErr);
  const rawList: any[] = Array.isArray(req.body.emails) ? req.body.emails : [];
  const emails: string[] = [];
  for (const e of rawList) {
    if (typeof e !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())) {
      return badRequest(res, `Invalid email in master-admin list: ${String(e)}`);
    }
    const n = e.trim().toLowerCase();
    if (!emails.includes(n)) emails.push(n);
  }
  const state = getPlatformState();
  const actor = actorOf(req);
  const verdict = validateMasterAdminUpdate(state, actor.email, emails);
  if (!verdict.ok) return res.status(verdict.status).json({ success: false, error: verdict.error });

  const before = state.masterAdminEmails;
  state.masterAdminEmails = emails;
  const added = emails.filter(e => !before.includes(e));
  const removed = before.filter(e => !emails.includes(e));
  writeAudit(state, actor.email, 'master_admins.update', 'platformConfig/masterAdmins',
    `stored list: ${before.length} -> ${emails.length}; added: ${added.join(', ') || 'none'}; removed: ${removed.join(', ') || 'none'}`);
  persistPlatform();
  return res.json({
    success: true,
    stored: state.masterAdminEmails,
    env: OWNER_EMAILS,
    effective: effectiveMasterAdmins(state)
  });
}));

// --- Admin: overview (Admin Command Center) -----------------------------------

app.get('/api/admin/overview', requireMasterAdmin, ah(async (_req, res) => {
  const state = getPlatformState();
  const users = Object.values(state.users);
  const byStatus: Record<string, number> = { active: 0, pending_approval: 0, disabled: 0 };
  const byPlan: Record<string, number> = {};
  for (const u of users) {
    byStatus[u.status] = (byStatus[u.status] ?? 0) + 1;
    const key = u.planId ?? 'none';
    byPlan[key] = (byPlan[key] ?? 0) + 1;
  }
  return res.json({
    success: true,
    overview: {
      totalUsers: users.length,
      byStatus,
      byPlan,
      pendingApprovals: byStatus.pending_approval ?? 0,
      masterAdminCount: effectiveMasterAdmins(state).length,
      envFallbackActive: OWNER_EMAILS.length > 0,
      recentAudit: state.audit.slice(0, 10)
    }
  });
}));

// --- Admin: audit log ----------------------------------------------------------

app.get('/api/admin/audit', requireMasterAdmin, ah(async (req, res) => {
  const state = getPlatformState();
  const limitRaw = parseInt(String(req.query.limit || '100'), 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(500, Math.max(1, limitRaw)) : 100;
  return res.json({ success: true, entries: state.audit.slice(0, limit) });
}));

// --- Phase 7.1: consent ledger, suppression, and contact gate ---------------
// Master-admin only. These routes never send an email, SMS, or call;
// the check route only evaluates the gate. National DNC note: the US
// National DNC Registry requires paid registration and cannot be
// queried from here, so the gate uses the internal suppression list
// plus user-supplied CSV imports only, and never claims a live lookup.

app.get('/api/admin/phase71/overview', requireMasterAdmin, ah(async (_req, res) => {
  const state = getPlatformState();
  return res.json({
    success: true,
    consents: state.phase71.consents,
    suppressions: state.phase71.suppressions,
    counts: {
      consents: state.phase71.consents.length,
      activeConsents: state.phase71.consents.filter(c => c.revokedAt === null).length,
      suppressions: state.phase71.suppressions.length
    },
    nationalDnc: {
      lookup: 'not_available',
      note: 'The US National DNC Registry requires paid registration and cannot be queried from here. This gate uses the internal suppression list plus user-supplied CSV imports only.'
    }
  });
}));

app.post('/api/admin/phase71/consents', requireMasterAdmin, ah(async (req, res) => {
  const fieldErr = validateFields(req.body, { contactId: 'string', channel: 'string', type: 'string', source: 'string' });
  if (fieldErr) return badRequest(res, fieldErr);
  const state = getPlatformState();
  const result = grantConsent(state.phase71.consents, {
    contactId: req.body.contactId,
    channel: req.body.channel as ContactChannel,
    type: req.body.type as ConsentType,
    source: req.body.source
  });
  if (!result.ok) return badRequest(res, result.error);
  writeAudit(state, actorOf(req).email, 'phase71.consent_grant', result.record.contactId,
    `Granted ${result.record.type} for channel ${result.record.channel} from ${result.record.source}`);
  persistPlatform();
  return res.status(201).json({ success: true, consent: result.record });
}));

app.post('/api/admin/phase71/consents/revoke', requireMasterAdmin, ah(async (req, res) => {
  const fieldErr = validateFields(req.body, { contactId: 'string', source: 'string', email: 'string', phone: 'string' });
  if (fieldErr) return badRequest(res, fieldErr);
  const contactId = String(req.body.contactId || '').trim();
  if (!contactId) return badRequest(res, 'CONTACT_ID_REQUIRED');
  const state = getPlatformState();
  const { revoked } = revokeContact(state.phase71.consents, contactId, req.body.source || 'revocation');
  // Revocation suppresses all channels: add suppression records for the
  // contact id and, when supplied, its email and phone.
  const added: string[] = [];
  const addSupp = (type: 'contact' | 'email' | 'phone', identifier: string) => {
    const r = addPhase71Suppression(state.phase71.suppressions, {
      identifierType: type, identifier, reason: 'opt_out', source: req.body.source || 'revocation', addedBy: actorOf(req).email
    });
    if (r.ok && !r.duplicate) added.push(`${type}:${r.record.identifier}`);
  };
  addSupp('contact', contactId);
  if (req.body.email) addSupp('email', req.body.email);
  if (req.body.phone) addSupp('phone', req.body.phone);
  writeAudit(state, actorOf(req).email, 'phase71.consent_revoke', contactId,
    `Revoked ${revoked} consent record(s); suppression added: ${added.join(', ') || 'none new'}`);
  persistPlatform();
  return res.json({ success: true, revoked, suppressionsAdded: added });
}));

app.post('/api/admin/phase71/suppressions', requireMasterAdmin, ah(async (req, res) => {
  const fieldErr = validateFields(req.body, { identifierType: 'string', identifier: 'string', reason: 'string', source: 'string' });
  if (fieldErr) return badRequest(res, fieldErr);
  const state = getPlatformState();
  const result = addPhase71Suppression(state.phase71.suppressions, {
    identifierType: req.body.identifierType,
    identifier: req.body.identifier,
    reason: (req.body.reason || 'manual') as SuppressionReason,
    source: req.body.source || 'manual',
    addedBy: actorOf(req).email
  });
  if (!result.ok) return badRequest(res, result.error);
  writeAudit(state, actorOf(req).email, 'phase71.suppression_add', result.record.identifier,
    `Added ${result.record.identifierType} suppression (${result.record.reason})${result.duplicate ? ' (already listed)' : ''}`);
  persistPlatform();
  return res.status(201).json({ success: true, suppression: result.record, duplicate: result.duplicate });
}));

app.delete('/api/admin/phase71/suppressions/:id', requireMasterAdmin, ah(async (req, res) => {
  const state = getPlatformState();
  const target = state.phase71.suppressions.find(s => s.id === req.params.id);
  if (!target) return res.status(404).json({ success: false, error: 'Suppression not found' });
  state.phase71.suppressions = state.phase71.suppressions.filter(s => s.id !== target.id);
  writeAudit(state, actorOf(req).email, 'phase71.suppression_remove', target.identifier,
    `Removed ${target.identifierType} suppression (${target.reason})`);
  persistPlatform();
  return res.json({ success: true, removed: target });
}));

app.post('/api/admin/phase71/suppressions/import', requireMasterAdmin, ah(async (req, res) => {
  const fieldErr = validateFields(req.body, { csv: 'string', source: 'string' });
  if (fieldErr) return badRequest(res, fieldErr);
  const state = getPlatformState();
  const parsed = importSuppressionCsv(req.body.csv || '', { source: req.body.source || 'dnc_import', addedBy: actorOf(req).email });
  let added = 0;
  let duplicates = 0;
  for (const phone of parsed.added) {
    const r = addPhase71Suppression(state.phase71.suppressions, {
      identifierType: 'phone', identifier: phone, reason: 'dnc_import', source: req.body.source || 'dnc_import', addedBy: actorOf(req).email
    });
    if (r.ok && !r.duplicate) added++; else duplicates++;
  }
  for (const phone of parsed.skipped) duplicates++;
  writeAudit(state, actorOf(req).email, 'phase71.suppression_import', 'internal suppression list',
    `Imported ${added} phone numbers, ${duplicates} duplicates skipped, ${parsed.errors.length} invalid lines. This is an internal list import, not a live National DNC lookup.`);
  persistPlatform();
  return res.json({ success: true, added, duplicates, errors: parsed.errors });
}));

app.post('/api/admin/phase71/check', requireMasterAdmin, ah(async (req, res) => {
  const fieldErr = validateFields(req.body, { channel: 'string' });
  if (fieldErr) return badRequest(res, fieldErr);
  const channel = req.body.channel as ContactChannel;
  if (!['email', 'voice', 'sms'].includes(channel)) return badRequest(res, 'channel must be email, voice, or sms');
  const raw = req.body.contact || {};
  const contact: GateContact = {
    id: String(raw.id || '').trim(),
    email: normalizePhase71Email(raw.email) || null,
    phone: normalizePhase71Phone(raw.phone) || null,
    phoneLineType: ['mobile', 'landline', 'unknown'].includes(raw.phoneLineType) ? raw.phoneLineType : 'unknown',
    fieldVerifications: Array.isArray(raw.fieldVerifications) ? raw.fieldVerifications.filter((v: any) =>
      v && ['email', 'phone', 'business', 'identity'].includes(v.field) && typeof v.verified === 'boolean'
        && typeof v.provenance === 'string' && typeof v.verifiedAt === 'string') : []
  };
  if (!contact.id) return badRequest(res, 'CONTACT_ID_REQUIRED');
  const state = getPlatformState();
  const verdict = canContact(contact, channel, { consents: state.phase71.consents, suppressions: state.phase71.suppressions });
  writeAudit(state, actorOf(req).email, 'phase71.gate_check', contact.id, gateAuditDetail(contact, verdict));
  persistPlatform();
  return res.json({ success: true, verdict });
}));

// --- Phase 7.3: after-call automation -------------------------------------
// Master-admin only. These routes never send an email, SMS, or call:
// processAfterCall produces drafts only (status draft, sent false),
// and the opt-out route cancels follow-ups and suppresses the lead.
// No outcome, result, or ROI figure is invented here: stage, task,
// draft, and owner summary all come from the call note and brief the
// caller passes in.
app.get('/api/admin/phase73/overview', requireMasterAdmin, ah(async (_req, res) => {
  const state = getPlatformState();
  return res.json({
    success: true,
    pipeline: state.phase73.pipeline,
    tasks: state.phase73.tasks,
    drafts: state.phase73.drafts,
    ownerSummaries: state.phase73.ownerSummaries,
    counts: {
      pipelineLeads: Object.keys(state.phase73.pipeline).length,
      pendingTasks: state.phase73.tasks.filter(t => t.status === 'pending').length,
      drafts: state.phase73.drafts.length,
      ownerSummaries: state.phase73.ownerSummaries.length
    }
  });
}));

app.post('/api/admin/phase73/after-call', requireMasterAdmin, ah(async (req, res) => {
  const fieldErr = validateFields(req.body, { note: 'object', brief: 'object' });
  if (fieldErr) return badRequest(res, fieldErr);
  const rawNote = req.body.note || {};
  const rawBrief = req.body.brief || {};
  const outcome = rawNote.outcome as CallOutcome;
  if (!['blocked', 'transferred', 'callback_booked', 'email_requested', 'not_interested', 'ended'].includes(outcome)) {
    return badRequest(res, 'note.outcome must be a Phase 7.2 call outcome');
  }
  const contactId = String(rawNote.contactId || '').trim();
  if (!contactId) return badRequest(res, 'CONTACT_ID_REQUIRED');
  const state = getPlatformState();
  const result = processAfterCall({
    note: {
      contactId,
      outcome,
      nextStep: String(rawNote.nextStep || ''),
      transferSummary: rawNote.transferSummary || null,
      callbackAt: rawNote.callbackAt || null,
      agreed: rawNote.agreed || null
    },
    brief: {
      contactName: String(rawBrief.contactName || ''),
      businessName: String(rawBrief.businessName || ''),
      callingCompany: String(rawBrief.callingCompany || ''),
      painPoint: String(rawBrief.painPoint || ''),
      proofOffer: String(rawBrief.proofOffer || ''),
      ownerName: String(rawBrief.ownerName || '')
    },
    suppressions: state.phase71.suppressions,
    existingTasks: state.phase73.tasks
  });
  state.phase73.pipeline[contactId] = result.stage;
  state.phase73.tasks.push(...result.tasks);
  state.phase73.drafts.push(...result.drafts);
  if (result.ownerSummary) {
    state.phase73.ownerSummaries = state.phase73.ownerSummaries.filter(s => s.contactId !== contactId);
    state.phase73.ownerSummaries.push(result.ownerSummary);
  }
  if (result.suppressed) {
    // Universal suppression: an opt-out outcome also suppresses the
    // contact in the Phase 7.1 ledger, so future gate checks block.
    const added = addPhase71Suppression(state.phase71.suppressions, {
      identifierType: 'contact', identifier: contactId, reason: 'opt_out', source: 'phase73 after-call', addedBy: actorOf(req).email
    });
    void added;
  }
  for (const event of result.auditEvents) {
    writeAudit(state, actorOf(req).email, 'phase73.after_call', contactId, event);
  }
  persistPlatform();
  return res.json({
    success: true,
    stage: result.stage,
    tasks: result.tasks,
    drafts: result.drafts,
    ownerSummary: result.ownerSummary,
    ownerSummaryText: result.ownerSummary ? formatOwnerSummary(result.ownerSummary) : null,
    suppressed: result.suppressed,
    followUpsCancelled: result.followUpsCancelled
  });
}));

app.post('/api/admin/phase73/opt-out', requireMasterAdmin, ah(async (req, res) => {
  const fieldErr = validateFields(req.body, { contactId: 'string', source: 'string' });
  if (fieldErr) return badRequest(res, fieldErr);
  const contactId = String(req.body.contactId || '').trim();
  if (!contactId) return badRequest(res, 'CONTACT_ID_REQUIRED');
  const state = getPlatformState();
  const result = applyPhase73OptOut({ contactId, source: req.body.source || 'opt-out', existingTasks: state.phase73.tasks });
  state.phase73.pipeline[contactId] = 'opted_out';
  revokeContact(state.phase71.consents, contactId, req.body.source || 'opt-out');
  addPhase71Suppression(state.phase71.suppressions, {
    identifierType: 'contact', identifier: contactId, reason: 'opt_out', source: req.body.source || 'opt-out', addedBy: actorOf(req).email
  });
  writeAudit(state, actorOf(req).email, 'phase73.opt_out', contactId, result.auditEvent);
  persistPlatform();
  return res.json({ success: true, stage: result.stage, followUpsCancelled: result.followUpsCancelled });
}));

// --- Phase 7.4: owner dashboard ----------------------------------------
// Master-admin only. These routes never send an email, SMS, or call,
// never change consent or gate state, and never invent a value: they
// read the Phase 7.3 pipeline and apply reversible owner actions
// (won, lost, reopen, snooze, unsnooze, confirm next step), each
// written to the audit log and to the Phase 7.4 action log.
app.get('/api/admin/phase74/dashboard', requireMasterAdmin, ah(async (_req, res) => {
  const state = getPlatformState();
  const view = buildOwnerDashboard({
    pipeline: state.phase73.pipeline,
    tasks: state.phase73.tasks,
    drafts: state.phase73.drafts,
    ownerSummaries: state.phase73.ownerSummaries
  });
  return res.json({ success: true, ...view, actions: state.phase74.actions.slice(-100) });
}));

app.post('/api/admin/phase74/outcome', requireMasterAdmin, ah(async (req, res) => {
  const fieldErr = validateFields(req.body, { contactId: 'string', outcome: 'string' });
  if (fieldErr) return badRequest(res, fieldErr);
  const contactId = String(req.body.contactId || '').trim();
  const outcome = String(req.body.outcome || '').trim();
  if (!contactId) return badRequest(res, 'CONTACT_ID_REQUIRED');
  if (outcome !== 'closed_won' && outcome !== 'closed_lost') return badRequest(res, 'outcome must be closed_won or closed_lost');
  const state = getPlatformState();
  const result = markLeadOutcome({
    pipeline: state.phase73.pipeline,
    tasks: state.phase73.tasks,
    contactId,
    outcome: outcome as 'closed_won' | 'closed_lost',
    reason: String(req.body.reason || '')
  });
  state.phase74.actions.push(result.action);
  writeAudit(state, actorOf(req).email, 'phase74.outcome', contactId, result.auditEvent);
  persistPlatform();
  return res.json({ success: true, stage: result.stage, followUpsCancelled: result.followUpsCancelled, action: result.action });
}));

app.post('/api/admin/phase74/reopen', requireMasterAdmin, ah(async (req, res) => {
  const fieldErr = validateFields(req.body, { actionId: 'string' });
  if (fieldErr) return badRequest(res, fieldErr);
  const state = getPlatformState();
  const action = state.phase74.actions.find(a => a.id === String(req.body.actionId));
  if (!action) return badRequest(res, 'ACTION_NOT_FOUND');
  const result = reopenLead({ pipeline: state.phase73.pipeline, tasks: state.phase73.tasks, action });
  if (!result.restored) return badRequest(res, 'ACTION_NOT_REVERSIBLE');
  if (result.reversal) state.phase74.actions.push(result.reversal);
  writeAudit(state, actorOf(req).email, 'phase74.reopen', action.contactId, `reopened action=${action.id} restored_stage=${result.stage} tasks_restored=${result.tasksRestored}`);
  persistPlatform();
  return res.json({ success: true, restored: true, stage: result.stage, tasksRestored: result.tasksRestored });
}));

app.post('/api/admin/phase74/snooze', requireMasterAdmin, ah(async (req, res) => {
  const fieldErr = validateFields(req.body, { taskId: 'string', dueAt: 'string' });
  if (fieldErr) return badRequest(res, fieldErr);
  const state = getPlatformState();
  const result = snoozeFollowUp({
    tasks: state.phase73.tasks,
    taskId: String(req.body.taskId),
    newDueAt: String(req.body.dueAt),
    reason: String(req.body.reason || '')
  });
  if (!result.snoozed || !result.action) return badRequest(res, 'TASK_NOT_PENDING');
  state.phase74.actions.push(result.action);
  writeAudit(state, actorOf(req).email, 'phase74.snooze', result.action.contactId, `snoozed task=${result.action.taskId} new_due=${result.action.newDueAt}`);
  persistPlatform();
  return res.json({ success: true, snoozed: true, action: result.action });
}));

app.post('/api/admin/phase74/unsnooze', requireMasterAdmin, ah(async (req, res) => {
  const fieldErr = validateFields(req.body, { actionId: 'string' });
  if (fieldErr) return badRequest(res, fieldErr);
  const state = getPlatformState();
  const action = state.phase74.actions.find(a => a.id === String(req.body.actionId));
  if (!action) return badRequest(res, 'ACTION_NOT_FOUND');
  const result = unsnoozeFollowUp({ tasks: state.phase73.tasks, action });
  if (!result.restored || !result.reversal) return badRequest(res, 'ACTION_NOT_REVERSIBLE');
  state.phase74.actions.push(result.reversal);
  writeAudit(state, actorOf(req).email, 'phase74.unsnooze', action.contactId, `unsnoozed task=${action.taskId}`);
  persistPlatform();
  return res.json({ success: true, restored: true });
}));

app.post('/api/admin/phase74/next-step', requireMasterAdmin, ah(async (req, res) => {
  const fieldErr = validateFields(req.body, { contactId: 'string', nextStep: 'string' });
  if (fieldErr) return badRequest(res, fieldErr);
  const contactId = String(req.body.contactId || '').trim();
  if (!contactId) return badRequest(res, 'CONTACT_ID_REQUIRED');
  const state = getPlatformState();
  const result = confirmNextStep({
    ownerSummaries: state.phase73.ownerSummaries,
    contactId,
    nextStep: String(req.body.nextStep || ''),
    reason: String(req.body.reason || '')
  });
  if (!result.confirmed || !result.action) return badRequest(res, 'NO_OWNER_SUMMARY');
  state.phase74.actions.push(result.action);
  writeAudit(state, actorOf(req).email, 'phase74.next_step', contactId, `next_step=${result.action.newNextAction}`);
  persistPlatform();
  return res.json({ success: true, confirmed: true, action: result.action });
}));

// --- Billing: checkout and billing, TEST MODE ONLY ------------------------
// Master-admin only. Nothing here charges a card, stores a card number,
// or calls a payment provider. The provider config returns only variable
// names and a configured flag, never a key value. A live checkout flow,
// webhook handling, and a live test payment are still required before
// any customer can pay.
app.get('/api/admin/billing/overview', requireMasterAdmin, ah(async (_req, res) => {
  const state = getPlatformState();
  const now = new Date();
  const subscriptions = Object.values(state.billing.subscriptions).map((sub) => {
    const plan = getBillingPlan(sub.planId);
    return {
      ...expireTrialIfDue(sub, now),
      planName: plan ? plan.name : sub.planId,
      priceCentsPerMonth: plan ? plan.priceCentsPerMonth : 0,
      leadsRemaining: leadsRemaining(sub),
      trialDaysRemaining: trialDaysRemaining(sub, now),
    };
  });
  return res.json({
    success: true,
    testMode: true,
    liveCharging: false,
    plans: BILLING_PLANS.map((plan) => ({ ...plan, price: formatPriceCents(plan.priceCentsPerMonth) })),
    provider: getBillingProviderConfig(),
    subscriptions,
  });
}));

app.post('/api/admin/billing/trial', requireMasterAdmin, ah(async (req, res) => {
  const fieldErr = validateFields(req.body, { workspaceId: 'string', planId: 'string' });
  if (fieldErr) return badRequest(res, fieldErr);
  const workspaceId = String(req.body.workspaceId || '').trim();
  const planId = String(req.body.planId || '').trim() as BillingPlanId;
  if (!workspaceId) return badRequest(res, 'WORKSPACE_ID_REQUIRED');
  if (!getBillingPlan(planId)) return badRequest(res, 'UNKNOWN_PLAN');
  const state = getPlatformState();
  const sub = startTrial(workspaceId, planId);
  state.billing.subscriptions[workspaceId] = sub;
  writeAudit(state, actorOf(req).email, 'billing.trial_started', workspaceId, `trial plan=${planId} 14 days, test mode, no charge`);
  persistPlatform();
  return res.status(201).json({ success: true, subscription: sub, trialDaysRemaining: trialDaysRemaining(sub) });
}));

app.post('/api/admin/billing/select-plan', requireMasterAdmin, ah(async (req, res) => {
  const fieldErr = validateFields(req.body, { workspaceId: 'string', planId: 'string' });
  if (fieldErr) return badRequest(res, fieldErr);
  const workspaceId = String(req.body.workspaceId || '').trim();
  const planId = String(req.body.planId || '').trim() as BillingPlanId;
  const state = getPlatformState();
  const sub = state.billing.subscriptions[workspaceId];
  if (!sub) return badRequest(res, 'SUBSCRIPTION_NOT_FOUND');
  const result = selectPlan(sub, planId);
  if (!result.ok) return badRequest(res, result.error || 'PLAN_CHANGE_FAILED');
  state.billing.subscriptions[workspaceId] = result.subscription;
  writeAudit(state, actorOf(req).email, 'billing.plan_selected', workspaceId, `plan=${planId} pending=${result.subscription.pendingPlanId || 'none'}`);
  persistPlatform();
  return res.json({ success: true, subscription: result.subscription });
}));

app.post('/api/admin/billing/renew', requireMasterAdmin, ah(async (req, res) => {
  const fieldErr = validateFields(req.body, { workspaceId: 'string' });
  if (fieldErr) return badRequest(res, fieldErr);
  const workspaceId = String(req.body.workspaceId || '').trim();
  const state = getPlatformState();
  const sub = state.billing.subscriptions[workspaceId];
  if (!sub) return badRequest(res, 'SUBSCRIPTION_NOT_FOUND');
  const expired = expireTrialIfDue(sub, new Date());
  const renewed = expired.status === 'trial_expired' ? expired : renewPeriod(expired, new Date());
  state.billing.subscriptions[workspaceId] = renewed;
  writeAudit(state, actorOf(req).email, 'billing.renewed', workspaceId, `status=${renewed.status} plan=${renewed.planId}`);
  persistPlatform();
  return res.json({ success: true, subscription: renewed });
}));

app.post('/api/admin/billing/cancel', requireMasterAdmin, ah(async (req, res) => {
  const fieldErr = validateFields(req.body, { workspaceId: 'string', stopFollowUpsOnCancel: 'boolean' });
  if (fieldErr) return badRequest(res, fieldErr);
  const workspaceId = String(req.body.workspaceId || '').trim();
  const state = getPlatformState();
  const sub = state.billing.subscriptions[workspaceId];
  if (!sub) return badRequest(res, 'SUBSCRIPTION_NOT_FOUND');
  const cancelled = cancelSubscription(sub, { stopFollowUpsOnCancel: req.body.stopFollowUpsOnCancel === true });
  state.billing.subscriptions[workspaceId] = cancelled;
  writeAudit(state, actorOf(req).email, 'billing.cancelled', workspaceId, `cancel_at_period_end=true stop_follow_ups=${cancelled.stopFollowUpsOnCancel}`);
  persistPlatform();
  return res.json({ success: true, subscription: cancelled });
}));

app.post('/api/admin/billing/manual-payment', requireMasterAdmin, ah(async (req, res) => {
  const fieldErr = validateFields(req.body, { workspaceId: 'string', amountCents: 'number', note: 'string' });
  if (fieldErr) return badRequest(res, fieldErr);
  const workspaceId = String(req.body.workspaceId || '').trim();
  const state = getPlatformState();
  const sub = state.billing.subscriptions[workspaceId];
  if (!sub) return badRequest(res, 'SUBSCRIPTION_NOT_FOUND');
  const result = recordManualPayment(sub, {
    amountCents: req.body.amountCents,
    paidAt: String(req.body.paidAt || new Date().toISOString()),
    recordedBy: actorOf(req).email,
    note: String(req.body.note || ''),
  });
  if (!result.ok) return badRequest(res, result.error || 'MANUAL_PAYMENT_FAILED');
  state.billing.subscriptions[workspaceId] = result.subscription;
  writeAudit(state, actorOf(req).email, 'billing.manual_payment', workspaceId, `manual payment amount_cents=${req.body.amountCents} plan=${sub.planId} note=${String(req.body.note || '')}`);
  persistPlatform();
  return res.json({ success: true, subscription: result.subscription });
}));

app.post('/api/admin/billing/lead-use', requireMasterAdmin, ah(async (req, res) => {
  const fieldErr = validateFields(req.body, { workspaceId: 'string' });
  if (fieldErr) return badRequest(res, fieldErr);
  const workspaceId = String(req.body.workspaceId || '').trim();
  const state = getPlatformState();
  const sub = state.billing.subscriptions[workspaceId];
  if (!sub) return badRequest(res, 'SUBSCRIPTION_NOT_FOUND');
  const result = recordLeadUse(sub, new Date());
  if (!result.ok) return badRequest(res, result.error || 'LEAD_CAP_OR_ACCESS');
  state.billing.subscriptions[workspaceId] = result.subscription;
  persistPlatform();
  return res.json({ success: true, subscription: result.subscription, leadsRemaining: leadsRemaining(result.subscription), canAddLead: canAddLead(result.subscription) });
}));

app.post('/api/admin/billing/test-checkout', requireMasterAdmin, ah(async (req, res) => {
  const fieldErr = validateFields(req.body, { workspaceId: 'string', planId: 'string' });
  if (fieldErr) return badRequest(res, fieldErr);
  const workspaceId = String(req.body.workspaceId || '').trim();
  const planId = String(req.body.planId || '').trim() as BillingPlanId;
  if (!workspaceId) return badRequest(res, 'WORKSPACE_ID_REQUIRED');
  if (!getBillingPlan(planId)) return badRequest(res, 'UNKNOWN_PLAN');
  return res.json({ success: true, testMode: true, charged: false, session: createTestCheckoutSession(workspaceId, planId) });
}));

// --- Lead prep: email shape check, company brief, signal monitor -------------
// Master-admin only. Read-only preparation: nothing here sends, calls,
// fetches a page, or authorises contact. Email results are shape checks
// only, company briefs come from user-supplied text only, and signals
// come from supplied items only. The Phase 7 consent gate still decides
// every contact, and an opt-out stops all channels at once.
app.get('/api/admin/lead-prep/overview', requireMasterAdmin, ah(async (_req, res) => {
  const state = getPlatformState();
  return res.json({
    success: true,
    liveVerification: false,
    liveFetch: false,
    emailChecks: state.leadPrep.emailChecks.slice(-50),
    companyBriefs: state.leadPrep.companyBriefs.slice(-50),
    watches: state.leadPrep.watches,
    signals: state.leadPrep.signals.slice(-100),
    placesDrafts: state.leadPrep.placesDrafts.slice(-100),
    placesKeyConfigured: getPlacesApiKey() !== null,
    counts: {
      emailChecks: state.leadPrep.emailChecks.length,
      companyBriefs: state.leadPrep.companyBriefs.length,
      watches: state.leadPrep.watches.length,
      signals: state.leadPrep.signals.length,
      placesDrafts: state.leadPrep.placesDrafts.length
    }
  });
}));

app.post('/api/admin/lead-prep/email-check', requireMasterAdmin, ah(async (req, res) => {
  const fieldErr = validateFields(req.body, { email: 'string' });
  if (fieldErr) return badRequest(res, fieldErr);
  const state = getPlatformState();
  const result = validateEmailAddress({ email: String(req.body.email || ''), contactId: req.body.contactId || null });
  state.leadPrep.emailChecks.push(result);
  writeAudit(state, actorOf(req).email, 'leadprep.email_check', result.email, `verdict=${result.verdict} shape only, no live check`);
  persistPlatform();
  return res.status(201).json({ success: true, result });
}));

app.post('/api/admin/lead-prep/company-brief', requireMasterAdmin, ah(async (req, res) => {
  const fieldErr = validateFields(req.body, { companyName: 'string', pageText: 'string', source: 'string' });
  if (fieldErr) return badRequest(res, fieldErr);
  const state = getPlatformState();
  const brief = buildCompanyBrief({
    companyName: String(req.body.companyName || ''),
    pageText: String(req.body.pageText || ''),
    source: String(req.body.source || ''),
    sourceUrl: req.body.sourceUrl || null,
    suppliedBy: actorOf(req).email
  });
  state.leadPrep.companyBriefs.push(brief);
  writeAudit(state, actorOf(req).email, 'leadprep.company_brief', brief.companyName, 'brief from supplied text only, nothing fetched');
  persistPlatform();
  return res.status(201).json({ success: true, brief });
}));

app.post('/api/admin/lead-prep/watch', requireMasterAdmin, ah(async (req, res) => {
  const fieldErr = validateFields(req.body, { kind: 'string', label: 'string', source: 'string' });
  if (fieldErr) return badRequest(res, fieldErr);
  const state = getPlatformState();
  const result = addSignalWatch(state.leadPrep.watches, {
    kind: req.body.kind,
    label: String(req.body.label || ''),
    source: String(req.body.source || ''),
    addedBy: actorOf(req).email
  });
  if (!result.ok) return badRequest(res, result.error);
  writeAudit(state, actorOf(req).email, 'leadprep.watch_add', result.watch.label, `kind=${result.watch.kind}`);
  persistPlatform();
  return res.status(201).json({ success: true, watch: result.watch });
}));

app.post('/api/admin/lead-prep/signal', requireMasterAdmin, ah(async (req, res) => {
  const fieldErr = validateFields(req.body, { watchId: 'string', title: 'string', body: 'string', source: 'string' });
  if (fieldErr) return badRequest(res, fieldErr);
  const state = getPlatformState();
  const watch = state.leadPrep.watches.find(w => w.id === req.body.watchId);
  if (!watch) return badRequest(res, 'WATCH_NOT_FOUND');
  const signal = classifySuppliedItem({
    watchId: String(req.body.watchId),
    title: String(req.body.title || ''),
    body: String(req.body.body || ''),
    publishedAt: req.body.publishedAt || null,
    source: String(req.body.source || '')
  });
  state.leadPrep.signals.push(signal);
  writeAudit(state, actorOf(req).email, 'leadprep.signal', signal.title, `kind=${signal.kind} contact_authorised=false`);
  persistPlatform();
  return res.status(201).json({ success: true, signal });
}));

// Google Places search, master-admin only, server side only. The key is
// read from the server environment and sent only in the Places header.
// It is never logged, never stored, and never sent to the browser. A
// draft is preparation only: not a verified contact, and it never
// authorises contact. The verification step and the Phase 7 consent
// gate must still pass first, and an opt-out stops all channels.
app.post('/api/admin/lead-prep/places-search', requireMasterAdmin, ah(async (req, res) => {
  const fieldErr = validateFields(req.body, { industry: 'string', place: 'string' });
  if (fieldErr) return badRequest(res, fieldErr);
  const industry = String(req.body.industry || '');
  const place = String(req.body.place || '');
  const validation = validatePlacesSearchInput({ industry, place });
  if (validation) return badRequest(res, validation);
  const apiKey = getPlacesApiKey();
  if (!apiKey) {
    return res.status(503).json({ success: false, livePlaces: false, error: PLACES_NOT_CONFIGURED_MESSAGE });
  }
  const state = getPlatformState();
  let provider;
  try {
    provider = createGooglePlacesProvider(apiKey);
  } catch (e: any) {
    return res.status(503).json({ success: false, livePlaces: false, error: e?.message || PLACES_NOT_CONFIGURED_MESSAGE });
  }
  let result;
  try {
    result = await searchPlacesWithProvider(provider, { industry, place });
  } catch (e: any) {
    return res.status(502).json({ success: false, livePlaces: false, error: e?.message || 'Google Places search failed' });
  }
  const merged = dedupePlacesDrafts([...state.leadPrep.placesDrafts, ...result.drafts]);
  const newlyStored = merged.drafts.length - state.leadPrep.placesDrafts.length;
  state.leadPrep.placesDrafts = merged.drafts;
  writeAudit(state, actorOf(req).email, 'leadprep.places_search', `${industry.trim()} in ${place.trim()}`, `drafts=${result.drafts.length} newly_stored=${newlyStored} cap=${PLACES_MAX_RESULTS} live=true`);
  persistPlatform();
  return res.json({
    success: true,
    livePlaces: true,
    drafts: result.drafts,
    totalReturned: result.totalReturned,
    duplicatesRemoved: result.duplicatesRemoved,
    cappedAt: result.cappedAt
  });
}));

// --- Dashboard: snapshot sync + stats (prompt Part 2) --------------------------
// -------------------------------------------------------------
// Phases 4–6 — Pipeline operations (server/pipeline.ts)
// Phase 4: lead registry (provenance + dedupe + suppression), deterministic
// enrichment, LinkedIn founder-assisted flow. Phase 5: notes → tasks →
// counted daily stats. Phase 6: email sequences via the real Resend
// mailer + provider webhook. Workspace scoping mirrors the dashboard
// routes: a caller sees only their own workspace; master admins may name
// another workspace explicitly.
// -------------------------------------------------------------

/** Resolve the workspace a pipeline route should act on, or send 403. */
function pipelineWorkspaceId(req: any, res: any, requested?: any): string | null {
  const own = callerWorkspaceId(req);
  const target = typeof requested === 'string' && requested.trim() ? requested : own;
  if (target !== own && !isCallerMasterAdmin(req)) {
    res.status(403).json({ success: false, error: 'Cannot access another workspace' });
    return null;
  }
  return target;
}

// --- Phase 4: lead registry ------------------------------------------------

app.post('/api/leads/ingest', requireFeature('lead_discovery'), requireWithinLimit('leads'), ah(async (req, res) => {
  const fieldErr = validateFields(req.body, { leads: 'array', workspaceId: 'string' });
  if (fieldErr) return badRequest(res, fieldErr);
  if (!Array.isArray(req.body.leads)) return badRequest(res, 'Field "leads" must be an array');
  if (req.body.leads.length > 500) return badRequest(res, 'Ingest is capped at 500 records per request');
  const ws = pipelineWorkspaceId(req, res, req.body.workspaceId);
  if (!ws) return;
  const state = getPipelineState();
  const { results, created } = ingestLeads(state, ws, req.body.leads);
  persistPipeline();
  if (created > 0 && (req as any).user?.uid) {
    recordUsage(getPlatformState(), (req as any).user.uid, 'leads', created);
    persistPlatform();
  }
  return res.json({
    success: true,
    workspaceId: ws,
    created,
    duplicates: results.filter(r => r.outcome === 'duplicate').length,
    rejected: results.filter(r => r.outcome === 'rejected').length,
    results
  });
}));

app.get('/api/leads/registry', requireActiveAccount, ah(async (req, res) => {
  const ws = pipelineWorkspaceId(req, res, req.query.workspaceId);
  if (!ws) return;
  const state = getPipelineState();
  const leads = Object.values(state.leads)
    .filter(l => l.workspaceId === ws)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 1000)
    .map(l => ({
      ...l,
      // Live re-check: a suppression added after ingest applies immediately.
      suppressedNow: l.suppressed || !!matchSuppression(state, ws, l)
    }));
  return res.json({ success: true, workspaceId: ws, count: leads.length, leads });
}));

app.post('/api/leads/enrich', requireFeature('lead_discovery'), ah(async (req, res) => {
  const fieldErr = validateFields(req.body, { leadIds: 'array', workspaceId: 'string' });
  if (fieldErr) return badRequest(res, fieldErr);
  const ws = pipelineWorkspaceId(req, res, req.body.workspaceId);
  if (!ws) return;
  const state = getPipelineState();
  const enriched = enrichWorkspaceLeads(state, ws, Array.isArray(req.body.leadIds) ? req.body.leadIds : undefined);
  persistPipeline();
  return res.json({
    success: true,
    workspaceId: ws,
    ruleset: 'thrivemed-default-v1',
    enrichedCount: enriched.length,
    leads: enriched
  });
}));

// --- Phase 4: suppressions ---------------------------------------------------

app.get('/api/suppressions', requireActiveAccount, ah(async (req, res) => {
  const ws = pipelineWorkspaceId(req, res, req.query.workspaceId);
  if (!ws) return;
  const state = getPipelineState();
  const suppressions = Object.values(state.suppressions)
    .filter(s => s.workspaceId === ws)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return res.json({ success: true, workspaceId: ws, count: suppressions.length, suppressions });
}));

app.post('/api/suppressions', requireActiveAccount, ah(async (req, res) => {
  const fieldErr = validateFields(req.body, {
    identifierType: 'string', identifier: 'string', reason: 'string', workspaceId: 'string'
  });
  if (fieldErr) return badRequest(res, fieldErr);
  const { identifierType, identifier, reason } = req.body;
  if (!['email', 'phone', 'npi', 'practice'].includes(identifierType)) {
    return badRequest(res, 'identifierType must be one of email | phone | npi | practice');
  }
  if (!identifier || !String(identifier).trim()) return badRequest(res, 'identifier is required');
  if (reason !== undefined && !['opt_out', 'dnc_request', 'registry', 'manual'].includes(reason)) {
    return badRequest(res, 'reason must be one of opt_out | dnc_request | registry | manual');
  }
  const ws = pipelineWorkspaceId(req, res, req.body.workspaceId);
  if (!ws) return;
  const state = getPipelineState();
  const entry = addSuppression(state, ws, identifierType, String(identifier), reason || 'manual', actorOf(req).email);
  persistPipeline();
  return res.status(201).json({ success: true, suppression: entry });
}));

// Removing a suppression lifts a do-not-contact guard, so it is a
// master-admin action (and audited), never a casual delete.
app.delete('/api/suppressions/:id', requireMasterAdmin, ah(async (req, res) => {
  const state = getPipelineState();
  const entry = state.suppressions[String(req.params.id)];
  if (!entry) return res.status(404).json({ success: false, error: 'Suppression not found' });
  delete state.suppressions[entry.id];
  persistPipeline();
  const platform = getPlatformState();
  writeAudit(platform, actorOf(req).email, 'suppression.remove', entry.id,
    `Removed ${entry.identifierType} suppression "${entry.identifier}" (was: ${entry.reason}) in ${entry.workspaceId}`);
  persistPlatform();
  return res.json({ success: true, removed: entry.id });
}));

// --- Phase 4: LinkedIn founder-assisted flow ---------------------------------
// Pulsar prepares the target + draft; the HUMAN sends from their own
// LinkedIn (blueprint §4.3 — no unattended automation, no simulated sends).
// /api/linkedin/send-connection stays 501 not_connected.

app.post('/api/linkedin/assist/prepare', requireFeature('linkedin_workflows'), ah(async (req, res) => {
  const fieldErr = validateFields(req.body, {
    leadId: 'string', workspaceId: 'string', prospect: 'object'
  });
  if (fieldErr) return badRequest(res, fieldErr);
  const ws = pipelineWorkspaceId(req, res, req.body.workspaceId);
  if (!ws) return;
  const state = getPipelineState();

  let leadId: string | null = null;
  let prospectName = '';
  let practiceName = '';
  let linkedInUrl = '';
  let specialty = '';
  if (req.body.leadId) {
    const lead = state.leads[String(req.body.leadId)];
    if (!lead || lead.workspaceId !== ws) {
      return res.status(404).json({ success: false, error: 'Lead not found in this workspace' });
    }
    leadId = lead.id;
    prospectName = lead.doctorName || lead.adminContact || '';
    practiceName = lead.practiceName;
    linkedInUrl = lead.linkedInProfile || '';
    specialty = lead.specialty || '';
  } else if (req.body.prospect && typeof req.body.prospect === 'object') {
    prospectName = String(req.body.prospect.fullName || req.body.prospect.name || '');
    practiceName = String(req.body.prospect.practice || req.body.prospect.practiceName || '');
    linkedInUrl = String(req.body.prospect.linkedInUrl || '');
    specialty = String(req.body.prospect.specialty || '');
  } else {
    return badRequest(res, 'Provide either leadId or prospect');
  }
  if (!prospectName) return badRequest(res, 'A prospect name is required');

  // Draft: Gemini when a key exists (facts-only prompt, labeled 'gemini'),
  // otherwise the deterministic template (labeled 'template'). A failed AI
  // call falls back to the template rather than failing the preparation.
  let draft = buildTemplateDraft({ prospectName, practiceName, specialty });
  let draftSource: 'template' | 'gemini' = 'template';
  if (process.env.GEMINI_API_KEY) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Write a short, professional LinkedIn connection-request note (max 300 characters) from the operations lead of ThriveMed RCM (US medical billing) to this person. Use ONLY these facts — invent nothing about the person or their practice:
- Name: ${prospectName}
- Practice: ${practiceName || 'a US medical practice'}
- Specialty: ${specialty || 'healthcare'}
Mention cutting claim denials and days in AR. No hype, no fake familiarity. Return only the note text.`,
        config: { temperature: 0.4 }
      });
      const text = (response.text || '').trim();
      if (text) {
        draft = text.slice(0, 1200);
        draftSource = 'gemini';
      }
    } catch (err: any) {
      console.warn('LinkedIn draft Gemini fallback:', err?.message);
    }
  }

  const assist = createAssist(state, ws, {
    leadId, prospectName, practiceName, linkedInUrl, draftMessage: draft, draftSource
  }, actorOf(req).email);
  persistPipeline();
  return res.status(201).json({
    success: true,
    assist,
    openInLinkedIn: linkedInUrl || null,
    note: 'Assisted flow: open the profile in LinkedIn, send the request yourself, then log the outcome here. Pulsar never sends on LinkedIn.'
  });
}));

app.get('/api/linkedin/assist', requireActiveAccount, ah(async (req, res) => {
  const ws = pipelineWorkspaceId(req, res, req.query.workspaceId);
  if (!ws) return;
  const state = getPipelineState();
  const assists = Object.values(state.assists)
    .filter(a => a.workspaceId === ws)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 500);
  return res.json({ success: true, workspaceId: ws, count: assists.length, assists });
}));

app.post('/api/linkedin/assist/:id/log-outcome', requireFeature('linkedin_workflows'), ah(async (req, res) => {
  const fieldErr = validateFields(req.body, { outcome: 'string', note: 'string' });
  if (fieldErr) return badRequest(res, fieldErr);
  const outcomes = ['sent_manually', 'accepted', 'replied', 'declined', 'no_response'];
  if (!outcomes.includes(req.body.outcome)) {
    return badRequest(res, `outcome must be one of ${outcomes.join(' | ')}`);
  }
  const ws = pipelineWorkspaceId(req, res, req.body.workspaceId);
  if (!ws) return;
  const state = getPipelineState();
  const assist = state.assists[String(req.params.id)];
  if (!assist || assist.workspaceId !== ws) {
    return res.status(404).json({ success: false, error: 'Assist task not found in this workspace' });
  }
  logAssistOutcome(state, assist, req.body.outcome, req.body.note);
  persistPipeline();
  return res.json({ success: true, assist });
}));

// --- Phase 5: notes & tasks --------------------------------------------------

function tasksForNote(state: ReturnType<typeof getPipelineState>, note: PipelineNote, items: Array<{ text: string; dueAt?: string | null; priority?: any }>, owner: string, createdBy: string) {
  return items
    .filter(i => i && typeof i.text === 'string' && i.text.trim())
    .map(i => createTask(state, note.workspaceId, {
      title: i.text.trim().slice(0, 300),
      owner,
      leadId: note.leadId,
      noteId: note.id,
      dueAt: i.dueAt ?? null,
      priority: i.priority
    }, createdBy));
}

app.post('/api/notes', requireActiveAccount, ah(async (req, res) => {
  const fieldErr = validateFields(req.body, {
    leadId: 'string', title: 'string', summary: 'string', interestLevel: 'string',
    objections: 'array', nextStep: 'string', actionItems: 'array', owner: 'string',
    createTasks: 'boolean', workspaceId: 'string'
  });
  if (fieldErr) return badRequest(res, fieldErr);
  if (!req.body.summary || !String(req.body.summary).trim()) {
    return badRequest(res, 'A manual note requires a summary written by the author');
  }
  const ws = pipelineWorkspaceId(req, res, req.body.workspaceId);
  if (!ws) return;
  const state = getPipelineState();
  const actor = actorOf(req);
  const note: PipelineNote = {
    id: `note-${crypto.randomUUID()}`,
    workspaceId: ws,
    leadId: req.body.leadId || null,
    type: 'manual',
    title: req.body.title || 'Manual note',
    transcript: null,
    summary: String(req.body.summary),
    summarySource: 'manual',
    interestLevel: req.body.interestLevel || null,
    objections: Array.isArray(req.body.objections) ? req.body.objections.map(String) : [],
    nextStep: req.body.nextStep || null,
    actionItems: (Array.isArray(req.body.actionItems) ? req.body.actionItems : [])
      .filter((i: any) => i && typeof i.text === 'string' && i.text.trim())
      .map((i: any) => ({ text: String(i.text).trim(), extraction: 'manual' as const })),
    createdBy: actor.email,
    createdAt: new Date().toISOString()
  };
  state.notes[note.id] = note;
  const tasks = req.body.createTasks === false
    ? []
    : tasksForNote(state, note, (Array.isArray(req.body.actionItems) ? req.body.actionItems : []), req.body.owner || actor.email, actor.email);
  persistPipeline();
  return res.status(201).json({ success: true, note, tasksCreated: tasks });
}));

app.post('/api/notes/from-transcript', requireActiveAccount, aiQuotaMiddleware, ah(async (req, res) => {
  const fieldErr = validateFields(req.body, {
    leadId: 'string', title: 'string', transcript: 'string', owner: 'string',
    createTasks: 'boolean', workspaceId: 'string'
  });
  if (fieldErr) return badRequest(res, fieldErr);
  const transcript = String(req.body.transcript || '');
  if (!transcript.trim()) {
    return badRequest(res, 'A non-empty transcript is required — notes are generated only from real transcripts');
  }
  if (transcript.length > 50000) return badRequest(res, 'Transcript exceeds 50,000 characters');
  const ws = pipelineWorkspaceId(req, res, req.body.workspaceId);
  if (!ws) return;
  const state = getPipelineState();
  const actor = actorOf(req);

  // Summary: Gemini when configured (labeled 'gemini'); otherwise the note
  // stores the transcript verbatim with deterministic, rule-extracted
  // action items and NO invented summary (summarySource 'deterministic').
  let summary: string | null = null;
  let summarySource: PipelineNote['summarySource'] = 'deterministic';
  let interestLevel: string | null = null;
  let objections: string[] = [];
  let nextStep: string | null = null;
  let actionItems: PipelineNote['actionItems'] = extractActionItemsFromTranscript(transcript);

  if (process.env.GEMINI_API_KEY) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Analyze this real conversation transcript and return strict JSON only:
{ "summary": "2-3 sentence factual summary", "interestLevel": "Hot Lead" | "Warm Opportunity" | "Follow-up Required" | "Not Qualified", "objections": ["..."], "nextStep": "...", "actionItems": [{ "text": "..." }] }
Use ONLY facts present in the transcript. Do not invent names, numbers, or commitments.

Transcript:
${transcript}`,
        config: { temperature: 0.3 }
      });
      const clean = (response.text || '').replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(clean);
      if (parsed && typeof parsed.summary === 'string') {
        summary = parsed.summary;
        summarySource = 'gemini';
        interestLevel = typeof parsed.interestLevel === 'string' ? parsed.interestLevel : null;
        objections = Array.isArray(parsed.objections) ? parsed.objections.map(String) : [];
        nextStep = typeof parsed.nextStep === 'string' ? parsed.nextStep : null;
        if (Array.isArray(parsed.actionItems) && parsed.actionItems.length > 0) {
          actionItems = parsed.actionItems
            .filter((i: any) => i && typeof i.text === 'string' && i.text.trim())
            .map((i: any) => ({ text: String(i.text).trim(), extraction: 'gemini' as const }));
        }
      }
    } catch (err: any) {
      console.warn('Transcript note Gemini fallback:', err?.message);
    }
  }

  const note: PipelineNote = {
    id: `note-${crypto.randomUUID()}`,
    workspaceId: ws,
    leadId: req.body.leadId || null,
    type: 'transcript',
    title: req.body.title || 'Transcript note',
    transcript,
    summary,
    summarySource,
    interestLevel,
    objections,
    nextStep,
    actionItems,
    createdBy: actor.email,
    createdAt: new Date().toISOString()
  };
  state.notes[note.id] = note;
  const tasks = req.body.createTasks === false
    ? []
    : tasksForNote(state, note, actionItems.map(i => ({ text: i.text })), req.body.owner || actor.email, actor.email);
  persistPipeline();
  return res.status(201).json({ success: true, note, tasksCreated: tasks });
}));

app.get('/api/notes', requireActiveAccount, ah(async (req, res) => {
  const ws = pipelineWorkspaceId(req, res, req.query.workspaceId);
  if (!ws) return;
  const state = getPipelineState();
  let notes = Object.values(state.notes).filter(n => n.workspaceId === ws);
  if (typeof req.query.leadId === 'string') notes = notes.filter(n => n.leadId === req.query.leadId);
  notes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return res.json({ success: true, workspaceId: ws, count: notes.length, notes: notes.slice(0, 200) });
}));

app.get('/api/tasks', requireActiveAccount, ah(async (req, res) => {
  const ws = pipelineWorkspaceId(req, res, req.query.workspaceId);
  if (!ws) return;
  const state = getPipelineState();
  let tasks = Object.values(state.tasks).filter(t => t.workspaceId === ws);
  if (typeof req.query.status === 'string') tasks = tasks.filter(t => t.status === req.query.status);
  if (typeof req.query.leadId === 'string') tasks = tasks.filter(t => t.leadId === req.query.leadId);
  tasks.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return res.json({ success: true, workspaceId: ws, count: tasks.length, tasks: tasks.slice(0, 500) });
}));

app.post('/api/tasks', requireActiveAccount, ah(async (req, res) => {
  const fieldErr = validateFields(req.body, {
    title: 'string', owner: 'string', leadId: 'string', noteId: 'string',
    dueAt: 'string', priority: 'string', workspaceId: 'string'
  });
  if (fieldErr) return badRequest(res, fieldErr);
  if (!req.body.title || !String(req.body.title).trim()) return badRequest(res, 'title is required');
  if (req.body.priority !== undefined && !['Urgent', 'High', 'Medium', 'Low'].includes(req.body.priority)) {
    return badRequest(res, 'priority must be one of Urgent | High | Medium | Low');
  }
  if (req.body.dueAt !== undefined && req.body.dueAt !== null && Number.isNaN(Date.parse(req.body.dueAt))) {
    return badRequest(res, 'dueAt must be an ISO date string');
  }
  const ws = pipelineWorkspaceId(req, res, req.body.workspaceId);
  if (!ws) return;
  const state = getPipelineState();
  const actor = actorOf(req);
  const task = createTask(state, ws, {
    title: String(req.body.title).trim(),
    owner: req.body.owner || actor.email,
    leadId: req.body.leadId || null,
    noteId: req.body.noteId || null,
    dueAt: req.body.dueAt || null,
    priority: req.body.priority
  }, actor.email);
  persistPipeline();
  return res.status(201).json({ success: true, task });
}));

// The only way a task changes status: an explicit human action here.
// Completion stamps the actor + time; nothing auto-completes a task.
app.patch('/api/tasks/:id', requireActiveAccount, ah(async (req, res) => {
  const fieldErr = validateFields(req.body, { status: 'string', workspaceId: 'string' });
  if (fieldErr) return badRequest(res, fieldErr);
  if (!['open', 'done', 'dismissed'].includes(req.body.status)) {
    return badRequest(res, 'status must be one of open | done | dismissed');
  }
  const ws = pipelineWorkspaceId(req, res, req.body.workspaceId);
  if (!ws) return;
  const state = getPipelineState();
  const task = state.tasks[String(req.params.id)];
  if (!task || task.workspaceId !== ws) {
    return res.status(404).json({ success: false, error: 'Task not found in this workspace' });
  }
  updateTaskStatus(state, task, req.body.status, actorOf(req).email);
  persistPipeline();
  return res.json({ success: true, task });
}));

// Daily stats counted from the workspace's own records (Phase 5): the
// reconciliation source for the daily briefing. A zero-activity day
// returns genuine zeros and says so.
app.get('/api/briefing/daily-stats', requireActiveAccount, ah(async (req, res) => {
  const ws = pipelineWorkspaceId(req, res, req.query.workspaceId);
  if (!ws) return;
  const dateRaw = typeof req.query.date === 'string' ? req.query.date : new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) return badRequest(res, 'date must be YYYY-MM-DD');
  const stats = computeDailyStats(getPipelineState(), getPlatformState(), ws, dateRaw);
  return res.json({ success: true, stats });
}));

// --- Phase 6: email sequences --------------------------------------------------

const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

function parseSequenceSteps(rawSteps: any): { steps?: SequenceStep[]; error?: string } {
  if (!Array.isArray(rawSteps) || rawSteps.length === 0) {
    return { error: 'steps must be a non-empty array' };
  }
  if (rawSteps.length > 10) return { error: 'A sequence may have at most 10 steps' };
  const steps: SequenceStep[] = [];
  for (let i = 0; i < rawSteps.length; i++) {
    const s = rawSteps[i];
    if (!s || typeof s !== 'object') return { error: `steps[${i}] must be an object` };
    if (typeof s.subject !== 'string' || !s.subject.trim()) return { error: `steps[${i}].subject is required` };
    if (typeof s.body !== 'string' || !s.body.trim()) return { error: `steps[${i}].body is required` };
    const delayDays = s.delayDays === undefined ? 0 : Number(s.delayDays);
    if (!Number.isFinite(delayDays) || delayDays < 0) return { error: `steps[${i}].delayDays must be a non-negative number` };
    const windowStart = typeof s.windowStart === 'string' ? s.windowStart : '08:00';
    const windowEnd = typeof s.windowEnd === 'string' ? s.windowEnd : '21:00';
    if (!TIME_OF_DAY.test(windowStart) || !TIME_OF_DAY.test(windowEnd)) {
      return { error: `steps[${i}] windowStart/windowEnd must be HH:MM` };
    }
    steps.push({
      subject: s.subject, body: s.body, delayDays,
      windowStart, windowEnd
    });
  }
  return { steps };
}

app.post('/api/sequences', requireFeature('campaigns'), ah(async (req, res) => {
  const fieldErr = validateFields(req.body, {
    name: 'string', timezone: 'string', steps: 'array', workspaceId: 'string'
  });
  if (fieldErr) return badRequest(res, fieldErr);
  if (!req.body.name || !String(req.body.name).trim()) return badRequest(res, 'name is required');
  const parsed = parseSequenceSteps(req.body.steps);
  if (parsed.error) return badRequest(res, parsed.error);
  const timezone = typeof req.body.timezone === 'string' && req.body.timezone ? req.body.timezone : 'America/New_York';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
  } catch {
    return badRequest(res, `Unknown timezone: ${timezone}`);
  }
  const ws = pipelineWorkspaceId(req, res, req.body.workspaceId);
  if (!ws) return;
  const state = getPipelineState();
  const actor = actorOf(req);
  const sequence: Sequence = {
    id: `seq-${crypto.randomUUID()}`,
    workspaceId: ws,
    name: String(req.body.name).trim(),
    status: 'draft',
    timezone,
    steps: parsed.steps!,
    createdBy: actor.email,
    createdByUid: actor.uid,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  state.sequences[sequence.id] = sequence;
  persistPipeline();
  return res.status(201).json({ success: true, sequence });
}));

app.get('/api/sequences', requireActiveAccount, ah(async (req, res) => {
  const ws = pipelineWorkspaceId(req, res, req.query.workspaceId);
  if (!ws) return;
  const state = getPipelineState();
  const sequences = Object.values(state.sequences)
    .filter(s => s.workspaceId === ws)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(s => ({
      ...s,
      enrollments: Object.values(state.enrollments)
        .filter(e => e.sequenceId === s.id)
        .map(e => ({ id: e.id, leadId: e.leadId, email: e.email, currentStep: e.currentStep, status: e.status, stopReason: e.stopReason, nextDueAt: e.nextDueAt }))
    }));
  return res.json({ success: true, workspaceId: ws, count: sequences.length, sequences });
}));

app.patch('/api/sequences/:id', requireFeature('campaigns'), ah(async (req, res) => {
  const fieldErr = validateFields(req.body, {
    name: 'string', status: 'string', timezone: 'string', steps: 'array', workspaceId: 'string'
  });
  if (fieldErr) return badRequest(res, fieldErr);
  if (req.body.status !== undefined && !['draft', 'active', 'paused'].includes(req.body.status)) {
    return badRequest(res, 'status must be one of draft | active | paused');
  }
  const ws = pipelineWorkspaceId(req, res, req.body.workspaceId);
  if (!ws) return;
  const state = getPipelineState();
  const sequence = state.sequences[String(req.params.id)];
  if (!sequence || sequence.workspaceId !== ws) {
    return res.status(404).json({ success: false, error: 'Sequence not found in this workspace' });
  }
  if (req.body.steps !== undefined) {
    const parsed = parseSequenceSteps(req.body.steps);
    if (parsed.error) return badRequest(res, parsed.error);
    sequence.steps = parsed.steps!;
  }
  if (req.body.name) sequence.name = String(req.body.name).trim();
  if (req.body.status) sequence.status = req.body.status;
  if (req.body.timezone) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: req.body.timezone });
      sequence.timezone = req.body.timezone;
    } catch {
      return badRequest(res, `Unknown timezone: ${req.body.timezone}`);
    }
  }
  sequence.updatedAt = new Date().toISOString();
  persistPipeline();
  return res.json({ success: true, sequence });
}));

app.post('/api/sequences/:id/enroll', requireFeature('email_outreach'), ah(async (req, res) => {
  const fieldErr = validateFields(req.body, { leadIds: 'array', workspaceId: 'string' });
  if (fieldErr) return badRequest(res, fieldErr);
  if (!Array.isArray(req.body.leadIds) || req.body.leadIds.length === 0) {
    return badRequest(res, 'leadIds must be a non-empty array');
  }
  if (req.body.leadIds.length > 200) return badRequest(res, 'Enrollment is capped at 200 leads per request');
  const ws = pipelineWorkspaceId(req, res, req.body.workspaceId);
  if (!ws) return;
  const state = getPipelineState();
  const sequence = state.sequences[String(req.params.id)];
  if (!sequence || sequence.workspaceId !== ws) {
    return res.status(404).json({ success: false, error: 'Sequence not found in this workspace' });
  }
  const actor = actorOf(req);
  const results = req.body.leadIds.map((leadId: any) => {
    const lead = state.leads[String(leadId)];
    if (!lead || lead.workspaceId !== ws) {
      return { leadId: String(leadId), outcome: 'rejected', reason: 'lead not found in this workspace' };
    }
    const r = enrollLeadInSequence(state, sequence, lead, actor.email);
    return { leadId: lead.id, outcome: r.outcome, reason: r.reason, enrollmentId: r.enrollment?.id };
  });
  persistPipeline();
  return res.json({ success: true, sequenceId: sequence.id, results });
}));

app.get('/api/sequences/deliveries', requireActiveAccount, ah(async (req, res) => {
  const ws = pipelineWorkspaceId(req, res, req.query.workspaceId);
  if (!ws) return;
  const state = getPipelineState();
  let deliveries = state.deliveries.filter(d => d.workspaceId === ws);
  if (typeof req.query.sequenceId === 'string') {
    deliveries = deliveries.filter(d => d.sequenceId === req.query.sequenceId);
  }
  return res.json({ success: true, workspaceId: ws, count: deliveries.length, deliveries: deliveries.slice(0, 500) });
}));

// Manual tick (the background interval below runs the same engine every
// minute for all workspaces; this endpoint scopes it to the caller's
// workspace for on-demand processing and acceptance testing).
app.post('/api/sequences/tick', requireFeature('email_outreach'), ah(async (req, res) => {
  const ws = pipelineWorkspaceId(req, res, req.body?.workspaceId);
  if (!ws) return;
  const summary = await processDueSequences(getPipelineState(), getPlatformState(), {
    workspaceId: ws,
    send: (p) => sendEmailViaResend(p)
  });
  persistPipeline();
  persistPlatform();
  return res.json({ success: true, workspaceId: ws, summary });
}));

// Background sequence processor — same engine as the manual tick, all
// workspaces, once a minute. Paused sequences are skipped by the engine,
// so pausing stops future sends within one interval tick.
let sequenceTickRunning = false;
setInterval(async () => {
  if (sequenceTickRunning) return;
  sequenceTickRunning = true;
  try {
    const summary = await processDueSequences(getPipelineState(), getPlatformState(), {
      send: (p) => sendEmailViaResend(p)
    });
    if (summary.processed > 0) {
      persistPipeline();
      persistPlatform();
      console.log(`[SEQUENCES] tick: processed=${summary.processed} sent=${summary.sent} failed=${summary.failed} notConfigured=${summary.notConfigured} suppressed=${summary.skippedSuppressed}`);
    }
  } catch (err) {
    console.error('[SEQUENCES] background tick failed:', err);
  } finally {
    sequenceTickRunning = false;
  }
}, 60000);

// Resend provider webhook: delivery / bounce / complaint events. Auth is
// the Standard-Webhooks signature over the raw body (Firebase middleware
// exempts this path — see the /api auth block). Without a configured
// webhook secret the endpoint honestly reports not_configured.
app.post('/api/webhooks/resend', ah(async (req, res) => {
  const secret = process.env.RESEND_WEBHOOK_SECRET || '';
  if (!secret) {
    return res.status(503).json({ success: false, status: 'not_configured', error: 'RESEND_WEBHOOK_SECRET is not configured; webhook events cannot be verified or accepted.' });
  }
  const rawBody = (req as any).rawBody ? (req as any).rawBody.toString('utf8') : '';
  const verdict = verifyResendWebhook(secret, {
    id: req.header('svix-id') || undefined,
    timestamp: req.header('svix-timestamp') || undefined,
    signature: req.header('svix-signature') || undefined
  }, rawBody);
  if (!verdict.ok) {
    return res.status(400).json({ success: false, error: `Webhook rejected: ${verdict.reason}` });
  }
  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ success: false, error: 'Webhook body is not valid JSON' });
  }
  const state = getPipelineState();
  const result = applyResendEvent(state, event);
  persistPipeline();
  return res.json({ success: true, ...result });
}));

// The workspace's records live in client-side Firestore; this server has no
// Admin SDK access (see platform.ts header), so the client syncs the real
// records it holds and the server aggregates them. Nothing is invented:
// an unsynced workspace aggregates to zeros and honest empty states.

const SNAPSHOT_CAPS = { leads: 5000, campaigns: 200, callSessions: 5000, tasks: 5000 };

function sanitizeSnapshotSection(body: any, existing: WorkspaceSnapshot, workspaceId: string): WorkspaceSnapshot {
  const next: WorkspaceSnapshot = {
    workspaceId,
    updatedAt: new Date().toISOString(),
    leads: existing.leads,
    campaigns: existing.campaigns,
    callSessions: existing.callSessions,
    tasks: existing.tasks
  };
  if (Array.isArray(body.leads)) {
    next.leads = body.leads.slice(0, SNAPSHOT_CAPS.leads).map((l: any) => ({
      id: typeof l?.id === 'string' ? l.id : undefined,
      status: typeof l?.status === 'string' ? l.status : undefined,
      createdAt: typeof l?.createdAt === 'string' ? l.createdAt : null,
      lastContacted: typeof l?.lastContacted === 'string' ? l.lastContacted : null
    }));
  }
  if (Array.isArray(body.campaigns)) {
    next.campaigns = body.campaigns.slice(0, SNAPSHOT_CAPS.campaigns).map((c: any) => ({
      id: String(c?.id || ''),
      name: String(c?.name || 'Untitled campaign'),
      status: String(c?.status || 'draft'),
      sent: Math.max(0, Number(c?.sent) || 0),
      opened: Math.max(0, Number(c?.opened) || 0),
      replied: Math.max(0, Number(c?.replied) || 0),
      createdAt: typeof c?.createdAt === 'string' ? c.createdAt : null
    }));
  }
  if (Array.isArray(body.callSessions)) {
    next.callSessions = body.callSessions.slice(0, SNAPSHOT_CAPS.callSessions)
      .filter((s: any) => typeof s?.at === 'string')
      .map((s: any) => ({
        at: s.at,
        outcome: typeof s?.outcome === 'string' ? s.outcome : 'answered'
      }));
  }
  if (Array.isArray(body.tasks)) {
    next.tasks = body.tasks.slice(0, SNAPSHOT_CAPS.tasks).map((t: any) => ({
      id: typeof t?.id === 'string' ? t.id : undefined,
      dueAt: typeof t?.dueAt === 'string' ? t.dueAt : null,
      completed: t?.completed === true,
      completedAt: typeof t?.completedAt === 'string' ? t.completedAt : null
    }));
  }
  return next;
}

app.post('/api/dashboard/snapshot', requireActiveAccount, ah(async (req, res) => {
  const fieldErr = validateFields(req.body, {
    workspaceId: 'string', leads: 'array', campaigns: 'array', callSessions: 'array', tasks: 'array'
  });
  if (fieldErr) return badRequest(res, fieldErr);
  const own = callerWorkspaceId(req);
  const requested = typeof req.body.workspaceId === 'string' && req.body.workspaceId ? req.body.workspaceId : own;
  if (requested !== own && !isCallerMasterAdmin(req)) {
    return res.status(403).json({ success: false, error: 'Cannot sync a snapshot for another workspace' });
  }
  const state = getPlatformState();
  const existing: WorkspaceSnapshot = state.snapshots[requested] || {
    workspaceId: requested, updatedAt: '', leads: [], campaigns: [], callSessions: [], tasks: []
  };
  const next = sanitizeSnapshotSection(req.body, existing, requested);
  state.snapshots[requested] = next;
  persistPlatform();
  return res.json({
    success: true,
    workspaceId: requested,
    counts: {
      leads: next.leads.length,
      campaigns: next.campaigns.length,
      callSessions: next.callSessions.length,
      tasks: next.tasks.length
    },
    updatedAt: next.updatedAt
  });
}));

app.get('/api/dashboard/stats', requireActiveAccount, ah(async (req, res) => {
  const rangeRaw = String(req.query.range || '30d');
  const rangeMatch = rangeRaw.match(/^(7|30|90)d$/);
  if (!rangeMatch) {
    return badRequest(res, 'range must be one of 7d, 30d, 90d');
  }
  const rangeDays = parseInt(rangeMatch[1], 10);
  const own = callerWorkspaceId(req);
  const requested = typeof req.query.workspaceId === 'string' && req.query.workspaceId ? req.query.workspaceId : own;
  if (requested !== own && !isCallerMasterAdmin(req)) {
    return res.status(403).json({ success: false, error: 'Cannot read stats for another workspace' });
  }
  const state = getPlatformState();
  const snapshot = state.snapshots[requested] || null;
  const stats = aggregateDashboardStats(snapshot, rangeDays, new Date());
  return res.json({
    success: true,
    range: rangeRaw,
    workspaceId: requested,
    generatedAt: new Date().toISOString(),
    stats
  });
}));

// Phase 0 (0.1): global error handler — malformed JSON is a 400, everything
// else a JSON 500. No request may terminate the process.
app.use((err: any, _req: any, res: any, next: any) => {
  if (res.headersSent) return next(err);
  const isParseError = err?.type === 'entity.parse.failed' || err instanceof SyntaxError;
  const status = isParseError ? 400 : (typeof err?.status === 'number' ? err.status : 500);
  if (status >= 500) console.error('[express] Unhandled error:', err);
  return res.status(status).json({
    success: false,
    error: isParseError ? 'Malformed JSON body' : (err?.message || 'Internal server error')
  });
});

// Explicit SEO Crawler Routes
app.get('/robots.txt', (_req, res) => {
  res.type('text/plain');
  res.sendFile(path.join(__dirname, 'public', 'robots.txt'));
});

app.get('/sitemap.xml', (_req, res) => {
  res.type('application/xml; charset=utf-8');
  res.sendFile(path.join(__dirname, 'public', 'sitemap.xml'));
});

// Mount Vite or serve static assets
if (!isProd) {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

const server = app.listen(PORT, HOST, () => {
  console.log(`Pulsar Server running on http://${HOST}:${PORT} (isProd: ${isProd})`);
  console.log(`[BOOT] Owner gate: ${OWNER_EMAILS.length} owner email(s) configured via OWNER_EMAILS${OWNER_EMAILS.length === 0 ? ' — owner routes will fail closed (403)' : ''}.`);
  console.log(`[BOOT] Scheduler recipient: ${schedulerState.recipientEmail ? 'configured' : 'NOT configured (dispatches will report not_configured)'}. Persisted scheduler state: ${store.scheduler ? 'loaded from server-data/store.json' : 'fresh defaults'}.`);
  const platformState = getPlatformState();
  console.log(`[BOOT] Platform: ${Object.keys(platformState.plans).length} plan(s), ${Object.keys(platformState.users).length} user record(s), ${effectiveMasterAdmins(platformState).length} effective master admin(s) (env + stored list).`);
});

process.on('SIGTERM', () => {
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  server.close(() => {
    process.exit(0);
  });
});
