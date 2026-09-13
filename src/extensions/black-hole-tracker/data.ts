import { db } from '$core/db';
import { localEvents } from '$core/ledger';
import { loadNetwork, type NetworkSource } from '$core/network';
import type { LedgerEvent } from '$lib/types';

export interface TrackerData {
  /** The ledger plus everything this browser recorded. */
  events: LedgerEvent[];
  /** Refs this browser minted. The public ledger carries no identity. */
  myRefs: string[];
  titles: Record<string, string>;
  source: NetworkSource;
  demo: boolean;
}

/**
 * Merges the shared ledger with local writes.
 *
 * Local entries are yours and always present. Shared ones supply the squad
 * counts, which is the only part that needs other people.
 */
export async function loadTracker(_login: string): Promise<TrackerData> {
  const [network, mine, recorded] = await Promise.all([
    loadNetwork(),
    db.myApplications.toArray(),
    localEvents()
  ]);

  const titles: Record<string, string> = {};
  for (const job of network.jobs) titles[job.id] = job.title;
  for (const app of mine) titles[app.job_id] = app.job_title;

  // Local events may duplicate published ones once publishing is on, since the
  // browser keeps its own copy of everything it wrote.
  const seen = new Set(network.events.map((e) => e.id));
  const merged = [...network.events, ...recorded.filter((e) => !seen.has(e.id))];

  return {
    events: merged,
    myRefs: mine.map((a) => a.application_ref),
    titles,
    source: network.source,
    demo: network.source === 'demo'
  };
}
