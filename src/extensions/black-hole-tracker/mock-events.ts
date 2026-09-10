/**
 * Fixture Event Ledger.
 *
 * Shaped to exercise every tracked state plus the Black Hole Squad count.
 * `ME` is substituted for the signed-in login at load time so the dashboard is
 * populated whoever is looking at it.
 *
 * TODO: delete once events/<job_id>.jsonl is published to the data repo.
 */

import type { LedgerEvent } from '$lib/types';

export const ME = '__me__';

const ago = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

const submitted = (job_id: string, github_login: string, days: number): LedgerEvent => ({
  job_id,
  github_login,
  action: 'application_submitted',
  at: ago(days),
  actor: 'candidate'
});

const company = (
  job_id: string,
  github_login: string,
  action: LedgerEvent['action'],
  days: number
): LedgerEvent => ({ job_id, github_login, action, at: ago(days), actor: 'company' });

/** Other candidates stuck on the same postings, which is what Squad counts. */
function squad(job_id: string, logins: string[], submittedDays: number, viewed: boolean) {
  return logins.flatMap((login, i) => [
    submitted(job_id, login, submittedDays + i),
    ...(viewed ? [company(job_id, login, 'resume_viewed', submittedDays + i - 3)] : [])
  ]);
}

export const MOCK_EVENTS: LedgerEvent[] = [
  // Interviewing. The company is acting, so no black hole.
  submitted('job_aurelia_backend', ME, 12),
  company('job_aurelia_backend', ME, 'resume_viewed', 11),
  company('job_aurelia_backend', ME, 'interview_scheduled', 5),

  // Viewed then dropped, just past the 14 day line.
  submitted('job_northwind_platform', ME, 20),
  company('job_northwind_platform', ME, 'resume_viewed', 18),

  // Viewed then dropped, two months of silence.
  submitted('job_halcyon_fullstack', ME, 60),
  company('job_halcyon_fullstack', ME, 'resume_viewed', 55),
  ...squad('job_halcyon_fullstack', ['ada-l', 'grace-h', 'linus-t'], 50, true),

  // Never even opened. The worst case, and the posting scores 70.
  submitted('job_vertex_swe', ME, 100),
  ...squad(
    'job_vertex_swe',
    ['ada-l', 'grace-h', 'linus-t', 'margaret-h', 'alan-t', 'barbara-l'],
    88,
    false
  ),

  // Rejected. Closed, and not silence.
  submitted('job_meridian_data', ME, 40),
  company('job_meridian_data', ME, 'resume_viewed', 38),
  company('job_meridian_data', ME, 'rejection_sent', 35)
];

/** Titles live with the jobs in the real read; duplicated here for the fixture. */
export const MOCK_TITLES: Record<string, string> = {
  job_aurelia_backend: 'Senior Backend Engineer',
  job_northwind_platform: 'Platform Engineer',
  job_halcyon_fullstack: 'Full-Stack Developer',
  job_vertex_swe: 'Software Engineer (All Levels)',
  job_meridian_data: 'Data Engineer'
};
