import { deriveMetrics, projectAll } from '$core/math-engine';
import { loadNetwork, type NetworkSource } from '$core/network';
import type { Application, Job, JobMetrics } from '$lib/types';

export interface ManagedPosting {
  job: Job;
  metrics: JobMetrics;
  applications: Application[];
}

export interface CompanyData {
  postings: ManagedPosting[];
  source: NetworkSource;
  demo: boolean;
}

/**
 * Postings a company would manage.
 *
 * Company claiming does not exist, so there is no way to know which postings
 * belong to the signed-in user. Until it does, this returns everything posted
 * through PointBreak, which is what a claimed company would see.
 */
export async function loadManagedPostings(): Promise<CompanyData> {
  const network = await loadNetwork();
  const applications = projectAll(network.events);

  const postings = network.jobs
    .filter((job) => job.source === 'pointbreak' && job.status === 'open')
    .map((job) => ({
      job,
      metrics: deriveMetrics(job, network.events, network.jobs),
      applications: applications.filter((a) => a.job_id === job.id)
    }));

  return { postings, source: network.source, demo: network.source === 'demo' };
}
