import { projectAll } from '$core/math-engine';
import type { Application } from '$lib/types';
import { ME, MOCK_EVENTS, MOCK_TITLES } from './mock-events';

export interface TrackerData {
  /** The signed-in user's own applications. */
  mine: Application[];
  /** Everyone's, which is what the Squad count is computed across. */
  all: Application[];
  titles: Record<string, string>;
}

/**
 * Reads the Event Ledger and projects it.
 *
 * TODO: replace the fixture with a read of events/<job_id>.jsonl from the data
 * repo. The projection and everything downstream stays as is, since the ledger
 * shape is the contract.
 */
export async function loadTracker(login: string): Promise<TrackerData> {
  const events = MOCK_EVENTS.map((e) =>
    e.github_login === ME ? { ...e, github_login: login } : e
  );

  const all = projectAll(events);

  return {
    mine: all.filter((a) => a.github_login === login),
    all,
    titles: MOCK_TITLES
  };
}
