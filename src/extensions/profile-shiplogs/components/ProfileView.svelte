<script lang="ts">
  import { session } from '$core/auth/session.svelte';
  import { db, isStale, markFresh } from '$core/db';
  import { RateLimitError } from '$core/github-api';
  import type { UserProfile } from '$lib/types';
  import { relativeTime } from '$lib/utils';
  import { loadProfile } from '../data';
  import ShipLogList from './ShipLogList.svelte';
  import SkillMatrix from './SkillMatrix.svelte';

  let profile = $state<UserProfile | null>(null);
  let error = $state<string | null>(null);
  let loading = $state(false);
  let refreshing = $state(false);

  const CACHE_TTL_MS = 60 * 60 * 1000;

  async function load(force = false) {
    const login = session.current?.github_login;
    if (!login) return;

    error = null;

    // Show cached data immediately, then refresh behind it. Building a profile
    // costs ~26 API calls, so this is not something to repeat on every visit.
    const cached = await db.profiles.get(login);
    if (cached) profile = cached;

    if (!force && cached && !(await isStale(`profile:${login}`, CACHE_TTL_MS))) return;

    if (cached) refreshing = true;
    else loading = true;

    try {
      const fresh = await loadProfile(login);
      await db.profiles.put(fresh);
      await markFresh(`profile:${login}`);
      profile = fresh;
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

  $effect(() => {
    if (session.current?.github_login) load();
  });
</script>

<header class="mb-6 flex items-baseline justify-between gap-4">
  <div>
    <h1 class="text-lg font-medium">{profile?.github_login ?? session.current?.github_login}</h1>
    <p class="text-sm text-muted">
      Read from GitHub. Nothing on this page is self-reported.
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
    {refreshing ? 'Refreshing…' : 'Refresh'}
  </button>
</header>

{#if error}
  <p class="mb-6 rounded-md border border-danger p-3 text-sm text-danger">{error}</p>
{/if}

{#if loading}
  <p class="text-muted">Reading your repositories and merged pull requests…</p>
{:else if profile}
  <section class="mb-8">
    <h2 class="mb-1 text-base font-medium">Verified skills</h2>
    <p class="mb-3 text-sm text-muted">
      Commits you authored, grouped by each repository's primary language.
    </p>
    <SkillMatrix skills={profile.verified_skills} />
  </section>

  <section>
    <h2 class="mb-1 text-base font-medium">Ship logs</h2>
    <p class="mb-3 text-sm text-muted">
      Merged pull requests — work someone else reviewed and accepted.
    </p>
    <ShipLogList logs={profile.ship_logs} />
  </section>
{/if}
