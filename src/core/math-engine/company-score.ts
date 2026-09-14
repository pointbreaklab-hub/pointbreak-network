/**
 * Company-level transparency scoring.
 *
 * Why this exists separately from the job score
 * ---------------------------------------------
 * A per-posting score needs several people to have applied to the same job,
 * which almost never happens: applications spread across tens of thousands of
 * postings. Aggregating by company needs several people to have applied to the
 * same *employer*, which happens constantly, because applications concentrate
 * on a small number of well known names.
 *
 * Same ledger, same attestation rules, roughly a hundredth of the users needed
 * before the number means anything. It is also the question people actually
 * ask: not "is req 4021 a ghost" but "does this company answer anyone".
 *
 * Nothing here uses data a company supplied about itself, and a company action
 * counts only once the candidate it names confirms it happened.
 */

import type {
  CompanyMetrics,
  CompanyScore,
  GhostBand,
  Job,
  LedgerEvent,
  ScoreRule
} from '$lib/types';
import { daysBetween } from '$lib/utils';
import { attestations, counts, projectAll } from './ledger';

/** Below this, a company is reported as unmeasured rather than scored. */
export const MIN_COMPANY_SAMPLE = 5;

export const STALE_POSTING_DAYS = 60;
export const SLOW_RESPONSE_DAYS = 21;
export const FAST_RESPONSE_DAYS = 7;

export const COMPANY_BANDS = { mixed: 30, black_hole: 60 } as const;

export const COMPANY_BAND_LABELS: Record<GhostBand, { emoji: string; label: string }> = {
  active: { emoji: '\u{1F7E2}', label: 'Responsive' },
  evergreen: { emoji: '\u{1F7E1}', label: 'Patchy' },
  ghost: { emoji: '\u{1F534}', label: 'Black hole' }
};

/**
 * Did the company do something the candidate accepts as real?
 *
 * An application being submitted is the candidate acting, not the company, so
 * it must never count as a response. Getting this wrong makes a posting with
 * ten ignored applicants look engaged purely because the applicants exist.
 *
 * A candidate-reported rejection or interview also counts: they heard
 * something, whoever wrote it down.
 */
function isResponse(event: LedgerEvent, attested: Map<string, string>): boolean {
  if (event.actor === 'company') return counts(event, attested);
  return event.action === 'rejection_received' || event.action === 'interview_held';
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Aggregates every posting a company has into one picture.
 *
 * `respondedApplications` counts applications where the candidate confirmed at
 * least one company action. An unconfirmed claim is not a response, which is
 * the same rule the black hole clock uses and the reason a recruiter cannot
 * improve this number by marking work as done.
 */
export function deriveCompanyMetrics(
  companyId: string,
  jobs: Job[],
  events: LedgerEvent[]
): CompanyMetrics {
  const theirJobs = jobs.filter((job) => job.company_id === companyId);
  const jobIds = new Set(theirJobs.map((job) => job.id));
  const theirEvents = events.filter((event) => jobIds.has(event.job_id));

  const attested = attestations(theirEvents);
  const applications = projectAll(theirEvents);

  const daysToFirstResponse: number[] = [];
  let responded = 0;

  for (const application of applications) {
    const forThis = theirEvents.filter(
      (event) => event.application_ref === application.application_ref
    );

    const first = forThis
      .filter((event) => isResponse(event, attested))
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0];

    if (!first) continue;

    responded++;
    const gap = daysBetween(application.submitted_at, first.at);
    if (gap >= 0) daysToFirstResponse.push(gap);
  }

  const real = theirEvents.filter((event) => counts(event, attested));
  const claims = theirEvents.filter((event) => event.actor === 'company');

  const stalePostings = theirJobs.filter((job) => {
    if (job.status !== 'open') return false;
    if (daysBetween(job.first_seen_at ?? job.posted_at) <= STALE_POSTING_DAYS) return false;

    const forJob = theirEvents.filter((e) => e.job_id === job.id);
    return !forJob.some((e) => isResponse(e, attested));
  }).length;

  return {
    company_id: companyId,
    applications: applications.length,
    responded,
    never_responded: applications.length - responded,
    response_rate: applications.length ? responded / applications.length : 0,
    median_days_to_response: median(daysToFirstResponse),
    interviews_attested: real.filter(
      (e) => e.action === 'interview_scheduled' || e.action === 'interview_held'
    ).length,
    rejections_attested: real.filter(
      (e) => e.action === 'rejection_sent' || e.action === 'rejection_received'
    ).length,
    claims_total: claims.length,
    claims_disputed: claims.filter((e) => attested.get(e.id) === 'disputed').length,
    open_postings: theirJobs.filter((job) => job.status === 'open').length,
    stale_postings: stalePostings,
    total_postings: theirJobs.length
  };
}

/**
 * A flat rule table, like the job score, so every point traces to one named
 * condition a company can read and act on.
 *
 * Below MIN_COMPANY_SAMPLE the company is returned as unmeasured. Publishing a
 * damning number derived from two reports would be both misleading and the
 * fastest way to deserve a legal letter.
 */
export function scoreCompany(metrics: CompanyMetrics): CompanyScore {
  const enough = metrics.applications >= MIN_COMPANY_SAMPLE;
  const slow = metrics.median_days_to_response;

  const breakdown: ScoreRule[] = [
    {
      id: 'rarely_responds',
      label: `${Math.round(metrics.response_rate * 100)}% of tracked applicants heard anything back`,
      points: 25,
      applied: enough && metrics.response_rate < 0.25
    },
    {
      id: 'majority_ignored',
      label: `${metrics.never_responded} of ${metrics.applications} applicants never heard back`,
      points: 20,
      applied: enough && metrics.never_responded / metrics.applications > 0.5
    },
    {
      id: 'slow_when_they_do',
      label: slow === null ? 'No responses to time' : `Median ${Math.round(slow)} days to a first reply`,
      points: 15,
      applied: enough && slow !== null && slow > SLOW_RESPONSE_DAYS
    },
    {
      id: 'serial_stale',
      label: `${metrics.stale_postings} postings open over ${STALE_POSTING_DAYS} days with nothing confirmed`,
      points: 20,
      applied: metrics.stale_postings > 2
    },
    {
      id: 'inflated_claims',
      label: `${metrics.claims_disputed} of ${metrics.claims_total} logged actions disputed by candidates`,
      points: 15,
      applied:
        metrics.claims_disputed >= 3 &&
        metrics.claims_total > 0 &&
        metrics.claims_disputed / metrics.claims_total > 0.2
    },
    {
      id: 'responsive',
      label: `${Math.round(metrics.response_rate * 100)}% of applicants heard back`,
      points: -20,
      applied: enough && metrics.response_rate >= 0.75
    },
    {
      id: 'fast',
      label: slow === null ? '' : `Median ${Math.round(slow)} days to a first reply`,
      points: -10,
      applied: enough && slow !== null && slow <= FAST_RESPONSE_DAYS
    }
  ];

  const raw = breakdown.reduce((sum, rule) => sum + (rule.applied ? rule.points : 0), 0);
  const score = Math.max(0, Math.min(100, raw));

  return {
    company_id: metrics.company_id,
    score,
    band: companyBandFor(score),
    measured: enough,
    sample: metrics.applications,
    breakdown,
    metrics
  };
}

export function companyBandFor(score: number): GhostBand {
  if (score >= COMPANY_BANDS.black_hole) return 'ghost';
  if (score >= COMPANY_BANDS.mixed) return 'evergreen';
  return 'active';
}

/** Every company present in the ledger, scored. Unmeasured ones included. */
export function scoreAllCompanies(jobs: Job[], events: LedgerEvent[]): CompanyScore[] {
  const ids = [...new Set(jobs.map((job) => job.company_id))];
  return ids.map((id) => scoreCompany(deriveCompanyMetrics(id, jobs, events)));
}
