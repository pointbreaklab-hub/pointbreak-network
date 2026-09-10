/**
 * Local cache. Dexie over IndexedDB.
 *
 * This is a cache, never a source of truth — Git is. Anything here can be
 * dropped and refetched. It exists so the app is usable offline and so we stay
 * under GitHub's unauthenticated rate limit.
 */

import Dexie, { type Table } from 'dexie';
import type { Application, JobPost, MessageRequest, Profile, Receipt } from '$lib/types';

export interface CacheMeta {
  key: string;
  etag?: string;
  fetchedAt: number;
}

export class PointBreakDB extends Dexie {
  jobs!: Table<JobPost, string>;
  profiles!: Table<Profile, string>;
  applications!: Table<Application, [string, string]>;
  receipts!: Table<Receipt, string>;
  messages!: Table<MessageRequest, string>;
  meta!: Table<CacheMeta, string>;

  constructor() {
    super('pointbreak');
    this.version(1).stores({
      jobs: 'id, companyId, status, postedAt',
      profiles: 'login',
      applications: '[jobId+login], jobId, login, submittedAt',
      receipts: 'id, subject, kind',
      messages: 'threadId, to, sentAt',
      meta: 'key'
    });
  }
}

export const db = new PointBreakDB();

const DEFAULT_TTL_MS = 5 * 60 * 1000;

export async function isStale(key: string, ttlMs = DEFAULT_TTL_MS): Promise<boolean> {
  const entry = await db.meta.get(key);
  return !entry || Date.now() - entry.fetchedAt > ttlMs;
}

export async function markFresh(key: string, etag?: string): Promise<void> {
  await db.meta.put({ key, etag, fetchedAt: Date.now() });
}

export async function clearCache(): Promise<void> {
  await Promise.all(db.tables.map((t) => t.clear()));
}
