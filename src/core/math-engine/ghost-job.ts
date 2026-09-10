/**
 * Ghost Job scoring.
 *
 * Deliberately readable and deliberately client-side: the weights below are the
 * whole algorithm, and anyone can check that the number on screen is what this
 * function returns for the published inputs.
 *
 * Convention: every signal is 0..1 where 1 is *worse* for the job seeker.
 */

import type { Application, GhostScore, JobPost, Signal } from '$lib/types';
import { daysBetween, normalize } from '$lib/utils';

export const WEIGHTS = {
  staleness: 0.3,
  responseRate: 0.3,
  funnelDropoff: 0.2,
  repostFrequency: 0.2
} as const;

/** A posting open past ~90 days with no hire is the strongest single signal. */
function staleness(job: JobPost): Signal {
  return {
    name: 'staleness',
    weight: WEIGHTS.staleness,
    value: normalize(daysBetween(job.postedAt), 14, 90)
  };
}

/** Share of applicants who never heard anything back. */
function responseRate(job: JobPost, applications: Application[]): Signal {
  const received = job.disclosure.applicationsReceived ?? applications.length;
  if (received === 0) return { name: 'responseRate', weight: WEIGHTS.responseRate, value: 0 };

  const answered =
    job.disclosure.advancedToScreen ??
    applications.filter((a) => a.history.some((h) => !h.inferred && h.stage !== 'submitted')).length;

  return {
    name: 'responseRate',
    weight: WEIGHTS.responseRate,
    value: 1 - normalize(answered / received, 0, 0.25)
  };
}

/** A funnel that collapses to zero offers after many onsites suggests no req. */
function funnelDropoff(job: JobPost): Signal {
  const { advancedToOnsite = 0, offersExtended = 0 } = job.disclosure;
  if (advancedToOnsite === 0) return { name: 'funnelDropoff', weight: WEIGHTS.funnelDropoff, value: 0 };

  return {
    name: 'funnelDropoff',
    weight: WEIGHTS.funnelDropoff,
    value: 1 - normalize(offersExtended / advancedToOnsite, 0, 0.3)
  };
}

/** The same title reposted repeatedly without a recorded hire. */
function repostFrequency(job: JobPost, siblings: JobPost[]): Signal {
  const reposts = siblings.filter(
    (j) => j.id !== job.id && j.companyId === job.companyId && j.title === job.title
  );
  const withoutHire = reposts.filter((j) => (j.disclosure.hires ?? 0) === 0).length;

  return {
    name: 'repostFrequency',
    weight: WEIGHTS.repostFrequency,
    value: normalize(withoutHire, 0, 3)
  };
}

/**
 * Confidence tracks how much of the funnel the company actually published.
 * A company that discloses nothing gets low confidence, not a good score —
 * and low-confidence postings rank below disclosed ones.
 */
function confidenceOf(job: JobPost): number {
  const fields = [
    job.disclosure.applicationsReceived,
    job.disclosure.advancedToScreen,
    job.disclosure.advancedToOnsite,
    job.disclosure.offersExtended,
    job.disclosure.hires
  ];
  const disclosed = fields.filter((f) => f !== undefined).length / fields.length;

  const freshness = job.disclosure.lastUpdated
    ? 1 - normalize(daysBetween(job.disclosure.lastUpdated), 7, 60)
    : 0.3;

  return Number((disclosed * 0.7 + freshness * 0.3).toFixed(2));
}

export function scoreJob(
  job: JobPost,
  applications: Application[] = [],
  siblings: JobPost[] = []
): GhostScore {
  const signals = [
    staleness(job),
    responseRate(job, applications),
    funnelDropoff(job),
    repostFrequency(job, siblings)
  ];

  const score = signals.reduce((sum, s) => sum + s.weight * s.value, 0);

  return {
    jobId: job.id,
    score: Number(score.toFixed(2)),
    confidence: confidenceOf(job),
    signals
  };
}
