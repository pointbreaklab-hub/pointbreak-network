<script lang="ts">
  import { scoreJob } from '$core/math-engine';
  import type { Job } from '$lib/types';
  import { loadJobs } from '../data';
  import JobFeed from './JobFeed.svelte';
  import JobFilters from './JobFilters.svelte';

  let jobs = $state<Job[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  let stack = $state<string[]>([]);
  let minSalary = $state(0);
  let hideGhosts = $state(false);

  $effect(() => {
    loadJobs()
      .then((result) => (jobs = result))
      .catch((e) => (error = e instanceof Error ? e.message : 'Could not load postings.'))
      .finally(() => (loading = false));
  });

  // Filtering by salary uses the floor, not the midpoint: a posting only counts
  // as clearing your bar if its worst case does.
  const visible = $derived(
    jobs.filter((job) => {
      if (job.salary.min < minSalary) return false;
      if (stack.length && !stack.every((t) => job.tech_stack.includes(t))) return false;
      if (hideGhosts && scoreJob(job).band === 'ghost') return false;
      return true;
    })
  );

  const hidden = $derived(jobs.length - visible.length);
</script>

<h1 class="text-lg font-medium">Jobs</h1>
<p class="mt-1 mb-5 text-sm text-muted">
  Ranked by Ghost Score, lowest first. Companies that act on applicants rank above ones that
  don't, and no amount of money changes that order.
</p>

<JobFilters bind:stack bind:minSalary bind:hideGhosts />

{#if loading}
  <p class="text-muted">Loading postings…</p>
{:else if error}
  <p class="rounded-md border border-danger p-3 text-sm text-danger">{error}</p>
{:else}
  {#if hidden > 0}
    <p class="tabular mb-3 text-sm text-muted">{hidden} of {jobs.length} hidden by filters.</p>
  {/if}
  <JobFeed jobs={visible} />
{/if}
