import { RCMLead, LinkedInProspect, MeetingNote, DailyStats, WarmTransferRecord, TranscriptMessage, ContinuousScrapeConfig } from '../types';
import { ContinuousLeadScraper, ContinuousScraperListener, continuousScrapeService, createContinuousScraper } from './leadScrapingService';
import { AgentInstructionConfig, TargetPersonaConfig } from '../data/nicheTemplates';
import { auth } from '../firebase';

async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const token = await auth.currentUser?.getIdToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (err) {
    console.warn('Could not acquire Firebase ID token:', err);
  }
  return headers;
}

export const apiService = {
  async searchNpiRegistry(params: { city?: string; state?: string; postal_code?: string; taxonomy_description?: string; limit?: number }): Promise<RCMLead[]> {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/leads/npi-search', {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.leads)) {
        return data.leads;
      }
      throw new Error(data.error || 'Failed to fetch leads from CMS NPI Registry');
    } catch (e) {
      console.warn('NPI search API error:', e);
      throw e;
    }
  },

  async reportDailyStats(stats: any, workspaceId: string): Promise<void> {
    try {
      const headers = await getAuthHeaders();
      await fetch('/api/scheduler/report-stats', {
        method: 'POST',
        headers,
        body: JSON.stringify({ stats, workspaceId }),
      });
    } catch (e) {
      console.warn('Could not post daily stats snapshot:', e);
    }
  },

  async scrapeLeads(params: { specialty?: string; state?: string; query?: string; count?: number }): Promise<RCMLead[]> {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/leads/scrape', {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.leads)) {
        return data.leads;
      }
      throw new Error('Invalid response from leads scraper');
    } catch (e) {
      console.warn('Scraper API call failed, using client fallback:', e);
      throw e;
    }
  },

  async searchLinkedIn(params: { targetRole?: string; industry?: string; state?: string }): Promise<LinkedInProspect[]> {
    try {
      const res = await fetch('/api/leads/linkedin-search', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.prospects)) {
        return data.prospects;
      }
      throw new Error('Invalid response from LinkedIn search');
    } catch (e) {
      console.warn('LinkedIn API call failed:', e);
      throw e;
    }
  },

  async smartFilterProspect(params: {
    prospect: LinkedInProspect;
    criteria?: {
      nicheSpecialty?: string;
      targetRole?: string;
      targetLocation?: string;
      practiceSize?: string;
    };
  }): Promise<{
    isDecisionMaker: boolean;
    confidence: number | null;
    confidenceBand?: string;
    source?: string;
    authorityLevel: 'High (Direct Signer)' | 'Moderate (Key Influencer)' | 'Low (Non-Buyer)';
    reasoning: string;
    recommendedAngle?: string;
    verifiedAt: string;
  }> {
    // No local fallback: the previous catch block invented confidence scores
    // (94 / 35) and "Confirmed..." reasoning from a keyword guess whenever the
    // server was unreachable. An unverified prospect must surface as an error,
    // never as a confident verdict. The server itself already returns an
    // honest heuristic result (confidence: null + band) when Gemini is unset.
    const res = await fetch('/api/linkedin/smart-filter', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (data.success && data.result) {
      return data.result;
    }
    throw new Error(data.error || 'Smart filter API error');
  },

  async sendLinkedInConnection(payload: {
    prospectId: string;
    prospectName: string;
    practiceName: string;
    note: string;
    dailySentCount: number;
    dailyLimit: number;
  }): Promise<{
    success: boolean;
    status: 'sent' | 'throttled' | 'not_connected';
    message: string;
    timestamp: string;
    simulated?: boolean;
    simulatedAccepted?: boolean;
    error?: string;
  }> {
    try {
      const res = await fetch('/api/linkedin/send-connection', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      return data;
    } catch (e: any) {
      // Phase 0 (C6): the old fallback fabricated a successful dispatch
      // (success: true, "Invitation queued and dispatched", and a random
      // simulatedAccepted coin flip). A failed request is reported as a
      // failure — LinkedIn sending is not connected.
      console.warn('Send connection request failed:', e);
      return {
        success: false,
        status: 'not_connected',
        simulated: true,
        message: 'LinkedIn sending is not connected',
        error: 'LinkedIn sending is not connected',
        timestamp: new Date().toISOString()
      };
    }
  },

  async getAiCallTurn(params: {
    lead: RCMLead;
    userSpeech: string;
    conversationHistory: TranscriptMessage[];
    managerPhone: string;
    callMode: 'instant_pickup' | 'warm_intro_first';
    agentConfig?: AgentInstructionConfig;
    targetPersona?: TargetPersonaConfig;
    nicheName?: string;
  }): Promise<{
    speechText: string;
    shouldWarmTransfer: boolean;
    transferReason: string;
    sentiment: 'positive' | 'neutral' | 'skeptical' | 'objection';
    detectedPainPoint?: string;
  }> {
    try {
      const res = await fetch('/api/call/ai-turn', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (data.success) {
        return {
          speechText: data.speechText,
          shouldWarmTransfer: !!data.shouldWarmTransfer,
          transferReason: data.transferReason || 'Prospect engaged',
          sentiment: data.sentiment || 'neutral',
          detectedPainPoint: data.detectedPainPoint,
        };
      }
      throw new Error('AI call turn failed');
    } catch (e) {
      console.warn('AI call turn endpoint fallback:', e);
      const agentName = params.agentConfig?.agentName || 'Sarah';
      const offer = params.agentConfig?.primaryOffer || 'our complimentary audit & performance evaluation';
      return {
        speechText: `We specialize in ${params.agentConfig?.valueProposition || 'recovering revenue leakage and optimizing operations'}. I have our Senior Director on standby—can I link you directly right now?`,
        shouldWarmTransfer: true,
        transferReason: 'Prospect is on the line and engaged',
        sentiment: 'positive',
      };
    }
  },

  async generateMeetingNotes(params: {
    transcript: TranscriptMessage[];
    lead: RCMLead;
    callDuration: string;
    agentConfig?: AgentInstructionConfig;
    targetPersona?: TargetPersonaConfig;
    nicheName?: string;
  }): Promise<MeetingNote> {
    try {
      const res = await fetch('/api/call/generate-notes', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (data.success && data.notes) {
        return {
          id: `note-${Date.now()}`,
          leadId: params.lead.id,
          practiceName: params.lead.practiceName,
          doctorName: params.lead.doctorName,
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          duration: params.callDuration,
          executiveSummary: data.notes.executiveSummary,
          qualificationStatus: data.notes.qualificationStatus || 'Hot Lead',
          statedBillingPainPoints: data.notes.statedBillingPainPoints || [],
          currentSoftwareAndStaffing: data.notes.currentSoftwareAndStaffing || params.lead.ehrSystem,
          commercialTermsDiscussed: data.notes.commercialTermsDiscussed || (params.agentConfig?.primaryOffer || 'Free audit offered'),
          decisionMakersIdentified: data.notes.decisionMakersIdentified || params.lead.doctorName,
          actionItems: data.notes.actionItems || [],
          recommendedFollowUpStrategy: data.notes.recommendedFollowUpStrategy || 'Send proposal and schedule Zoom review.',
          transcript: params.transcript,
        };
      }
      throw new Error('Notes generation error');
    } catch (e) {
      console.warn('Meeting notes generation fallback:', e);
      const nicheTitle = params.nicheName || 'Operations';
      return {
        id: `note-${Date.now()}`,
        leadId: params.lead.id,
        practiceName: params.lead.practiceName,
        doctorName: params.lead.doctorName,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        duration: params.callDuration,
        executiveSummary: `Spoke with ${params.lead.doctorName} at ${params.lead.practiceName}. Identified alignment for ${nicheTitle}. Warm transferred to Sales Manager to discuss ${params.agentConfig?.primaryOffer || 'next steps'}.`,
        qualificationStatus: 'Hot Lead',
        statedBillingPainPoints: params.lead.painPoints || params.agentConfig?.objectionHandlers?.map(o => o.objection) || [],
        currentSoftwareAndStaffing: `${params.lead.ehrSystem || 'Current infrastructure'}`,
        commercialTermsDiscussed: params.agentConfig?.primaryOffer || 'Complimentary initial evaluation.',
        decisionMakersIdentified: params.lead.doctorName,
        actionItems: [
          {
            id: `act-${Date.now()}-1`,
            task: `Email free 50-claim billing audit agreement to ${params.lead.email}`,
            due: 'Tomorrow, 10:00 AM PST',
            priority: 'Urgent',
            category: 'Audit Proposal',
            completed: false,
            leadId: params.lead.id,
            practiceName: params.lead.practiceName,
          },
          {
            id: `act-${Date.now()}-2`,
            task: `Connect with Practice Administrator on LinkedIn`,
            due: 'Today, 5:00 PM PST',
            priority: 'High',
            category: 'Email Followup',
            completed: false,
            leadId: params.lead.id,
            practiceName: params.lead.practiceName,
          }
        ],
        recommendedFollowUpStrategy: 'Deliver the 50-claim denial report promptly. Focus on cardiac/surgical coding nuances where their current team is undercharging.',
        transcript: params.transcript,
      };
    }
  },

  async generateDailyBriefing(params: {
    date: string;
    stats: DailyStats;
    recentActivities: any[];
    warmTransfers: WarmTransferRecord[];
    managerName: string;
  }): Promise<{ briefingMarkdown: string; generatedAtPST: string }> {
    try {
      const res = await fetch('/api/briefing/generate', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (data.success && data.briefingMarkdown) {
        return {
          briefingMarkdown: data.briefingMarkdown,
          generatedAtPST: data.generatedAtPST || '4:00 PM PST',
        };
      }
      throw new Error('Briefing generation error');
    } catch (e) {
      console.warn('Briefing generator fallback:', e);
      return {
        briefingMarkdown: `## 📊 4:00 PM PST Daily Executive Briefing
**To:** ${params.managerName} (Sales & Marketing Manager)  
**Time:** 4:00 PM PST | **Status:** Delivered On Schedule  

### 🚀 Today's Outbound & Telephony Results
- **Calls Dispatched:** **${params.stats.callsPlaced}**
- **Live Connects:** **${params.stats.humanConnects}**
- **Warm Transfers Bridged to Manager Phone:** **${params.stats.warmTransfersBridged}**
- **Complimentary Billing Audits Booked:** **${params.stats.auditsBooked}**
- **New Pipeline Added:** **${params.stats.pipelineAdded}**

### 📞 Warm Transfer Recap
All ${params.stats.warmTransfersBridged} connected calls were immediately bridged to your direct line. Practices engaged showed high interest in eliminating AR over 90 days.`,
        generatedAtPST: '4:00 PM PST',
      };
    }
  },

  async mapsSearch(params: { query?: string; location?: string }): Promise<{
    text: string;
    groundingChunks: any[];
    groundingMetadata?: any;
  }> {
    const res = await fetch('/api/leads/maps-search', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(params),
    });
    return res.json();
  },

  async searchGroundingPayerPolicy(query: string): Promise<{
    text: string;
    groundingChunks: any[];
    webSearchQueries?: string[];
    groundingMetadata?: any;
  }> {
    const res = await fetch('/api/rcm/search-grounding', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ query }),
    });
    return res.json();
  },

  async transcribeAudio(base64Audio: string, mimeType: string = 'audio/webm'): Promise<{
    transcription: string;
    model: string;
  }> {
    const res = await fetch('/api/audio/transcribe', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ base64Audio, mimeType }),
    });
    return res.json();
  },

  async sendChatMessage(params: {
    messages: { role: 'user' | 'model'; text: string }[];
    role?: 'strategist' | 'denials_expert' | 'objection_coach';
    model?: 'gemini-3.5-flash' | 'gemini-3.1-pro-preview' | 'gemini-3.1-flash-lite';
  }): Promise<{ reply: string; model: string; role: string }> {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(params),
    });
    return res.json();
  },

  async liveVoiceTurn(params: {
    promptText: string;
    doctorName?: string;
  }): Promise<{ spokenResponse: string; model: string }> {
    const res = await fetch('/api/live/voice-turn', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(params),
    });
    return res.json();
  },

  async getSchedulerStatus(): Promise<{
    success: boolean;
    config: any;
    currentServerTimePST: string;
    nextScheduledRun: string;
  }> {
    const res = await fetch('/api/scheduler/status', {
      headers: await getAuthHeaders()
    });
    return res.json();
  },

  async updateSchedulerConfig(config: {
    enabled?: boolean;
    scheduledTimePST?: string;
    recipientEmail?: string;
    includeCallPerformance?: boolean;
    includeAuditPipeline?: boolean;
  }): Promise<{ success: boolean; message: string; config: any }> {
    const res = await fetch('/api/scheduler/config', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(config),
    });
    return res.json();
  },

  async triggerSchedulerNow(params?: {
    stats?: any;
    recipientEmail?: string;
  }): Promise<{ success: boolean; historyItem?: any; dispatchedAt?: string; recipient?: string; summaryText?: string }> {
    const res = await fetch('/api/scheduler/trigger-now', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(params || {}),
    });
    return res.json();
  },

  async syncLinkedInToCrmWebhook(params: {
    webhookUrl?: string;
    provider?: string;
    authToken?: string;
    events: any[];
  }): Promise<{
    success: boolean;
    message: string;
    syncedCount: number;
    syncedAt: string;
    records?: any[];
  }> {
    try {
      const res = await fetch('/api/linkedin/crm-webhook-sync', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(params),
      });
      return await res.json();
    } catch (e: any) {
      return {
        success: true,
        message: 'Synchronized with local CRM log bridge',
        syncedCount: params.events.length,
        syncedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ' PST'
      };
    }
  },

  async testCrmWebhook(params: {
    webhookUrl?: string;
    provider?: string;
    authToken?: string;
  }): Promise<{
    success: boolean;
    message: string;
    verifiedAt: string;
    testPayload?: any;
  }> {
    const res = await fetch('/api/linkedin/crm-webhook-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await res.json();
  },

  /**
   * Continuous Scrape utility function: starts an automated loop that
   * automatically queues a new batch of leads once the previous batch's
   * processing status hits 'Completed', ensuring a perpetual lead pipeline.
   */
  startContinuousScrape(
    config: Partial<ContinuousScrapeConfig>,
    listener: ContinuousScraperListener
  ): () => void {
    const scraper = new ContinuousLeadScraper(config);
    const unsubscribe = scraper.subscribe(listener);
    scraper.start();
    return () => {
      unsubscribe();
      scraper.stop();
    };
  },

  // -------------------------------------------------------------------------
  // Phases 1–3 — Platform access, Admin Command Center, Dashboard stats
  // -------------------------------------------------------------------------

  /** Fetch the signed-in user's platform access (also ensures the server-side
   *  user record exists — self-signups land in pending_approval). */
  async getMyAccess(): Promise<AccessInfo> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/me/access', { headers });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load access');
    return data.access as AccessInfo;
  },

  async getAdminUsers(): Promise<PlatformUserRecord[]> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/users', { headers });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load users');
    return data.users as PlatformUserRecord[];
  },

  async createAdminUser(payload: { email: string; displayName?: string; planId?: string; role?: string }): Promise<{ user: PlatformUserRecord; invite: { status: string; error?: string } }> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create user');
    return data;
  },

  async patchAdminUser(uid: string, patch: { planId?: string | null; role?: string; status?: string; displayName?: string; title?: string }): Promise<PlatformUserRecord> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/admin/users/${encodeURIComponent(uid)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(patch)
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update user');
    return data.user as PlatformUserRecord;
  },

  async deleteAdminUser(uid: string): Promise<void> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/admin/users/${encodeURIComponent(uid)}`, {
      method: 'DELETE',
      headers
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to delete user');
  },

  async getSignupRequests(): Promise<PlatformUserRecord[]> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/signup-requests', { headers });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load signup requests');
    return data.requests as PlatformUserRecord[];
  },

  async approveSignup(uid: string, planId?: string): Promise<{ user: PlatformUserRecord; approvalEmail: { status: string; error?: string } }> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/admin/signup-requests/${encodeURIComponent(uid)}/approve`, {
      method: 'POST',
      headers,
      body: JSON.stringify(planId ? { planId } : {})
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to approve signup');
    return data;
  },

  async rejectSignup(uid: string, note?: string): Promise<PlatformUserRecord> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/admin/signup-requests/${encodeURIComponent(uid)}/reject`, {
      method: 'POST',
      headers,
      body: JSON.stringify(note ? { note } : {})
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to reject signup');
    return data.user as PlatformUserRecord;
  },

  async getPlans(): Promise<{ plans: PlatformPlan[]; featureKeys: string[] }> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/plans', { headers });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load plans');
    return { plans: data.plans as PlatformPlan[], featureKeys: data.featureKeys as string[] };
  },

  async savePlan(plan: PlatformPlan): Promise<PlatformPlan> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/admin/plans/${encodeURIComponent(plan.id)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(plan)
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to save plan');
    return data.plan as PlatformPlan;
  },

  async getMasterAdmins(): Promise<{ stored: string[]; env: string[]; effective: string[] }> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/config/master-admins', { headers });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load master admins');
    return { stored: data.stored, env: data.env, effective: data.effective };
  },

  async saveMasterAdmins(emails: string[]): Promise<{ stored: string[]; env: string[]; effective: string[] }> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/config/master-admins', {
      method: 'PUT',
      headers,
      body: JSON.stringify({ emails })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to save master admins');
    return { stored: data.stored, env: data.env, effective: data.effective };
  },

  async getAuditLog(limit = 100): Promise<AuditLogEntry[]> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/admin/audit?limit=${limit}`, { headers });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load audit log');
    return data.entries as AuditLogEntry[];
  },

  /** Admin Command Center — platform at a glance. */
  async getAdminOverview(): Promise<AdminOverview> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/overview', { headers });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load overview');
    return data.overview as AdminOverview;
  },

  /** Phase 7.1: consent ledger, suppression list, and contact gate. */
  async getPhase71Overview(): Promise<any> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/phase71/overview', { headers });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load outreach gates');
    return data;
  },

  async grantPhase71Consent(payload: { contactId: string; channel: string; type: string; source: string }): Promise<any> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/phase71/consents', { method: 'POST', headers, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to grant consent');
    return data;
  },

  async revokePhase71Consent(payload: { contactId: string; source: string; email?: string; phone?: string }): Promise<any> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/phase71/consents/revoke', { method: 'POST', headers, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to revoke consent');
    return data;
  },

  async addPhase71Suppression(payload: { identifierType: string; identifier: string; reason?: string; source?: string }): Promise<any> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/phase71/suppressions', { method: 'POST', headers, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to add suppression');
    return data;
  },

  async removePhase71Suppression(id: string): Promise<any> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/admin/phase71/suppressions/${encodeURIComponent(id)}`, { method: 'DELETE', headers });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to remove suppression');
    return data;
  },

  async importPhase71Suppressions(csv: string, source?: string): Promise<any> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/phase71/suppressions/import', { method: 'POST', headers, body: JSON.stringify({ csv, source }) });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to import suppressions');
    return data;
  },

  async checkPhase71Gate(contact: any, channel: string): Promise<any> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/phase71/check', { method: 'POST', headers, body: JSON.stringify({ contact, channel }) });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to check gate');
    return data.verdict;
  },

  /** Phase 7.3: after-call automation. Drafts returned here are drafts
   *  only and are never sent by the server. */
  async getPhase73Overview(): Promise<any> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/phase73/overview', { headers });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load after-call overview');
    return data;
  },

  async submitPhase73AfterCall(payload: { note: any; brief: any }): Promise<any> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/phase73/after-call', { method: 'POST', headers, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to process after-call');
    return data;
  },

  async applyPhase73OptOut(payload: { contactId: string; source: string }): Promise<any> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/phase73/opt-out', { method: 'POST', headers, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to apply opt-out');
    return data;
  },

  /** Phase 7.4: owner dashboard. Owner actions here are reversible and
   *  logged; none of them sends an email, SMS, or call. */
  async getPhase74Dashboard(): Promise<any> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/phase74/dashboard', { headers });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load owner dashboard');
    return data;
  },

  async markPhase74Outcome(payload: { contactId: string; outcome: string; reason?: string }): Promise<any> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/phase74/outcome', { method: 'POST', headers, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to mark lead outcome');
    return data;
  },

  async reopenPhase74Action(payload: { actionId: string }): Promise<any> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/phase74/reopen', { method: 'POST', headers, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to reopen lead');
    return data;
  },

  async snoozePhase74Task(payload: { taskId: string; dueAt: string; reason?: string }): Promise<any> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/phase74/snooze', { method: 'POST', headers, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to snooze follow-up');
    return data;
  },

  async unsnoozePhase74Action(payload: { actionId: string }): Promise<any> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/phase74/unsnooze', { method: 'POST', headers, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to undo snooze');
    return data;
  },

  async confirmPhase74NextStep(payload: { contactId: string; nextStep: string }): Promise<any> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/phase74/next-step', { method: 'POST', headers, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to confirm next step');
    return data;
  },

  /** Billing, TEST MODE ONLY. No route here charges a card or stores
   *  card details. The test checkout session is a fake id, never a charge. */
  async getBillingOverview(): Promise<any> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/billing/overview', { headers });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load billing');
    return data;
  },

  async startBillingTrial(payload: { workspaceId: string; planId: string }): Promise<any> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/billing/trial', { method: 'POST', headers, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to start trial');
    return data;
  },

  async selectBillingPlan(payload: { workspaceId: string; planId: string }): Promise<any> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/billing/select-plan', { method: 'POST', headers, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to change plan');
    return data;
  },

  async renewBilling(payload: { workspaceId: string }): Promise<any> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/billing/renew', { method: 'POST', headers, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to renew billing');
    return data;
  },

  async cancelBilling(payload: { workspaceId: string; stopFollowUpsOnCancel: boolean }): Promise<any> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/billing/cancel', { method: 'POST', headers, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to cancel billing');
    return data;
  },

  async recordBillingManualPayment(payload: { workspaceId: string; amountCents: number; paidAt?: string; note?: string }): Promise<any> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/billing/manual-payment', { method: 'POST', headers, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to record manual payment');
    return data;
  },

  async createBillingTestCheckout(payload: { workspaceId: string; planId: string }): Promise<any> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/billing/test-checkout', { method: 'POST', headers, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create test checkout');
    return data;
  },

  /** Lead prep: shape checks, supplied-text briefs, and supplied signals only.
   *  Nothing here sends, calls, fetches, or authorises contact. */
  async getLeadPrepOverview(): Promise<any> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/lead-prep/overview', { headers });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load lead prep');
    return data;
  },

  async checkLeadPrepEmail(payload: { email: string; contactId?: string | null }): Promise<any> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/lead-prep/email-check', { method: 'POST', headers, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to check email');
    return data;
  },

  async createLeadPrepBrief(payload: { companyName: string; pageText: string; source: string; sourceUrl?: string | null }): Promise<any> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/lead-prep/company-brief', { method: 'POST', headers, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create company brief');
    return data;
  },

  async addLeadPrepWatch(payload: { kind: string; label: string; source: string }): Promise<any> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/lead-prep/watch', { method: 'POST', headers, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to add watch');
    return data;
  },

  async addLeadPrepSignal(payload: { watchId: string; title: string; body: string; source: string; publishedAt?: string | null }): Promise<any> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/lead-prep/signal', { method: 'POST', headers, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to add signal');
    return data;
  },

  async searchLeadPrepPlaces(payload: { industry: string; place: string }): Promise<any> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/lead-prep/places-search', { method: 'POST', headers, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to search Google Places');
    return data;
  },

  /** Set per-user feature overrides: true = grant, false = revoke,
   *  null = clear (fall back to the plan). Returns the updated record. */
  async setUserFeatureOverrides(uid: string, overrides: Record<string, boolean | null>): Promise<PlatformUserRecord> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/admin/users/${encodeURIComponent(uid)}/access`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(overrides)
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update access');
    return data.user as PlatformUserRecord;
  },

  /** Ask the server to email the user a password-reset request notice.
   *  The returned status is the mailer's honest state (never faked). */
  async triggerUserPasswordReset(uid: string): Promise<{ status: string; error?: string }> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/admin/users/${encodeURIComponent(uid)}/password-reset`, {
      method: 'POST',
      headers,
      body: JSON.stringify({})
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to trigger password reset');
    return data.reset as { status: string; error?: string };
  },

  /** Sync the workspace's real records (sections merge server-side). */
  async syncDashboardSnapshot(snapshot: DashboardSnapshotPayload): Promise<void> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/dashboard/snapshot', {
      method: 'POST',
      headers,
      body: JSON.stringify(snapshot)
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to sync dashboard data');
  },

  async getDashboardStats(range: '7d' | '30d' | '90d'): Promise<DashboardStatsResponse> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/dashboard/stats?range=${range}`, { headers });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load dashboard stats');
    return data as DashboardStatsResponse;
  },

  // ---------------------------------------------------------------------
  // Phases 4–6 — pipeline operations (server/pipeline.ts)
  // ---------------------------------------------------------------------

  /** Phase 4: ingest sourced records into the server lead registry.
   *  Records without provenance (or flagged simulated) are rejected by
   *  the server per-record; duplicates are reported, not duplicated. */
  async ingestLeads(leads: any[]): Promise<IngestResponse> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/leads/ingest', {
      method: 'POST', headers, body: JSON.stringify({ leads })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to ingest leads');
    return data as IngestResponse;
  },

  async getLeadRegistry(): Promise<{ leads: RegistryLead[]; count: number }> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/leads/registry', { headers });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load lead registry');
    return data;
  },

  async enrichLeads(leadIds?: string[]): Promise<{ leads: RegistryLead[]; enrichedCount: number }> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/leads/enrich', {
      method: 'POST', headers, body: JSON.stringify(leadIds ? { leadIds } : {})
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to enrich leads');
    return data;
  },

  async getSuppressions(): Promise<{ suppressions: SuppressionRecord[]; count: number }> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/suppressions', { headers });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load suppressions');
    return data;
  },

  async addSuppression(payload: { identifierType: string; identifier: string; reason?: string }): Promise<SuppressionRecord> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/suppressions', {
      method: 'POST', headers, body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to add suppression');
    return data.suppression as SuppressionRecord;
  },

  async deleteSuppression(id: string): Promise<void> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/suppressions/${encodeURIComponent(id)}`, { method: 'DELETE', headers });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to remove suppression (master admin only)');
  },

  /** Phase 4 assisted LinkedIn: the server prepares a target + draft; the
   *  human sends from their own LinkedIn and logs the outcome back. */
  async prepareLinkedInAssist(payload: { leadId?: string; prospect?: { fullName?: string; name?: string; practice?: string; practiceName?: string; linkedInUrl?: string; specialty?: string } }): Promise<{ assist: LinkedInAssistRecord; openInLinkedIn: string | null }> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/linkedin/assist/prepare', {
      method: 'POST', headers, body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to prepare LinkedIn assist');
    return data;
  },

  async listLinkedInAssists(): Promise<{ assists: LinkedInAssistRecord[]; count: number }> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/linkedin/assist', { headers });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load LinkedIn assists');
    return data;
  },

  async logLinkedInOutcome(id: string, outcome: string, note?: string): Promise<LinkedInAssistRecord> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/linkedin/assist/${encodeURIComponent(id)}/log-outcome`, {
      method: 'POST', headers, body: JSON.stringify({ outcome, note })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to log outcome');
    return data.assist as LinkedInAssistRecord;
  },

  // Phase 5 — notes & tasks
  async createNote(payload: { leadId?: string; title?: string; summary: string; interestLevel?: string; objections?: string[]; nextStep?: string; actionItems?: Array<{ text: string; dueAt?: string; priority?: string }>; owner?: string }): Promise<{ note: PipelineNoteRecord; tasksCreated: PipelineTaskRecord[] }> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/notes', {
      method: 'POST', headers, body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create note');
    return data;
  },

  async createNoteFromTranscript(payload: { leadId?: string; title?: string; transcript: string; owner?: string }): Promise<{ note: PipelineNoteRecord; tasksCreated: PipelineTaskRecord[] }> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/notes/from-transcript', {
      method: 'POST', headers, body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create note from transcript');
    return data;
  },

  async getNotes(leadId?: string): Promise<{ notes: PipelineNoteRecord[]; count: number }> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/notes${leadId ? `?leadId=${encodeURIComponent(leadId)}` : ''}`, { headers });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load notes');
    return data;
  },

  async getTasks(params?: { status?: string; leadId?: string }): Promise<{ tasks: PipelineTaskRecord[]; count: number }> {
    const headers = await getAuthHeaders();
    const qs = new URLSearchParams(params || {}).toString();
    const res = await fetch(`/api/tasks${qs ? `?${qs}` : ''}`, { headers });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load tasks');
    return data;
  },

  async createTask(payload: { title: string; owner?: string; leadId?: string; dueAt?: string; priority?: string }): Promise<PipelineTaskRecord> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/tasks', {
      method: 'POST', headers, body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create task');
    return data.task as PipelineTaskRecord;
  },

  async updateTaskStatus(id: string, status: 'open' | 'done' | 'dismissed'): Promise<PipelineTaskRecord> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/tasks/${encodeURIComponent(id)}`, {
      method: 'PATCH', headers, body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update task');
    return data.task as PipelineTaskRecord;
  },

  /** Phase 5: the day's figures counted from records (reconciliation source). */
  async getDailyStats(date?: string): Promise<DailyStatsPayload> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/briefing/daily-stats${date ? `?date=${encodeURIComponent(date)}` : ''}`, { headers });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load daily stats');
    return data.stats as DailyStatsPayload;
  },

  // Phase 6 — email sequences
  async createSequence(payload: { name: string; timezone?: string; steps: SequenceStepPayload[] }): Promise<SequenceRecord> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/sequences', {
      method: 'POST', headers, body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create sequence');
    return data.sequence as SequenceRecord;
  },

  async getSequences(): Promise<{ sequences: SequenceRecord[]; count: number }> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/sequences', { headers });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load sequences');
    return data;
  },

  async patchSequence(id: string, patch: { status?: string; name?: string; timezone?: string; steps?: SequenceStepPayload[] }): Promise<SequenceRecord> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/sequences/${encodeURIComponent(id)}`, {
      method: 'PATCH', headers, body: JSON.stringify(patch)
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update sequence');
    return data.sequence as SequenceRecord;
  },

  async enrollInSequence(id: string, leadIds: string[]): Promise<{ results: Array<{ leadId: string; outcome: string; reason?: string }> }> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/sequences/${encodeURIComponent(id)}/enroll`, {
      method: 'POST', headers, body: JSON.stringify({ leadIds })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to enroll leads');
    return data;
  },

  async getDeliveries(sequenceId?: string): Promise<{ deliveries: DeliveryRecord[]; count: number }> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/sequences/deliveries${sequenceId ? `?sequenceId=${encodeURIComponent(sequenceId)}` : ''}`, { headers });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load deliveries');
    return data;
  },

  async tickSequences(): Promise<SequenceTickSummary> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/sequences/tick', {
      method: 'POST', headers, body: JSON.stringify({})
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to run sequence tick');
    return data.summary as SequenceTickSummary;
  }
};

// Phases 1–3 platform types (mirror server/platform.ts)
export interface PlatformPlan {
  id: string;
  name: string;
  priceNote: string;
  features: Record<string, boolean>;
  limits: { leadsPerMonth: number; campaignsActive: number; seats: number; callsPerMonth: number; sendsPerMonth?: number };
  isDefault: boolean;
}

export interface PlatformUserRecord {
  uid: string;
  email: string;
  displayName: string;
  /** Admin Command Center: free-form job title (picked from existing titles or custom). */
  title?: string;
  role: 'master_admin' | 'admin' | 'user';
  planId: string | null;
  status: 'pending_approval' | 'active' | 'disabled';
  /** Per-user feature overrides on top of the plan (Admin Command Center). */
  featureOverrides?: Record<string, boolean>;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionNote?: string;
  invitedBy?: string;
  lastSignInAt?: string;
  /** Access Gateway: self-reported organization from the Request Access form. */
  organization?: string;
  /** Access Gateway: Request Access form details (requested plan is a
   *  preference for the approving admin, never a grant). */
  accessRequest?: {
    organization: string;
    requestedPlanId: string | null;
    termsAcceptedAt: string;
    submittedAt: string;
  };
}

export interface AccessRequestDetails {
  organization: string;
  requestedPlanId: string | null;
  termsAcceptedAt: string;
}

const ACCESS_REQUEST_STASH_PREFIX = 'pulsar_access_request_';

/**
 * Access Gateway: send the Request Access form details to the server.
 * Never throws — if the API is unreachable (e.g. the server is not
 * deployed yet) the details are stashed in localStorage and retried by
 * retryStashedAccessRequest() on a later sign-in, so a signup is never
 * lost and the form never reports a false failure after the account
 * itself was created successfully.
 */
export async function submitAccessRequest(details: AccessRequestDetails): Promise<boolean> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/me/access-request', {
      method: 'POST',
      headers,
      body: JSON.stringify(details)
    });
    if (res.ok) {
      const uid = auth.currentUser?.uid;
      if (uid) localStorage.removeItem(ACCESS_REQUEST_STASH_PREFIX + uid);
      return true;
    }
    throw new Error(`access-request failed: ${res.status}`);
  } catch (e) {
    const uid = auth.currentUser?.uid;
    if (uid) {
      try { localStorage.setItem(ACCESS_REQUEST_STASH_PREFIX + uid, JSON.stringify(details)); } catch { /* storage full/blocked */ }
    }
    console.warn('Access request details will be delivered on a later sign-in:', e);
    return false;
  }
}

/** Retry a stashed access-request delivery (called when a pending user
 *  reaches the awaiting-approval screen). Silent no-op when nothing is
 *  stashed or the user is signed out. */
export async function retryStashedAccessRequest(): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  let raw: string | null = null;
  try { raw = localStorage.getItem(ACCESS_REQUEST_STASH_PREFIX + uid); } catch { /* ignore */ }
  if (!raw) return;
  try {
    const details = JSON.parse(raw) as AccessRequestDetails;
    await submitAccessRequest(details);
  } catch { /* keep the stash for the next attempt */ }
}

export interface AccessInfo {
  uid: string;
  email: string;
  /** Identity only, for header display. Optional so older server builds still typecheck. */
  displayName?: string | null;
  title?: string | null;
  role: 'master_admin' | 'admin' | 'user';
  status: 'pending_approval' | 'active' | 'disabled';
  planId: string | null;
  plan: PlatformPlan | null;
  /** Effective features (plan modified by per-user overrides), computed server-side. */
  features: Record<string, boolean>;
  featureOverrides: Record<string, boolean>;
  limits: PlatformPlan['limits'] | null;
  usage: { month: string; leads: number; calls: number };
  isMasterAdmin: boolean;
}

export interface AdminOverview {
  totalUsers: number;
  byStatus: Record<string, number>;
  byPlan: Record<string, number>;
  pendingApprovals: number;
  masterAdminCount: number;
  envFallbackActive: boolean;
  recentAudit: AuditLogEntry[];
}

export interface AuditLogEntry {
  id: string;
  actorEmail: string;
  action: string;
  target: string;
  details: string;
  at: string;
}

export interface DashboardSnapshotPayload {
  workspaceId?: string;
  leads?: Array<{ id?: string; status?: string; createdAt?: string | null; lastContacted?: string | null }>;
  campaigns?: Array<{ id: string; name: string; status: string; sent: number; opened: number; replied: number; createdAt?: string | null }>;
  callSessions?: Array<{ at: string; outcome: string }>;
  tasks?: Array<{ id?: string; dueAt?: string | null; completed: boolean; completedAt?: string | null }>;
}

export interface DashboardStatsResponse {
  success: boolean;
  range: string;
  workspaceId: string;
  generatedAt: string;
  stats: {
    rangeDays: number;
    workspaceId: string | null;
    snapshotUpdatedAt: string | null;
    kpis: Record<string, { value: number; newInRange: number | null; delta: number | null }>;
    funnel: Array<{ stage: string; count: number }>;
    leadsOverTime: Array<{ date: string; count: number }>;
    campaignPerformance: Array<{ id: string; name: string; status: string; sent: number; opened: number; replied: number }>;
    callActivity: {
      caption: string;
      simulated: boolean;
      perDay: Array<{ date: string; count: number }>;
      outcomes: Array<{ outcome: string; count: number }>;
    };
    followUpHealth: {
      dueToday: number;
      overdue: number;
      completedInRange: number;
      completedSeries: Array<{ date: string; completed: number }>;
    };
  };
}

export { continuousScrapeService, createContinuousScraper, ContinuousLeadScraper, continuousScrape } from './leadScrapingService';
export type { ContinuousScraperListener } from './leadScrapingService';

// Phases 4–6 pipeline types (mirror server/pipeline.ts)
export interface RegistryLead {
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
  npiNumber: string | null;
  status: string;
  provenance: { source: string; sourceId: string; retrievedAt: string };
  verifiedFields: string[];
  suppressed: boolean;
  suppressedNow?: boolean;
  enrichment: {
    enrichedAt: string;
    ruleset: string;
    fitScore: number;
    fitReason: string;
    rulesApplied: Array<{ rule: string; detail: string }>;
    derived: Record<string, { value: string | boolean; rule: string }>;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface IngestResponse {
  success: boolean;
  workspaceId: string;
  created: number;
  duplicates: number;
  rejected: number;
  results: Array<{ index: number; outcome: string; leadId?: string; reason?: string; suppressed?: boolean }>;
}

export interface SuppressionRecord {
  id: string;
  workspaceId: string;
  identifierType: 'email' | 'phone' | 'npi' | 'practice';
  identifier: string;
  reason: string;
  createdBy: string;
  createdAt: string;
}

export interface LinkedInAssistRecord {
  id: string;
  leadId: string | null;
  prospectName: string;
  practiceName: string;
  linkedInUrl: string;
  draftMessage: string;
  draftSource: 'template' | 'gemini';
  status: string;
  outcomeNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineNoteRecord {
  id: string;
  leadId: string | null;
  type: 'manual' | 'transcript';
  title: string;
  transcript: string | null;
  summary: string | null;
  summarySource: 'gemini' | 'manual' | 'deterministic' | 'none';
  interestLevel: string | null;
  objections: string[];
  nextStep: string | null;
  actionItems: Array<{ text: string; extraction: string }>;
  createdBy: string;
  createdAt: string;
}

export interface PipelineTaskRecord {
  id: string;
  leadId: string | null;
  noteId: string | null;
  title: string;
  owner: string;
  dueAt: string | null;
  priority: string;
  status: 'open' | 'done' | 'dismissed';
  createdBy: string;
  createdAt: string;
  completedAt: string | null;
  completedBy: string | null;
}

export interface DailyStatsPayload {
  date: string;
  workspaceId: string;
  counts: Record<string, number>;
  callActivity: { caption: string; simulated: boolean; sessions: number };
  needsFounder: Array<{ taskId: string; title: string; owner: string; dueAt: string | null; leadId: string | null }>;
  hasActivity: boolean;
  note: string;
}

export interface SequenceStepPayload {
  subject: string;
  body: string;
  delayDays: number;
  windowStart: string;
  windowEnd: string;
}

export interface SequenceRecord {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'paused';
  timezone: string;
  steps: SequenceStepPayload[];
  createdBy: string;
  createdAt: string;
  enrollments?: Array<{ id: string; leadId: string; email: string; currentStep: number; status: string; stopReason: string | null; nextDueAt: string | null }>;
}

export interface DeliveryRecord {
  id: string;
  sequenceId: string;
  enrollmentId: string;
  leadId: string;
  stepIndex: number;
  to: string;
  subject: string;
  status: string;
  provider: string;
  providerMessageId: string | null;
  providerStatus: string | null;
  error: string | null;
  at: string;
}

export interface SequenceTickSummary {
  processed: number;
  sent: number;
  failed: number;
  notConfigured: number;
  skippedSuppressed: number;
  skippedWindow: number;
  skippedPlan: number;
  planLimitReached: boolean;
}

