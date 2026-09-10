/**
 * Projects the append-only Event Ledger into Application Records.
 *
 * The ledger is the source of truth and an Application is a view over it. A
 * company cannot move a candidate out of a black hole without appending an
 * event, and every event that clears one also moves its Ghost Score. There is
 * no status field to quietly edit.
 */

import type { Application, ApplicationStatus, LedgerAction, LedgerEvent } from '$lib/types';

/** Actions only a company can take. These, and only these, break silence. */
const COMPANY_ACTIONS: LedgerAction[] = ['resume_viewed', 'interview_scheduled', 'rejection_sent'];

const STATUS_FOR: Record<LedgerAction, ApplicationStatus> = {
  application_submitted: 'submitted',
  resume_viewed: 'viewed',
  interview_scheduled: 'interviewing',
  rejection_sent: 'rejected'
};

/** Later stages never regress: a view logged after an interview is not a demotion. */
const RANK: Record<ApplicationStatus, number> = {
  submitted: 0,
  viewed: 1,
  interviewing: 2,
  rejected: 3
};

const at = (e: LedgerEvent) => Date.parse(e.at);

export function projectApplication(events: LedgerEvent[]): Application | null {
  if (events.length === 0) return null;

  const ordered = [...events].sort((a, b) => at(a) - at(b));
  const submitted = ordered.find((e) => e.action === 'application_submitted') ?? ordered[0];

  let status: ApplicationStatus = 'submitted';
  for (const event of ordered) {
    const candidate = STATUS_FOR[event.action];
    if (RANK[candidate] > RANK[status]) status = candidate;
  }

  const lastCompanyAction = ordered.filter((e) => COMPANY_ACTIONS.includes(e.action)).at(-1);

  return {
    job_id: submitted.job_id,
    github_login: submitted.github_login,
    status,
    submitted_at: submitted.at,
    last_action_at: lastCompanyAction?.at ?? submitted.at
  };
}

/** Groups a whole ledger by (job, candidate) and projects each group. */
export function projectAll(events: LedgerEvent[]): Application[] {
  const groups = new Map<string, LedgerEvent[]>();

  for (const event of events) {
    const key = `${event.job_id} ${event.github_login}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(event);
    else groups.set(key, [event]);
  }

  return [...groups.values()]
    .map(projectApplication)
    .filter((a): a is Application => a !== null);
}
