<script lang="ts">
  import DemoNotice from '$core/layout/DemoNotice.svelte';
  import { loadManagedPostings, type ManagedPosting } from '../data';
  import type { NetworkSource } from '$core/network';
  import ApplicantManager from './ApplicantManager.svelte';

  // ApplicantManager is presentational and needs a posting. Routes render
  // extension components with no props, so it needs a container that loads
  // something first. Without one the route rendered it bare and crashed.
  let postings = $state<ManagedPosting[]>([]);
  let source = $state<NetworkSource>('index');
  let demo = $state(false);
  let selectedId = $state<string | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    loadManagedPostings()
      .then((result) => {
        postings = result.postings;
        source = result.source;
        demo = result.demo;
        selectedId ??= result.postings[0]?.job.id ?? null;
      })
      .catch((e: unknown) => (error = e instanceof Error ? e.message : 'Could not load postings.'))
      .finally(() => (loading = false));
  });

  const selected = $derived(postings.find((p) => p.job.id === selectedId) ?? null);
</script>

<h1 class="text-lg font-medium">Company</h1>
<p class="mt-1 mb-5 max-w-3xl text-sm text-muted">
  Every number here is derived from the ledger. None of it is anything you wrote about yourself,
  and an action you log counts only once the candidate it names confirms it happened.
</p>

<DemoNotice {source} {demo} />

<p class="mb-5 rounded-md border border-edge p-3 text-sm text-muted">
  <strong class="text-fg">Claiming a company is not built yet.</strong>
  Nobody can prove they work somewhere, so this shows the demonstration postings rather than yours.
</p>

{#if loading}
  <p class="text-muted">Loading postings...</p>
{:else if error}
  <p class="rounded-md border border-danger p-3 text-sm text-danger">{error}</p>
{:else if postings.length === 0}
  <p class="text-muted">No open postings.</p>
{:else}
  {#if postings.length > 1}
    <div class="mb-5 flex flex-wrap gap-2">
      {#each postings as posting (posting.job.id)}
        <button
          type="button"
          onclick={() => (selectedId = posting.job.id)}
          class="rounded-md border px-3 py-1.5 text-sm"
          class:border-accent={posting.job.id === selectedId}
          class:text-accent={posting.job.id === selectedId}
          class:border-edge={posting.job.id !== selectedId}
          class:text-muted={posting.job.id !== selectedId}
        >
          {posting.job.title}
        </button>
      {/each}
    </div>
  {/if}

  {#if selected}
    <ApplicantManager
      job={selected.job}
      metrics={selected.metrics}
      applications={selected.applications}
    />
  {/if}
{/if}
