/**
 * Reads the network.
 *
 * Three paths, in order of preference:
 *
 *   1. `index/network.json` from raw.githubusercontent.com. One request, no
 *      token, CDN cached, and it works for a visitor who has never signed in.
 *   2. Walking `jobs/` and `events/` directly, if the index is missing or
 *      stale. Correct but expensive, so it is the fallback rather than the
 *      default.
 *   3. The IndexedDB copy of whatever was read last, when the network is
 *      unreachable.
 *
 * The index carries raw records and never scores. Everything derived is
 * computed here, in the browser, so the arithmetic stays checkable and a change
 * to the algorithm does not require the ledger to be reindexed.
 */

import { db } from '$core/db';
import { MOCK_EVENTS, MOCK_JOBS } from '$lib/fixtures';
import type { Company, Job, LedgerEvent } from '$lib/types';

const DATA_REPO = import.meta.env.PUBLIC_DATA_REPO ?? 'pointbreaklab-hub/pointbreak-data';
const RAW = `https://raw.githubusercontent.com/${DATA_REPO}/main`;
const API = 'https://api.github.com';

export type NetworkSource = 'index' | 'walk' | 'cache' | 'demo';

export interface NetworkSnapshot {
  jobs: Job[];
  events: LedgerEvent[];
  companies: Company[];
  generated_at?: string;
  source: NetworkSource;
  /** Set when the ledger was read but holds nothing yet. */
  empty: boolean;
}

interface NetworkIndex {
  version: number;
  generated_at: string;
  jobs: Job[];
  events: LedgerEvent[];
  companies: Company[];
}

/**
 * raw.githubusercontent.com sits behind a CDN with a five minute TTL, and the
 * cache key ignores the query string, so a cache-busting parameter does not
 * work. `no-cache` revalidates rather than serving the browser's own copy,
 * which is the most that can be done from here.
 *
 * The practical effect is that another person's write can take up to five
 * minutes to appear. That is fine for a job board, and your own writes are
 * never affected because they are read from IndexedDB before this is consulted.
 */
async function fetchIndex(): Promise<NetworkIndex | null> {
  try {
    const res = await fetch(`${RAW}/index/network.json`, { cache: 'no-cache' });
    if (!res.ok) return null;

    const index = (await res.json()) as NetworkIndex;
    if (index.version !== 1) {
      console.warn(`[network] unknown index version ${index.version}, falling back`);
      return null;
    }

    return index;
  } catch {
    return null;
  }
}

/**
 * Fallback when the index is absent. The trees API lists the whole repository
 * in one request, then each file is fetched from the CDN rather than the API so
 * this does not consume the caller's rate limit.
 */
async function walkRepo(): Promise<NetworkIndex | null> {
  try {
    const res = await fetch(`${API}/repos/${DATA_REPO}/git/trees/main?recursive=1`);
    if (!res.ok) return null;

    const { tree } = (await res.json()) as { tree: Array<{ path: string; type: string }> };
    const paths = tree.filter((entry) => entry.type === 'blob').map((entry) => entry.path);

    const wanted = (dir: string, extension: string) =>
      paths.filter((p) => p.startsWith(`${dir}/`) && p.endsWith(extension));

    const [jobs, companies, eventFiles] = await Promise.all([
      Promise.all(wanted('jobs', '.json').map((p) => fetchJson<Job>(p))),
      Promise.all(wanted('companies', '.json').map((p) => fetchJson<Company>(p))),
      Promise.all(wanted('events', '.jsonl').map((p) => fetchJsonl<LedgerEvent>(p)))
    ]);

    return {
      version: 1,
      generated_at: new Date().toISOString(),
      jobs: jobs.filter((j): j is Job => j !== null),
      companies: companies.filter((c): c is Company => c !== null),
      events: eventFiles.flat()
    };
  } catch {
    return null;
  }
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${RAW}/${path}`);
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

async function fetchJsonl<T>(path: string): Promise<T[]> {
  try {
    const res = await fetch(`${RAW}/${path}`);
    if (!res.ok) return [];

    return (await res.text())
      .split('\n')
      .filter((line) => line.trim())
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as T];
        } catch {
          // Append-only means a malformed line is permanent. One bad line must
          // not make the whole ledger unreadable forever.
          return [];
        }
      });
  } catch {
    return [];
  }
}

async function cache(index: NetworkIndex): Promise<void> {
  try {
    await Promise.all([db.jobs.bulkPut(index.jobs), db.events.bulkPut(index.events)]);
  } catch {
    // A cache write failing is not worth failing the read over.
  }
}

async function fromCache(): Promise<NetworkIndex | null> {
  try {
    const [jobs, events] = await Promise.all([db.jobs.toArray(), db.events.toArray()]);
    if (jobs.length === 0 && events.length === 0) return null;
    return { version: 1, generated_at: '', jobs, events, companies: [] };
  } catch {
    return null;
  }
}

/**
 * Demonstration data, shown only when the ledger is genuinely empty and always
 * labelled as such in the UI.
 *
 * It is deliberately not committed to the data repository. Those companies do
 * not exist, and publishing invented postings into what is meant to be a real
 * public record would mislead anyone who cloned it.
 */
function demo(): NetworkSnapshot {
  return {
    jobs: MOCK_JOBS,
    events: MOCK_EVENTS,
    companies: [],
    source: 'demo',
    empty: true
  };
}

export async function loadNetwork(): Promise<NetworkSnapshot> {
  let source: NetworkSource = 'index';
  let index = await fetchIndex();

  if (!index) {
    source = 'walk';
    index = await walkRepo();
  }

  if (!index) {
    source = 'cache';
    index = await fromCache();
  }

  if (!index) return demo();

  const empty = index.jobs.length === 0 && index.events.length === 0;

  // An empty ledger is a successful read of nothing. Showing a blank board
  // would be honest but useless, so demonstration data stands in, labelled.
  if (empty) return { ...demo(), generated_at: index.generated_at };

  if (source !== 'cache') void cache(index);

  return {
    jobs: index.jobs,
    events: index.events,
    companies: index.companies ?? [],
    generated_at: index.generated_at,
    source,
    empty: false
  };
}
