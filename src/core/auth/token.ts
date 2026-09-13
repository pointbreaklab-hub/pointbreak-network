/**
 * Personal access token sign-in.
 *
 * The whole auth story for a static site, because `api.github.com` is
 * CORS-enabled and `github.com/login/*` is not. A token the user creates and
 * pastes needs no relay, no client secret, and no server.
 *
 * It is also the more honest fit for this project: the token is the user's,
 * scoped by them, revocable by them, and visible in their GitHub settings. No
 * third party is issuing or holding anything.
 */

import type { GhIdentity } from './session.svelte';

const API = 'https://api.github.com';

export class TokenError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid' | 'network' | 'scope'
  ) {
    super(message);
    this.name = 'TokenError';
  }
}

/** Rejects the token rather than storing something that will fail later. */
export async function verifyToken(token: string): Promise<GhIdentity> {
  const trimmed = token.trim();
  if (!trimmed) throw new TokenError('Paste a token first.', 'invalid');

  let res: Response;
  try {
    res = await fetch(`${API}/user`, {
      headers: {
        authorization: `Bearer ${trimmed}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28'
      }
    });
  } catch {
    throw new TokenError('Could not reach api.github.com. Check your connection.', 'network');
  }

  if (res.status === 401) {
    throw new TokenError(
      'GitHub rejected that token. It may be mistyped, expired, or revoked.',
      'invalid'
    );
  }
  if (!res.ok) {
    throw new TokenError(`GitHub returned ${res.status} when checking the token.`, 'invalid');
  }

  const user = (await res.json()) as { login: string; name?: string };

  return { github_login: user.login, display_name: user.name };
}
