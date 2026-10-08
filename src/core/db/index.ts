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
import type { Portfolio } from '$lib/portfolio';
import type {
  ApplicationRef,
  Job,
  LedgerAction,
  LedgerEvent,
  MessageRequest,
  Receipt,
  UserProfile
} from '$lib/types';

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

/**
 * An event recorded here but not yet in the shared ledger.
 *
 * Tracking works with no account at all, which means most events are written
 * before there is any way to publish them. They wait here instead of being
 * lost, and drain when someone signs in. Without this queue the only way to
 * contribute would be to have a GitHub account ready before your first
 * rejection, which is the wrong order and the main reason nobody would start.
 */
export interface OutboxEntry {
  /** The local event id, so the queue and the record cannot drift apart. */
  event_id: string;
  job_id: string;
  application_ref: ApplicationRef;
  action: LedgerAction;
  ref_event?: string;
  queued_at: string;
  /** Why the last attempt failed, kept so the UI can say rather than guess. */
  last_error?: string;
}

/**
 * A long-lived append capability for one posting, held locally.
 *
 * The service issues one per account per posting and locks it to the first
 * application ref it carries, so it authorises the whole life of one
 * application without the service ever learning whose it is. Losing it means
 * that posting can no longer be published from this account, which is why it
 * lives in the database rather than in memory.
 */
export interface JobToken {
  job_id: string;
  token: string;
  issued_at: string;
}

export class PointBreakDB extends Dexie {
  jobs!: Table<Job, string>;
  events!: Table<LedgerEvent, string>;
  profiles!: Table<UserProfile, string>;
  receipts!: Table<Receipt, string>;
  messages!: Table<MessageRequest, string>;
  myApplications!: Table<MyApplication, ApplicationRef>;
  /** Private until explicitly published. A CV holds personal data. */
  portfolios!: Table<Portfolio, string>;
  /** Events waiting for a way to publish them. */
  outbox!: Table<OutboxEntry, string>;
  /** Append capabilities, one per posting. Private to this browser. */
  jobTokens!: Table<JobToken, string>;
  meta!: Table<CacheMeta, string>;

  constructor() {
    super('pointbreak');
    this.version(3).stores({
      jobs: 'id, company_id, status, source, first_seen_at',
      events: 'id, job_id, application_ref, action, at',
      profiles: 'github_login',
      receipts: 'id, subject, kind',
      messages: 'thread_id, to, sent_at',
      myApplications: 'application_ref, job_id, created_at',
      portfolios: 'github_login',
      meta: 'key'
    });

    // 4 adds the outbox and its tokens. Everything tracked before an account
    // existed has to survive getting one.
    this.version(4).stores({
      jobs: 'id, company_id, status, source, first_seen_at',
      events: 'id, job_id, application_ref, action, at',
      profiles: 'github_login',
      receipts: 'id, subject, kind',
      messages: 'thread_id, to, sent_at',
      myApplications: 'application_ref, job_id, created_at',
      portfolios: 'github_login',
      outbox: 'event_id, job_id, queued_at',
      jobTokens: 'job_id',
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
    // portfolios, the outbox and its tokens are deliberately excluded: none of
    // them is a cache of something fetchable, and dropping the outbox would
    // discard reports that have nowhere else to exist yet.
    [db.jobs, db.events, db.profiles, db.receipts, db.messages, db.meta].map((t) => t.clear())
  );
}
