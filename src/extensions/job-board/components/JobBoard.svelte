<script lang="ts">
  import { loadScoredJobs, type ScoredJob } from '../data';
  import JobFeed from './JobFeed.svelte';
  import JobFilters from './JobFilters.svelte';

  let jobs = $state<ScoredJob[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  let stack = $state<string[]>([]);
  let minSalary = $state(0);
  let hideGhosts = $state(false);
  let disclosedOnly = $state(false);

  $effect(() => {
    loadScoredJobs()
      .then((result) => (jobs = result))
      .catch((e: unknown) => (error = e instanceof Error ? e.message : 'Could not load postings.'))
      .finally(() => (loading = false));
  });

  const visible = $derived(
    jobs.filter(({ job, score }) => {
      if (disclosedOnly && !job.salary_disclosed) return false;
      if (minSalary > 0 && (!job.salary || job.salary.min < minSalary)) return false;
      if (stack.length && !stack.every((t) => job.tech_stack.includes(t))) return false;
      if (hideGhosts && score.band === 'ghost') return false;
      return true;
    })
  );

  const hidden = $derived(jobs.length - visible.length);
</script>

<h1 class="text-lg font-medium">Jobs</h1>
<p class="mt-1 mb-5 max-w-3xl text-sm text-muted">
  Ranked by Ghost Score, lowest first. Scores are computed from what candidates report, not from
  what companies claim, so a posting can be measured whether or not the company has ever heard of
  us.
</p>

<JobFilters bind:stack bind:minSalary bind:hideGhosts bind:disclosedOnly />

{#if loading}
  <p class="text-muted">Loading postings...</p>
{:else if error}
  <p class="rounded-md border border-danger p-3 text-sm text-danger">{error}</p>
{:else}
  {#if hidden > 0}
    <p class="tabular mb-3 text-sm text-muted">{hidden} of {jobs.length} hidden by filters.</p>
  {/if}
  <JobFeed jobs={visible} />
{/if}
