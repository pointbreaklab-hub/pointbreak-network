import { deriveMetrics, scoreJob } from '$core/math-engine';
import { loadNetwork, type NetworkSource } from '$core/network';
import type { GhostScore, Job, JobMetrics } from '$lib/types';

export interface ScoredJob {
  job: Job;
  metrics: JobMetrics;
  score: GhostScore;
}

export interface JobBoardData {
  postings: ScoredJob[];
  source: NetworkSource;
  /** True when the ledger is empty and these are demonstration postings. */
  demo: boolean;
}

/**
 * Reads the ledger and scores it.
 *
 * Metrics are derived here rather than read off a job, so a company cannot move
 * its own score by editing its own file, and the index deliberately ships no
 * scores so this arithmetic stays checkable in the browser.
 */
export async function loadScoredJobs(): Promise<JobBoardData> {
  const network = await loadNetwork();

  const postings = network.jobs
    .filter((job) => job.status === 'open')
    .map((job) => {
      const metrics = deriveMetrics(job, network.events, network.jobs);
      return { job, metrics, score: scoreJob(job, metrics) };
    });

  return { postings, source: network.source, demo: network.source === 'demo' };
}
