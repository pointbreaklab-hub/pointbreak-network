<script lang="ts">
  import { session } from '$core/auth/session.svelte';
  import { db, isStale, markFresh } from '$core/db';
  import { RateLimitError } from '$core/github-api';
  import { applyAttestations, weighAttestations } from '$core/math-engine';
  import type { UserProfile, WeightedAttestation } from '$lib/types';
  import { relativeTime } from '$lib/utils';
  import { loadAttestations, loadVoucherProfiles } from '../attestations';
  import { loadProfile } from '../data';
  import Attestations from './Attestations.svelte';
  import ContributionVolumeCard from './ContributionVolume.svelte';
  import ShipLogList from './ShipLogList.svelte';
  import SkillMatrix from './SkillMatrix.svelte';

  let profile = $state<UserProfile | null>(null);
  let vouches = $state<WeightedAttestation[]>([]);
  let error = $state<string | null>(null);
  let loading = $state(false);
  let refreshing = $state(false);

  const CACHE_TTL_MS = 60 * 60 * 1000;

  // Skills with vouches folded in. A skill evidenced only by attestation still
  // appears, which is the whole point for work that was never public.
  const skills = $derived(profile ? applyAttestations(profile.skills, vouches) : []);

  async function load(force = false) {
    const login = session.current?.github_login;
    if (!login) return;

    error = null;

    const cached = await db.profiles.get(login);
    if (cached) profile = cached;

    if (!force && cached && !(await isStale(`profile:${login}`, CACHE_TTL_MS))) {
      await loadVouches(login);
      return;
    }

    if (cached) refreshing = true;
    else loading = true;

    try {
      const fresh = await loadProfile(login);
      await db.profiles.put(fresh);
      await markFresh(`profile:${login}`);
      profile = fresh;
      await loadVouches(login);
    } catch (e) {
      error =
        e instanceof RateLimitError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Could not read your GitHub activity.';
    } finally {
      loading = false;
      refreshing = false;
    }
  }

  async function loadVouches(login: string) {
    try {
      const attestations = await loadAttestations(login);
      if (attestations.length === 0) {
        vouches = [];
        return;
      }
      const profiles = await loadVoucherProfiles(attestations.map((a) => a.attested_by));
      vouches = weighAttestations(attestations, profiles);
    } catch {
      // A profile is still worth showing without its vouches.
      vouches = [];
    }
  }

  $effect(() => {
    if (session.current?.github_login) load();
  });
</script>

<header class="mb-6 flex items-baseline justify-between gap-4">
  <div>
    <h1 class="text-lg font-medium">{profile?.github_login ?? session.current?.github_login}</h1>
    <p class="text-sm text-muted">
      Read from GitHub and from vouches other people signed. Nothing here is self-reported.
      {#if profile?.updated_at}
        <span class="tabular"> · updated {relativeTime(profile.updated_at)}</span>
      {/if}
    </p>
  </div>

  <button
    type="button"
    onclick={() => load(true)}
    disabled={loading || refreshing}
    class="rounded-md border border-edge px-3 py-1.5 text-sm text-muted hover:text-fg disabled:opacity-40"
  >
    {refreshing ? 'Refreshing...' : 'Refresh'}
  </button>
</header>

{#if error}
  <p class="mb-6 rounded-md border border-danger p-3 text-sm text-danger">{error}</p>
{/if}

{#if loading}
  <p class="text-muted">Reading your repositories and merged pull requests...</p>
{:else if profile}
  <section class="mb-8">
    <ContributionVolumeCard volume={profile.contributions} />
  </section>

  <section class="mb-8">
    <h2 class="mb-1 text-base font-medium">Skills</h2>
    <p class="mb-3 max-w-2xl text-sm text-muted">
      Each claim shows what backs it. Public commits are the weakest evidence here and a colleague
      vouching under their own name is the strongest.
    </p>
    <SkillMatrix {skills} />
  </section>

  <Attestations {vouches} subject={profile.github_login} />

  <section>
    <h2 class="mb-1 text-base font-medium">Ship logs</h2>
    <p class="mb-3 text-sm text-muted">
      Merged pull requests, meaning work someone else reviewed and accepted.
    </p>
    <ShipLogList logs={profile.ship_logs} />
  </section>
{/if}
