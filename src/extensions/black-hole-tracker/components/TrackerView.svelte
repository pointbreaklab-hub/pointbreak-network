<script lang="ts">
  import { session } from '$core/auth/session.svelte';
  import { BLACK_HOLE_AFTER_DAYS, detectAll } from '$core/math-engine';
  import { loadTracker, type TrackerData } from '../data';
  import ApplicationStatus from './ApplicationStatus.svelte';

  let data = $state<TrackerData | null>(null);
  let error = $state<string | null>(null);
  let loading = $state(true);

  $effect(() => {
    const login = session.current?.github_login;
    if (!login) return;

    loadTracker(login)
      .then((result) => (data = result))
      .catch((e) => (error = e instanceof Error ? e.message : 'Could not read the ledger.'))
      .finally(() => (loading = false));
  });

  const dark = $derived(
    data ? detectAll(data.mine, data.all).filter((r) => r.is_black_hole).length : 0
  );
</script>

<h1 class="text-lg font-medium">Black Hole Tracker</h1>
<p class="mt-1 mb-5 text-sm text-muted">
  Every row is projected from an append-only event ledger, so a company cannot change what you see
  here without appending an action that also moves its own Ghost Score.
</p>

{#if loading}
  <p class="text-muted">Reading the ledger...</p>
{:else if error}
  <p class="rounded-md border border-danger p-3 text-sm text-danger">{error}</p>
{:else if data}
  {#if dark > 0}
    <p class="mb-4 rounded-md border border-danger p-3 text-sm">
      <span class="tabular text-danger">{dark}</span>
      of your
      <span class="tabular">{data.mine.length}</span>
      applications have had no company action for over {BLACK_HOLE_AFTER_DAYS} days.
    </p>
  {/if}

  <ApplicationStatus applications={data.mine} allApplications={data.all} titles={data.titles} />
{/if}
