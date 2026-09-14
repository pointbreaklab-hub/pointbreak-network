import { session } from '$core/auth/session.svelte';
import { db } from '$core/db';
import { PUBLISHING_ENABLED } from '$core/ledger';
import { emptyPortfolio, type Portfolio, type Visibility } from '$lib/portfolio';

const LEDGER_URL = import.meta.env.PUBLIC_LEDGER_URL ?? '';

/**
 * Portfolios are local first, like everything else here, and for a stronger
 * reason: a CV holds a phone number and often a home address. Nothing leaves
 * the browser until the user publishes deliberately, and what is published is
 * the parsed structure rather than the file.
 */

export async function loadPortfolio(login: string): Promise<Portfolio | null> {
  return (await db.portfolios.get(login)) ?? null;
}

export async function savePortfolio(portfolio: Portfolio): Promise<void> {
  // Svelte 5 wraps $state in a Proxy, and IndexedDB's structured clone refuses
  // proxies with a DataCloneError. A spread only unwraps the top level, so
  // nested arrays still throw. Round-tripping through JSON strips every layer
  // and keeps callers from having to remember $state.snapshot().
  const plain = JSON.parse(JSON.stringify(portfolio)) as Portfolio;
  await db.portfolios.put({ ...plain, updated_at: new Date().toISOString() });
}

export async function createPortfolio(login: string): Promise<Portfolio> {
  const portfolio = emptyPortfolio(login);
  await savePortfolio(portfolio);
  return portfolio;
}

export async function deletePortfolio(login: string): Promise<void> {
  await db.portfolios.delete(login);
}

export interface PublishResult {
  ok: boolean;
  message: string;
}

/**
 * Publishing is the only thing that makes a portfolio leave this browser.
 *
 * It needs the ledger service, because a candidate cannot be given write access
 * to the shared data repository. Until that service is running, a portfolio can
 * be built, previewed and kept, and simply cannot be shared.
 */
export async function publishPortfolio(portfolio: Portfolio): Promise<PublishResult> {
  if (portfolio.visibility !== 'public') {
    return { ok: false, message: 'Set visibility to public before publishing.' };
  }

  if (!PUBLISHING_ENABLED) {
    return {
      ok: false,
      message:
        'Publishing is off in this build, so this portfolio stays on this device. Everything else works.'
    };
  }

  const token = session.current?.token;
  if (!token) return { ok: false, message: 'Sign in before publishing.' };

  try {
    const res = await fetch(`${LEDGER_URL}/portfolio`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      // A JSON round-trip strips the Svelte state proxy, which cannot be
      // serialised by every path it passes through.
      body: JSON.stringify(JSON.parse(JSON.stringify(portfolio)))
    });

    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return { ok: false, message: explain(body.error ?? `http_${res.status}`) };

    return {
      ok: true,
      message: `Published. Anyone can now read it at /u/${portfolio.github_login.toLowerCase()}.`
    };
  } catch {
    return {
      ok: false,
      message:
        'Could not reach the publishing service, so nothing was sent. Your portfolio is unchanged on this device.'
    };
  }
}

/** Removes a published portfolio. History keeps it; the page stops serving it. */
export async function unpublishPortfolio(): Promise<PublishResult> {
  const token = session.current?.token;
  if (!token) return { ok: false, message: 'Sign in first.' };

  try {
    const res = await fetch(`${LEDGER_URL}/portfolio`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` }
    });
    if (!res.ok) return { ok: false, message: 'Could not remove it. Try again.' };

    return {
      ok: true,
      message:
        'Removed from the network. It stays in the Git history, which cannot be rewritten, so treat anything once published as permanently on the record.'
    };
  } catch {
    return { ok: false, message: 'Could not reach the publishing service.' };
  }
}

function explain(code: string): string {
  const key = code.split(':')[0];
  const messages: Record<string, string> = {
    contact_details_present:
      'This still contains contact details, so it was refused. A public repository keeps them in its history forever, even after deletion.',
    not_public: 'Set visibility to public before publishing.',
    account_too_new: 'This GitHub account is too new to publish yet.',
    portfolio_too_large: 'That portfolio is too large to publish.',
    bad_github_token: 'GitHub rejected your token. Sign in again.'
  };
  return messages[key] ?? code;
}

/** Only two states can actually be enforced. See lib/portfolio.ts. */
export function visibilityHelp(visibility: Visibility): string {
  switch (visibility) {
    case 'public':
      return 'Anyone can read it, including people who are not signed in.';
    case 'hidden':
      return 'Stays on this device. Nobody else can read it, including us.';
    case 'specific_people':
    case 'hiring_managers':
      return 'Not available yet. See below.';
  }
}
