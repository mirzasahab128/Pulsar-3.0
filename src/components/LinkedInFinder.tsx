import React, { useState } from 'react';
import { 
  Linkedin, 
  Search, 
  Copy, 
  Check, 
  ExternalLink, 
  Sparkles, 
  UserCheck, 
  Send, 
  Briefcase, 
  MapPin, 
  PhoneCall, 
  Mail,
  RefreshCw,
  MessageSquare,
  Sliders,
  FileText,
  CheckCheck,
  Stethoscope,
  Activity,
  Layers,
  RotateCw,
  Shuffle,
  ShieldCheck,
  User,
  Zap,
  ChevronRight,
  Settings2,
  Download,
  Calendar
} from 'lucide-react';
import { 
  LinkedInProspect, 
  RCMLead, 
  LinkedInConnectedAccount, 
  LinkedInQueueItem, 
  LinkedInOutreachTemplate 
} from '../types';
import { apiService } from '../services/api';
import { speechService } from '../utils/speech';
import { exportLinkedInQueueToCSV } from '../utils/linkedinCsvExport';
import { LinkedInDailyProgressRing } from './LinkedInDailyProgressRing';
import { LinkedInOutreachAutomator } from './LinkedInOutreachAutomator';
import { 
  LinkedInOutreachTemplateManager, 
  DEFAULT_LINKEDIN_TEMPLATES, 
  resolveTemplateVariables 
} from './LinkedInOutreachTemplateManager';
import { BatchSchedulingTimeline } from './BatchSchedulingTimeline';
import { useTheme } from '../context/ThemeContext';

interface LinkedInFinderProps {
  onDialProspect: (lead: RCMLead) => void;
  onOpenSettings?: () => void;
}

export const getProspectSalutation = (fullName: string): string => {
  const clean = fullName.split(',')[0].trim();
  if (clean.startsWith('Dr.') || clean.startsWith('Doctor')) {
    const parts = clean.split(' ');
    return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : clean;
  }
  return clean.split(' ')[0] || clean;
};

export const getProspectSpecialty = (p: LinkedInProspect): string => {
  if (p.specialty && p.specialty.trim()) return p.specialty.trim();
  const text = `${p.headline} ${p.practice}`.toLowerCase();
  if (text.includes('surg')) return 'General & Ambulatory Surgery';
  if (text.includes('cardio') || text.includes('heart')) return 'Cardiology & Vascular Medicine';
  if (text.includes('ortho') || text.includes('spine')) return 'Orthopedics & Spine Care';
  if (text.includes('derm') || text.includes('skin')) return 'Dermatology & Mohs Surgery';
  if (text.includes('path') || text.includes('lab')) return 'Pathology & Clinical Laboratory';
  if (text.includes('pediatr')) return 'Pediatrics & Primary Care';
  if (text.includes('hospital') || text.includes('health alliance')) return 'Hospital & Health Systems';
  if (text.includes('multispecialty')) return 'Multispecialty Clinics & ASC';
  return 'Medical Practice Management';
};

export interface OutreachTemplateOption {
  id: string;
  name: string;
  tag: string;
  description: string;
  generate: (name: string, specialty: string, practice: string) => string;
}

export const OUTREACH_TEMPLATES: OutreachTemplateOption[] = [
  {
    id: 'clean-claims',
    name: 'Clean Claim Rate & Denial Focus',
    tag: 'Highest Response Rate',
    description: 'Emphasizes 98%+ clean claim rates and AAPC certified specialty coders (<300 chars for LinkedIn note limit).',
    generate: (name, specialty, practice) => 
      `Hi ${name}, noticed your leadership in ${specialty} at ${practice}. We help ${specialty} practices eliminate claim denials and achieve 98%+ clean claims with certified AAPC coders. Would love to connect and exchange notes on 2026 reimbursement trends!`
  },
  {
    id: 'audit-offer',
    name: 'Free 50-Claim Audit Benchmark',
    tag: 'High Value Offer',
    description: 'Offers a complimentary zero-risk billing audit to benchmark current denial overturn rates.',
    generate: (name, specialty, practice) => 
      `Hi ${name}, given your work in ${specialty} at ${practice}, wanted to connect. We help ${specialty} businesses grow by finding the right prospects and handling outreach. Would love to connect and share a complimentary 1-page growth benchmark for ${specialty} groups.`
  },
  {
    id: 'executive-peer',
    name: 'Healthcare Executive Peer Network',
    tag: 'Relationship Building',
    description: 'Polite peer-level invitation designed for practice administrators and CMOs.',
    generate: (name, specialty, practice) => 
      `Hi ${name}, expanding my network of healthcare leaders specializing in ${specialty}. At Pulsar, we partner with groups like ${practice} to navigate complex payer rule shifts. Would love to stay connected on LinkedIn!`
  },
  {
    id: 'denial-overturns',
    name: 'Appeals & AR Recovery Angle',
    tag: 'Operational Pain Point',
    description: 'Focuses on recovering high-dollar aged AR and payer appeal backlogs.',
    generate: (name, specialty, practice) => 
      `Hi ${name}, following your work with ${practice}'s ${specialty} team. Most ${specialty} clinics battle payer appeal backlogs. Would welcome connecting on LinkedIn to share how our team overturns 78% of initial commercial denials.`
  }
];

export const LinkedInFinder: React.FC<LinkedInFinderProps> = ({ onDialProspect, onOpenSettings }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Sub-tab Navigation: 'automator' | 'batch_timeline' | 'progress_ring' | 'templates' | 'prospector'
  const [activeSubTab, setActiveSubTab] = useState<'automator' | 'batch_timeline' | 'progress_ring' | 'templates' | 'prospector'>('automator');

  // Individual Connected LinkedIn Account State
  const [connectedAccount, setConnectedAccount] = useState<LinkedInConnectedAccount>(() => {
    const saved = localStorage.getItem('pulsercm_linkedin_account');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      id: 'li-acc-1',
      accountName: 'Sarah Jenkins (VP Healthcare Business Development)',
      profileUrl: 'https://linkedin.com/in/sarah-jenkins-rcm',
      headline: 'VP of Business Development & Client Partnerships @ Pulsar',
      status: 'connected',
      dailyLimit: 50,
      requestsSentToday: 18,
      totalConnections: 3420,
      acceptanceRate: 46,
      lastSyncTimestamp: 'Today, 2:45 PM PST',
      connectedEmail: 'sarah.jenkins@pulsebilling.com',
      cookieOrSessionActive: true
    };
  });

  const [isEditAccountModalOpen, setIsEditAccountModalOpen] = useState<boolean>(false);
  const [editAccountName, setEditAccountName] = useState<string>(connectedAccount.accountName);
  const [editAccountUrl, setEditAccountUrl] = useState<string>(connectedAccount.profileUrl);
  const [editDailyLimit, setEditDailyLimit] = useState<number>(connectedAccount.dailyLimit || 50);

  // Outreach Templates State
  const [templates, setTemplates] = useState<LinkedInOutreachTemplate[]>(() => {
    const saved = localStorage.getItem('pulsercm_linkedin_templates');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return DEFAULT_LINKEDIN_TEMPLATES;
  });

  // Template Rotation State
  const [rotationEnabled, setRotationEnabled] = useState<boolean>(true);

  // Active request processing indicator
  const [isProcessingRequest, setIsProcessingRequest] = useState<boolean>(false);

  // Automation Queue State
  const [queue, setQueue] = useState<LinkedInQueueItem[]>([
    {
      id: 'queue-init-1',
      prospect: {
        id: 'li-1',
        fullName: 'Karen Abernathy, CMPE, FACHE',
        headline: 'Executive Director of Practice Operations at Lone Star Multispecialty Clinics',
        practice: 'Lone Star Multispecialty Clinics',
        specialty: 'Multispecialty & Ambulatory Surgery (ASC)',
        location: 'Dallas-Fort Worth Metroplex, TX',
        experience: '16+ years in healthcare management & clinical revenue cycle',
        connectionDegree: '2nd',
        linkedInUrl: 'https://linkedin.com/in/karen-abernathy-cmpe',
        email: 'kabernathy@lonestarclinics.com',
        phone: '(214) 749-3300',
        tailoredIcebreaker: 'Noticed Lone Star recently expanded your ambulatory surgical center operations in Plano.',
        inMailDraft: 'Hi Karen, with your recent ASC expansion, managing high-dollar surgical denials is usually the #1 revenue leak...'
      },
      status: 'accepted',
      addedAt: '10:15 AM PST',
      sentAt: '10:22 AM PST',
      templateId: 'tpl-1',
      templateName: '98%+ Clean Claim Rate & Denial Focus',
      personalizedNote: 'Hi Karen, noticed your leadership in Multispecialty & ASC at Lone Star Multispecialty Clinics. We help practices eliminate billing denials and achieve 98%+ clean claims with certified AAPC coders. Would love to connect!',
      scheduledTimeSlot: '08:30',
      batchName: 'Morning Clinic Huddle & Inbox Review',
      crmSynced: true,
      crmSyncedAt: '10:22 AM PST',
      smartFilter: {
        isDecisionMaker: true,
        confidence: 96,
        authorityLevel: 'High (Direct Signer)',
        reasoning: 'Executive Director with sole operational authority over clinic billing vendor contracts and clearinghouse integrations.',
        verifiedAt: '10:15 AM PST'
      }
    },
    {
      id: 'queue-init-2',
      prospect: {
        id: 'li-2',
        fullName: 'Dr. Michael Chen, MD, FACS',
        headline: 'Managing Partner at Bay Area Surgical Associates | Clinical Professor',
        practice: 'Bay Area Surgical Associates',
        specialty: 'General & Outpatient Robotic Surgery',
        location: 'San Jose, CA',
        experience: '20 years practicing surgical specialist & practice owner',
        connectionDegree: '2nd',
        linkedInUrl: 'https://linkedin.com/in/dr-michael-chen-surgery',
        email: 'mchen@bayareasurgeons.org',
        phone: '(408) 559-2100',
        tailoredIcebreaker: 'Saw your recent presentation on outpatient robotic surgery economics.',
        inMailDraft: 'Dr. Chen, most surgical practices lose 12-18% of earned revenue due to unbilled modifiers...'
      },
      status: 'sent',
      addedAt: '11:05 AM PST',
      sentAt: '11:12 AM PST',
      templateId: 'tpl-2',
      templateName: 'Complimentary 50-Claim Audit Offer',
      personalizedNote: 'Hi Dr. Chen, given your work in General & Outpatient Robotic Surgery at Bay Area Surgical Associates, wanted to connect. We specialize in surgical revenue cycle recovery, cutting AR to <30 days. Would love to share a free 50-claim audit.',
      scheduledTimeSlot: '11:45',
      batchName: 'Midday Administration & Charting Break',
      crmSynced: true,
      crmSyncedAt: '11:12 AM PST',
      smartFilter: {
        isDecisionMaker: true,
        confidence: 93,
        authorityLevel: 'High (Direct Signer)',
        reasoning: 'Managing Partner and physician owner with final financial and clinical vendor signing power.',
        verifiedAt: '11:05 AM PST'
      }
    },
    {
      id: 'queue-init-3',
      prospect: {
        id: 'li-3',
        fullName: 'Rachel Kowalski, CPB',
        headline: 'Director of Billing Operations & Compliance at Midwest Health Alliance',
        practice: 'Midwest Health Alliance',
        specialty: 'Hospital Network & Inpatient Billing',
        location: 'Columbus, OH',
        experience: '12 years overseeing hospital billing and revenue recovery',
        connectionDegree: '3rd',
        linkedInUrl: 'https://linkedin.com/in/rachel-kowalski-rcm',
        email: 'rkowalski@midwesthealthalliance.com',
        phone: '(614) 882-9011',
        tailoredIcebreaker: 'Impressed by your focus on payer compliance and timely filing protocols.',
        inMailDraft: 'Hi Rachel, if your team is currently battling aged AR over 90 days...'
      },
      status: 'approved',
      addedAt: '1:30 PM PST',
      templateId: 'tpl-4',
      templateName: 'Aged AR & Commercial Denial Overturns',
      personalizedNote: 'Hi Rachel, following your work with Midwest Health Alliance. Most hospital clinics battle payer appeal backlogs. Would welcome connecting to share how our team overturns 78% of commercial denials.',
      scheduledTimeSlot: '14:15',
      batchName: 'Afternoon Billing Department Checkpoint',
      smartFilter: {
        isDecisionMaker: true,
        confidence: 91,
        authorityLevel: 'Moderate (Key Influencer)',
        reasoning: 'Director of Billing Operations oversees RCM staffing and evaluates vendor claims scrubbing performance.',
        verifiedAt: '1:30 PM PST'
      }
    },
    {
      id: 'queue-init-4',
      prospect: {
        id: 'li-4',
        fullName: 'Emily Thorne, RN',
        headline: 'Staff Nurse & Triage Coordinator at Lone Star Regional Medical Center',
        practice: 'Lone Star Regional Medical Center',
        specialty: 'Clinical Nursing',
        location: 'Fort Worth, TX',
        experience: '4 years bedside and triage care',
        connectionDegree: '3rd',
        linkedInUrl: 'https://linkedin.com/in/emily-thorne-nurse',
        email: 'ethorne@lonestarregional.org',
        phone: '(817) 555-0199',
        tailoredIcebreaker: 'Dedicated triage coordinator.',
        inMailDraft: 'Hi Emily...'
      },
      status: 'rejected_by_ai',
      addedAt: '2:10 PM PST',
      templateId: 'tpl-1',
      templateName: '98%+ Clean Claim Rate & Denial Focus',
      personalizedNote: 'Hi Emily, noticed your work at Lone Star Regional...',
      smartFilter: {
        isDecisionMaker: false,
        confidence: 98,
        authorityLevel: 'Low (Non-Buyer)',
        reasoning: 'Clinical staff nurse with no involvement in practice finance, billing contracts, or revenue cycle management. Filtered to protect daily quota.',
        verifiedAt: '2:10 PM PST'
      }
    }
  ]);

  // Save account helpers
  const handleUpdateAccount = (acc: LinkedInConnectedAccount) => {
    setConnectedAccount(acc);
    localStorage.setItem('pulsercm_linkedin_account', JSON.stringify(acc));
  };

  const handleUpdateTemplates = (tpls: LinkedInOutreachTemplate[]) => {
    setTemplates(tpls);
    localStorage.setItem('pulsercm_linkedin_templates', JSON.stringify(tpls));
  };

  const handleSaveAccountModal = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: LinkedInConnectedAccount = {
      ...connectedAccount,
      accountName: editAccountName.trim() || connectedAccount.accountName,
      profileUrl: editAccountUrl.trim() || connectedAccount.profileUrl,
      dailyLimit: Math.max(1, Math.min(100, editDailyLimit))
    };
    handleUpdateAccount(updated);
    setIsEditAccountModalOpen(false);
  };

  // Prospector view state
  const [targetRole, setTargetRole] = useState<string>('Practice Administrator / Executive Director');
  const [targetState, setTargetState] = useState<string>('United States');
  const [industry, setIndustry] = useState<string>('Healthcare & Medical Practice Management');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [copiedTemplateId, setCopiedTemplateId] = useState<string | null>(null);
  const [copiedInMailId, setCopiedInMailId] = useState<string | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string>('clean-claims');

  const [prospects, setProspects] = useState<LinkedInProspect[]>([
    {
      id: 'li-1',
      fullName: 'Karen Abernathy, CMPE, FACHE',
      headline: 'Executive Director of Practice Operations at Lone Star Multispecialty Clinics | MGMA Member',
      practice: 'Lone Star Multispecialty Clinics',
      specialty: 'Multispecialty & Ambulatory Surgery (ASC)',
      location: 'Dallas-Fort Worth Metroplex, TX',
      experience: '16+ years in healthcare management & clinical revenue cycle',
      connectionDegree: '2nd',
      linkedInUrl: 'https://linkedin.com/in/karen-abernathy-cmpe',
      email: 'kabernathy@lonestarclinics.com',
      phone: '(214) 749-3300',
      tailoredIcebreaker: 'Noticed Lone Star recently expanded your ambulatory surgical center operations in Plano.',
      inMailDraft: 'Hi Karen, with your recent ASC expansion, managing high-dollar surgical denials is usually the #1 revenue leak. Our specialized billing team guarantees a 98.4% first-pass clean claim rate and reduces AR days to under 32 days. Would you be open to a complimentary 15-minute billing audit for your top 100 denials?'
    },
    {
      id: 'li-2',
      fullName: 'Dr. Michael Chen, MD, FACS',
      headline: 'Managing Partner at Bay Area Surgical Associates | Clinical Professor',
      practice: 'Bay Area Surgical Associates',
      specialty: 'General & Outpatient Robotic Surgery',
      location: 'San Jose, CA',
      experience: '20 years practicing surgical specialist & practice owner',
      connectionDegree: '2nd',
      linkedInUrl: 'https://linkedin.com/in/dr-michael-chen-surgery',
      email: 'mchen@bayareasurgeons.org',
      phone: '(408) 559-2100',
      tailoredIcebreaker: 'Saw your recent presentation on outpatient robotic surgery economics.',
      inMailDraft: 'Dr. Chen, most surgical practices lose 12-18% of earned revenue due to unbilled modifiers and payer undercoding. We provide end-to-end RCM with dedicated certified coders (AAPC) tailored to general & robotic surgery. Let me show you how we recovered $180k in aged AR for a similar 8-provider group.'
    },
    {
      id: 'li-3',
      fullName: 'Rachel Kowalski, CPB',
      headline: 'Director of Billing Operations & Compliance at Midwest Health Alliance',
      practice: 'Midwest Health Alliance',
      specialty: 'Hospital Network & Inpatient Billing',
      location: 'Columbus, OH',
      experience: '12 years overseeing hospital billing and revenue recovery',
      connectionDegree: '3rd',
      linkedInUrl: 'https://linkedin.com/in/rachel-kowalski-rcm',
      email: 'rkowalski@midwesthealthalliance.com',
      phone: '(614) 882-9011',
      tailoredIcebreaker: 'Impressed by your focus on payer compliance and timely filing protocols.',
      inMailDraft: 'Hi Rachel, if your team is currently battling aged AR over 90 days or payer appeal backlogs, we can deploy a dedicated recovery squad in 48 hours with zero software changeover. Could I send you a 1-page case study on how we slashed AR days by 24 days in 60 days?'
    }
  ]);

  const ROLES = [
    'Practice Administrator / Executive Director',
    'Chief Medical Officer (CMO)',
    'Managing Partner & Physician Owner',
    'Director of Revenue Cycle Management (RCM)',
    'Clinical Operations Manager / Clinic Lead'
  ];

  const handleSearch = async () => {
    setIsSearching(true);
    try {
      const results = await apiService.searchLinkedIn({
        targetRole,
        industry,
        state: targetState
      });
      setProspects(results);
    } catch (err) {
      console.error('LinkedIn search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const generateOutreachTemplate = (
    prospect: LinkedInProspect, 
    templateId: string = activeTemplateId
  ): string => {
    const template = OUTREACH_TEMPLATES.find(t => t.id === templateId) || OUTREACH_TEMPLATES[0];
    const name = getProspectSalutation(prospect.fullName);
    const specialty = getProspectSpecialty(prospect);
    return template.generate(name, specialty, prospect.practice);
  };

  const handleCopyOutreachTemplate = (prospect: LinkedInProspect, templateId: string = activeTemplateId) => {
    const text = generateOutreachTemplate(prospect, templateId);
    navigator.clipboard.writeText(text);
    setCopiedTemplateId(prospect.id);
    speechService.playTelephoneRing('transfer_chime');
    setTimeout(() => setCopiedTemplateId(null), 3000);
  };

  const handleCopyInMail = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedInMailId(id);
    speechService.playTelephoneRing('transfer_chime');
    setTimeout(() => setCopiedInMailId(null), 2500);
  };

  const handleConvertToCall = (prospect: LinkedInProspect) => {
    const lead: RCMLead = {
      id: `li-lead-${Date.now()}`,
      practiceName: prospect.practice,
      doctorName: prospect.fullName,
      title: prospect.headline,
      specialty: getProspectSpecialty(prospect),
      practiceSize: 'Multi-Provider Group',
      phone: prospect.phone,
      email: prospect.email,
      address: prospect.location,
      state: prospect.location.split(',')[1]?.trim() || 'US',
      ehrSystem: 'AthenaHealth / Epic',
      monthlyClaimVolume: '$500,000 / mo',
      painPoints: ['High denial rates on complex claims', 'Staffing shortages in billing office'],
      linkedInProfile: prospect.linkedInUrl,
      source: 'LinkedIn Executive Search',
      status: 'Ready for Call'
    };
    onDialProspect(lead);
  };

  const sentToday = connectedAccount.requestsSentToday || 0;
  const dailyLimit = connectedAccount.dailyLimit || 50;

  return (
    <div className="space-y-6">
      
      {/* Top Connected Account Status Dock */}
      <div className={`p-4 rounded-3xl border transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-2xl ${
        isDark 
          ? 'bg-[#111C2E]/90 border-slate-700/40 text-[#F1F5F9] shadow-xl' 
          : 'bg-white border-[#DCE5EC] text-[#172338] shadow-sm'
      }`}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 via-sky-500 to-cyan-400 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
              <Linkedin className="w-6 h-6 fill-white" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-slate-950 animate-pulse" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-sm font-black tracking-tight font-display ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {connectedAccount.accountName}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-500/30 font-bold">
                1 Account Connected
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 font-bold">
                Active Session
              </span>
            </div>
            <p className={`text-xs line-clamp-1 mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {connectedAccount.headline}
            </p>
          </div>
        </div>

        {/* Quota Progress Meter & Account Config */}
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          <div className={`px-4 py-2 rounded-2xl border flex items-center gap-3 transition-colors ${
            isDark ? 'bg-slate-900/90 border-white/5' : 'bg-slate-50 border-slate-200 shadow-sm'
          }`}>
            <div>
              <div className={`text-[10px] uppercase font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Daily Outbound Quota</div>
              <div className={`font-mono text-sm font-bold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <span className="text-cyan-500 dark:text-cyan-400">{sentToday}</span>
                <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>/</span>
                <span className={isDark ? 'text-slate-200' : 'text-slate-700'}>{dailyLimit} sent</span>
              </div>
            </div>

            {/* Mini Progress Bar */}
            <div className={`w-20 rounded-full h-2 overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
              <div 
                className="bg-gradient-to-r from-cyan-400 to-blue-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (sentToday / dailyLimit) * 100)}%` }}
              />
            </div>
          </div>

          <button
            onClick={() => {
              if (queue.length === 0) return;
              exportLinkedInQueueToCSV(queue, 'Pulsar_LinkedIn_CRM_Export');
            }}
            disabled={queue.length === 0}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border ${
              isDark 
                ? 'bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border-emerald-500/40' 
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
            }`}
            title="Export all LinkedIn connection statuses and profile details to CSV for external CRM management"
          >
            <Download className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
            <span className="hidden sm:inline">Export CRM CSV</span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-200">
              {queue.length}
            </span>
          </button>

          <button
            onClick={() => {
              setEditAccountName(connectedAccount.accountName);
              setEditAccountUrl(connectedAccount.profileUrl);
              setEditDailyLimit(connectedAccount.dailyLimit || 50);
              setIsEditAccountModalOpen(true);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
              isDark 
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' 
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-sm'
            }`}
            title="Configure Connected LinkedIn Account & Daily Limit"
          >
            <Settings2 className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Account Settings</span>
          </button>
        </div>
      </div>

      {/* Sub-Tab Navigation Bar */}
      <div className={`flex items-center gap-1.5 sm:gap-2 p-1.5 rounded-2xl border overflow-x-auto shadow-sm text-xs backdrop-blur-xl transition-colors no-scrollbar ${
        isDark 
          ? 'bg-[#111C2E]/85 border-slate-700/40 text-[#F1F5F9]' 
          : 'bg-white border-[#DCE5EC] text-[#172338]'
      }`}
      style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <button
          onClick={() => setActiveSubTab('automator')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold transition transform active:scale-98 cursor-pointer whitespace-nowrap text-xs ${
            activeSubTab === 'automator'
              ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-black shadow-lg shadow-blue-600/30 ring-1 ring-blue-300'
              : isDark 
                ? 'text-slate-400 hover:text-white hover:bg-slate-800/50' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Zap className="w-4 h-4 text-cyan-400" />
          <span>Outreach Automator & Queue</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-slate-950/40 text-cyan-200 font-black">
            {queue.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('batch_timeline')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold transition transform active:scale-98 cursor-pointer whitespace-nowrap text-xs ${
            activeSubTab === 'batch_timeline'
              ? 'bg-gradient-to-r from-blue-600 to-emerald-600 text-white font-black shadow-lg shadow-blue-600/30 ring-1 ring-blue-300'
              : isDark 
                ? 'text-slate-400 hover:text-white hover:bg-slate-800/50' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Calendar className="w-4 h-4 text-blue-300" />
          <span>Batch Scheduling Timeline</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-blue-950/80 text-blue-300 border border-blue-500/30">
            Peak Windows
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('progress_ring')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold transition transform active:scale-98 cursor-pointer whitespace-nowrap text-xs ${
            activeSubTab === 'progress_ring'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black shadow-lg shadow-emerald-500/30 ring-1 ring-white/50'
              : isDark 
                ? 'text-slate-400 hover:text-white hover:bg-slate-800/50' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Daily Progress Ring</span>
        </button>

        <button
          onClick={() => setActiveSubTab('templates')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold transition transform active:scale-98 cursor-pointer whitespace-nowrap text-xs ${
            activeSubTab === 'templates'
              ? 'bg-blue-600 text-white font-black shadow-lg shadow-blue-600/30 ring-1 ring-blue-300'
              : isDark 
                ? 'text-slate-400 hover:text-white hover:bg-slate-800/50' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Shuffle className="w-4 h-4" />
          <span>Outreach Templates ({templates.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('prospector')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold transition transform active:scale-98 cursor-pointer whitespace-nowrap text-xs ${
            activeSubTab === 'prospector'
              ? isDark ? 'bg-slate-800 text-white font-bold ring-1 ring-slate-600' : 'bg-slate-900 text-white font-bold shadow-md'
              : isDark 
                ? 'text-slate-400 hover:text-white hover:bg-slate-800/50' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Search className="w-4 h-4" />
          <span>Executive Prospector</span>
        </button>
      </div>

      {/* SUB-VIEW 1: LinkedIn Outreach Automator Component */}
      {activeSubTab === 'automator' && (
        <LinkedInOutreachAutomator
          connectedAccount={connectedAccount}
          onUpdateAccount={handleUpdateAccount}
          templates={templates}
          rotationEnabled={rotationEnabled}
          queue={queue}
          onUpdateQueue={setQueue}
          onDialProspect={onDialProspect}
          isProcessing={isProcessingRequest}
          onProcessingChange={setIsProcessingRequest}
          onOpenSettings={onOpenSettings}
        />
      )}

      {/* SUB-VIEW 2: Batch Scheduling Timeline Component */}
      {activeSubTab === 'batch_timeline' && (
        <BatchSchedulingTimeline
          queue={queue}
          onUpdateQueue={setQueue}
          connectedAccount={connectedAccount}
          onOpenAutomator={() => setActiveSubTab('automator')}
          onOpenSettings={onOpenSettings}
        />
      )}

      {/* SUB-VIEW 3: Daily Connection Progress Ring & Activity Status Component */}
      {activeSubTab === 'progress_ring' && (
        <LinkedInDailyProgressRing
          account={connectedAccount}
          recentLogs={queue}
          isProcessing={isProcessingRequest}
          onOpenAutomator={() => setActiveSubTab('automator')}
          onRefreshAccount={() => {
            handleUpdateAccount({
              ...connectedAccount,
              lastSyncTimestamp: 'Just now'
            });
          }}
          onEditAccount={() => setIsEditAccountModalOpen(true)}
        />
      )}

      {/* SUB-VIEW 3: Outreach Template Manager Component */}
      {activeSubTab === 'templates' && (
        <LinkedInOutreachTemplateManager
          templates={templates}
          onUpdateTemplates={handleUpdateTemplates}
          rotationEnabled={rotationEnabled}
          onToggleRotation={setRotationEnabled}
        />
      )}

      {/* SUB-VIEW 4: Interactive Executive Prospector */}
      {activeSubTab === 'prospector' && (
        <div className="space-y-6">
          {/* Search Header Banner */}
          <div className={`p-6 rounded-3xl border transition-all duration-300 shadow-xl ${
            isDark 
              ? 'bg-gradient-to-r from-slate-900 via-blue-950/40 to-slate-900 border-blue-900/40 text-white' 
              : 'bg-white border-blue-200/90 text-slate-900 shadow-[0_12px_40px_-10px_rgba(15,23,42,0.06)]'
          }`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  <Linkedin className="w-3.5 h-3.5" />
                  Direct Profile Exploration
                </div>
                <h2 className={`text-xl sm:text-2xl font-black tracking-tight font-display ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Healthcare Executive Directory Search
                </h2>
                <p className={`text-xs sm:text-sm mt-1 max-w-2xl ${isDark ? 'text-slate-300/80' : 'text-slate-600'}`}>
                  Interactive profile browser for manual outreach, custom 1-click tailored copy, and direct telephone dialing.
                </p>
              </div>

              <button
                onClick={handleSearch}
                disabled={isSearching}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/25 transition cursor-pointer disabled:opacity-50 active:scale-98"
              >
                <RefreshCw className={`w-4 h-4 ${isSearching ? 'animate-spin' : ''}`} />
                <span>{isSearching ? 'Searching Profiles...' : 'Search LinkedIn Profiles'}</span>
              </button>
            </div>

            {/* Filter Controls */}
            <div className={`mt-6 pt-5 border-t grid grid-cols-1 sm:grid-cols-3 gap-3 ${
              isDark ? 'border-slate-800/80' : 'border-slate-200'
            }`}>
              <div>
                <label className={`text-xs block mb-1 font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Target Healthcare Role:</label>
                <select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 cursor-pointer ${
                    isDark ? 'bg-slate-950/80 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
                  }`}
                >
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div>
                <label className={`text-xs block mb-1 font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Industry / Sector:</label>
                <input
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="e.g. Medical Practices, Hospitals"
                  className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 ${
                    isDark ? 'bg-slate-950/80 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
                  }`}
                />
              </div>

              <div>
                <label className={`text-xs block mb-1 font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Target US Location:</label>
                <input
                  type="text"
                  value={targetState}
                  onChange={(e) => setTargetState(e.target.value)}
                  placeholder="e.g. Texas, California, Florida"
                  className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 ${
                    isDark ? 'bg-slate-950/80 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Global Outreach Template Style Selector Bar */}
          <div className={`p-4 rounded-2xl border shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors ${
            isDark ? 'bg-slate-900/90 border-blue-500/30' : 'bg-white border-slate-200/90 shadow-sm'
          }`}>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-500 dark:text-blue-400 border border-blue-500/30">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <div className={`text-xs font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  <span>Active Outreach Template Strategy:</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono border border-emerald-500/20 font-bold">
                    &lt; 300 Chars • LinkedIn Safe
                  </span>
                </div>
                <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Auto-customizes each profile card below with the executive's name and clinical practice specialty.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {OUTREACH_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => setActiveTemplateId(tmpl.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                    activeTemplateId === tmpl.id
                      ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30 border border-blue-400'
                      : isDark
                        ? 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                        : 'bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  <span>{tmpl.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Prospect Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {prospects.map((p) => {
              const specialty = getProspectSpecialty(p);
              const generatedOutreachNote = generateOutreachTemplate(p, activeTemplateId);
              const isNoteCopied = copiedTemplateId === p.id;
              const charCount = generatedOutreachNote.length;

              return (
                <div 
                  key={p.id}
                  className={`p-5 rounded-3xl border transition shadow-xl flex flex-col justify-between space-y-4 ${
                    isDark 
                      ? 'glass-card bg-slate-900/90 border-slate-800 hover:border-blue-500/50' 
                      : 'bg-white border-slate-200/90 hover:border-blue-400 hover:shadow-xl'
                  }`}
                >
                  <div>
                    {/* Header Badge */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-semibold">
                        LinkedIn {p.connectionDegree} Connection
                      </span>
                      <a 
                        href={p.linkedInUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={`text-xs flex items-center gap-1 transition ${
                          isDark ? 'text-slate-400 hover:text-blue-400' : 'text-slate-500 hover:text-blue-600'
                        }`}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>View Profile</span>
                      </a>
                    </div>

                    <h3 className={`text-base font-bold tracking-tight font-display ${isDark ? 'text-white' : 'text-slate-900'}`}>{p.fullName}</h3>
                    
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/30 text-[10px] font-mono font-semibold">
                        <Stethoscope className="w-3 h-3 text-teal-500 dark:text-teal-400" />
                        Specialty: {specialty}
                      </span>
                    </div>

                    <p className={`text-xs mt-2 line-clamp-2 leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{p.headline}</p>

                    <div className={`mt-3 space-y-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      <div className="flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className={`font-medium truncate ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>{p.practice}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{p.location}</span>
                      </div>
                    </div>

                    <div className={`mt-3 pt-3 border-t flex flex-wrap gap-2 text-[11px] font-mono ${
                      isDark ? 'border-slate-800' : 'border-slate-200'
                    }`}>
                      <span className={`px-2 py-1 rounded flex items-center gap-1 border ${
                        isDark ? 'bg-slate-950 text-emerald-400 border-slate-800' : 'bg-slate-50 text-emerald-700 border-slate-200'
                      }`}>
                        <PhoneCall className="w-3 h-3" />
                        {p.phone}
                      </span>
                      <span className={`px-2 py-1 rounded flex items-center gap-1 truncate max-w-[180px] border ${
                        isDark ? 'bg-slate-950 text-slate-300 border-slate-800' : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`} title={p.email}>
                        <Mail className="w-3 h-3 text-slate-400" />
                        {p.email}
                      </span>
                    </div>

                    {/* Pre-Written Connection Request Outreach Template */}
                    <div className="mt-4 p-3.5 rounded-xl bg-gradient-to-b from-blue-950/40 via-slate-950 to-slate-950 border border-blue-500/40 shadow-md space-y-2">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                          Pre-Written Connection Request:
                        </span>
                        <span className={`text-[10px] font-mono ${charCount <= 300 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {charCount}/300 chars
                        </span>
                      </div>

                      <p className="text-xs text-slate-200 leading-relaxed font-sans bg-slate-900/90 p-2.5 rounded-lg border border-slate-800/80">
                        "{generatedOutreachNote}"
                      </p>

                      <div className="flex items-center justify-between pt-1 gap-2">
                        <button
                          onClick={() => handleCopyOutreachTemplate(p, activeTemplateId)}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            isNoteCopied
                              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20'
                          }`}
                        >
                          {isNoteCopied ? <Check className="w-3.5 h-3.5 text-slate-950" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{isNoteCopied ? 'Template Copied!' : 'Copy Outreach Note'}</span>
                        </button>

                        <button
                          onClick={() => {
                            // Add to automator queue
                            const newQueueItem: LinkedInQueueItem = {
                              id: `queue-manual-${Date.now()}`,
                              prospect: p,
                              status: 'approved',
                              addedAt: 'Just now',
                              templateId: activeTemplateId,
                              templateName: OUTREACH_TEMPLATES.find(t => t.id === activeTemplateId)?.name,
                              personalizedNote: generatedOutreachNote
                            };
                            setQueue(prev => [newQueueItem, ...prev]);
                            setActiveSubTab('automator');
                          }}
                          className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition cursor-pointer"
                        >
                          <span>+ Add to Queue</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bottom Bar */}
                  <div className="mt-4 pt-3 border-t border-slate-800 space-y-2">
                    <button
                      onClick={() => handleCopyOutreachTemplate(p, activeTemplateId)}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                        isNoteCopied
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                          : 'bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 text-white shadow-blue-600/25'
                      }`}
                    >
                      {isNoteCopied ? <CheckCheck className="w-4 h-4 text-slate-950" /> : <Copy className="w-4 h-4" />}
                      <span>{isNoteCopied ? 'Template Copied!' : 'Copy Outreach Template'}</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopyInMail(p.id, p.inMailDraft)}
                        className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {copiedInMailId === p.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Mail className="w-3.5 h-3.5 text-slate-400" />}
                        <span>{copiedInMailId === p.id ? 'InMail Copied' : 'Copy InMail'}</span>
                      </button>

                      <button
                        onClick={() => handleConvertToCall(p)}
                        className="flex-1 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-teal-500/20"
                      >
                        <PhoneCall className="w-3.5 h-3.5 fill-slate-950" />
                        <span>Call Direct</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Account Settings / Connection Modal */}
      {isEditAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-blue-500/40 rounded-2xl p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Connected LinkedIn Account
                  </h3>
                  <p className="text-xs text-slate-400">
                    Individual sender account used for dispatching niche connection invites.
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsEditAccountModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAccountModal} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Connected Account Full Name & Role:
                </label>
                <input
                  type="text"
                  value={editAccountName}
                  onChange={(e) => setEditAccountName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  LinkedIn Profile URL:
                </label>
                <input
                  type="text"
                  value={editAccountUrl}
                  onChange={(e) => setEditAccountUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Daily Safe Request Limit (Default 50):
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={editDailyLimit}
                  onChange={(e) => setEditDailyLimit(parseInt(e.target.value, 10) || 50)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-cyan-300 focus:outline-none focus:border-blue-500"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  LinkedIn enforces weekly limits of ~100-250 invites. 50/day with throttled intervals keeps your account safe and prevents CAPTCHA triggers.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditAccountModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/25 cursor-pointer"
                >
                  Save Account Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
