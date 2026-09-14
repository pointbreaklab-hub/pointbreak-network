<script lang="ts">
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import {
    COMPANY_BAND_LABELS,
    deriveCompanyMetrics,
    MIN_COMPANY_SAMPLE,
    scoreCompany,
    scoreJob,
    deriveMetrics
  } from '$core/math-engine';
  import { loadNetwork } from '$core/network';
  import type { CompanyScore, Job } from '$lib/types';
  import { relativeTime } from '$lib/utils';

  const companyId = $derived($page.params.id ?? '');

  let result = $state<CompanyScore | null>(null);
  let postings = $state<Array<{ job: Job; score: number; band: string }>>([]);
  let loading = $state(true);

  $effect(() => {
    const id = companyId;
    if (!id) return;

    loading = true;
    loadNetwork()
      .then((network) => {
        result = scoreCompany(deriveCompanyMetrics(id, network.jobs, network.events));
        postings = network.jobs
          .filter((job) => job.company_id === id)
          .map((job) => {
            const score = scoreJob(job, deriveMetrics(job, network.events, network.jobs));
            return { job, score: score.score, band: score.band };
          })
          .sort((a, b) => b.score - a.score);
      })
      .finally(() => (loading = false));
  });

  const tone = (band: string) =>
    band === 'ghost' ? 'text-danger' : band === 'evergreen' ? 'text-warn' : 'text-ok';
</script>

<svelte:head>
  <title>{companyId} · PointBreak</title>
</svelte:head>

<p class="mb-3 text-sm">
  <a href="{base}/companies" class="text-muted hover:text-fg">All companies</a>
</p>

<h1 class="text-lg font-medium">{companyId}</h1>

{#if loading}
  <p class="mt-4 text-muted">Loading...</p>
{:else if result}
  {@const band = COMPANY_BAND_LABELS[result.band]}
  {@const m = result.metrics}

  {#if !result.measured}
    <p class="mt-4 max-w-2xl rounded-md border border-edge p-3 text-sm text-muted">
      <strong class="text-fg">Not enough data to rate this company.</strong>
      {result.sample} tracked application{result.sample === 1 ? '' : 's'}, and a rating needs at
      least {MIN_COMPANY_SAMPLE}. That makes this unknown rather than good or bad.
    </p>
  {:else}
    <p class="mt-1 text-sm {tone(result.band)}">
      {band.emoji}
      {band.label}
      <span class="tabular text-muted">· {result.score}/100 from {result.sample} reports</span>
    </p>
  {/if}

  <div class="mt-5 grid max-w-3xl gap-3 sm:grid-cols-3">
    {#each [['Heard back', `${Math.round(m.response_rate * 100)}%`, `${m.responded} of ${m.applications}`], ['Median wait', m.median_days_to_response === null ? 'never' : `${Math.round(m.median_days_to_response)}d`, 'to a first reply'], ['Open postings', String(m.open_postings), `${m.stale_postings} stale`]] as [label, value, note] (label)}
      <div class="rounded-lg border border-edge p-4">
        <p class="text-xs text-muted">{label}</p>
        <p class="tabular mt-1 text-2xl font-semibold">{value}</p>
        <p class="text-xs text-muted">{note}</p>
      </div>
    {/each}
  </div>

  {#if result.measured}
    <section class="mt-6 max-w-3xl">
      <h2 class="text-sm font-medium text-muted">How the rating was reached</h2>
      <ul class="mt-2 grid gap-1 text-sm">
        {#each result.breakdown.filter((r) => r.applied) as rule (rule.id)}
          <li class="flex justify-between gap-4 border-b border-edge py-1">
            <span class="text-muted">{rule.label}</span>
            <span class="tabular {rule.points > 0 ? 'text-danger' : 'text-ok'}">
              {rule.points > 0 ? '+' : ''}{rule.points}
            </span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if m.claims_disputed > 0}
    <p class="mt-4 max-w-3xl rounded-md border border-danger p-3 text-sm">
      <strong class="text-danger">Disputed actions.</strong>
      <span class="text-muted">
        {m.claims_disputed} of {m.claims_total} actions this company logged were disputed by the
        candidate who should have received them.
      </span>
    </p>
  {/if}

  <section class="mt-6 max-w-3xl">
    <h2 class="text-sm font-medium text-muted">Postings</h2>
    <ul class="mt-2 grid gap-1">
      {#each postings as { job, score, band: jobBand } (job.id)}
        <li class="flex items-baseline justify-between gap-4 border-b border-edge py-2 text-sm">
          <span>
            {job.title}
            <span class="text-xs text-muted">· {relativeTime(job.posted_at)}</span>
          </span>
          <span class="tabular shrink-0 {tone(jobBand)}">{score}</span>
        </li>
      {:else}
        <li class="py-2 text-sm text-muted">No postings tracked.</li>
      {/each}
    </ul>
  </section>
{/if}
