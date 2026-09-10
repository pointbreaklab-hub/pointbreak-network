/**
 * Black Hole detection.
 *
 * A non-response is a measurement. After 14 days with no company action the
 * candidate accepted as real, an application stops being pending and becomes a
 * recorded fact about the company.
 *
 * "Accepted as real" is doing the work: an unconfirmed claim that a resume was
 * viewed cannot be used to reset the silence clock, which would otherwise be
 * the obvious way to game this.
 */

import type { Application, BlackHoleState, TrackedState } from '$lib/types';
import { daysBetween } from '$lib/utils';

export const BLACK_HOLE_AFTER_DAYS = 14;

/** Only states still awaiting a company action can go dark. */
const SILENT_STATES: TrackedState[] = ['submitted', 'viewed'];

export function detect(application: Application, squadSize?: number): BlackHoleState {
  const daysSilent = Math.round(daysBetween(application.last_action_at));
  const isBlackHole =
    SILENT_STATES.includes(application.status) && daysSilent > BLACK_HOLE_AFTER_DAYS;

  return {
    job_id: application.job_id,
    application_ref: application.application_ref,
    state: isBlackHole ? 'black_hole' : application.status,
    days_silent: daysSilent,
    is_black_hole: isBlackHole,
    squad_size: squadSize
  };
}

/**
 * The Black Hole Squad: everyone else stuck on the same posting.
 *
 * Counted over pseudonymous application refs, so this reveals how many people
 * are being ignored without revealing who any of them are. Distinct refs are
 * assumed to be distinct people, which makes the count a floor rather than a
 * proof.
 */
export function squadSizes(applications: Application[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const app of applications) {
    if (!detect(app).is_black_hole) continue;
    counts.set(app.job_id, (counts.get(app.job_id) ?? 0) + 1);
  }

  return counts;
}

export function detectAll(mine: Application[], everyone: Application[] = mine): BlackHoleState[] {
  const squads = squadSizes(everyone);
  return mine
    .map((app) => detect(app, squads.get(app.job_id)))
    .sort((a, b) => b.days_silent - a.days_silent);
}
