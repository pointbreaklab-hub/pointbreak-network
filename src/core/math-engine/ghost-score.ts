/**
 * Ghost Score: 0 to 100, higher is worse.
 *
 * A flat rule table, not a weighted model. Every point on screen traces to one
 * named rule a company can read, argue with, and act on. That is the product:
 * a score you can't audit is just a vibe with a number attached.
 */

import type { GhostBand, GhostScore, Job, ScoreRule } from '$lib/types';
import { daysBetween } from '$lib/utils';

export const STALE_AFTER_DAYS = 30;
export const REPOST_LIMIT = 2;
export const HIGH_VOLUME_APPLICATIONS = 100;

/** Cutoffs are a product decision, not a derivation. Tune them here. */
export const BANDS = { evergreen: 30, ghost: 60 } as const;

export function scoreJob(job: Job): GhostScore {
  const { metrics } = job;
  const daysOpen = daysBetween(job.posted_at);
  const noEngagement = metrics.interviews_scheduled === 0 && metrics.rejections_sent === 0;

  const breakdown: ScoreRule[] = [
    {
      id: 'stale_no_engagement',
      label: `Open ${Math.round(daysOpen)}d with no interviews or rejections`,
      points: 20,
      applied: daysOpen > STALE_AFTER_DAYS && noEngagement
    },
    {
      id: 'serial_repost',
      label: `Description reposted ${metrics.reposts}×`,
      points: 30,
      applied: metrics.reposts > REPOST_LIMIT
    },
    {
      id: 'volume_no_interviews',
      label: `${metrics.applications} applications, no interviews`,
      points: 20,
      applied: metrics.applications > HIGH_VOLUME_APPLICATIONS && metrics.interviews_scheduled === 0
    },
    {
      id: 'interviews_held',
      label: `${metrics.interviews_scheduled} interviews scheduled`,
      points: -5 * metrics.interviews_scheduled,
      applied: metrics.interviews_scheduled > 0
    },
    {
      id: 'rejections_sent',
      label: `${metrics.rejections_sent} rejections sent`,
      points: -1 * metrics.rejections_sent,
      applied: metrics.rejections_sent > 0
    }
  ];

  const raw = breakdown.reduce((sum, rule) => sum + (rule.applied ? rule.points : 0), 0);
  const score = Math.max(0, Math.min(100, raw));

  return { job_id: job.id, score, band: bandFor(score), breakdown };
}

export function bandFor(score: number): GhostBand {
  if (score >= BANDS.ghost) return 'ghost';
  if (score >= BANDS.evergreen) return 'evergreen';
  return 'active';
}

export const BAND_LABELS: Record<GhostBand, { emoji: string; label: string }> = {
  active: { emoji: '🟢', label: 'Active Interviewing' },
  evergreen: { emoji: '🟡', label: 'Evergreen Repost' },
  ghost: { emoji: '🔴', label: 'Ghost Job' }
};

/**
 * What a company should do next to move the number, cheapest action first.
 * Mirrors the rule table so the advice can never drift from the scoring.
 */
export function actionNudges(job: Job): string[] {
  const { metrics } = job;
  const nudges: string[] = [];
  const unactioned = metrics.applications - metrics.rejections_sent - metrics.interviews_scheduled;

  if (unactioned > 0) {
    nudges.push(
      `You have ${unactioned} unactioned applications. Sending rejections lowers your score by 1 each.`
    );
  }
  if (metrics.interviews_scheduled === 0 && metrics.applications > 0) {
    nudges.push('No interviews scheduled yet. Each one scheduled lowers your score by 5.');
  }
  if (metrics.reposts > REPOST_LIMIT) {
    nudges.push(
      `This description has been posted ${metrics.reposts} times. Close the old postings or rewrite this one.`
    );
  }
  if (daysBetween(job.posted_at) > STALE_AFTER_DAYS && job.status === 'open') {
    nudges.push('Open longer than 30 days. Close it with a reason if the role is filled or cancelled.');
  }

  return nudges;
}
