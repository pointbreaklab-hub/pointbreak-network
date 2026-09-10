/**
 * Company Trust scoring — the mirror of the Ghost Score.
 *
 * Here 1 is *good*: this is the one number where a high value is earned. It is
 * built from what a company publishes and honours, never from sentiment.
 */

import type { CompanyProfile, JobPost, Signal, TrustScore } from '$lib/types';
import { normalize } from '$lib/utils';
import { scoreJob } from './ghost-job';

export const WEIGHTS = {
  disclosure: 0.4,
  hireFollowThrough: 0.3,
  ghostHistory: 0.2,
  verification: 0.1
} as const;

export function scoreCompany(company: CompanyProfile, jobs: JobPost[]): TrustScore {
  const posted = jobs.filter((j) => j.companyId === company.id);

  if (posted.length === 0) {
    return { companyId: company.id, score: 0, confidence: 0, signals: [] };
  }

  const scores = posted.map((j) => scoreJob(j, [], posted));

  const disclosure: Signal = {
    name: 'disclosure',
    weight: WEIGHTS.disclosure,
    value: scores.reduce((s, g) => s + g.confidence, 0) / scores.length
  };

  const closed = posted.filter((j) => j.status !== 'open');
  const hireFollowThrough: Signal = {
    name: 'hireFollowThrough',
    weight: WEIGHTS.hireFollowThrough,
    value: closed.length
      ? closed.filter((j) => (j.disclosure.hires ?? 0) > 0).length / closed.length
      : 0
  };

  const ghostHistory: Signal = {
    name: 'ghostHistory',
    weight: WEIGHTS.ghostHistory,
    value: 1 - scores.reduce((s, g) => s + g.score, 0) / scores.length
  };

  const verification: Signal = {
    name: 'verification',
    weight: WEIGHTS.verification,
    value: company.verifiedAt ? 1 : 0
  };

  const signals = [disclosure, hireFollowThrough, ghostHistory, verification];
  const score = signals.reduce((sum, s) => sum + s.weight * s.value, 0);

  return {
    companyId: company.id,
    score: Number(score.toFixed(2)),
    // More postings, more evidence. Saturates at ten.
    confidence: Number(normalize(posted.length, 1, 10).toFixed(2)),
    signals
  };
}
