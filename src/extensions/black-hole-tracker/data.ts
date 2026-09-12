import { localEvents } from '$core/ledger';
import { db } from '$core/db';
import { MOCK_EVENTS, MOCK_TITLES, MY_REFS } from '$lib/fixtures';
import type { LedgerEvent } from '$lib/types';

export interface TrackerData {
  /** Fixture ledger plus everything this browser has recorded. */
  events: LedgerEvent[];
  /** Refs this browser minted. The public ledger carries no identity. */
  myRefs: string[];
  titles: Record<string, string>;
}

/**
 * Merges the demonstration ledger with real local writes.
 *
 * The fixtures stay until there is a shared ledger worth reading, because a
 * tracker with one row in it cannot show what a squad count or a disputed claim
 * looks like. Real entries are yours and persist; fixture ones are illustration.
 */
export async function loadTracker(_login: string): Promise<TrackerData> {
  const [mine, recorded] = await Promise.all([db.myApplications.toArray(), localEvents()]);

  const titles = { ...MOCK_TITLES };
  for (const app of mine) titles[app.job_id] = app.job_title;

  return {
    events: [...MOCK_EVENTS, ...recorded],
    myRefs: [...MY_REFS, ...mine.map((a) => a.application_ref)],
    titles
  };
}
