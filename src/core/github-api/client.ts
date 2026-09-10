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

/** The token is dead. The only fix is signing in again. */
export class AuthError extends GitHubError {
  constructor(message = 'Your GitHub session expired. Sign in again.') {
    super(message, 401);
    this.name = 'AuthError';
  }
}

export class RateLimitError extends GitHubError {
  constructor(readonly resetAt: Date) {
    super(`GitHub rate limit exhausted, resets ${resetAt.toLocaleTimeString()}`, 403);
    this.name = 'RateLimitError';
  }
}

export interface GhResponse<T> {
  data: T;
  headers: Headers;
}

/**
 * Returns headers alongside the body. Needed because GitHub reports collection
 * sizes only in the `Link` header. Asking for one item per page and reading
 * the last page number is the documented way to count commits without paging
 * through all of them.
 */
export async function ghFetchRaw<T>(path: string, init: RequestInit = {}): Promise<GhResponse<T>> {
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
    const reset = Number(res.headers.get('x-ratelimit-reset') ?? 0);
    throw new RateLimitError(new Date(reset * 1000));
  }

  if (res.status === 401) {
    // A rejected token cannot be salvaged, and leaving it in storage means every
    // subsequent call fails the same way. Drop it so the guard sends the user
    // back to sign-in.
    session.signOut();
    throw new AuthError();
  }

  if (!res.ok) throw new GitHubError(await errorMessage(res), res.status);

  const etag = res.headers.get('etag');
  if (etag) await markFresh(path, etag);

  return { data: (await res.json()) as T, headers: res.headers };
}

export async function ghFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  return (await ghFetchRaw<T>(path, init)).data;
}

/**
 * GraphQL, needed for the few things REST does not expose. Private contribution
 * totals are the important one: they let an engineer whose work is all in
 * private repos prove volume without revealing a single repository name.
 */
export async function ghGraphQL<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const token = session.current?.token;
  if (!token) throw new AuthError('GraphQL requires a signed-in session.');

  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });

  if (res.status === 401) {
    session.signOut();
    throw new AuthError();
  }
  if (!res.ok) throw new GitHubError(await errorMessage(res), res.status);

  const body = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (body.errors?.length) throw new GitHubError(body.errors[0].message, 200);
  if (!body.data) throw new GitHubError('empty GraphQL response', 200);

  return body.data;
}

/**
 * GitHub reports failures as {"message": "...", "documentation_url": "..."}.
 * Surfacing the whole body puts raw JSON in front of the user.
 */
async function errorMessage(res: Response): Promise<string> {
  const body = await res.text();
  try {
    const parsed = JSON.parse(body) as { message?: string };
    return parsed.message ?? body;
  } catch {
    return body;
  }
}

/**
 * Total item count for a paginated collection, read from the `Link` header's
 * `rel="last"` page number. Callers must request `per_page=1` for the number to
 * mean "items" rather than "pages".
 */
export function countFromLinkHeader(headers: Headers, itemsOnPage: number): number {
  const link = headers.get('link');
  if (!link) return itemsOnPage;

  const last = link.split(',').find((part) => part.includes('rel="last"'));
  if (!last) return itemsOnPage;

  const page = last.match(/[?&]page=(\d+)/)?.[1];
  return page ? Number(page) : itemsOnPage;
}
