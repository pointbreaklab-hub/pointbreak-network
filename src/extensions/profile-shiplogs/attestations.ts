/**
 * Reading peer attestations and assessing who made them.
 *
 * A vouch is only worth what the voucher is worth, so displaying attestations
 * means loading a credibility basis for every person who made one. That is done
 * in a single batched GraphQL query rather than N REST calls, because a profile
 * with ten vouches would otherwise cost ten round trips.
 */

import { ghGraphQL, readJSONL } from '$core/github-api';
import type { PeerAttestation, UserProfile } from '$lib/types';

/** Bounds the batched query. Vouches beyond this are shown unweighted. */
const MAX_VOUCHERS = 12;

export async function loadAttestations(login: string): Promise<PeerAttestation[]> {
  return readJSONL<PeerAttestation>(`attestations/${login.toLowerCase()}.jsonl`);
}

interface VoucherStats {
  login: string;
  contributionsCollection: {
    totalCommitContributions: number;
    restrictedContributionsCount: number;
    startedAt: string;
    endedAt: string;
  };
  pullRequests: { totalCount: number };
  repositories: { nodes: Array<{ primaryLanguage: { name: string } | null }> };
}

/**
 * Minimal profiles for the people who vouched, sufficient to weigh them.
 *
 * Private contribution totals are included, which matters: an engineer whose
 * work is all behind a firewall is often the most valuable voucher about
 * another such engineer, and excluding them would rebuild the exact bias the
 * evidence model exists to remove.
 */
export async function loadVoucherProfiles(logins: string[]): Promise<Map<string, UserProfile>> {
  const unique = [...new Set(logins.map((l) => l.toLowerCase()))].slice(0, MAX_VOUCHERS);
  if (unique.length === 0) return new Map();

  const query = `
    query {
      ${unique
        .map(
          (login, i) => `u${i}: user(login: ${JSON.stringify(login)}) {
        login
        contributionsCollection {
          totalCommitContributions
          restrictedContributionsCount
          startedAt
          endedAt
        }
        pullRequests(states: MERGED) { totalCount }
        repositories(first: 20, isFork: false, orderBy: {field: PUSHED_AT, direction: DESC}) {
          nodes { primaryLanguage { name } }
        }
      }`
        )
        .join('\n')}
    }`;

  const data = await ghGraphQL<Record<string, VoucherStats | null>>(query);
  const profiles = new Map<string, UserProfile>();

  for (const stats of Object.values(data)) {
    if (!stats) continue;

    const c = stats.contributionsCollection;
    profiles.set(stats.login.toLowerCase(), {
      github_login: stats.login,
      // Only the aggregate matters for credibility, so language attribution is
      // left off rather than costing a request per repository.
      skills: [
        {
          skill: 'all',
          evidence: [
            { kind: 'public_commits', count: c.totalCommitContributions, at: c.endedAt }
          ]
        }
      ],
      ship_logs: Array.from({ length: Math.min(stats.pullRequests.totalCount, 500) }, (_, i) => ({
        repo: `${stats.login}/merged`,
        pr: i + 1,
        merged_at: c.endedAt,
        redacted: true
      })),
      contributions: {
        total: c.totalCommitContributions + c.restrictedContributionsCount,
        restricted: c.restrictedContributionsCount,
        from: c.startedAt,
        to: c.endedAt
      }
    });
  }

  return profiles;
}
