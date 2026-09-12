/**
 * Ledger writes.
 *
 * Two modes, chosen at build time by PUBLIC_PUBLISH_LEDGER.
 *
 * Local (the default). Events are written to IndexedDB and nowhere else. Your
 * tracker works, persists across reloads, and needs no server at all. What you
 * give up is everything that requires other people: squad counts, and any
 * company score built from more than your own reports.
 *
 * Published. Events additionally go to the Worker, which commits them to the
 * public ledger. This is only worth switching on once several people are
 * logging the same postings, because with one user a shared ledger computes
 * nothing a local one cannot.
 *
 * Why a Worker rather than committing directly: a Git commit carries its
 * author, so a candidate committing their own application would publish the
 * link between a pseudonymous application_ref and themselves. That is the exact
 * exposure the pseudonym exists to prevent.
 */

import { session } from '$core/auth/session.svelte';
import { db } from '$core/db';
import type { LedgerAction, LedgerEvent } from '$lib/types';

const WORKER = import.meta.env.PUBLIC_WORKER_URL ?? '';
export const PUBLISHING_ENABLED = import.meta.env.PUBLIC_PUBLISH_LEDGER === 'true';

export class LedgerError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = 'LedgerError';
  }
}

const MESSAGES: Record<string, string> = {
  already_claimed:
    'You have already logged an application for this posting. One per account keeps squad counts honest.',
  account_too_new:
    'This GitHub account is too new to append to the shared ledger. The age requirement is what stops throwaway accounts manufacturing agreement.',
  monthly_budget_exhausted: 'You have reached this month’s publish limit.',
  already_vouched_for_this_skill: 'You have already vouched for this person on this skill.',
  cannot_vouch_for_yourself: 'You cannot vouch for yourself.',
  git_write_conflict: 'The ledger is busy. Try again in a moment.',
  worker_unreachable:
    'Saved on this device, but could not reach the publishing service, so nobody else can see it yet.'
};

function friendly(code: string): string {
  return MESSAGES[code.split(':')[0]] ?? code;
}

async function post<T>(path: string, body: unknown, authenticated: boolean): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };

  // Only the token request carries identity. The append must not, so that no
  // single request to the Worker contains both a login and a ref.
  if (authenticated) {
    const token = session.current?.token;
    if (!token) throw new LedgerError('Sign in first.', 'not_signed_in');
    headers.authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${WORKER}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  } catch {
    // fetch rejects on DNS failure, offline and CORS refusal alike, with no
    // detail, so "failed to fetch" would explain nothing.
    throw new LedgerError(friendly('worker_unreachable'), 'worker_unreachable');
  }

  const payload = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    const code = payload.error ?? `http_${res.status}`;
    throw new LedgerError(friendly(code), code);
  }

  return payload as T;
}

export interface AppendInput {
  job_id: string;
  application_ref: string;
  action: LedgerAction;
  ref_event?: string;
}

export interface AppendResult {
  event: LedgerEvent;
  published: boolean;
  /** Set when the local write succeeded but publishing did not. */
  warning?: string;
}

function makeEvent(input: AppendInput): LedgerEvent {
  return {
    id: `ev_local_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
    job_id: input.job_id,
    application_ref: input.application_ref,
    action: input.action,
    at: new Date().toISOString(),
    actor: 'candidate',
    ref_event: input.ref_event
  };
}

/**
 * Records an event.
 *
 * The local write is the commit, not a guess pending confirmation, so this does
 * not roll back when publishing fails. Losing what you recorded because a
 * server was unreachable would be the worse failure.
 */
export async function appendEvent(input: AppendInput): Promise<AppendResult> {
  const event = makeEvent(input);
  await db.events.put(event);

  if (!PUBLISHING_ENABLED) return { event, published: false };

  try {
    const { token } = await post<{ token: string }>(
      '/ledger/token',
      { job_id: input.job_id, scope: 'ledger' },
      true
    );
    await post('/ledger/append', { token, event: { ...input, actor: 'candidate', at: '' } }, false);
    return { event, published: true };
  } catch (e) {
    return {
      event,
      published: false,
      warning: e instanceof Error ? e.message : 'Could not publish.'
    };
  }
}

export async function vouch(subject: string, skill: string, note?: string): Promise<void> {
  if (!PUBLISHING_ENABLED) {
    throw new LedgerError(
      'Vouching needs the shared ledger, which is off in this build. A vouch only means something once other people can see it.',
      'publishing_disabled'
    );
  }
  await post('/attest', { subject, skill, note }, true);
}

/** Everything this browser has recorded. */
export async function localEvents(): Promise<LedgerEvent[]> {
  return db.events.toArray();
}

/**
 * Local data is the only copy in this mode, so it has to be removable from the
 * app rather than trapped in it.
 */
export async function exportLocalData(): Promise<string> {
  const [events, applications] = await Promise.all([
    db.events.toArray(),
    db.myApplications.toArray()
  ]);

  return JSON.stringify(
    { version: 1, exported_at: new Date().toISOString(), events, applications },
    null,
    2
  );
}

export async function importLocalData(json: string): Promise<{ events: number; applications: number }> {
  const parsed = JSON.parse(json) as {
    events?: LedgerEvent[];
    applications?: Array<Record<string, unknown>>;
  };

  const events = parsed.events ?? [];
  const applications = parsed.applications ?? [];

  // bulkPut rather than bulkAdd so re-importing the same file is harmless.
  await db.events.bulkPut(events);
  await db.myApplications.bulkPut(applications as never);

  return { events: events.length, applications: applications.length };
}
