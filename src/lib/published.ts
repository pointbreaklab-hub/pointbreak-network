/**
 * Reading published portfolios.
 *
 * Served from raw.githubusercontent.com so a shared link works for someone with
 * no account, no token and no idea what this site is. That is the whole point
 * of a portfolio URL, and requiring a sign-in to view one would defeat it.
 */

import type { Portfolio } from './portfolio';

const DATA_REPO = import.meta.env.PUBLIC_DATA_REPO ?? 'pointbreaklab-hub/pointbreak-data';
const RAW = `https://raw.githubusercontent.com/${DATA_REPO}/main`;

export type PublishedState =
  | { status: 'published'; portfolio: Portfolio; published_at?: string }
  | { status: 'not_published' }
  | { status: 'error'; message: string };

export async function loadPublishedPortfolio(login: string): Promise<PublishedState> {
  const safe = login.toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!safe) return { status: 'not_published' };

  try {
    const res = await fetch(`${RAW}/users/${safe}/portfolio.json`, { cache: 'no-cache' });

    // A missing file is the normal state for most logins, not an error.
    if (res.status === 404) return { status: 'not_published' };
    if (!res.ok) return { status: 'error', message: `Could not load that profile (${res.status}).` };

    const portfolio = (await res.json()) as Portfolio & { published_at?: string };

    // A file that exists but is not marked public should not render. Belt and
    // braces: the service refuses to write one, but the reader should not rely
    // on that having always been true.
    if (portfolio.visibility !== 'public') return { status: 'not_published' };

    return { status: 'published', portfolio, published_at: portfolio.published_at };
  } catch {
    return { status: 'error', message: 'Could not reach the network.' };
  }
}
