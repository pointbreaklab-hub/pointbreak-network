/**
 * Local storage. Dexie over IndexedDB.
 *
 * Two different jobs live here:
 *
 *   - A cache of public data (jobs, profiles, events). Droppable and refetchable,
 *     Git is the source of truth.
 *   - The candidate's private map from application_ref back to what it means.
 *     That mapping exists nowhere else, by design, because publishing it would
 *     expose who applied where. Losing it means losing your tracker history, so
 *     it is the one thing worth backing up to a private repo.
 */

import Dexie, { type Table } from 'dexie';
import type { ApplicationRef, Job, LedgerEvent, MessageRequest, Receipt, UserProfile } from '$lib/types';

export interface CacheMeta {
  key: string;
  etag?: string;
  fetched_at: number;
}

/** Private. Never committed to the public data repo. */
export interface MyApplication {
  application_ref: ApplicationRef;
  job_id: string;
  /** Denormalized so the tracker reads even when the job cache is cold. */
  job_title: string;
  company_id: string;
  source_url?: string;
  created_at: string;
}

export class PointBreakDB extends Dexie {
  jobs!: Table<Job, string>;
  events!: Table<LedgerEvent, string>;
  profiles!: Table<UserProfile, string>;
  receipts!: Table<Receipt, string>;
  messages!: Table<MessageRequest, string>;
  myApplications!: Table<MyApplication, ApplicationRef>;
  meta!: Table<CacheMeta, string>;

  constructor() {
    super('pointbreak');
    this.version(2).stores({
      jobs: 'id, company_id, status, source, first_seen_at',
      events: 'id, job_id, application_ref, action, at',
      profiles: 'github_login',
      receipts: 'id, subject, kind',
      messages: 'thread_id, to, sent_at',
      myApplications: 'application_ref, job_id, created_at',
      meta: 'key'
    });
  }
}

export const db = new PointBreakDB();

const DEFAULT_TTL_MS = 5 * 60 * 1000;

export async function isStale(key: string, ttlMs = DEFAULT_TTL_MS): Promise<boolean> {
  const entry = await db.meta.get(key);
  return !entry || Date.now() - entry.fetched_at > ttlMs;
}

export async function markFresh(key: string, etag?: string): Promise<void> {
  await db.meta.put({ key, etag, fetched_at: Date.now() });
}

/** Clears cached public data. Deliberately leaves myApplications alone. */
export async function clearCache(): Promise<void> {
  await Promise.all(
    [db.jobs, db.events, db.profiles, db.receipts, db.messages, db.meta].map((t) => t.clear())
  );
}
