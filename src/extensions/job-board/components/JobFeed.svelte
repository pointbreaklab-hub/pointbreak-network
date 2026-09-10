<script lang="ts">
  import { formatSalary, relativeTime } from '$lib/utils';
  import type { ScoredJob } from '../data';
  import TransparencyBadge from './TransparencyBadge.svelte';

  let { jobs = [] }: { jobs: ScoredJob[] } = $props();

  // Lowest ghost score first. Companies that act rank above ones that do not,
  // and there is nothing to buy that changes this order.
  const ranked = $derived([...jobs].sort((a, b) => a.score.score - b.score.score));

  function sourceLabel(job: ScoredJob['job']): string {
    if (job.source === 'pointbreak') return 'Posted here';
    if (!job.source_url) return 'Logged by a candidate';
    return `Logged from ${new URL(job.source_url).hostname.replace(/^www\./, '')}`;
  }
</script>

{#if ranked.length === 0}
  <p class="text-muted">No postings match.</p>
{:else}
  <ul class="grid gap-3">
    {#each ranked as { job, metrics, score } (job.id)}
      <li class="rounded-lg border border-edge p-4">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h3 class="text-base font-medium">{job.title}</h3>
            <p class="text-xs text-muted">{sourceLabel(job)}</p>
          </div>
          <TransparencyBadge {score} showValue />
        </div>

        <p class="tabular mt-2 text-sm">
          {#if job.salary_disclosed && job.salary}
            {formatSalary(job.salary)}
          {:else}
            <span class="text-warn">Salary not disclosed</span>
          {/if}
          <span class="text-muted">
            · posted {relativeTime(job.posted_at)}
            · {metrics.applications} tracked applicants
            · {metrics.interviews_attested} confirmed interviews
          </span>
        </p>

        {#if metrics.claims_disputed > 0}
          <p class="mt-1 text-xs text-danger">
            {metrics.claims_disputed} of {metrics.claims_total} actions this company logged were
            disputed by the candidates who should have received them.
          </p>
        {:else if metrics.claims_unattested > 0}
          <p class="mt-1 text-xs text-muted">
            {metrics.claims_unattested} logged actions are still unconfirmed and count for nothing.
          </p>
        {/if}

        <ul class="mt-2 flex flex-wrap gap-1.5">
          {#each job.tech_stack as tech (tech)}
            <li class="rounded bg-elevated px-1.5 py-0.5 text-xs text-muted">{tech}</li>
          {/each}
        </ul>
      </li>
    {/each}
  </ul>
{/if}
