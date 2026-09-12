/**
 * Worked scenario for peer attestation.
 *
 *   npm run scenario:attestation
 *
 * Demonstrates the two things the weighting has to get right: an engineer whose
 * work is entirely private can still be evidenced, and a ring of fresh accounts
 * vouching for each other produces nothing.
 */
import {
  voucherCredibility,
  weighAttestations,
  applyAttestations
} from '../src/core/math-engine/attestation';
import type {
  PeerAttestation,
  UserProfile
} from '../src/lib/types';

const now = '2026-09-12T10:00:00Z';

function profile(
  login: string,
  publicCommits: Record<string, number>,
  mergedPrs: number,
  privateTotal: number
): UserProfile {
  return {
    github_login: login,
    skills: Object.entries(publicCommits).map(([skill, count]) => ({
      skill,
      evidence: [{ kind: 'public_commits', count, at: now }]
    })),
    ship_logs: Array.from({ length: mergedPrs }, (_, i) => ({
      repo: `${login}/work`,
      pr: i + 1,
      merged_at: now
    })),
    contributions: privateTotal
      ? { total: privateTotal, restricted: privateTotal, from: now, to: now }
      : undefined
  };
}

/* ---- The person the old model failed ---- */

// 14 years at a bank. Everything she has built is behind a firewall.
const priya = profile('priya-raghavan', { Java: 3 }, 1, 4812);

/* ---- Her vouchers ---- */

// Her tech lead. Also bank, also almost nothing public.
const marcus = profile('marcus-bell', { Go: 40 }, 2, 6200);

// Former colleague, now at a company that works in the open.
const sofia = profile('sofia-almeida', { Java: 1800, Python: 240 }, 90, 900);

// A junior who worked with her briefly.
const dev = profile('dev-okonkwo', { Java: 200 }, 3, 0);

/* ---- The attack ---- */

// Three accounts created last month with no work behind them, vouching in a ring.
const ring = ['ring-alpha', 'ring-beta', 'ring-gamma'].map((l) => profile(l, {}, 0, 0));

const vouchers = new Map(
  [priya, marcus, sofia, dev, ...ring].map((p) => [p.github_login, p])
);

function att(by: string, subject: string, skill: string, note: string): PeerAttestation {
  return { id: `att_${by}_${skill}`, subject, skill, note, attested_by: by, at: now };
}

const onPriya: PeerAttestation[] = [
  att('marcus-bell', 'priya-raghavan', 'Kotlin',
      'Rewrote our settlement engine in Kotlin, ~40k lines. I reviewed most of it over two years.'),
  att('sofia-almeida', 'priya-raghavan', 'Java',
      'Owned the risk platform. She is the person I would call about JVM memory behaviour.'),
  att('dev-okonkwo', 'priya-raghavan', 'Kotlin',
      'Mentored me on the settlement codebase.'),
  ...ring.map((r) => att(r.github_login, 'priya-raghavan', 'Rust', 'great engineer'))
];

/* ---- Output ---- */

const pad = (s: string, n: number) => s.padEnd(n);
console.log('VOUCHER CREDIBILITY (from what GitHub attests, never self-reported)\n');
console.log(pad('account', 18), pad('public', 8), pad('PRs', 5), pad('private', 9), 'weight');
for (const p of [marcus, sofia, dev, ...ring]) {
  const c = voucherCredibility(p);
  console.log(
    pad(c.login, 18),
    pad(String(c.basis.public_commits), 8),
    pad(String(c.basis.merged_prs), 5),
    pad(String(c.basis.private_contributions), 9),
    c.weight.toFixed(3)
  );
}

const weighed = weighAttestations(onPriya, vouchers);
console.log('\nVOUCHES ON priya-raghavan, after weighting\n');
for (const w of weighed) {
  const kept = w.credibility.weight >= 0.05;
  console.log(
    `  ${kept ? 'counts ' : 'ignored'} ${pad(w.attestation.skill, 8)} ${pad(w.attestation.attested_by, 18)} ${w.credibility.weight.toFixed(3)}`
  );
}

console.log('\nPRIYA’S SKILLS, before and after\n');
console.log('  before (public commits only):');
for (const s of priya.skills) {
  console.log(`    ${pad(s.skill, 8)} ${s.evidence.map((e) => `${e.count} ${e.kind}`).join(', ')}`);
}

console.log('\n  after attestation:');
for (const s of applyAttestations(priya.skills, weighed)) {
  console.log(`    ${pad(s.skill, 8)} ${s.evidence.map((e) => `${e.count} ${e.kind}`).join(', ')}`);
}

console.log('\n  private contribution volume GitHub confirms:', priya.contributions?.restricted);
