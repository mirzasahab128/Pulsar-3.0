import React, { useCallback, useEffect, useState } from 'react';
import {
  Database,
  FileText,
  Mail,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ShieldOff,
  Sparkles,
  Play,
  Pause,
  Plus,
  Upload
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import {
  apiService,
  RegistryLead,
  SuppressionRecord,
  PipelineNoteRecord,
  PipelineTaskRecord,
  DailyStatsPayload,
  SequenceRecord,
  DeliveryRecord
} from '../services/api';

type PipelineTab = 'registry' | 'notes' | 'sequences';

const DELIVERY_STYLES: Record<string, string> = {
  sent: 'bg-sky-500/15 text-sky-500 border-sky-500/30',
  delivered: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  failed: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
  not_configured: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  bounced: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
  complained: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
  skipped_suppressed: 'bg-slate-500/15 text-slate-400 border-slate-500/30'
};

/**
 * Phases 4–6 — Pipeline Ops workspace.
 * Registry: sourced leads only (provenance on every record), dedupe and
 * suppressions enforced server-side, deterministic rule-based enrichment.
 * Notes & Tasks: notes are created from real transcripts or written
 * manually; extracted action items become tasks; daily stats are counted
 * from records. Sequences: email steps sent through the real Resend
 * mailer — every attempt leaves a delivery record with the provider's
 * real status/message id, and "not_configured" is shown as not sent.
 */
export const PipelineWorkspace: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [tab, setTab] = useState<PipelineTab>('registry');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [leads, setLeads] = useState<RegistryLead[]>([]);
  const [suppressions, setSuppressions] = useState<SuppressionRecord[]>([]);
  const [notes, setNotes] = useState<PipelineNoteRecord[]>([]);
  const [tasks, setTasks] = useState<PipelineTaskRecord[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStatsPayload | null>(null);
  const [sequences, setSequences] = useState<SequenceRecord[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);

  // Registry tab forms
  const [npiForm, setNpiForm] = useState({ city: '', state: 'TX', taxonomy: 'Cardiology', limit: 25 });
  const [supForm, setSupForm] = useState({ identifierType: 'email', identifier: '', reason: 'manual' });

  // Notes tab forms
  const [transcript, setTranscript] = useState('');
  const [transcriptLeadId, setTranscriptLeadId] = useState('');
  const [manualSummary, setManualSummary] = useState('');
  const [manualAction, setManualAction] = useState('');

  // Sequences tab forms
  const [seqName, setSeqName] = useState('');
  const [seqSteps, setSeqSteps] = useState<Array<{ subject: string; body: string; delayDays: number }>>([
    { subject: 'Intro — {{practiceName}}', body: 'Hi {{firstName}}, following up on business growth for {{practiceName}}.', delayDays: 0 }
  ]);
  const [enrollSelection, setEnrollSelection] = useState<Record<string, string[]>>({});

  // Phase 2 theme: shared surfaces resolve to the theme tokens (which flip
  // with the existing .dark switch) so Pipeline Ops reads as the same app
  // as the themed dashboard. isDark is kept for remaining inline accents.
  const card = 'pv-card rounded-2xl border border-[var(--pv-border)] bg-[var(--pv-card)] text-[var(--pv-ink)] p-4 sm:p-5';
  const input = 'w-full rounded-xl border border-[var(--pv-border)] bg-[var(--pv-card-soft)] text-[var(--pv-ink)] px-3 py-2 text-sm focus:border-[var(--pv-accent)] outline-none';
  const btn = 'px-3 py-2 rounded-xl bg-gradient-to-r from-[#0B5D3B] to-[#1DA068] hover:brightness-110 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50';
  const btnGhost = 'px-3 py-2 rounded-xl border border-[var(--pv-border)] bg-[var(--pv-card-soft)] text-[var(--pv-ink)] hover:bg-[var(--pv-mint)] text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50';

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e: any) {
      setError(e?.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const refreshRegistry = useCallback(async () => {
    const [reg, sup] = await Promise.all([apiService.getLeadRegistry(), apiService.getSuppressions()]);
    setLeads(reg.leads);
    setSuppressions(sup.suppressions);
  }, []);

  const refreshNotes = useCallback(async () => {
    const [n, t, s] = await Promise.all([apiService.getNotes(), apiService.getTasks(), apiService.getDailyStats()]);
    setNotes(n.notes);
    setTasks(t.tasks);
    setDailyStats(s);
  }, []);

  const refreshSequences = useCallback(async () => {
    const [sq, dl] = await Promise.all([apiService.getSequences(), apiService.getDeliveries()]);
    setSequences(sq.sequences);
    setDeliveries(dl.deliveries);
  }, []);

  useEffect(() => {
    run(async () => {
      if (tab === 'registry') await refreshRegistry();
      if (tab === 'notes') await refreshNotes();
      if (tab === 'sequences') {
        await refreshSequences();
        const reg = await apiService.getLeadRegistry();
        setLeads(reg.leads);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // --- Registry actions ----------------------------------------------------

  const handleNpiIngest = () => run(async () => {
    const found = await apiService.searchNpiRegistry({
      city: npiForm.city || undefined,
      state: npiForm.state || undefined,
      taxonomy_description: npiForm.taxonomy || undefined,
      limit: npiForm.limit
    });
    if (found.length === 0) {
      setNotice('NPI search returned no records for those criteria.');
      return;
    }
    const res = await apiService.ingestLeads(found);
    setNotice(`NPI ingest: ${res.created} new, ${res.duplicates} duplicates, ${res.rejected} rejected — every stored record carries CMS provenance.`);
    await refreshRegistry();
  });

  const handleCsvIngest = (file: File) => run(async () => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) throw new Error('CSV needs a header row and at least one data row');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows = lines.slice(1).map(line => {
      const cells = line.split(',').map(c => c.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = cells[i] || ''; });
      return {
        practiceName: row.practicename || row.practice || row.company || '',
        doctorName: row.doctorname || row.contact || row.name || '',
        title: row.title || '',
        specialty: row.specialty || '',
        phone: row.phone || '',
        email: row.email || '',
        address: row.address || '',
        state: row.state || '',
        npiNumber: row.npinumber || row.npi || '',
        linkedInProfile: row.linkedinprofile || row.linkedin || '',
        source: 'csv_import'
      };
    });
    const res = await apiService.ingestLeads(rows);
    setNotice(`CSV ingest: ${res.created} new, ${res.duplicates} duplicates, ${res.rejected} rejected (records without a source are refused).`);
    await refreshRegistry();
  });

  const handleEnrich = () => run(async () => {
    const res = await apiService.enrichLeads();
    setNotice(`Enriched ${res.enrichedCount} lead(s) with the deterministic ruleset — every score names the rules that produced it.`);
    await refreshRegistry();
  });

  const handleAddSuppression = () => run(async () => {
    if (!supForm.identifier.trim()) throw new Error('Enter an identifier to suppress');
    await apiService.addSuppression(supForm);
    setSupForm({ ...supForm, identifier: '' });
    setNotice('Suppression added — it is enforced at ingest, at enrollment, and again before every send.');
    await refreshRegistry();
  });

  // --- Notes & tasks actions ----------------------------------------------

  const handleTranscriptNote = () => run(async () => {
    if (!transcript.trim()) throw new Error('Paste a real transcript first — notes are never generated from nothing');
    const res = await apiService.createNoteFromTranscript({
      transcript,
      leadId: transcriptLeadId || undefined,
      title: 'Transcript note'
    });
    setTranscript('');
    setNotice(res.note.summarySource === 'gemini'
      ? `Note created from the transcript (AI summary). ${res.tasksCreated.length} task(s) created from extracted action items.`
      : `Note stored with the transcript verbatim. No AI summary is configured, so nothing was paraphrased — ${res.tasksCreated.length} task(s) came from action lines in the transcript itself.`);
    await refreshNotes();
  });

  const handleManualNote = () => run(async () => {
    if (!manualSummary.trim()) throw new Error('Write the note summary first');
    const res = await apiService.createNote({
      summary: manualSummary,
      actionItems: manualAction.trim() ? [{ text: manualAction.trim() }] : []
    });
    setManualSummary('');
    setManualAction('');
    setNotice(`Manual note saved. ${res.tasksCreated.length} task(s) created.`);
    await refreshNotes();
  });

  const handleTaskStatus = (id: string, status: 'open' | 'done' | 'dismissed') => run(async () => {
    await apiService.updateTaskStatus(id, status);
    await refreshNotes();
  });

  // --- Sequence actions -----------------------------------------------------

  const handleCreateSequence = () => run(async () => {
    if (!seqName.trim()) throw new Error('Give the sequence a name');
    const seq = await apiService.createSequence({
      name: seqName.trim(),
      steps: seqSteps.map(s => ({ ...s, windowStart: '08:00', windowEnd: '21:00' }))
    });
    setSeqName('');
    setNotice(`Sequence "${seq.name}" created as a draft. Enroll leads, then activate it.`);
    await refreshSequences();
  });

  const handleSeqStatus = (id: string, status: string) => run(async () => {
    await apiService.patchSequence(id, { status });
    setNotice(status === 'paused' ? 'Sequence paused — the engine will not send its future steps.' : `Sequence is now ${status}.`);
    await refreshSequences();
  });

  const handleEnroll = (seqId: string) => run(async () => {
    const leadIds = enrollSelection[seqId] || [];
    if (leadIds.length === 0) throw new Error('Select at least one lead to enroll');
    const res = await apiService.enrollInSequence(seqId, leadIds);
    const enrolled = res.results.filter(r => r.outcome === 'enrolled').length;
    const blocked = res.results.filter(r => r.outcome !== 'enrolled');
    setNotice(`Enrolled ${enrolled} lead(s).${blocked.length ? ` ${blocked.length} not enrolled: ${blocked.map(b => b.reason || b.outcome).join('; ')}` : ''}`);
    setEnrollSelection({ ...enrollSelection, [seqId]: [] });
    await refreshSequences();
  });

  const handleTick = () => run(async () => {
    const s = await apiService.tickSequences();
    setNotice(`Sequence run: ${s.sent} sent, ${s.failed} failed, ${s.notConfigured} not sent (mailer not configured), ${s.skippedSuppressed} suppressed, ${s.skippedWindow} outside send window${s.planLimitReached ? ' — plan send limit reached' : ''}.`);
    await refreshSequences();
    await refreshNotes();
  });

  const tabs: Array<{ id: PipelineTab; label: string; icon: React.ReactNode }> = [
    { id: 'registry', label: 'Lead Registry', icon: <Database className="w-4 h-4" /> },
    { id: 'notes', label: 'Notes & Tasks', icon: <FileText className="w-4 h-4" /> },
    { id: 'sequences', label: 'Email Sequences', icon: <Mail className="w-4 h-4" /> }
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 cursor-pointer border ${tab === t.id
              ? 'bg-gradient-to-r from-[#0B5D3B] to-[#1DA068] text-white border-transparent'
              : 'border-[var(--pv-border)] bg-[var(--pv-card-soft)] text-[var(--pv-ink)] hover:bg-[var(--pv-mint)]'}`}>
            {t.icon} {t.label}
          </button>
        ))}
        <button className={btnGhost} disabled={busy} onClick={() => run(async () => {
          if (tab === 'registry') await refreshRegistry();
          if (tab === 'notes') await refreshNotes();
          if (tab === 'sequences') await refreshSequences();
        })}>
          <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {notice && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {notice}
        </div>
      )}

      {tab === 'registry' && (
        <div className="space-y-5">
          <div className={card}>
            <h3 className="font-bold mb-1">Add sourced leads</h3>
            <p className={`text-xs mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              The registry only accepts records with provenance. Demo/simulated records are refused, duplicates are
              detected on NPI / phone / name+address, and suppressions are enforced at ingest.
            </p>
            <div className="grid sm:grid-cols-5 gap-2 mb-3">
              <input className={input} placeholder="City" value={npiForm.city} onChange={e => setNpiForm({ ...npiForm, city: e.target.value })} />
              <input className={input} placeholder="State (TX)" value={npiForm.state} onChange={e => setNpiForm({ ...npiForm, state: e.target.value })} />
              <input className={input} placeholder="Taxonomy (Cardiology)" value={npiForm.taxonomy} onChange={e => setNpiForm({ ...npiForm, taxonomy: e.target.value })} />
              <input className={input} type="number" min={1} max={25} value={npiForm.limit} onChange={e => setNpiForm({ ...npiForm, limit: Number(e.target.value) || 10 })} />
              <button className={btn} disabled={busy} onClick={handleNpiIngest}>Search NPI & ingest</button>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <label className={`${btnGhost} cursor-pointer`}>
                <Upload className="w-3.5 h-3.5" /> Ingest CSV file
                <input type="file" accept=".csv" className="hidden" onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleCsvIngest(f);
                  e.target.value = '';
                }} />
              </label>
              <button className={btnGhost} disabled={busy} onClick={handleEnrich}>
                <Sparkles className="w-3.5 h-3.5" /> Enrich all (rule-based fit scores)
              </button>
              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                CSV columns: practiceName, doctorName, title, specialty, phone, email, address, state, npiNumber, linkedInProfile
              </span>
            </div>
          </div>

          <div className={card}>
            <h3 className="font-bold mb-3">Registry ({leads.length})</h3>
            {leads.length === 0 ? (
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No leads yet. Ingest from the NPI Registry or a CSV file above — real records only.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`text-left text-xs uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      <th className="py-2 pr-3">Practice</th><th className="py-2 pr-3">Specialty</th>
                      <th className="py-2 pr-3">Fit</th><th className="py-2 pr-3">Source</th><th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map(l => (
                      <tr key={l.id} className={`border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                        <td className="py-2 pr-3">
                          <div className="font-semibold">{l.practiceName}</div>
                          <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{l.doctorName || '—'} · {l.email || 'no email'} · {l.phone || 'no phone'}</div>
                        </td>
                        <td className="py-2 pr-3">{l.specialty || '—'}</td>
                        <td className="py-2 pr-3">
                          {l.enrichment ? (
                            <span title={l.enrichment.fitReason}>
                              <span className="font-bold">{l.enrichment.fitScore}</span>
                              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}> ({l.enrichment.rulesApplied.length} rules)</span>
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-2 pr-3 text-xs">{l.provenance.source}<br />
                          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{new Date(l.provenance.retrievedAt).toLocaleDateString()}</span>
                        </td>
                        <td className="py-2">
                          {(l.suppressedNow || l.suppressed)
                            ? <span className="px-2 py-0.5 rounded-lg bg-rose-500/15 text-rose-400 border border-rose-500/30 text-xs font-semibold">Suppressed</span>
                            : <span className="text-xs">{l.status}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className={card}>
            <h3 className="font-bold mb-1 flex items-center gap-2"><ShieldOff className="w-4 h-4" /> Suppression list ({suppressions.length})</h3>
            <p className={`text-xs mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Checked at ingest, at enrollment, and again before every send. Bounces and complaints are added
              automatically by the Resend webhook. Removing an entry is a master-admin action.
            </p>
            <div className="grid sm:grid-cols-4 gap-2 mb-3">
              <select className={input} value={supForm.identifierType} onChange={e => setSupForm({ ...supForm, identifierType: e.target.value })}>
                <option value="email">Email</option><option value="phone">Phone</option>
                <option value="npi">NPI</option><option value="practice">Practice name</option>
              </select>
              <input className={input} placeholder="Identifier" value={supForm.identifier} onChange={e => setSupForm({ ...supForm, identifier: e.target.value })} />
              <select className={input} value={supForm.reason} onChange={e => setSupForm({ ...supForm, reason: e.target.value })}>
                <option value="manual">Manual</option><option value="opt_out">Opt-out</option>
                <option value="dnc_request">Do-not-contact request</option><option value="registry">Registry (DNC)</option>
              </select>
              <button className={btn} disabled={busy} onClick={handleAddSuppression}><Plus className="w-3.5 h-3.5" /> Add suppression</button>
            </div>
            {suppressions.length > 0 && (
              <ul className="text-sm space-y-1">
                {suppressions.map(s => (
                  <li key={s.id} className="flex items-center justify-between gap-2">
                    <span><span className="font-mono text-xs">{s.identifierType}</span> · {s.identifier} <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>({s.reason}, {new Date(s.createdAt).toLocaleDateString()})</span></span>
                    <button className={btnGhost} disabled={busy} onClick={() => run(async () => {
                      await apiService.deleteSuppression(s.id);
                      setNotice('Suppression removed.');
                      await refreshRegistry();
                    })}>Remove</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === 'notes' && (
        <div className="space-y-5">
          {dailyStats && (
            <div className={card}>
              <h3 className="font-bold mb-2">Today, counted from records ({dailyStats.date})</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                {Object.entries(dailyStats.counts).map(([k, v]) => (
                  <div key={k}>
                    <div className="text-xl font-extrabold">{v}</div>
                    <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{k}</div>
                  </div>
                ))}
              </div>
              <p className={`text-xs mt-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {dailyStats.note} Call activity counts Call Studio sessions (simulated in-browser; not carrier calls).
                {dailyStats.needsFounder.length > 0 && ` Needs you: ${dailyStats.needsFounder.map(t => t.title).join('; ')}`}
              </p>
            </div>
          )}

          <div className={card}>
            <h3 className="font-bold mb-2">Note from a real transcript</h3>
            <select className={`${input} mb-2`} value={transcriptLeadId} onChange={e => setTranscriptLeadId(e.target.value)}>
              <option value="">Attach to lead (optional)…</option>
              {leads.length === 0 && <option value="" disabled>Load the Registry tab first to pick a lead</option>}
              {leads.map(l => <option key={l.id} value={l.id}>{l.practiceName}</option>)}
            </select>
            <textarea className={`${input} min-h-28`} placeholder="Paste the actual call / meeting transcript here. Notes are generated only from real transcripts — with no AI key configured, the transcript is stored verbatim and action items come only from action lines in the text."
              value={transcript} onChange={e => setTranscript(e.target.value)} />
            <button className={`${btn} mt-2`} disabled={busy} onClick={handleTranscriptNote}>Create note + tasks</button>
          </div>

          <div className={card}>
            <h3 className="font-bold mb-2">Manual note</h3>
            <textarea className={`${input} min-h-20`} placeholder="What happened, in your words…" value={manualSummary} onChange={e => setManualSummary(e.target.value)} />
            <input className={`${input} mt-2`} placeholder="Optional action item (becomes a task)" value={manualAction} onChange={e => setManualAction(e.target.value)} />
            <button className={`${btn} mt-2`} disabled={busy} onClick={handleManualNote}>Save note</button>
          </div>

          <div className={card}>
            <h3 className="font-bold mb-3">Tasks ({tasks.filter(t => t.status === 'open').length} open)</h3>
            {tasks.length === 0 ? (
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No tasks yet. Tasks are created from notes — and only a person can mark one done.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {tasks.map(t => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span className={t.status === 'done' ? 'line-through opacity-60' : ''}>
                      {t.title}
                      <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}> · {t.owner}{t.dueAt ? ` · due ${new Date(t.dueAt).toLocaleDateString()}` : ''} · {t.priority}</span>
                      {t.status === 'done' && t.completedBy && <span className="text-xs text-emerald-500"> · done by {t.completedBy}</span>}
                    </span>
                    <span className="flex gap-1.5">
                      {t.status === 'open' && <>
                        <button className={btnGhost} disabled={busy} onClick={() => handleTaskStatus(t.id, 'done')}>Mark done</button>
                        <button className={btnGhost} disabled={busy} onClick={() => handleTaskStatus(t.id, 'dismissed')}>Dismiss</button>
                      </>}
                      {t.status !== 'open' && <button className={btnGhost} disabled={busy} onClick={() => handleTaskStatus(t.id, 'open')}>Reopen</button>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={card}>
            <h3 className="font-bold mb-3">Recent notes ({notes.length})</h3>
            {notes.length === 0 ? (
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No notes yet.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {notes.slice(0, 10).map(n => (
                  <li key={n.id}>
                    <div className="font-semibold">{n.title} <span className={`text-xs font-normal ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>· {n.type} · summary: {n.summarySource} · {new Date(n.createdAt).toLocaleString()}</span></div>
                    <div className={isDark ? 'text-slate-300' : 'text-slate-700'}>{n.summary || <em>No AI summary — transcript stored verbatim below the fold; nothing was paraphrased or invented.</em>}</div>
                    {n.actionItems.length > 0 && (
                      <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Action items ({n.actionItems[0].extraction}): {n.actionItems.map(a => a.text).join(' · ')}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === 'sequences' && (
        <div className="space-y-5">
          <div className={card}>
            <h3 className="font-bold mb-1">New email sequence</h3>
            <p className={`text-xs mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Steps send through the real Resend mailer inside each step's send window (08:00–21:00 sequence time).
              Templates can use {'{{practiceName}}'}, {'{{firstName}}'}, {'{{specialty}}'}, {'{{state}}'}. A send that
              doesn't happen is never shown as sent — check the delivery log below.
            </p>
            <input className={`${input} mb-2`} placeholder="Sequence name" value={seqName} onChange={e => setSeqName(e.target.value)} />
            {seqSteps.map((s, i) => (
              <div key={i} className="grid sm:grid-cols-6 gap-2 mb-2">
                <input className={`${input} sm:col-span-2`} placeholder={`Step ${i + 1} subject`} value={s.subject}
                  onChange={e => setSeqSteps(seqSteps.map((x, j) => j === i ? { ...x, subject: e.target.value } : x))} />
                <input className={`${input} sm:col-span-3`} placeholder="Body" value={s.body}
                  onChange={e => setSeqSteps(seqSteps.map((x, j) => j === i ? { ...x, body: e.target.value } : x))} />
                <input className={input} type="number" min={0} title="Delay (days) before this step" value={s.delayDays}
                  onChange={e => setSeqSteps(seqSteps.map((x, j) => j === i ? { ...x, delayDays: Number(e.target.value) || 0 } : x))} />
              </div>
            ))}
            <div className="flex gap-2">
              <button className={btnGhost} disabled={seqSteps.length >= 10} onClick={() => setSeqSteps([...seqSteps, { subject: '', body: '', delayDays: 2 }])}>
                <Plus className="w-3.5 h-3.5" /> Add step
              </button>
              <button className={btn} disabled={busy} onClick={handleCreateSequence}>Create sequence (draft)</button>
              <button className={btnGhost} disabled={busy} onClick={handleTick}>
                <Play className="w-3.5 h-3.5" /> Run due sends now
              </button>
            </div>
          </div>

          {sequences.map(seq => (
            <div key={seq.id} className={card}>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h3 className="font-bold">{seq.name}
                  <span className={`ml-2 px-2 py-0.5 rounded-lg border text-xs font-semibold ${seq.status === 'active' ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' : seq.status === 'paused' ? 'bg-amber-500/15 text-amber-500 border-amber-500/30' : 'bg-slate-500/15 text-slate-400 border-slate-500/30'}`}>{seq.status}</span>
                </h3>
                <span className="flex gap-1.5">
                  {seq.status !== 'active' && <button className={btnGhost} disabled={busy} onClick={() => handleSeqStatus(seq.id, 'active')}><Play className="w-3.5 h-3.5" /> Activate</button>}
                  {seq.status === 'active' && <button className={btnGhost} disabled={busy} onClick={() => handleSeqStatus(seq.id, 'paused')}><Pause className="w-3.5 h-3.5" /> Pause</button>}
                </span>
              </div>
              <p className={`text-xs mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {seq.steps.length} step(s) · {seq.timezone} · {(seq.enrollments || []).length} enrollment(s)
                {(seq.enrollments || []).filter(e => e.status === 'stopped').length > 0 && ` · ${(seq.enrollments || []).filter(e => e.status === 'stopped').length} stopped (suppressed/bounced)`}
              </p>
              <div className="flex flex-wrap gap-2 items-center">
                <select multiple size={3} className={`${input} max-w-md`}
                  value={enrollSelection[seq.id] || []}
                  onChange={e => setEnrollSelection({
                    ...enrollSelection,
                    [seq.id]: Array.from(e.target.selectedOptions).map(o => o.value)
                  })}>
                  {leads.filter(l => l.email && !l.suppressedNow && !l.suppressed).map(l => (
                    <option key={l.id} value={l.id}>{l.practiceName} — {l.email}</option>
                  ))}
                </select>
                <button className={btnGhost} disabled={busy} onClick={() => handleEnroll(seq.id)}>Enroll selected</button>
                <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Only registry leads with a sourced email and no suppression can enroll.</span>
              </div>
            </div>
          ))}

          <div className={card}>
            <h3 className="font-bold mb-3">Delivery log ({deliveries.length})</h3>
            {deliveries.length === 0 ? (
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No send attempts yet. Every attempt — sent, failed, or not configured — is recorded here with the provider's real status.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`text-left text-xs uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      <th className="py-2 pr-3">To</th><th className="py-2 pr-3">Subject</th>
                      <th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Provider ID</th><th className="py-2">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.slice(0, 50).map(d => (
                      <tr key={d.id} className={`border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                        <td className="py-2 pr-3">{d.to}</td>
                        <td className="py-2 pr-3">{d.subject}</td>
                        <td className="py-2 pr-3">
                          <span className={`px-2 py-0.5 rounded-lg border text-xs font-semibold ${DELIVERY_STYLES[d.status] || ''}`}>{d.status}</span>
                          {d.error && <div className="text-xs text-rose-400 mt-0.5">{d.error}</div>}
                        </td>
                        <td className="py-2 pr-3 font-mono text-xs">{d.providerMessageId || '—'}</td>
                        <td className="py-2 text-xs">{new Date(d.at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PipelineWorkspace;
