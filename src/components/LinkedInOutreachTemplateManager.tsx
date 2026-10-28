import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  RotateCw, 
  Copy, 
  Sparkles, 
  AlertCircle, 
  FileText, 
  CheckCircle2, 
  Shuffle, 
  Sliders, 
  TrendingUp,
  X,
  Tag,
  Stethoscope
} from 'lucide-react';
import { LinkedInOutreachTemplate } from '../types';

interface LinkedInOutreachTemplateManagerProps {
  templates: LinkedInOutreachTemplate[];
  onUpdateTemplates: (templates: LinkedInOutreachTemplate[]) => void;
  rotationEnabled: boolean;
  onToggleRotation: (enabled: boolean) => void;
}

export const DEFAULT_LINKEDIN_TEMPLATES: LinkedInOutreachTemplate[] = [
  {
    id: 'tpl-1',
    name: '98%+ Clean Claim Rate & Denial Focus',
    category: 'Clean Claims',
    body: 'Hi {doctorName}, noticed your leadership in {specialty} at {practiceName}. We help {specialty} practices eliminate billing denials and achieve 98%+ clean claims with certified AAPC coders. Would love to connect and exchange notes on 2026 payer trends!',
    active: true,
    sentCount: 38,
    acceptedCount: 19,
    tags: ['Highest Response Rate', 'Denial Angle']
  },
  {
    id: 'tpl-2',
    name: 'Complimentary 50-Claim Audit Offer',
    category: 'Free Audit Offer',
    body: 'Hi {doctorName}, given your work in {specialty} at {practiceName}, wanted to connect. We help {specialty} businesses grow by finding the right prospects and handling outreach. Would love to connect and share a complimentary growth benchmark for {practiceName}.',
    active: true,
    sentCount: 34,
    acceptedCount: 16,
    tags: ['Direct Value Offer', 'Audit Hook']
  },
  {
    id: 'tpl-3',
    name: 'Healthcare Executive Peer Invitation',
    category: 'Executive Peer',
    body: 'Hi {doctorName}, expanding my network of healthcare leaders specializing in {specialty}. At Pulsar, we partner with groups like {practiceName} to navigate complex payer rule shifts. Would love to stay connected on LinkedIn!',
    active: true,
    sentCount: 26,
    acceptedCount: 11,
    tags: ['Peer Networking', 'Low Friction']
  },
  {
    id: 'tpl-4',
    name: 'Aged AR & Commercial Denial Overturns',
    category: 'Denial Overturns',
    body: 'Hi {doctorName}, following your work with {practiceName}. Most {specialty} clinics battle payer appeal backlogs. Would welcome connecting to share how our team overturns 78% of initial commercial claim denials for {specialty} groups.',
    active: true,
    sentCount: 18,
    acceptedCount: 8,
    tags: ['Aged AR', 'Recovery Focus']
  }
];

export const resolveTemplateVariables = (
  templateBody: string, 
  prospect: { doctorName: string; practiceName: string; specialty?: string; location?: string; title?: string }
): string => {
  return templateBody
    .replace(/{doctorName}/g, prospect.doctorName || 'Doctor')
    .replace(/{practiceName}/g, prospect.practiceName || 'your practice')
    .replace(/{specialty}/g, prospect.specialty || 'medical specialty')
    .replace(/{location}/g, prospect.location || 'your area')
    .replace(/{title}/g, prospect.title || 'Practice Leader');
};

export const LinkedInOutreachTemplateManager: React.FC<LinkedInOutreachTemplateManagerProps> = ({
  templates,
  onUpdateTemplates,
  rotationEnabled,
  onToggleRotation
}) => {
  const [editingTemplate, setEditingTemplate] = useState<LinkedInOutreachTemplate | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [copiedPreviewId, setCopiedPreviewId] = useState<string | null>(null);

  // Form states for create/edit
  const [formName, setFormName] = useState<string>('');
  const [formCategory, setFormCategory] = useState<LinkedInOutreachTemplate['category']>('Clean Claims');
  const [formBody, setFormBody] = useState<string>('');
  const [formActive, setFormActive] = useState<boolean>(true);

  // Sample prospect for live interactive preview
  const [sampleProspect, setSampleProspect] = useState({
    doctorName: 'Dr. Marcus Vance',
    practiceName: 'Austin Heart & Vascular Institute',
    specialty: 'Cardiology & Electrophysiology',
    location: 'Austin, TX',
    title: 'Managing Partner'
  });

  const handleStartCreate = () => {
    setFormName('');
    setFormCategory('Custom');
    setFormBody('Hi {doctorName}, impressed by your leadership in {specialty} at {practiceName}. Would love to connect regarding recent medical billing and clean claim developments in {location}!');
    setFormActive(true);
    setEditingTemplate(null);
    setIsCreatingNew(true);
  };

  const handleStartEdit = (tpl: LinkedInOutreachTemplate) => {
    setFormName(tpl.name);
    setFormCategory(tpl.category);
    setFormBody(tpl.body);
    setFormActive(tpl.active);
    setEditingTemplate(tpl);
    setIsCreatingNew(false);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formBody.trim()) return;

    if (editingTemplate) {
      const updated = templates.map(t => 
        t.id === editingTemplate.id 
          ? { ...t, name: formName.trim(), category: formCategory, body: formBody.trim(), active: formActive }
          : t
      );
      onUpdateTemplates(updated);
      setEditingTemplate(null);
    } else {
      const newTpl: LinkedInOutreachTemplate = {
        id: `tpl-${Date.now()}`,
        name: formName.trim(),
        category: formCategory,
        body: formBody.trim(),
        active: formActive,
        sentCount: 0,
        acceptedCount: 0,
        tags: ['Custom Sequence']
      };
      onUpdateTemplates([...templates, newTpl]);
      setIsCreatingNew(false);
    }
  };

  const handleDelete = (id: string) => {
    if (templates.length <= 1) {
      alert('You must keep at least one active outreach template.');
      return;
    }
    const updated = templates.filter(t => t.id !== id);
    onUpdateTemplates(updated);
    if (editingTemplate?.id === id) setEditingTemplate(null);
  };

  const handleToggleActive = (id: string) => {
    const updated = templates.map(t => 
      t.id === id ? { ...t, active: !t.active } : t
    );
    onUpdateTemplates(updated);
  };

  const handleInsertVariable = (variableTag: string) => {
    setFormBody(prev => prev + variableTag);
  };

  const handleCopyPreview = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPreviewId(id);
    setTimeout(() => setCopiedPreviewId(null), 2500);
  };

  const activeTemplatesCount = templates.filter(t => t.active).length;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="p-6 rounded-2xl glass-panel bg-gradient-to-r from-slate-950/90 via-indigo-950/30 to-slate-950/90 border border-white/10 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-2">
            <Shuffle className="w-3.5 h-3.5" />
            Outreach Template Engine
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Personalized Connection Request Messages
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
            Create high-converting outreach messages utilizing dynamic variables like <code className="text-cyan-300 font-mono font-bold bg-cyan-950/60 px-1 py-0.5 rounded">{`{doctorName}`}</code> and <code className="text-cyan-300 font-mono font-bold bg-cyan-950/60 px-1 py-0.5 rounded">{`{practiceName}`}</code>. Auto-rotate between templates to optimize acceptance rates and avoid spam patterns.
          </p>
        </div>

        {/* Global Rotation Controller & Add Button */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="p-3 rounded-xl bg-slate-950/80 border border-white/10 flex items-center gap-3">
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <RotateCw className={`w-3.5 h-3.5 ${rotationEnabled ? 'text-emerald-400 animate-spin-slow' : 'text-slate-500'}`} />
                <span>Round-Robin Rotation</span>
              </div>
              <div className="text-[10px] text-slate-400">
                {rotationEnabled ? `Rotating across ${activeTemplatesCount} active templates` : 'Single default template locked'}
              </div>
            </div>
            <button
              onClick={() => onToggleRotation(!rotationEnabled)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                rotationEnabled 
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20' 
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {rotationEnabled ? 'Active ✓' : 'Disabled'}
            </button>
          </div>

          <button
            onClick={handleStartCreate}
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-600/25 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Template</span>
          </button>
        </div>
      </div>

      {/* Interactive Sample Prospect Configurator */}
      <div className="p-4 rounded-xl bg-slate-950/70 border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold">Live Variable Substitution Preview Context:</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <input
            type="text"
            value={sampleProspect.doctorName}
            onChange={(e) => setSampleProspect({ ...sampleProspect, doctorName: e.target.value })}
            placeholder="{doctorName}"
            className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 font-mono"
            title="Sample {doctorName}"
          />
          <input
            type="text"
            value={sampleProspect.practiceName}
            onChange={(e) => setSampleProspect({ ...sampleProspect, practiceName: e.target.value })}
            placeholder="{practiceName}"
            className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 font-mono"
            title="Sample {practiceName}"
          />
          <input
            type="text"
            value={sampleProspect.specialty}
            onChange={(e) => setSampleProspect({ ...sampleProspect, specialty: e.target.value })}
            placeholder="{specialty}"
            className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 font-mono"
            title="Sample {specialty}"
          />
          <input
            type="text"
            value={sampleProspect.location}
            onChange={(e) => setSampleProspect({ ...sampleProspect, location: e.target.value })}
            placeholder="{location}"
            className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 font-mono"
            title="Sample {location}"
          />
        </div>
      </div>

      {/* Templates List Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {templates.map((tpl) => {
          const resolvedBody = resolveTemplateVariables(tpl.body, sampleProspect);
          const charCount = resolvedBody.length;
          const isOverLimit = charCount > 300;
          const acceptanceRate = tpl.sentCount > 0 ? Math.round((tpl.acceptedCount / tpl.sentCount) * 100) : 45;

          return (
            <div 
              key={tpl.id}
              className={`p-5 rounded-2xl border transition shadow-xl flex flex-col justify-between space-y-4 ${
                tpl.active 
                  ? 'bg-slate-900/90 border-blue-500/40 hover:border-blue-400' 
                  : 'bg-slate-950/60 border-slate-800 opacity-60'
              }`}
            >
              <div>
                {/* Header Strip */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-semibold uppercase">
                      {tpl.category}
                    </span>
                    {tpl.tags?.map((tag: string, idx: number) => (
                      <span key={idx} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleToggleActive(tpl.id)}
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold transition cursor-pointer ${
                        tpl.active 
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                      title="Toggle inclusion in auto-rotation"
                    >
                      {tpl.active ? 'In Rotation ✓' : 'Paused'}
                    </button>
                  </div>
                </div>

                <h3 className="text-base font-bold text-white tracking-tight">{tpl.name}</h3>

                {/* Raw Template Definition with highlighted tags */}
                <div className="mt-3 p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] uppercase font-mono text-slate-400">
                    <span>Template Formula:</span>
                    <span className={isOverLimit ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                      {charCount}/300 chars {isOverLimit ? '(⚠️ Over Limit)' : '(LinkedIn Safe)'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed font-mono whitespace-pre-wrap">
                    {tpl.body}
                  </p>
                </div>

                {/* Live Substituted Preview */}
                <div className="mt-3 p-3 rounded-xl bg-blue-950/30 border border-blue-500/20 text-xs">
                  <div className="flex items-center justify-between text-[10px] font-mono text-cyan-400 mb-1">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Live Substituted Output:
                    </span>
                    <button
                      onClick={() => handleCopyPreview(tpl.id, resolvedBody)}
                      className="text-slate-400 hover:text-white flex items-center gap-1 transition cursor-pointer"
                    >
                      {copiedPreviewId === tpl.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedPreviewId === tpl.id ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <p className="text-slate-300 italic leading-relaxed">
                    "{resolvedBody}"
                  </p>
                </div>

                {/* Performance Stats Pill */}
                <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
                  <div className="flex items-center gap-3">
                    <span>Sent: <strong className="text-white">{tpl.sentCount}</strong></span>
                    <span>Accepted: <strong className="text-emerald-400">{tpl.acceptedCount}</strong></span>
                  </div>
                  <div className="flex items-center gap-1 text-emerald-300 font-bold">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>{acceptanceRate}% Acceptance</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  onClick={() => handleStartEdit(tpl)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => handleDelete(tpl.id)}
                  className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/40 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create / Edit Modal */}
      {(isCreatingNew || editingTemplate) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-slate-900 border border-blue-500/40 rounded-2xl p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingTemplate ? 'Edit Outreach Template' : 'Create New Outreach Template'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Use dynamic curly-brace variables to personalize each connection request note.
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setIsCreatingNew(false);
                  setEditingTemplate(null);
                }}
                className="text-slate-400 hover:text-white text-lg p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Template Name:
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Cardiology Catheterization Denial Offer"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Category Angle:
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="Clean Claims">Clean Claims & Denial Focus</option>
                  <option value="Free Audit Offer">Complimentary 50-Claim Audit Offer</option>
                  <option value="Executive Peer">Healthcare Executive Peer Invitation</option>
                  <option value="Denial Overturns">Aged AR & Commercial Denial Overturns</option>
                  <option value="Custom">Custom Strategy</option>
                </select>
              </div>

              {/* Variable Injector Buttons */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Insert Dynamic Variables (Click to Add):
                  </label>
                  <span className="text-[10px] text-cyan-400 font-mono">1-click insert</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { tag: '{doctorName}', desc: 'e.g. Dr. Vance' },
                    { tag: '{practiceName}', desc: 'e.g. Austin Heart' },
                    { tag: '{specialty}', desc: 'e.g. Cardiology' },
                    { tag: '{location}', desc: 'e.g. Austin, TX' },
                    { tag: '{title}', desc: 'e.g. Managing Partner' }
                  ].map((v) => (
                    <button
                      key={v.tag}
                      type="button"
                      onClick={() => handleInsertVariable(v.tag)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-[11px] font-mono font-semibold transition cursor-pointer flex items-center gap-1"
                      title={v.desc}
                    >
                      <span>{v.tag}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Body Textarea with Counter */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Connection Request Note Body:
                  </label>
                  <span className={`text-[11px] font-mono ${formBody.length > 300 ? 'text-rose-400 font-bold' : 'text-emerald-400'}`}>
                    {formBody.length}/300 chars {formBody.length > 300 ? '⚠️ (Exceeds LinkedIn 300 limit)' : '✓ (Safe)'}
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  placeholder="Hi {doctorName}, noticed your work in {specialty} at {practiceName}..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-blue-500 font-sans leading-relaxed"
                  required
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="templateActiveCheck"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="templateActiveCheck" className="text-xs text-slate-300 cursor-pointer">
                  Include this template in automatic round-robin rotation for outbound invites
                </label>
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingNew(false);
                    setEditingTemplate(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 cursor-pointer"
                >
                  {editingTemplate ? 'Update Template' : 'Create Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
