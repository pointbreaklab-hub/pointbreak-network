/**
 * Repost / evergreen detection.
 *
 * Compares a new description against the company's recent postings. Jaccard is
 * the default: it ignores term frequency, so padding a template with filler
 * doesn't disguise a repost the way it can with cosine.
 */

import type { Job, RepostMatch } from '$lib/types';

export const REPOST_THRESHOLD = 0.85;
export const COMPARISON_WINDOW = 50;

/** Boilerplate that appears in nearly every posting and carries no signal. */
const STOPWORDS = new Set([
  'a','an','and','are','as','at','be','by','for','from','has','have','in','is','it','its','of','on',
  'or','that','the','to','was','will','with','you','your','we','our','us','this','they','their',
  'role','team','work','working','experience','years','strong','ability','excellent','opportunity',
  'candidate','candidates','looking','join','company'
]);

export function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9+#.\s-]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2 && !STOPWORDS.has(token))
  );
}

/** |A ∩ B| / |A ∪ B| */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;

  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;

  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Term-frequency cosine. Exported for callers that want frequency to count. */
export function cosine(a: string, b: string): number {
  const freq = (text: string) => {
    const counts = new Map<string, number>();
    for (const token of text.toLowerCase().split(/\s+/).filter((t) => t.length > 2 && !STOPWORDS.has(t))) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
    return counts;
  };

  const fa = freq(a);
  const fb = freq(b);

  let dot = 0;
  for (const [token, count] of fa) dot += count * (fb.get(token) ?? 0);

  const norm = (m: Map<string, number>) =>
    Math.sqrt([...m.values()].reduce((sum, c) => sum + c * c, 0));

  const denominator = norm(fa) * norm(fb);
  return denominator === 0 ? 0 : dot / denominator;
}

/**
 * Past postings that look like the same job. Runs client-side at submit time so
 * a company sees the warning before paying, not after.
 */
export function findReposts(
  description: string,
  pastJobs: Job[],
  threshold = REPOST_THRESHOLD
): RepostMatch[] {
  const incoming = tokenize(description);

  return pastJobs
    .slice()
    .sort((a, b) => Date.parse(b.posted_at) - Date.parse(a.posted_at))
    .slice(0, COMPARISON_WINDOW)
    .map((job) => ({
      job_id: job.id,
      title: job.title,
      posted_at: job.posted_at,
      similarity: Number(jaccard(incoming, tokenize(job.description ?? '')).toFixed(3))
    }))
    .filter((match) => match.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);
}
