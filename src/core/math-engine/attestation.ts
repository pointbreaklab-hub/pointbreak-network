/**
 * Peer attestation weighting.
 *
 * The obvious attack on any vouching system is a ring: ten fresh accounts
 * vouch for each other and all ten look credible. The defence here is that a
 * vouch carries no intrinsic weight at all. It inherits weight from the
 * voucher's own footprint, and a fresh account has none to lend, so a ring
 * multiplies zero by ten and gets zero.
 *
 * Every input is something GitHub attests: public commit counts, merged pull
 * requests, and the aggregate private contribution total. Nothing the voucher
 * typed about themselves counts, because that would hand the ring its bootstrap.
 *
 * Private contributions are included deliberately. An engineer whose work is
 * entirely behind a corporate firewall is exactly the person whose vouch is
 * most valuable about another such engineer, and excluding them would rebuild
 * the bias this whole model exists to remove.
 */

import type {
  PeerAttestation,
  Skill,
  UserProfile,
  VoucherCredibility,
  WeightedAttestation
} from '$lib/types';

/** Footprint at which a voucher is considered fully credible. */
export const CREDIBILITY_SATURATION = 8000;

/** A merged PR is worth more than a commit: someone else reviewed it. */
export const MERGED_PR_MULTIPLIER = 20;

/** Below this, a vouch is shown but contributes nothing to ordering. */
export const MIN_CREDIBLE_WEIGHT = 0.05;

function totals(profile: UserProfile) {
  let public_commits = 0;
  let merged_prs = profile.ship_logs.length;

  for (const skill of profile.skills) {
    for (const item of skill.evidence) {
      if (item.kind === 'public_commits') public_commits += item.count ?? 0;
    }
  }

  return {
    public_commits,
    merged_prs,
    private_contributions: profile.contributions?.total ?? 0
  };
}

export function voucherCredibility(profile: UserProfile): VoucherCredibility {
  const basis = totals(profile);
  const footprint =
    basis.public_commits +
    basis.merged_prs * MERGED_PR_MULTIPLIER +
    basis.private_contributions;

  // Square root rather than linear: the difference between 0 and 500 commits
  // matters far more than between 5000 and 5500, and a linear scale would let
  // one prolific account dominate every vouch it makes.
  const weight = Math.min(1, Math.sqrt(footprint / CREDIBILITY_SATURATION));

  return { login: profile.github_login, weight: Number(weight.toFixed(3)), basis };
}

/**
 * Attaches credibility to each attestation and drops ones that cannot be
 * assessed, since an unverifiable voucher is indistinguishable from a
 * manufactured one.
 */
export function weighAttestations(
  attestations: PeerAttestation[],
  voucherProfiles: Map<string, UserProfile>
): WeightedAttestation[] {
  return attestations
    .flatMap((attestation) => {
      const profile = voucherProfiles.get(attestation.attested_by.toLowerCase());
      if (!profile) return [];
      return [{ attestation, credibility: voucherCredibility(profile) }];
    })
    .sort((a, b) => b.credibility.weight - a.credibility.weight);
}

/**
 * Folds attestations into a skill's evidence list.
 *
 * A vouch becomes a `peer_attestation` entry whose count is the summed
 * credibility of everyone who vouched, so five weak vouches cannot outweigh one
 * from someone with a real record.
 */
export function applyAttestations(skills: Skill[], weighed: WeightedAttestation[]): Skill[] {
  const bySkill = new Map<string, WeightedAttestation[]>();

  for (const item of weighed) {
    if (item.credibility.weight < MIN_CREDIBLE_WEIGHT) continue;
    const key = item.attestation.skill.toLowerCase();
    const bucket = bySkill.get(key);
    if (bucket) bucket.push(item);
    else bySkill.set(key, [item]);
  }

  const merged = skills.map((skill) => {
    const vouches = bySkill.get(skill.skill.toLowerCase());
    if (!vouches?.length) return skill;

    bySkill.delete(skill.skill.toLowerCase());
    return { ...skill, evidence: [...skill.evidence, vouchEvidence(vouches)] };
  });

  // A skill evidenced only by vouches still belongs on the profile. This is the
  // case for an engineer whose work in it was never public at all.
  for (const [, vouches] of bySkill) {
    merged.push({ skill: vouches[0].attestation.skill, evidence: [vouchEvidence(vouches)] });
  }

  return merged;
}

function vouchEvidence(vouches: WeightedAttestation[]) {
  const summed = vouches.reduce((sum, v) => sum + v.credibility.weight, 0);
  return {
    kind: 'peer_attestation' as const,
    count: Number(summed.toFixed(2)),
    attested_by: vouches.map((v) => v.attestation.attested_by).join(', '),
    at: vouches[0].attestation.at
  };
}
