import { MOCK_EVENTS, MOCK_TITLES, MY_REFS } from '$lib/fixtures';
import type { LedgerEvent } from '$lib/types';

export interface TrackerData {
  /** Raw ledger. Projection happens in the view so local appends are live. */
  events: LedgerEvent[];
  /** Refs this browser minted. The ledger itself carries no identity. */
  myRefs: string[];
  titles: Record<string, string>;
}

/**
 * TODO: replace with a read of events/<job_id>.jsonl from the data repo, and
 * read myRefs from db.myApplications instead of a fixture constant.
 */
export async function loadTracker(_login: string): Promise<TrackerData> {
  return { events: [...MOCK_EVENTS], myRefs: [...MY_REFS], titles: { ...MOCK_TITLES } };
}
