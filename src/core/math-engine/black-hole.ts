/**
 * Black Hole detection.
 *
 * A non-response is a measurement. After 14 days of company silence an
 * application stops being "pending" and becomes a recorded fact about the
 * company.
 */

import type { Application, BlackHoleState, TrackedState } from '$lib/types';
import { daysBetween } from '$lib/utils';

export const BLACK_HOLE_AFTER_DAYS = 14;

/** Only states awaiting a company action can go dark. */
const SILENT_STATES: TrackedState[] = ['submitted', 'viewed'];

export function detect(application: Application, squadSize?: number): BlackHoleState {
  const daysSilent = Math.round(daysBetween(application.last_action_at));
  const isBlackHole =
    SILENT_STATES.includes(application.status) && daysSilent > BLACK_HOLE_AFTER_DAYS;

  return {
    job_id: application.job_id,
    github_login: application.github_login,
    state: isBlackHole ? 'black_hole' : application.status,
    days_silent: daysSilent,
    is_black_hole: isBlackHole,
    squad_size: squadSize
  };
}

/**
 * The Black Hole Squad: everyone else stuck on the same posting.
 * Being ignored alongside 200 other people is a different fact than being
 * ignored alone, so the count is shown rather than just the state.
 */
export function squadSizes(applications: Application[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const app of applications) {
    if (!detect(app).is_black_hole) continue;
    counts.set(app.job_id, (counts.get(app.job_id) ?? 0) + 1);
  }

  return counts;
}

export function detectAll(
  mine: Application[],
  everyone: Application[] = mine
): BlackHoleState[] {
  const squads = squadSizes(everyone);
  return mine
    .map((app) => detect(app, squads.get(app.job_id)))
    .sort((a, b) => b.days_silent - a.days_silent);
}
