/**
 * Ghost Score: 0 to 100, higher is worse.
 *
 * A flat rule table, not a weighted model, so every point traces to one named
 * condition a company can read and act on.
 *
 * Every input comes from deriveMetrics(), which reads the ledger. Nothing here
 * can be moved by a company editing its own job file, and a company claim only
 * contributes once the candidate it affected confirmed it happened.
 */

import type { GhostBand, GhostScore, Job, JobMetrics, ScoreRule } from '$lib/types';
import { daysBetween } from '$lib/utils';

export const STALE_AFTER_DAYS = 30;
export const REPOST_LIMIT = 2;
export const HIGH_VOLUME_APPLICATIONS = 100;

/** Below this many logged applications, a silence rate means very little. */
export const MIN_SAMPLE_FOR_SILENCE = 5;

/** A single spite dispute must not move a score. Both thresholds must be met. */
export const MIN_DISPUTES = 3;
export const DISPUTE_RATE = 0.2;

/** Cutoffs are a product decision, not a derivation. Tune them here. */
export const BANDS = { evergreen: 30, ghost: 60 } as const;

export function scoreJob(job: Job, metrics: JobMetrics): GhostScore {
  const daysOpen = daysBetween(job.first_seen_at ?? job.posted_at);
  const attestedActions = metrics.interviews_attested + metrics.rejections_attested;

  const breakdown: ScoreRule[] = [
    {
      id: 'stale_no_engagement',
      label: `Open ${Math.round(daysOpen)}d with nothing confirmed by any candidate`,
      points: 20,
      applied: daysOpen > STALE_AFTER_DAYS && attestedActions === 0
    },
    {
      id: 'serial_repost',
      label: `Same description posted ${metrics.reposts} other times`,
      points: 30,
      applied: metrics.reposts > REPOST_LIMIT
    },
    {
      // Works on small samples, which matters because externally sourced jobs
      // are only seen through the candidates who logged them here. Twenty
      // people all ignored is damning even though twenty is not many.
      id: 'total_silence',
      label: `All ${metrics.applications} tracked applicants report no response`,
      points: 20,
      applied: metrics.applications >= MIN_SAMPLE_FOR_SILENCE && attestedActions === 0
    },
    {
      id: 'volume_no_interviews',
      label: `${metrics.applications} applications, no confirmed interviews`,
      points: 20,
      applied:
        metrics.applications > HIGH_VOLUME_APPLICATIONS && metrics.interviews_attested === 0
    },
    {
      // Caught claiming actions candidates say never happened.
      id: 'inflated_claims',
      label: `${metrics.claims_disputed} of ${metrics.claims_total} claimed actions disputed by candidates`,
      points: 15,
      applied:
        metrics.claims_disputed >= MIN_DISPUTES &&
        metrics.claims_total > 0 &&
        metrics.claims_disputed / metrics.claims_total > DISPUTE_RATE
    },
    {
      id: 'interviews_held',
      label: `${metrics.interviews_attested} interviews confirmed by candidates`,
      points: -5 * metrics.interviews_attested,
      applied: metrics.interviews_attested > 0
    },
    {
      id: 'rejections_sent',
      label: `${metrics.rejections_attested} rejections confirmed by candidates`,
      points: -1 * metrics.rejections_attested,
      applied: metrics.rejections_attested > 0
    }
  ];

  const raw = breakdown.reduce((sum, rule) => sum + (rule.applied ? rule.points : 0), 0);
  const score = Math.max(0, Math.min(100, raw));

  return {
    job_id: job.id,
    score,
    band: bandFor(score),
    breakdown,
    sample: metrics.applications
  };
}

export function bandFor(score: number): GhostBand {
  if (score >= BANDS.ghost) return 'ghost';
  if (score >= BANDS.evergreen) return 'evergreen';
  return 'active';
}

export const BAND_LABELS: Record<GhostBand, { emoji: string; label: string }> = {
  active: { emoji: '\u{1F7E2}', label: 'Active Interviewing' },
  evergreen: { emoji: '\u{1F7E1}', label: 'Evergreen Repost' },
  ghost: { emoji: '\u{1F534}', label: 'Ghost Job' }
};

/**
 * What a company should do next, cheapest action first. Mirrors the rule table
 * so the advice cannot drift from the scoring.
 */
export function actionNudges(job: Job, metrics: JobMetrics): string[] {
  const nudges: string[] = [];
  const unanswered =
    metrics.applications - metrics.rejections_attested - metrics.interviews_attested;

  if (metrics.claims_unattested > 0) {
    nudges.push(
      `${metrics.claims_unattested} actions you logged are unconfirmed and count for nothing. Candidates confirm them from their tracker.`
    );
  }
  if (metrics.claims_disputed > 0) {
    nudges.push(
      `${metrics.claims_disputed} actions you logged were disputed by the candidate who would have received them.`
    );
  }
  if (unanswered > 0) {
    nudges.push(
      `${unanswered} tracked applicants have had no confirmed response. Each rejection they confirm lowers your score by 1.`
    );
  }
  if (metrics.interviews_attested === 0 && metrics.applications > 0) {
    nudges.push('No confirmed interviews. Each one lowers your score by 5.');
  }
  if (metrics.reposts > REPOST_LIMIT) {
    nudges.push(
      `This description has been posted ${metrics.reposts} other times. Close the old postings or rewrite this one.`
    );
  }
  if (daysBetween(job.first_seen_at ?? job.posted_at) > STALE_AFTER_DAYS && job.status === 'open') {
    nudges.push('Open longer than 30 days. Close it with a reason if the role is filled.');
  }

  return nudges;
}
