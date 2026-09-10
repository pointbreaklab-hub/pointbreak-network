import type { Job } from '$lib/types';
import { MOCK_JOBS } from './mock-jobs';

/**
 * Job source.
 *
 * TODO: replace the fixture with a read of `jobs/` from the data repo via
 * $core/github-api. Everything downstream already treats this as async, so the
 * swap is confined to this function.
 */
export async function loadJobs(): Promise<Job[]> {
  return MOCK_JOBS;
}
