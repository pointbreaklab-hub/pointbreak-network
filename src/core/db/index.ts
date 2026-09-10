/**
 * Local cache. Dexie over IndexedDB.
 *
 * This is a cache, never a source of truth, Git is. Anything here can be
 * dropped and refetched. It exists so the app works offline and so we stay
 * under GitHub's API rate limit.
 */

import Dexie, { type Table } from 'dexie';
import type { Application, Job, MessageRequest, Receipt, UserProfile } from '$lib/types';

export interface CacheMeta {
  key: string;
  etag?: string;
  fetched_at: number;
}

export class PointBreakDB extends Dexie {
  jobs!: Table<Job, string>;
  profiles!: Table<UserProfile, string>;
  applications!: Table<Application, [string, string]>;
  receipts!: Table<Receipt, string>;
  messages!: Table<MessageRequest, string>;
  meta!: Table<CacheMeta, string>;

  constructor() {
    super('pointbreak');
    this.version(1).stores({
      jobs: 'id, company_id, status, posted_at',
      profiles: 'github_login',
      applications: '[job_id+github_login], job_id, github_login, last_action_at',
      receipts: 'id, subject, kind',
      messages: 'thread_id, to, sent_at',
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

export async function clearCache(): Promise<void> {
  await Promise.all(db.tables.map((t) => t.clear()));
}
