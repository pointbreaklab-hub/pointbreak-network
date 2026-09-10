/**
 * Thin GitHub REST wrapper.
 *
 * Reads are unauthenticated where possible (60 req/hr shared) and authenticated
 * when a session exists (5000 req/hr). ETags are cached so repeat reads return
 * 304 and don't count against the limit.
 */

import { session } from '$core/auth/session.svelte';
import { db, markFresh } from '$core/db';

const API = 'https://api.github.com';

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

export async function ghFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('accept', 'application/vnd.github+json');
  headers.set('x-github-api-version', '2022-11-28');

  const token = session.current?.token;
  if (token) headers.set('authorization', `Bearer ${token}`);

  const cached = await db.meta.get(path);
  if (cached?.etag && !init.method) headers.set('if-none-match', cached.etag);

  const res = await fetch(`${API}${path}`, { ...init, headers });

  if (res.status === 304) throw new GitHubError('not modified', 304);
  if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
    const reset = res.headers.get('x-ratelimit-reset');
    throw new GitHubError(`rate limited until ${reset}`, 403);
  }
  if (!res.ok) throw new GitHubError(await res.text(), res.status);

  const etag = res.headers.get('etag');
  if (etag) await markFresh(path, etag);

  return res.json() as Promise<T>;
}
