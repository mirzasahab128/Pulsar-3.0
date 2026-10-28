import React, { useState, useEffect, useMemo } from 'react';
import { 
  Mail, 
  Copy, 
  Check, 
  ExternalLink, 
  Sparkles, 
  Send, 
  FileText, 
  User, 
  Building2, 
  Tag as TagIcon, 
  Plus, 
  Trash2, 
  Edit3, 
  RefreshCw, 
  X,
  Stethoscope,
  ChevronDown,
  Layers,
  Clock,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { RCMLead, EmailTemplate } from '../types';

interface EmailOutreachModalProps {
  isOpen: boolean;
  onClose: () => void;
  leads: RCMLead[];
  initialLead?: RCMLead | null;
  onUpdateLeadStatus?: (leadId: string, status: RCMLead['status']) => void;
}

// Built-in battle-tested cold outreach templates for US Medical Billing Sales
export const DEFAULT_EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'tmpl-1',
    name: 'EHR Denial Recovery Audit',
    category: 'Denial Recovery',
    subject: 'Quick question re: {{ehrSystem}} claim denials at {{practiceName}}',
    tone: 'Consultative',
    description: 'Targeted directly at their specific EHR to highlight AR denial reduction',
    body: `Dear {{doctorName}},

I noticed {{practiceName}} currently operates on {{ehrSystem}}. With recent payer reimbursement updates and surgical modifier audits, many {{specialty}} groups in {{state}} are experiencing severe claim denial friction, especially around {{painPoint}}.

Pulsar provides an autonomous billing engine directly integrated with {{ehrSystem}} that reduces days in AR from 50+ down to 28 days while achieving a 98.4% first-pass clean claim rate.

We would love to perform a complimentary, zero-risk 20-claim clean rate audit on your {{monthlyClaimVolume}} pipeline to highlight uncollected revenue.

Would you or {{adminContact}} have 10 minutes this Thursday or Friday for a brief screen share?

Warm regards,
Alex Mercer
VP of Revenue Operations, Pulsar
alex@pulsarbilling.com | (800) 555-0199`
  },
  {
    id: 'tmpl-2',
    name: 'Staffing Bottlenecks & Prior Auth Relief',
    category: 'Staffing & Prior Auth',
    subject: 'Reducing administrative billing overhead for {{practiceName}}',
    tone: 'Direct',
    description: 'Appeals to clinics suffering from in-house biller turnover or prior-auth delays',
    body: `Hello {{doctorName}},

Running a {{specialty}} practice with {{practiceSize}} is demanding enough without your clinical team spending 15+ hours weekly chasing down prior authorizations and payer appeals.

We help clinics like {{practiceName}} fully automate front-end claim scrubbing, prior-auth verification, and aging AR follow-up. On average, our partner practices recover an additional 12-16% in net collections without hiring extra in-house billing staff.

Our team noticed your primary hurdle: {{painPoint}}.

Would you be open to a 10-minute briefing on how we eliminate these bottlenecks directly in {{ehrSystem}}?

Best regards,
Alex Mercer
Pulsar Healthcare Solutions
alex@pulsarbilling.com`
  },
  {
    id: 'tmpl-3',
    name: 'Specialty Out-of-Network & Fee Schedule Audit',
    category: 'Underpayments',
    subject: 'Commercial fee schedule underpayments for {{doctorName}} ({{specialty}})',
    tone: 'Urgent',
    description: 'Focuses on underpaid commercial claims, out-of-network rates, and surgical codes',
    body: `Dr. {{doctorName}},

Independent {{specialty}} practices in {{state}} are currently leaving substantial revenue on the table due to underpaid commercial fee schedules and automated payer downcoding.

Given {{practiceName}}'s volume of {{monthlyClaimVolume}}, even a 4% to 6% optimization in first-pass reimbursement represents significant cash flow every quarter.

Pulsar identifies contracted rate underpayments and appeals denied claims autonomously. We can review your top commercial payers with zero disruption to your daily patient flow.

Could we schedule a brief 10-minute discovery call early next week?

Sincerely,
Alex Mercer
Pulsar Executive Team
Direct: (800) 555-0199`
  },
  {
    id: 'tmpl-4',
    name: 'Low-Pressure 10-Minute Executive Intro',
    category: 'Intro / Coffee',
    subject: '10 min introduction for {{practiceName}}',
    tone: 'Casual',
    description: 'Short, conversational, low-commitment introductory outreach',
    body: `Hi {{doctorName}},

I'll keep this brief, I know your schedule is packed.

I lead outreach at Pulsar, where we help {{specialty}} businesses resolve {{painPoint}} and grow faster.

I'd love to share two quick benchmark insights we've gathered from other businesses in {{state}}. No aggressive sales pitch, just actionable data for your business.

Do you have 10 minutes open next Tuesday or Wednesday?

Best,
Alex Mercer
Pulsar | (800) 555-0199`
  },
  {
    id: 'tmpl-5',
    name: 'Complimentary Business Growth Audit',
    category: 'Audit Invitation',
    subject: 'Complimentary business growth audit for {{practiceName}}',
    tone: 'Consultative',
    description: 'High-conversion offer: no obligation, zero cost business growth audit (Healthcare & RCM pack example: 20-claim audit)' ,
    body: `Dear {{doctorName}},

To demonstrate our automated capabilities with zero financial commitment, Pulsar is offering a complimentary business growth audit to select {{specialty}} businesses in {{state}}.

We will review your current outreach and sales process, identify specific bottlenecks in {{ehrSystem}}, and provide an estimate of recoverable growth.

If you'd like to reserve an audit slot for {{practiceName}}, simply reply to this email or let me know when works best to coordinate with {{adminContact}}.

Warm regards,
Alex Mercer
Pulsar Business Growth`
  }
];

export const EmailOutreachModal: React.FC<EmailOutreachModalProps> = ({
  isOpen,
  onClose,
  leads,
  initialLead,
  onUpdateLeadStatus
}) => {
  // Currently selected lead
  const [selectedLeadId, setSelectedLeadId] = useState<string>(initialLead?.id || leads[0]?.id || '');
  
  // Custom templates stored in localStorage
  const [customTemplates, setCustomTemplates] = useState<EmailTemplate[]>(() => {
    try {
      const saved = localStorage.getItem('pulsercm_custom_email_templates');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Current active template
  const allTemplates = useMemo(() => [...DEFAULT_EMAIL_TEMPLATES, ...customTemplates], [customTemplates]);
  const [activeTemplateId, setActiveTemplateId] = useState<string>(DEFAULT_EMAIL_TEMPLATES[0].id);

  // Editable Subject & Body
  const [subjectText, setSubjectText] = useState<string>('');
  const [bodyText, setBodyText] = useState<string>('');
  const [copiedNotice, setCopiedNotice] = useState<boolean>(false);
  const [sentNotice, setSentNotice] = useState<boolean>(false);
  const [isCreatingCustom, setIsCreatingCustom] = useState<boolean>(false);
  const [isAiPolishing, setIsAiPolishing] = useState<boolean>(false);

  // New custom template form state
  const [newTemplateName, setNewTemplateName] = useState<string>('');
  const [newTemplateCategory, setNewTemplateCategory] = useState<EmailTemplate['category']>('Custom');
  const [newTemplateSubject, setNewTemplateSubject] = useState<string>('Quick note for {{practiceName}}');
  const [newTemplateBody, setNewTemplateBody] = useState<string>('Dear {{doctorName}},\n\n...');

  // Deduplicated unique leads
  const uniqueLeads = useMemo(() => {
    const seen = new Set<string>();
    return leads.filter(l => {
      if (!l || !l.id || seen.has(l.id)) return false;
      seen.add(l.id);
      return true;
    });
  }, [leads]);

  // Target lead
  const activeLead = useMemo(() => {
    return uniqueLeads.find(l => l.id === selectedLeadId) || initialLead || uniqueLeads[0];
  }, [uniqueLeads, selectedLeadId, initialLead]);

  // Sync initial lead when modal opens or initialLead changes
  useEffect(() => {
    if (initialLead) {
      setSelectedLeadId(initialLead.id);
    } else if (uniqueLeads.length > 0 && !selectedLeadId) {
      setSelectedLeadId(uniqueLeads[0].id);
    }
  }, [initialLead, uniqueLeads]);

  // Helper to replace template variables with actual lead data
  const populateTemplate = (rawText: string, lead?: RCMLead): string => {
    if (!lead) return rawText;

    const firstPainPoint = lead.painPoints && lead.painPoints.length > 0 
      ? lead.painPoints[0] 
      : 'claim denials & aging AR';

    const replacements: Record<string, string> = {
      '{{doctorName}}': lead.doctorName || 'Doctor',
      '{{practiceName}}': lead.practiceName || 'your practice',
      '{{title}}': lead.title || 'Managing Partner',
      '{{specialty}}': lead.specialty || 'Healthcare',
      '{{practiceSize}}': lead.practiceSize || 'clinical providers',
      '{{phone}}': lead.phone || 'your office',
      '{{email}}': lead.email || '',
      '{{state}}': lead.state || 'your state',
      '{{ehrSystem}}': lead.ehrSystem || 'your billing EHR',
      '{{monthlyClaimVolume}}': lead.monthlyClaimVolume || '$350k / mo',
      '{{painPoint}}': firstPainPoint,
      '{{adminContact}}': lead.adminContact || 'your Practice Administrator'
    };

    let result = rawText;
    Object.entries(replacements).forEach(([token, val]) => {
      result = result.replaceAll(token, val);
    });

    return result;
  };

  // When active template or selected lead changes, populate subject & body
  useEffect(() => {
    const tmpl = allTemplates.find(t => t.id === activeTemplateId) || allTemplates[0];
    if (tmpl && activeLead) {
      setSubjectText(populateTemplate(tmpl.subject, activeLead));
      setBodyText(populateTemplate(tmpl.body, activeLead));
    }
  }, [activeTemplateId, activeLead, allTemplates]);

  if (!isOpen) return null;

  // Save new custom template
  const handleSaveCustomTemplate = () => {
    if (!newTemplateName.trim()) return;

    const newTmpl: EmailTemplate = {
      id: `custom-${Date.now()}`,
      name: newTemplateName.trim(),
      category: newTemplateCategory,
      subject: newTemplateSubject,
      body: newTemplateBody,
      tone: 'Consultative',
      isCustom: true
    };

    const updated = [...customTemplates, newTmpl];
    setCustomTemplates(updated);
    try {
      localStorage.setItem('pulsercm_custom_email_templates', JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save template to localStorage', e);
    }

    setActiveTemplateId(newTmpl.id);
    setIsCreatingCustom(false);
    setNewTemplateName('');
  };

  // Delete custom template
  const handleDeleteCustomTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customTemplates.filter(t => t.id !== id);
    setCustomTemplates(updated);
    try {
      localStorage.setItem('pulsercm_custom_email_templates', JSON.stringify(updated));
    } catch (e) {
      console.warn(e);
    }
    if (activeTemplateId === id) {
      setActiveTemplateId(DEFAULT_EMAIL_TEMPLATES[0].id);
    }
  };

  // One-click Copy to clipboard
  const handleCopy = () => {
    const fullText = `Subject: ${subjectText}\n\n${bodyText}`;
    navigator.clipboard.writeText(fullText);
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 2500);
  };

  // One-click Launch Native Email Client (mailto:)
  const handleLaunchMailto = () => {
    if (!activeLead) return;
    const recipient = activeLead.email || '';
    const subjectEncoded = encodeURIComponent(subjectText);
    const bodyEncoded = encodeURIComponent(bodyText);
    const mailtoUrl = `mailto:${recipient}?subject=${subjectEncoded}&body=${bodyEncoded}`;

    // Open mail client
    window.location.href = mailtoUrl;

    // Automatically update lead status to 'Follow-up' if currently 'Ready for Call'
    if (onUpdateLeadStatus && activeLead.status === 'Ready for Call') {
      onUpdateLeadStatus(activeLead.id, 'Follow-up');
    }

    setSentNotice(true);
    setTimeout(() => setSentNotice(false), 4000);
  };

  // AI Tone Re-write
  const handleAiRefineTone = async (toneStyle: 'Direct' | 'Executive' | 'Urgent') => {
    if (!activeLead) return;
    setIsAiPolishing(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Please rewrite this cold sales email for a medical practice in a ${toneStyle} tone. Keep it concise, punchy, and professional. 
          Lead Practice: ${activeLead.practiceName}, Doctor: ${activeLead.doctorName}, Specialty: ${activeLead.specialty}, EHR: ${activeLead.ehrSystem}.
          Current Subject: ${subjectText}
          Current Body: ${bodyText}
          Return your response as:
          SUBJECT: <rewritten subject>
          BODY: <rewritten body>`
        })
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.reply || '';
        const subjectMatch = text.match(/SUBJECT:\s*(.+)/i);
        const bodyMatch = text.match(/BODY:\s*([\s\S]+)/i);

        if (subjectMatch && subjectMatch[1]) {
          setSubjectText(subjectMatch[1].trim());
        }
        if (bodyMatch && bodyMatch[1]) {
          setBodyText(bodyMatch[1].trim());
        }
      }
    } catch (err) {
      console.warn('AI Polish fallback:', err);
    } finally {
      setIsAiPolishing(false);
    }
  };

  const currentTemplate = allTemplates.find(t => t.id === activeTemplateId) || allTemplates[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-5xl glass-modal border border-white/15 rounded-2xl shadow-2xl text-slate-100 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Modal Top Bar */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">Cold-Outreach Email Template Engine</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  1-Click Mailto Ready
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Auto-populates doctor names, EHR systems, and verified clinical pain points for instant outreach.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body - Two Column Layout */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-y-auto divide-y lg:divide-y-0 lg:divide-x divide-white/10">
          
          {/* Left Column: Lead Selector & Template Picker (4 cols) */}
          <div className="lg:col-span-4 p-4 sm:p-5 space-y-4 bg-slate-950/50 overflow-y-auto">
            
            {/* Target Lead Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Target Healthcare Account:</span>
                <span className="text-[10px] font-mono text-teal-400">{leads.length} in CRM</span>
              </label>

              <div className="relative">
                <select
                  value={selectedLeadId}
                  onChange={(e) => setSelectedLeadId(e.target.value)}
                  className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-teal-400 cursor-pointer pr-8"
                >
                  {uniqueLeads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.practiceName} — {lead.doctorName} ({lead.state})
                    </option>
                  ))}
                </select>
              </div>

              {activeLead && (
                <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10 text-xs space-y-1 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white truncate">{activeLead.doctorName}</span>
                    <span className="text-[10px] font-mono text-emerald-400 font-semibold">{activeLead.phone}</span>
                  </div>
                  <div className="text-slate-400 text-[11px] truncate flex items-center gap-1">
                    <Mail className="w-3 h-3 text-teal-400 shrink-0" />
                    <span>{activeLead.email}</span>
                  </div>
                  <div className="flex items-center gap-2 pt-1 font-mono text-[10px] text-slate-300">
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-white/10 text-cyan-300">
                      EHR: {activeLead.ehrSystem}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-white/10 text-emerald-300">
                      Vol: {activeLead.monthlyClaimVolume}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Template Library */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-teal-400" />
                  <span>Outreach Templates ({allTemplates.length})</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsCreatingCustom(!isCreatingCustom)}
                  className="text-[11px] font-bold text-teal-400 hover:text-teal-300 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>New Custom</span>
                </button>
              </div>

              {/* Template List Cards */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {allTemplates.map((template) => {
                  const isActive = activeTemplateId === template.id;
                  return (
                    <div
                      key={template.id}
                      onClick={() => {
                        setActiveTemplateId(template.id);
                        setIsCreatingCustom(false);
                      }}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer relative group ${
                        isActive 
                          ? 'border-teal-400 bg-teal-950/40 ring-1 ring-teal-400/40' 
                          : 'border-white/10 hover:border-white/20 bg-slate-900/60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-white">{template.name}</span>
                        {template.isCustom && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteCustomTemplate(template.id, e)}
                            className="text-slate-500 hover:text-rose-400 p-0.5"
                            title="Delete custom template"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-teal-300 border border-white/10">
                          {template.category}
                        </span>
                        {template.tone && (
                          <span className="text-[10px] text-slate-400">
                            • {template.tone}
                          </span>
                        )}
                      </div>

                      {template.description && (
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                          {template.description}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom Template Creation Drawer */}
            {isCreatingCustom && (
              <div className="p-3 rounded-xl bg-slate-900 border border-teal-500/40 space-y-2.5 animate-in fade-in">
                <span className="text-xs font-bold text-teal-300 block">Create Custom Template</span>
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="Template Name (e.g. Cardiology Urgent Intro)"
                  className="w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
                <input
                  type="text"
                  value={newTemplateSubject}
                  onChange={(e) => setNewTemplateSubject(e.target.value)}
                  placeholder="Subject (e.g. Quick note for {{doctorName}})"
                  className="w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                />
                <textarea
                  rows={4}
                  value={newTemplateBody}
                  onChange={(e) => setNewTemplateBody(e.target.value)}
                  placeholder="Body text. Use {{doctorName}}, {{practiceName}}, {{ehrSystem}}..."
                  className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 text-xs text-white font-mono"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingCustom(false)}
                    className="px-2.5 py-1 rounded-lg text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveCustomTemplate}
                    className="px-3 py-1 rounded-lg bg-teal-500 text-slate-950 font-bold text-xs"
                  >
                    Save Template
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Live Dynamic Preview & 1-Click Sending Deck (8 cols) */}
          <div className="lg:col-span-8 p-4 sm:p-6 flex flex-col justify-between space-y-4 bg-slate-950/70">
            
            <div className="space-y-4">
              
              {/* Token Insertion Pills */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10 flex items-center justify-between flex-wrap gap-2 text-xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                  Auto-Populated Tokens:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-teal-500/15 text-teal-300 text-[10px] font-mono border border-teal-500/30">
                    Dr: {activeLead?.doctorName}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-teal-500/15 text-teal-300 text-[10px] font-mono border border-teal-500/30">
                    EHR: {activeLead?.ehrSystem}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-teal-500/15 text-teal-300 text-[10px] font-mono border border-teal-500/30">
                    State: {activeLead?.state}
                  </span>
                </div>
              </div>

              {/* Subject Line Input */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <label className="font-bold text-slate-300">Email Subject Line:</label>
                  <span className="font-mono text-[10px] text-slate-500">{subjectText.length} chars</span>
                </div>
                <input
                  type="text"
                  value={subjectText}
                  onChange={(e) => setSubjectText(e.target.value)}
                  className="w-full bg-slate-900 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white font-medium focus:outline-none focus:border-teal-400 shadow-inner"
                />
              </div>

              {/* Email Body Area */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <label className="font-bold text-slate-300">Message Body (Editable):</label>
                  
                  {/* AI Quick Polish Pills */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-teal-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>Polish Tone:</span>
                    </span>
                    <button
                      type="button"
                      disabled={isAiPolishing}
                      onClick={() => handleAiRefineTone('Direct')}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] border border-white/10 cursor-pointer disabled:opacity-50"
                    >
                      Direct & Punchy
                    </button>
                    <button
                      type="button"
                      disabled={isAiPolishing}
                      onClick={() => handleAiRefineTone('Executive')}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] border border-white/10 cursor-pointer disabled:opacity-50"
                    >
                      Executive
                    </button>
                    <button
                      type="button"
                      disabled={isAiPolishing}
                      onClick={() => handleAiRefineTone('Urgent')}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] border border-white/10 cursor-pointer disabled:opacity-50"
                    >
                      High Urgency
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <textarea
                    rows={12}
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    className="w-full bg-slate-900 border border-white/15 rounded-xl p-3.5 text-xs text-slate-100 font-sans leading-relaxed focus:outline-none focus:border-teal-400 shadow-inner resize-none"
                  />
                  {isAiPolishing && (
                    <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs rounded-xl flex items-center justify-center gap-2 text-teal-300 text-xs font-semibold">
                      <RefreshCw className="w-4 h-4 animate-spin text-teal-400" />
                      <span>AI polishing email tone...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Notification Toasts */}
            {copiedNotice && (
              <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-xs text-emerald-200 flex items-center gap-2 animate-in fade-in">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Email subject and message body copied to clipboard!</span>
              </div>
            )}

            {sentNotice && (
              <div className="p-2.5 rounded-xl bg-teal-950/80 border border-teal-500/40 text-xs text-teal-200 flex items-center gap-2 animate-in fade-in">
                <Check className="w-4 h-4 text-teal-400" />
                <span>Launched email in your default client ({activeLead?.email}) and tagged lead as Follow-up.</span>
              </div>
            )}

            {/* Bottom Action Buttons */}
            <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-400">
                <span>Recipient: </span>
                <strong className="text-teal-300 font-mono">{activeLead?.email || 'N/A'}</strong>
              </div>

              <div className="flex items-center gap-2.5">
                {/* Copy Text Button */}
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold border border-white/15 transition cursor-pointer"
                >
                  <Copy className="w-4 h-4 text-slate-400" />
                  <span>Copy Text</span>
                </button>

                {/* 1-Click Send via Mailto */}
                <button
                  type="button"
                  onClick={handleLaunchMailto}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 text-xs font-black shadow-lg shadow-teal-500/25 transition transform active:scale-95 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>1-Click Email ({activeLead?.doctorName?.split(' ')?.[0] || 'Doctor'})</span>
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
