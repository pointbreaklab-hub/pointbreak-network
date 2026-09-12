/**
 * Ledger writes.
 *
 * Candidates do not commit to the data repo, and this is a privacy requirement
 * rather than a permissions one. A Git commit carries its author, so committing
 * your own application would publish the link between a pseudonymous
 * application_ref and you, which is the exact exposure the pseudonym prevents.
 *
 * So writes go through the Worker in two steps, deliberately split so that no
 * single request contains both a login and a ref:
 *
 *   1. Ask for a token, authenticated as yourself, naming only the job.
 *   2. Append the event, authenticated by the token, naming only the ref.
 */

import { session } from '$core/auth/session.svelte';
import type { LedgerAction, LedgerEvent } from '$lib/types';

const WORKER = import.meta.env.PUBLIC_WORKER_URL ?? 'https://receipts.pointbreaklab.com';

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
    'This GitHub account is too new to append to the ledger yet. The age requirement is what stops throwaway accounts manufacturing agreement.',
  monthly_budget_exhausted: 'You have reached this month’s append limit.',
  already_vouched_for_this_skill: 'You have already vouched for this person on this skill.',
  cannot_vouch_for_yourself: 'You cannot vouch for yourself.',
  git_write_conflict: 'The ledger is busy. Try again in a moment.'
};

function friendly(code: string): string {
  const key = code.split(':')[0];
  return MESSAGES[key] ?? code;
}

async function post<T>(path: string, body: unknown, authenticated: boolean): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };

  // Only the token request carries identity. The append must not.
  if (authenticated) {
    const token = session.current?.token;
    if (!token) throw new LedgerError('Sign in first.', 'not_signed_in');
    headers.authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${WORKER}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  } catch {
    // fetch rejects on DNS failure, offline, and CORS refusal alike, with no
    // detail. Saying "failed to fetch" to a user explains nothing.
    throw new LedgerError(
      'Could not reach the ledger service. Your change was not saved. Check your connection and try again.',
      'worker_unreachable'
    );
  }

  const payload = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    const code = payload.error ?? `http_${res.status}`;
    throw new LedgerError(friendly(code), code);
  }

  return payload as T;
}

async function requestToken(job_id: string, scope: 'ledger' | 'attest'): Promise<string> {
  const { token } = await post<{ token: string }>('/ledger/token', { job_id, scope }, true);
  return token;
}

export interface AppendInput {
  job_id: string;
  application_ref: string;
  action: LedgerAction;
  ref_event?: string;
}

/**
 * Appends a candidate event. The Worker stamps id and timestamp, because a
 * client-supplied time could backdate silence and a client-supplied id could
 * collide.
 */
export async function appendEvent(input: AppendInput): Promise<void> {
  const token = await requestToken(input.job_id, 'ledger');
  await post('/ledger/append', { token, event: { ...input, actor: 'candidate', at: '' } }, false);
}

export async function vouch(subject: string, skill: string, note?: string): Promise<void> {
  await post('/attest', { subject, skill, note }, true);
}

/** Optimistic local event, so the UI moves before the commit lands. */
export function localEvent(input: AppendInput): LedgerEvent {
  return {
    id: `ev_local_${crypto.randomUUID().slice(0, 8)}`,
    job_id: input.job_id,
    application_ref: input.application_ref,
    action: input.action,
    at: new Date().toISOString(),
    actor: 'candidate',
    ref_event: input.ref_event
  };
}
