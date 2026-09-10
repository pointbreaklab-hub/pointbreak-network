/**
 * Builds a UserProfile from the signed-in user's real GitHub activity.
 *
 * Public commit volume alone is a bad proxy for skill. Most professional
 * engineering happens in private repositories, so an engineer with fifteen
 * years at a bank has a nearly empty public profile while someone with forty
 * tutorial repositories looks prolific. Ranking on public commits would bury
 * exactly the people this product is for.
 *
 * So a skill can be evidenced four ways, and the UI shows which one backs each
 * claim rather than collapsing them into a single number:
 *
 *   public_commits        commits in public repos, by primary language
 *   merged_prs            pull requests someone else reviewed and merged
 *   private_contributions aggregate volume of private work, no repo names
 *   peer_attestation      another engineer vouching, signed by their account
 */

import {
  AuthError,
  countFromLinkHeader,
  ghFetch,
  ghFetchRaw,
  ghGraphQL,
  RateLimitError
} from '$core/github-api';
import type { ContributionVolume, ShipLog, Skill, SkillEvidence, UserProfile } from '$lib/types';

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
 * GitHub has no count endpoint. Requesting one item per page and reading the
 * rel="last" page number off the Link header is the documented approach, and
 * costs one request rather than paging the whole history.
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

    // Empty repos 409 and inaccessible ones 404. Neither is worth failing over.
    return 0;
  }
}

/**
 * Aggregate contribution volume including private work.
 *
 * `restrictedContributionsCount` is GitHub's count of contributions in repos
 * the viewer cannot see. It proves the work happened without naming a single
 * repository, which is the whole point: it is the only way a senior engineer
 * behind a corporate firewall can evidence output here.
 *
 * It is zero unless the user has enabled private contributions on their
 * profile, so an empty result means "not shared", not "did nothing".
 */
async function contributionVolume(login: string): Promise<ContributionVolume | undefined> {
  try {
    const data = await ghGraphQL<{
      user: {
        contributionsCollection: {
          startedAt: string;
          endedAt: string;
          totalCommitContributions: number;
          restrictedContributionsCount: number;
        };
      } | null;
    }>(
      `query($login: String!) {
        user(login: $login) {
          contributionsCollection {
            startedAt
            endedAt
            totalCommitContributions
            restrictedContributionsCount
          }
        }
      }`,
      { login }
    );

    const c = data.user?.contributionsCollection;
    if (!c) return undefined;

    return {
      total: c.totalCommitContributions + c.restrictedContributionsCount,
      restricted: c.restrictedContributionsCount,
      from: c.startedAt,
      to: c.endedAt
    };
  } catch (e) {
    if (e instanceof AuthError || e instanceof RateLimitError) throw e;
    return undefined;
  }
}

/**
 * Commits are attributed to each repository's primary language. Per-file
 * attribution would need a language breakdown and a diff for every commit,
 * which is far outside the rate limit, so the UI states the weaker claim this
 * actually supports: commits in repos whose primary language is X.
 */
async function skillsFromRepos(repos: GhRepo[], login: string): Promise<Map<string, number>> {
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

  return totals;
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

  // Forks are someone else's work; archives are work that stopped.
  const repos = allRepos.filter((r) => !r.fork && !r.archived).slice(0, MAX_REPOS);

  const [publicCommits, ship_logs, contributions] = await Promise.all([
    skillsFromRepos(repos, login),
    shipLogs(login),
    contributionVolume(login)
  ]);

  const now = new Date().toISOString();
  const skills: Skill[] = [];

  for (const [skill, count] of publicCommits) {
    const evidence: SkillEvidence[] = [{ kind: 'public_commits', count, at: now }];

    const merged = ship_logs.filter((log) => log.title?.toLowerCase().includes(skill.toLowerCase()));
    if (merged.length) evidence.push({ kind: 'merged_prs', count: merged.length, at: now });

    skills.push({ skill, evidence });
  }

  skills.sort((a, b) => evidenceWeight(b) - evidenceWeight(a));

  return {
    github_login: login,
    skills,
    ship_logs,
    contributions,
    updated_at: now
  };
}

/**
 * Ordering only, never displayed as a score. A merged PR is worth more than a
 * commit because someone else reviewed it, and a peer attestation is worth more
 * still because a named person staked their account on it.
 */
export function evidenceWeight(skill: Skill): number {
  const WEIGHT: Record<SkillEvidence['kind'], number> = {
    public_commits: 1,
    merged_prs: 5,
    private_contributions: 1,
    peer_attestation: 50,
    external_artifact: 10
  };

  return skill.evidence.reduce((sum, e) => sum + WEIGHT[e.kind] * (e.count ?? 1), 0);
}
