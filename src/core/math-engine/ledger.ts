/**
 * Projects the append-only Event Ledger into Application Records and the
 * metrics a Ghost Score is computed from.
 *
 * The rule that makes the whole system work: a company claim is worth nothing
 * until the candidate on the other end confirms it. Companies have every
 * incentive to overstate how responsive they were, candidates have every
 * incentive to report accurately, so evidence is collected from the side whose
 * interests point at the truth.
 */

import {
  CLAIM_ACTIONS,
  type Application,
  type ApplicationStatus,
  type Job,
  type JobMetrics,
  type LedgerAction,
  type LedgerEvent
} from '$lib/types';

const STATUS_FOR: Partial<Record<LedgerAction, ApplicationStatus>> = {
  application_submitted: 'submitted',
  resume_viewed: 'viewed',
  interview_scheduled: 'interviewing',
  interview_held: 'interviewing',
  rejection_sent: 'rejected',
  rejection_received: 'rejected',
  offer_received: 'offer',
  withdrawn: 'withdrawn'
};

/** Later stages never regress: a view logged after an interview is not a demotion. */
const RANK: Record<ApplicationStatus, number> = {
  submitted: 0,
  viewed: 1,
  interviewing: 2,
  rejected: 3,
  offer: 4,
  withdrawn: 5
};

const at = (e: LedgerEvent) => Date.parse(e.at);
const isClaim = (e: LedgerEvent) => CLAIM_ACTIONS.includes(e.action);

/**
 * Attestation state of every claim in a ledger.
 *
 * A dispute always wins over a confirmation. Someone who first confirmed and
 * then disputed has almost certainly discovered they were wrong, and the
 * failure mode we care about is a company being credited for something that
 * never happened.
 */
export function attestations(events: LedgerEvent[]): Map<string, 'confirmed' | 'disputed'> {
  const state = new Map<string, 'confirmed' | 'disputed'>();

  for (const event of events) {
    if (!event.ref_event) continue;
    if (event.action === 'claim_disputed') state.set(event.ref_event, 'disputed');
    else if (event.action === 'claim_confirmed' && state.get(event.ref_event) !== 'disputed') {
      state.set(event.ref_event, 'confirmed');
    }
  }

  return state;
}

/**
 * Does this event count as something the company actually did?
 *
 * Candidate-authored events are self-evident: nobody invents a rejection they
 * did not receive. Company-authored claims need the candidate to confirm.
 */
export function counts(event: LedgerEvent, attested: Map<string, string>): boolean {
  if (!isClaim(event)) return event.actor === 'candidate';
  return attested.get(event.id) === 'confirmed';
}

export function projectApplication(events: LedgerEvent[]): Application | null {
  if (events.length === 0) return null;

  const ordered = [...events].sort((a, b) => at(a) - at(b));
  const attested = attestations(ordered);
  const submitted = ordered.find((e) => e.action === 'application_submitted') ?? ordered[0];

  let status: ApplicationStatus = 'submitted';
  for (const event of ordered) {
    if (!counts(event, attested) && event.action !== 'application_submitted') continue;
    const next = STATUS_FOR[event.action];
    if (next && RANK[next] > RANK[status]) status = next;
  }

  // Only actions the candidate accepts as real break the silence clock. An
  // unconfirmed "we viewed your resume" cannot be used to reset it.
  const lastReal = ordered.filter((e) => e.actor === 'company' && counts(e, attested)).at(-1);

  const pending_claims = ordered.filter((e) => isClaim(e) && !attested.has(e.id));

  return {
    job_id: submitted.job_id,
    application_ref: submitted.application_ref,
    status,
    submitted_at: submitted.at,
    last_action_at: lastReal?.at ?? submitted.at,
    pending_claims
  };
}

/** Groups a ledger by application and projects each group. */
export function projectAll(events: LedgerEvent[]): Application[] {
  const groups = new Map<string, LedgerEvent[]>();

  for (const event of events) {
    const key = `${event.job_id} ${event.application_ref}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(event);
    else groups.set(key, [event]);
  }

  return [...groups.values()]
    .map(projectApplication)
    .filter((a): a is Application => a !== null);
}

/**
 * The numbers a Ghost Score runs on, derived rather than self-reported.
 *
 * `siblings` are the company's other postings, used to count reposts by
 * description hash so that too stops being a number the company writes down.
 */
export function deriveMetrics(
  job: Job,
  events: LedgerEvent[],
  siblings: Job[] = []
): JobMetrics {
  const forJob = events.filter((e) => e.job_id === job.id);
  const attested = attestations(forJob);

  const applications = new Set(
    forJob.filter((e) => e.action === 'application_submitted').map((e) => e.application_ref)
  ).size;

  const real = forJob.filter((e) => counts(e, attested));
  const claims = forJob.filter(isClaim);

  const interviews_attested = real.filter(
    (e) => e.action === 'interview_scheduled' || e.action === 'interview_held'
  ).length;

  const rejections_attested = real.filter(
    (e) => e.action === 'rejection_sent' || e.action === 'rejection_received'
  ).length;

  const reposts = job.description_hash
    ? siblings.filter(
        (s) =>
          s.id !== job.id &&
          s.company_id === job.company_id &&
          s.description_hash === job.description_hash
      ).length
    : 0;

  return {
    applications,
    interviews_attested,
    rejections_attested,
    claims_total: claims.length,
    claims_unattested: claims.filter((e) => !attested.has(e.id)).length,
    claims_disputed: claims.filter((e) => attested.get(e.id) === 'disputed').length,
    reposts
  };
}
