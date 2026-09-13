import { deriveMetrics, projectAll } from '$core/math-engine';
import { MOCK_EVENTS, MOCK_JOBS } from '$lib/fixtures';
import type { Application, Job, JobMetrics } from '$lib/types';

export interface ManagedPosting {
  job: Job;
  metrics: JobMetrics;
  applications: Application[];
}

/**
 * Postings a company would manage.
 *
 * Company identity is not built: nobody can claim a company profile yet, so
 * there is no way to know which postings belong to the signed-in user. Until
 * that exists this returns the fixture postings that were created here, which
 * is what a claimed company would see.
 *
 * TODO: scope to the company the user has claimed, once claiming exists.
 */
export async function loadManagedPostings(): Promise<ManagedPosting[]> {
  const applications = projectAll(MOCK_EVENTS);

  return MOCK_JOBS.filter((job) => job.source === 'pointbreak' && job.status === 'open').map(
    (job) => ({
      job,
      metrics: deriveMetrics(job, MOCK_EVENTS, MOCK_JOBS),
      applications: applications.filter((a) => a.job_id === job.id)
    })
  );
}
