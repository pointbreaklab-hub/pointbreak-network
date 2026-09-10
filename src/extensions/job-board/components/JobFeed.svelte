<script lang="ts">
  import { scoreJob } from '$core/math-engine';
  import type { Job } from '$lib/types';
  import { formatSalary, relativeTime } from '$lib/utils';
  import TransparencyBadge from './TransparencyBadge.svelte';

  let { jobs = [] }: { jobs: Job[] } = $props();

  // Lowest ghost score first: postings whose companies actually act rank above
  // the ones that don't. There is no paid placement to override this.
  const ranked = $derived(
    jobs
      .map((job) => ({ job, ghost: scoreJob(job) }))
      .sort((a, b) => a.ghost.score - b.ghost.score)
  );
</script>

{#if ranked.length === 0}
  <p class="text-muted">No postings yet.</p>
{:else}
  <ul class="grid gap-3">
    {#each ranked as { job, ghost } (job.id)}
      <li class="rounded-lg border border-edge p-4">
        <div class="flex items-start justify-between gap-4">
          <h3 class="text-base font-medium">{job.title}</h3>
          <TransparencyBadge score={ghost} showValue />
        </div>

        <p class="tabular mt-1 text-sm text-muted">
          {formatSalary(job.salary)} · posted {relativeTime(job.posted_at)}
          · {job.metrics.applications} applied
          · {job.metrics.interviews_scheduled} interviewed
        </p>

        <ul class="mt-2 flex flex-wrap gap-1.5">
          {#each job.tech_stack as tech (tech)}
            <li class="rounded bg-elevated px-1.5 py-0.5 text-xs text-muted">{tech}</li>
          {/each}
        </ul>
      </li>
    {/each}
  </ul>
{/if}
