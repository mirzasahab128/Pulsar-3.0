export type LeadTag = 'Target' | 'Do Not Call' | 'Follow-up Needed' | 'VIP Practice' | 'High Denial Rate' | string;

export interface EmailTemplate {
  id: string;
  name: string;
  category: 'Denial Recovery' | 'Staffing & Prior Auth' | 'Underpayments' | 'Intro / Coffee' | 'Audit Invitation' | 'Custom';
  subject: string;
  body: string;
  tone?: 'Consultative' | 'Direct' | 'Urgent' | 'Casual';
  description?: string;
  isCustom?: boolean;
}

export interface RCMLead {
  id: string;
  workspaceId?: string;
  practiceName: string;
  doctorName: string;
  title: string;
  specialty: string;
  practiceSize: string;
  phone: string;
  email: string;
  address: string;
  city?: string;
  state: string;
  lat?: number;
  lng?: number;
  ehrSystem: string;
  monthlyClaimVolume: string;
  painPoints: string[];
  tags?: LeadTag[];
  linkedInProfile?: string;
  adminContact?: string;
  source: string;
  status: 'Ready for Call' | 'Calling' | 'Transferred to Manager' | 'Audit Scheduled' | 'Follow-up' | 'Voicemail' | 'Not Interested';
  // Phases 1–3: stamped when a lead enters the app (existing records have
  // none — dashboard series only bucket dated records, never backfilled).
  createdAt?: string;
  lastContacted?: string;
  // Phase 4: provenance for sourced records (CMS NPI Registry etc.) and
  // the demo flag. Registry leads always carry provenance; demo records
  // are simulated and are refused by the server registry.
  provenance?: { source: string; sourceId?: string; retrievedAt?: string };
  simulated?: boolean;
  callNotesId?: string;
  auditNotes?: string;
  lawfulBasis?: string;
  verified?: boolean;
  npiNumber?: string;
  lastVerifiedDate?: string;
}

export interface LinkedInProspect {
  id: string;
  fullName: string;
  headline: string;
  practice: string;
  specialty?: string;
  location: string;
  experience: string;
  connectionDegree: string;
  linkedInUrl: string;
  email: string;
  phone: string;
  tailoredIcebreaker: string;
  inMailDraft: string;
}

export interface TranscriptMessage {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
  sentiment?: 'positive' | 'neutral' | 'skeptical' | 'objection';
}

export interface ActionItem {
  id: string;
  task: string;
  due: string;
  priority: 'Urgent' | 'High' | 'Medium' | 'Low';
  category: 'Audit Proposal' | 'Email Followup' | 'EHR Demo' | 'Contract' | 'Phone Call';
  completed: boolean;
  // Phases 1–3: stamped when the task is completed (follow-up health series).
  completedAt?: string;
  leadId?: string;
  practiceName?: string;
  isScheduledCall?: boolean;
  scheduledDateTime?: string;
  doctorName?: string;
  phone?: string;
  notes?: string;
}

export interface MeetingNote {
  id: string;
  leadId: string;
  workspaceId?: string;
  practiceName: string;
  doctorName: string;
  date: string;
  duration: string;
  executiveSummary: string;
  qualificationStatus: 'Hot Lead' | 'Warm Opportunity' | 'Follow-up Required' | 'Not Qualified';
  statedBillingPainPoints: string[];
  currentSoftwareAndStaffing: string;
  commercialTermsDiscussed: string;
  decisionMakersIdentified: string;
  actionItems: ActionItem[];
  recommendedFollowUpStrategy: string;
  transcript: TranscriptMessage[];
  crmSyncStatus?: 'Synced' | 'Pending';
  crmSyncTimestamp?: string;
  crmRecordId?: string;
  sentimentScore?: number; // 1-10 automated AI sentiment score
  sentimentGrade?: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  sentimentTone?: 'Enthusiastic' | 'Receptive' | 'Inquisitive' | 'Hesitant' | 'Guarded' | 'Unresponsive';
  sentimentReasoning?: string;
  sentimentBuyingSignals?: string[];
}

export interface CrmSyncRecord {
  id: string;
  crmSystem: 'Salesforce Health Cloud' | 'HubSpot Healthcare' | 'AthenaHealth PM' | 'Custom REST API (JSON Log)';
  syncedAt: string;
  practiceName: string;
  doctorName: string;
  qualificationStatus: string;
  callDuration: string;
  actionItemsCount: number;
  status: 'SUCCESS' | 'QUEUED';
  leadId: string;
  noteId: string;
  payload: any;
}

export interface DailyStats {
  callsPlaced: number;
  humanConnects: number;
  warmTransfersBridged: number;
  auditsBooked: number;
  leadsScraped: number;
  pipelineAdded: string;
  denialAuditValue: string;
  avgSentimentScore?: number;
}

export interface WarmTransferRecord {
  id: string;
  leadName: string;
  practiceName: string;
  phone: string;
  bridgedAt: string;
  durationWithManager: string;
  triggerReason: string;
  outcome: string;
}

export interface ManagerSettings {
  managerName: string;
  managerPhone: string;
  managerEmail: string;
  companyName: string;
  transferMode: 'instant_pickup' | 'warm_intro_first';
  speechRate: number;
  voiceGender: 'female' | 'male';
  autoSchedule4PMBriefing: boolean;
  dailyBriefingEmail: string;
  telephonyCarrier: 'twilio_sip' | 'vapi_ai' | 'bland_ai' | 'browser_webrtc' | 'whatsapp_voip';
  sipEndpointUrl: string;
  valuePropCleanClaimRate: string;
  valuePropRevenueBoost: string;
  routeToWhatsApp: boolean;
  whatsAppNumber: string;
  whatsAppCountryCode?: string;
  autoOpenWhatsAppOnTransfer?: boolean;
  dailySummarySchedulerEnabled: boolean;
  dailySummaryScheduledTimePST: string;
  dailySummaryRecipientEmail: string;
  dailySummaryIncludeCallPerformance: boolean;
  dailySummaryIncludeAuditPipeline: boolean;
  dailySummaryLastDispatched?: string;
  // CRM Webhook Integration for LinkedIn Outreach
  crmWebhookEnabled?: boolean;
  crmWebhookUrl?: string;
  crmWebhookProvider?: 'salesforce' | 'hubspot' | 'pipedrive' | 'apollo' | 'custom_zapier';
  crmWebhookAuthToken?: string;
  crmWebhookSyncAcceptedOnly?: boolean;
  crmWebhookLastSyncedAt?: string;
  crmWebhookLastPayload?: any;
}

export interface LinkedInConnectedAccount {
  id: string;
  accountName: string;
  profileUrl: string;
  headline: string;
  status: 'connected' | 'syncing' | 'paused' | 'disconnected';
  dailyLimit: number;
  requestsSentToday: number;
  totalConnections: number;
  acceptanceRate: number;
  lastSyncTimestamp: string;
  connectedEmail: string;
  avatarUrl?: string;
  cookieOrSessionActive: boolean;
}

export interface LinkedInOutreachTemplate {
  id: string;
  name: string;
  category: 'Clean Claims' | 'Free Audit Offer' | 'Executive Peer' | 'Denial Overturns' | 'Custom';
  body: string;
  active: boolean;
  sentCount: number;
  acceptedCount: number;
  tags?: string[];
}

export interface LinkedInSmartFilterResult {
  isDecisionMaker: boolean;
  // null when the server answered with its labeled heuristic (no Gemini key):
  // a band, not a fabricated precise percentage.
  confidence: number | null;
  confidenceBand?: string;
  source?: string;
  authorityLevel: 'High (Direct Signer)' | 'Moderate (Key Influencer)' | 'Low (Non-Buyer)';
  reasoning: string;
  verifiedAt: string;
}

export interface LinkedInQueueItem {
  id: string;
  prospect: LinkedInProspect;
  // Phase 4: 'prepared' = Pulsar prepared the draft (assisted flow — the
  // human sends from their own LinkedIn); 'sent' now means the human
  // confirmed they sent it themselves; 'replied' logged via outcome.
  status: 'queued' | 'ai_verifying' | 'approved' | 'sending' | 'prepared' | 'sent' | 'accepted' | 'replied' | 'rejected_by_ai';
  assistId?: string;
  addedAt: string;
  sentAt?: string;
  templateId?: string;
  templateName?: string;
  personalizedNote?: string;
  smartFilter?: LinkedInSmartFilterResult;
  // Set when smart filtering failed for this prospect: the item was NOT
  // verified and must not be treated as approved. It stays 'queued'.
  filterError?: string;
  scheduledTimeSlot?: string; // e.g. "08:30", "11:45", "14:15", "17:00"
  batchName?: string;
  crmSynced?: boolean;
  crmSyncedAt?: string;
}

export interface LinkedInBatchTimeSlot {
  id: string;
  timePST: string; // e.g. "08:30"
  label: string; // e.g. "Morning Executive Clinic Review (High Open Rate)"
  windowType: 'peak_morning' | 'lunch_admin_break' | 'afternoon_wrap' | 'evening_commute';
  targetAllocation: number; // e.g. 15 requests
  activityScore: number; // 0-100 engagement index
  notes: string;
  enabled: boolean;
}

export interface LinkedInSearchCriteria {
  nicheSpecialty: string;
  targetRole: string;
  targetLocation: string;
  practiceSize: string;
  dailyLimit: number;
  enableSmartFiltering: boolean;
}

// Continuous Lead Scraping & Perpetual Pipeline Types
export type ContinuousScrapeStatus = 'Idle' | 'Queued' | 'Scraping' | 'Processing' | 'Completed' | 'Error' | 'Paused';

export interface ScrapeBatchInfo {
  batchId: string;
  batchNumber: number;
  status: ContinuousScrapeStatus;
  leadsCount: number;
  specialty?: string;
  state?: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
  leads: RCMLead[];
}

export interface ContinuousScrapeConfig {
  batchSize: number;
  intervalDelayMs: number;
  targetSpecialty?: string;
  targetState?: string;
  query?: string;
  autoProcessDelayMs?: number;
  maxBatches?: number;
}

// Spatial UI Navigation Module IDs
export type PulsarSpatialModule = 
  | 'command_center'
  | 'ai_assistant'
  | 'activity_feed'
  | 'calendar'
  | 'leads'
  | 'prospects'
  | 'research'
  | 'qualification'
  | 'territory_maps'
  | 'network'
  | 'campaigns'
  | 'email_outreach'
  | 'call_studio'
  | 'meeting_notes'
  | 'linkedin'
  | 'conversations'
  | 'reminders'
  | 'google_tasks'
  | 'google_forms'
  | 'ai_agents'
  | 'workflows'
  | 'tasks_approvals'
  | 'pipeline'
  | 'conversion_reports'
  | 'agent_performance'
  | 'briefing'
  | 'integrations'
  | 'admin_access'
  | 'pipeline_ops'
  | 'permissions'
  | 'workspaces'
  | 'settings';

export type AgentAutonomyLevel = 'observe' | 'recommend' | 'prepare' | 'execute_approval' | 'authorized_automation';
export type AgentRuntimeStatus = 'active' | 'idle' | 'paused' | 'failed' | 'disconnected';

export interface PulsarAIAgent {
  id: string;
  name: string;
  role: string;
  description: string;
  autonomyLevel: AgentAutonomyLevel;
  status: AgentRuntimeStatus;
  channel: string;
  currentTask: string;
  tasksCompleted: number;
  pendingApprovals: number;
  lastActivity: string;
  healthScore: number;
  confidenceScore: number;
  errorCount: number;
  lastError?: string;
}

export type CampaignStatus = 'draft' | 'review' | 'approved' | 'scheduled' | 'running' | 'paused' | 'completed';

export interface OutreachCampaign {
  id: string;
  name: string;
  niche: string;
  channels: ('email' | 'linkedin' | 'voice' | 'whatsapp')[];
  status: CampaignStatus;
  targetCount: number;
  deliveredCount: number;
  openRate: number;
  replyRate: number;
  meetingsBooked: number;
  createdAt: string;
  scheduledFor?: string;
  description: string;
}

export interface PulsarActivityItem {
  id: string;
  timestamp: string;
  type: 'call' | 'lead_scraped' | 'warm_transfer' | 'linkedin_invite' | 'email_sent' | 'meeting_booked' | 'agent_action';
  title: string;
  description: string;
  actor: string;
  channel?: string;
  status?: string;
}

export interface IntegrationStatus {
  id: string;
  name: string;
  category: 'telephony' | 'messaging' | 'database' | 'ai' | 'email' | 'social' | 'registry' | 'productivity';
  status: 'connected' | 'configured' | 'action_required' | 'disconnected';
  description: string;
  requiredCredentials: string[];
  docsUrl?: string;
  lastHeartbeat?: string;
}

