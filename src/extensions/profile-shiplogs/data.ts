/**
 * Builds a UserProfile from the authenticated user's real GitHub activity.
 *
 * Nothing here is self-reported. Skills come from commit counts, ship logs come
 * from merged pull requests. If GitHub doesn't corroborate it, it isn't shown.
 */

import { AuthError, countFromLinkHeader, ghFetch, ghFetchRaw, RateLimitError } from '$core/github-api';
import type { ShipLog, UserProfile, VerifiedSkill } from '$lib/types';

/** Bounds the request count: one call per repo, so this is the API budget. */
const MAX_REPOS = 25;
const MAX_SHIP_LOGS = 50;

interface GhRepo {
  name: string;
  full_name: string;
  language: string | null;
  fork: boolean;
  archived: boolean;
  pushed_at: string;
}

interface GhSearchItem {
  number: number;
  title: string;
  html_url: string;
  repository_url: string;
  closed_at: string | null;
  pull_request?: { merged_at: string | null };
}

/**
 * Commits authored by `login` in one repo.
 *
 * GitHub has no count endpoint. Asking for a single item per page and reading
 * the `rel="last"` page number off the Link header is the documented trick, and
 * costs one request instead of paging the whole history.
 */
async function commitCount(fullName: string, login: string): Promise<number> {
  try {
    const { data, headers } = await ghFetchRaw<unknown[]>(
      `/repos/${fullName}/commits?author=${encodeURIComponent(login)}&per_page=1`
    );
    return countFromLinkHeader(headers, data.length);
  } catch (e) {
    // A dead token or an exhausted quota affects every repo, so swallowing it
    // here would silently render an empty skill list instead of an error.
    if (e instanceof AuthError || e instanceof RateLimitError) throw e;

    // Empty repos 409 and private ones 404. Neither is worth failing over.
    return 0;
  }
}

/**
 * Commits are attributed to the repository's primary language.
 *
 * Attributing per-file would need the language breakdown *and* a diff for every
 * commit, which is far outside the rate limit. The claim this makes is
 * therefore "commits in repos whose primary language is X", which is what the
 * UI says.
 */
async function verifiedSkills(repos: GhRepo[], login: string): Promise<VerifiedSkill[]> {
  const withLanguage = repos.filter((r) => r.language);

  const counted = await Promise.all(
    withLanguage.map(async (repo) => ({
      skill: repo.language as string,
      commits: await commitCount(repo.full_name, login)
    }))
  );

  const totals = new Map<string, number>();
  for (const { skill, commits } of counted) {
    if (commits === 0) continue;
    totals.set(skill, (totals.get(skill) ?? 0) + commits);
  }

  return [...totals]
    .map(([skill, commits]) => ({ skill, commits }))
    .sort((a, b) => b.commits - a.commits);
}

/** Merged PRs, newest first. A merged PR is work someone else accepted. */
async function shipLogs(login: string): Promise<ShipLog[]> {
  const query = `author:${login}+type:pr+is:merged`;
  const { items } = await ghFetch<{ items: GhSearchItem[] }>(
    `/search/issues?q=${query}&sort=created&order=desc&per_page=${MAX_SHIP_LOGS}`
  );

  return items.map((item) => ({
    repo: item.repository_url.replace('https://api.github.com/repos/', ''),
    pr: item.number,
    merged_at: item.pull_request?.merged_at ?? item.closed_at ?? '',
    title: item.title,
    url: item.html_url
  }));
}

export async function loadProfile(login: string): Promise<UserProfile> {
  const allRepos = await ghFetch<GhRepo[]>(
    `/users/${encodeURIComponent(login)}/repos?type=owner&sort=pushed&per_page=100`
  );

  // Forks and archives are someone else's work, or work that stopped.
  const repos = allRepos.filter((r) => !r.fork && !r.archived).slice(0, MAX_REPOS);

  // Run in parallel — skills are ~25 requests, ship logs is 1 on a separate
  // (much tighter) search quota, so serialising them buys nothing.
  const [verified_skills, ship_logs] = await Promise.all([
    verifiedSkills(repos, login),
    shipLogs(login)
  ]);

  return {
    github_login: login,
    verified_skills,
    ship_logs,
    updated_at: new Date().toISOString()
  };
}
