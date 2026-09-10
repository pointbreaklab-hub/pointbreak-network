import { deriveMetrics } from '$core/math-engine';
import { MOCK_EVENTS, MOCK_JOBS } from '$lib/fixtures';
import type { GhostScore, Job, JobMetrics } from '$lib/types';
import { scoreJob } from '$core/math-engine';

export interface ScoredJob {
  job: Job;
  metrics: JobMetrics;
  score: GhostScore;
}

/**
 * Jobs with their scores.
 *
 * Metrics are derived from the ledger here rather than read off the job, so a
 * company cannot influence its own score by editing its own file.
 *
 * TODO: replace the fixtures with reads of jobs/ and events/ from the data
 * repo. Everything downstream is already async and shape-stable.
 */
export async function loadScoredJobs(): Promise<ScoredJob[]> {
  const jobs = MOCK_JOBS;
  const events = MOCK_EVENTS;

  return jobs
    .filter((job) => job.status === 'open')
    .map((job) => {
      const metrics = deriveMetrics(job, events, jobs);
      return { job, metrics, score: scoreJob(job, metrics) };
    });
}
