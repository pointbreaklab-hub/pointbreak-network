import { db } from '$core/db';
import { PUBLISHING_ENABLED } from '$core/ledger';
import { emptyPortfolio, type Portfolio, type Visibility } from '$lib/portfolio';

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

  return {
    ok: false,
    message:
      'The publish endpoint is not built yet. The portfolio is saved here and nothing has been sent anywhere.'
  };
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
