import React, { useCallback, useEffect, useState } from 'react';
import { apiService } from '../services/api';

// Lead prep and signals page, master-admin only. Read-only preparation:
// email shape checks, company briefs from text the user supplies, and
// signals from items the user supplies. Nothing here sends, calls,
// fetches a page, or authorises contact. The consent gate still decides
// every contact, and an opt-out stops email, text, and call at once.
// The look reuses the existing pv theme tokens, so no colour change.

const cardCls = 'pv-card rounded-2xl border border-[var(--pv-border)] bg-[var(--pv-card)] text-[var(--pv-ink)] p-4 min-w-0';
const inputCls = 'w-full sm:w-auto px-3 py-2.5 rounded-lg border border-[var(--pv-border)] bg-[var(--pv-card-soft)] text-[var(--pv-ink)] text-sm outline-none focus:border-[var(--pv-accent)] min-h-[48px]';
const btnCls = 'px-4 py-2.5 rounded-lg text-sm font-semibold transition cursor-pointer min-h-[48px] inline-flex items-center justify-center';
const pillCls = 'px-2.5 py-1 rounded-full border border-[var(--pv-border)] bg-[var(--pv-card-soft)] text-[11px] font-semibold whitespace-nowrap';

export function LeadPrepPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [emailResult, setEmailResult] = useState<any>(null);
  const [companyName, setCompanyName] = useState('');
  const [companyText, setCompanyText] = useState('');
  const [companySource, setCompanySource] = useState('Pasted by me');
  const [briefResult, setBriefResult] = useState<any>(null);
  const [watchLabel, setWatchLabel] = useState('');
  const [watchKind, setWatchKind] = useState('rss_feed');
  const [watchSource, setWatchSource] = useState('');
  const [signalWatchId, setSignalWatchId] = useState('');
  const [signalTitle, setSignalTitle] = useState('');
  const [signalBody, setSignalBody] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await apiService.getLeadPrepOverview()); } catch (e: any) { setError(e?.message || 'Failed to load lead prep'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const run = async (fn: () => Promise<void>, msg?: string) => {
    setError(null); setNotice(null);
    try { await fn(); if (msg) setNotice(msg); await load(); } catch (e: any) { setError(e?.message || 'Action failed'); }
  };

  return (
    <div className="space-y-4 min-w-0 w-full">
      <div className={cardCls}>
        <h1 className="text-lg sm:text-xl font-bold break-words">Lead prep and signals</h1>
        <p className="text-sm text-[var(--pv-muted)] mt-1 break-words">Prepare a lead before any contact: check an email shape, build a company brief from text you supply, and record signals from sources you add. Nothing here sends, calls, or fetches a page, and a signal alone never authorises contact.</p>
        <div className="flex flex-wrap gap-2 mt-3">
          <button onClick={load} className={`${btnCls} bg-[var(--pv-green)] text-white hover:brightness-110`}>Refresh</button>
          {loading && <span className="text-sm text-[var(--pv-muted)] self-center">Loading...</span>}
        </div>
        {error && <div className="text-sm p-3 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-500 mt-3 break-words">{error}</div>}
        {notice && <div className="text-sm p-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-500 mt-3 break-words">{notice}</div>}
        <div className="flex flex-wrap gap-1.5 mt-3">
          <span className={pillCls}>Email checks: {data?.counts?.emailChecks ?? 0}</span>
          <span className={pillCls}>Company briefs: {data?.counts?.companyBriefs ?? 0}</span>
          <span className={pillCls}>Watches: {data?.counts?.watches ?? 0}</span>
          <span className={pillCls}>Signals: {data?.counts?.signals ?? 0}</span>
          <span className={pillCls}>Live verification: No</span>
          <span className={pillCls}>Live fetch: No</span>
        </div>
      </div>

      <div className={cardCls}>
        <div className="text-sm font-bold">Check an email shape</div>
        <p className="text-xs text-[var(--pv-muted)] mt-1 break-words">Syntax, domain shape, and a starter disposable list only. This does not prove an address is deliverable. A live verification service is still required for that.</p>
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@company.com" className={inputCls} />
          <button onClick={() => run(async () => { const out = await apiService.checkLeadPrepEmail({ email }); setEmailResult(out.result); }, 'Email checked')} className={`${btnCls} bg-violet-600 text-white hover:bg-violet-500`}>Check email</button>
        </div>
        {emailResult && (
          <div className="text-sm p-3 rounded-xl border border-[var(--pv-border)] bg-[var(--pv-card-soft)] mt-3 break-words">
            <span className="font-bold">{emailResult.email}</span>: {emailResult.verdict}
            <ul className="mt-2 space-y-1">
              {emailResult.checks.map((c: any, i: number) => <li key={i}>{c.check}: {c.passed ? 'Pass' : 'Fail'}: {c.detail}</li>)}
            </ul>
            <p className="text-xs text-[var(--pv-muted)] mt-2">{emailResult.note}</p>
          </div>
        )}
      </div>

      <div className={cardCls}>
        <div className="text-sm font-bold">Build a company brief from supplied text</div>
        <p className="text-xs text-[var(--pv-muted)] mt-1 break-words">Paste text you already have, or public page text you copied yourself. Pulsar does not fetch any page. A brief is pitch prep only and never authorises contact.</p>
        <div className="mt-3 space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Company name" className={inputCls} />
            <input value={companySource} onChange={e => setCompanySource(e.target.value)} placeholder="Source" className={inputCls} />
          </div>
          <textarea value={companyText} onChange={e => setCompanyText(e.target.value)} placeholder="Paste the company text here" className={`${inputCls} w-full min-h-[120px]`} />
          <button onClick={() => run(async () => { const out = await apiService.createLeadPrepBrief({ companyName, pageText: companyText, source: companySource }); setBriefResult(out.brief); }, 'Brief built')} className={`${btnCls} bg-violet-600 text-white hover:bg-violet-500`}>Build brief</button>
        </div>
        {briefResult && (
          <div className="text-sm p-3 rounded-xl border border-[var(--pv-border)] bg-[var(--pv-card-soft)] mt-3 break-words">
            <span className="font-bold">{briefResult.companyName}</span>
            <p>What they do: {briefResult.whatBusinessDoes.join(' ') || 'Not found in the supplied text.'}</p>
            <p>Services: {briefResult.services.join(' | ') || 'Not found.'}</p>
            <p>Locations: {briefResult.locations.join(', ') || 'Not found.'}</p>
            <p>Hiring signals: {briefResult.hiringSignals.join(' | ') || 'None found.'}</p>
            <p>Pain themes: {briefResult.painThemes.join(', ') || 'None found.'}</p>
          </div>
        )}
      </div>

      <div className={cardCls}>
        <div className="text-sm font-bold">Signal watchlist</div>
        <p className="text-xs text-[var(--pv-muted)] mt-1 break-words">Only sources you own or add: your own mailbox or calendar with consent, a public RSS feed you add, a public job posting, or a public listing you supply. Private messages, DMs, de-anonymising people, bulk social watching, and scraping are never monitored.</p>
        <div className="mt-3 flex flex-col sm:flex-row flex-wrap gap-2">
          <input value={watchLabel} onChange={e => setWatchLabel(e.target.value)} placeholder="Watch name" className={inputCls} />
          <select value={watchKind} onChange={e => setWatchKind(e.target.value)} className={inputCls}>
            <option value="rss_feed">Public RSS feed</option>
            <option value="job_posting">Public job posting</option>
            <option value="business_listing">Public business listing</option>
            <option value="own_mailbox">My own mailbox, consented</option>
            <option value="own_calendar">My own calendar, consented</option>
          </select>
          <input value={watchSource} onChange={e => setWatchSource(e.target.value)} placeholder="Source, e.g. feed address" className={inputCls} />
          <button onClick={() => run(async () => { await apiService.addLeadPrepWatch({ kind: watchKind, label: watchLabel, source: watchSource }); }, 'Watch added')} className={`${btnCls} bg-violet-600 text-white hover:bg-violet-500`}>Add watch</button>
        </div>
        <div className="mt-3 space-y-2">
          {(data?.watches || []).map((w: any) => (
            <div key={w.id} className="text-sm p-3 rounded-xl border border-[var(--pv-border)] bg-[var(--pv-card-soft)] break-words">{w.label} ({w.kind}): {w.source}</div>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          <div className="text-sm font-bold">Record a signal from a supplied item</div>
          <div className="flex flex-col sm:flex-row flex-wrap gap-2">
            <input value={signalWatchId} onChange={e => setSignalWatchId(e.target.value)} placeholder="Watch ID" className={inputCls} />
            <input value={signalTitle} onChange={e => setSignalTitle(e.target.value)} placeholder="Item title" className={inputCls} />
            <input value={signalBody} onChange={e => setSignalBody(e.target.value)} placeholder="Item text" className={inputCls} />
            <button onClick={() => run(async () => { await apiService.addLeadPrepSignal({ watchId: signalWatchId, title: signalTitle, body: signalBody, source: 'supplied by admin' }); }, 'Signal recorded. It does not authorise contact.')} className={`${btnCls} bg-violet-600 text-white hover:bg-violet-500`}>Record signal</button>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          {(data?.signals || []).slice(-20).map((s: any) => (
            <div key={s.id} className="text-sm p-3 rounded-xl border border-[var(--pv-border)] bg-[var(--pv-card-soft)] break-words">{s.kind}: {s.summary} (supplied-data only, contact authorised: No)</div>
          ))}
        </div>
      </div>
    </div>
  );
}
