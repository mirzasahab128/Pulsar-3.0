/**
 * Phase 0 (C8) — file-backed persistence for server-owned state.
 *
 * The audited server kept everything it owned (scheduler config, dispatch
 * history, latest stats, AI quota counters) in module-level memory: any
 * restart silently wiped it, and two instances would fork the daily-dispatch
 * dedupe. This store persists that state to `server-data/store.json`
 * (gitignored) with an atomic tmp-file + rename write, behind a small
 * load/save interface so the backing store can be swapped (e.g. Firestore)
 * later without changing route handlers.
 *
 * The daily-dispatch check-and-set on `scheduler.lastTriggeredDate` happens
 * synchronously against this in-memory snapshot + immediate save, which
 * makes the dedupe atomic within a process.
 */
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'server-data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

export interface PersistedStore {
  scheduler: any | null;
  aiQuota: Record<string, { date: string; count: number }>;
  /**
   * Phases 1–3 platform state (identity, plans, master admins, audit log,
   * usage counters, dashboard snapshots). Firestore-shaped (users / plans /
   * platformConfig / adminAudit) and held to `any` here so server/platform.ts
   * owns the typed model. Same swap-ready rationale as the scheduler state:
   * a Firestore adapter can replace this backing store without touching
   * route handlers.
   */
  platform: any | null;
  /**
   * Phases 4–6 pipeline state (lead registry, suppressions, LinkedIn
   * assists, notes, tasks, email sequences, delivery records). Same
   * Firestore-shaped, swap-ready rationale; server/pipeline.ts owns the
   * typed model.
   */
  pipeline: any | null;
}

const DEFAULT_STORE: PersistedStore = {
  scheduler: null,
  aiQuota: {},
  platform: null,
  pipeline: null
};

let cached: PersistedStore | null = null;

export function loadStore(): PersistedStore {
  if (cached) return cached;
  try {
    if (fs.existsSync(STORE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
      cached = {
        scheduler: parsed?.scheduler ?? null,
        aiQuota: parsed?.aiQuota ?? {},
        platform: parsed?.platform ?? null,
        pipeline: parsed?.pipeline ?? null
      };
      return cached;
    }
  } catch (err) {
    console.error('[store] Failed to read store.json, starting fresh:', err);
  }
  cached = { ...DEFAULT_STORE };
  return cached;
}

export function saveStore(state: PersistedStore): void {
  cached = state;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${STORE_PATH}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, STORE_PATH);
  } catch (err) {
    console.error('[store] Failed to persist store.json:', err);
  }
}
