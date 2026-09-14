<script lang="ts">
  import { base } from '$app/paths';
  import DemoNotice from '$core/layout/DemoNotice.svelte';
  import { COMPANY_BAND_LABELS, MIN_COMPANY_SAMPLE, scoreAllCompanies } from '$core/math-engine';
  import { loadNetwork, type NetworkSource } from '$core/network';
  import type { CompanyScore } from '$lib/types';

  let scores = $state<CompanyScore[]>([]);
  let source = $state<NetworkSource>('index');
  let demo = $state(false);
  let loading = $state(true);
  let sort = $state<'worst' | 'best' | 'most_tracked'>('worst');

  $effect(() => {
    loadNetwork()
      .then((network) => {
        scores = scoreAllCompanies(network.jobs, network.events);
        source = network.source;
        demo = network.source === 'demo';
      })
      .finally(() => (loading = false));
  });

  // Unmeasured companies are listed separately rather than sorted among the
  // rest. A company with two reports is not "good", it is unknown, and mixing
  // the two would let an absence read as a result.
  const measured = $derived(scores.filter((s) => s.measured));
  const unmeasured = $derived(scores.filter((s) => !s.measured));

  const ordered = $derived(
    [...measured].sort((a, b) => {
      if (sort === 'best') return a.score - b.score;
      if (sort === 'most_tracked') return b.sample - a.sample;
      return b.score - a.score;
    })
  );

  const tone = (band: string) =>
    band === 'ghost' ? 'text-danger' : band === 'evergreen' ? 'text-warn' : 'text-ok';

  const th = 'border-b border-edge px-3 py-2 text-left font-medium';
  const td = 'border-b border-edge px-3 py-2';
</script>

<svelte:head>
  <title>Company response rates · PointBreak</title>
  <meta
    name="description"
    content="How often companies actually answer the people who apply to them, computed from candidate reports."
  />
</svelte:head>

<h1 class="text-lg font-medium">Do these companies answer anyone?</h1>
<p class="mt-1 mb-5 max-w-3xl text-sm text-muted">
  Every figure is derived from what candidates reported and confirmed, never from anything a
  company said about itself. A company cannot improve these numbers by logging work it did not do,
  because an action only counts once the candidate it names confirms it happened.
</p>

<DemoNotice {source} {demo} />

{#if loading}
  <p class="text-muted">Loading...</p>
{:else if measured.length === 0}
  <p class="rounded-md border border-edge p-4 text-sm text-muted">
    No company has enough tracked applications yet. A score needs at least {MIN_COMPANY_SAMPLE}
    reports, because a number drawn from two would be misleading.
  </p>
{:else}
  <div class="mb-3 flex flex-wrap gap-2 text-sm">
    {#each [['worst', 'Worst first'], ['best', 'Best first'], ['most_tracked', 'Most reports']] as [key, label] (key)}
      <button
        type="button"
        onclick={() => (sort = key as typeof sort)}
        class="rounded-md border px-3 py-1 {sort === key
          ? 'border-accent text-accent'
          : 'border-edge text-muted'}"
      >
        {label}
      </button>
    {/each}
  </div>

  <div class="overflow-x-auto">
    <table class="w-full border-collapse text-sm">
      <thead>
        <tr class="text-muted">
          <th class={th}>Company</th>
          <th class={th}>Heard back</th>
          <th class={th}>Median wait</th>
          <th class={th}>Tracked</th>
          <th class={th}>Rating</th>
        </tr>
      </thead>
      <tbody>
        {#each ordered as entry (entry.company_id)}
          {@const band = COMPANY_BAND_LABELS[entry.band]}
          <tr>
            <td class={td}>
              <a href="{base}/companies/{entry.company_id}" class="text-accent">
                {entry.company_id}
              </a>
            </td>
            <td class="tabular {td}">
              {Math.round(entry.metrics.response_rate * 100)}%
              <span class="text-xs text-muted">
                ({entry.metrics.responded}/{entry.metrics.applications})
              </span>
            </td>
            <td class="tabular {td}">
              {#if entry.metrics.median_days_to_response === null}
                <span class="text-danger">never</span>
              {:else}
                {Math.round(entry.metrics.median_days_to_response)}d
              {/if}
            </td>
            <td class="tabular {td}">{entry.sample}</td>
            <td class="{td} {tone(entry.band)}">
              {band.emoji}
              {band.label}
              <span class="tabular text-xs opacity-70">{entry.score}</span>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  {#if unmeasured.length}
    <section class="mt-6">
      <h2 class="text-sm font-medium text-muted">Not enough data to say</h2>
      <p class="mt-1 text-sm text-muted">
        Fewer than {MIN_COMPANY_SAMPLE} tracked applications each. These are unknown, not good.
      </p>
      <p class="mt-2 flex flex-wrap gap-2">
        {#each unmeasured as entry (entry.company_id)}
          <a
            href="{base}/companies/{entry.company_id}"
            class="rounded-md border border-edge px-2 py-1 text-xs text-muted"
          >
            {entry.company_id}
            <span class="tabular opacity-60">{entry.sample}</span>
          </a>
        {/each}
      </p>
    </section>
  {/if}
{/if}

<section class="mt-8 max-w-3xl border-t border-edge pt-5 text-sm text-muted">
  <h2 class="font-medium text-fg">How this is calculated</h2>
  <p class="mt-2">
    Aggregated across every posting a company has, rather than per posting. Nobody wants to know
    whether one requisition is a ghost; they want to know whether a company replies. Aggregating
    this way also needs far fewer reports before a figure means anything.
  </p>
  <p class="mt-2">
    "Heard back" counts applications where the candidate confirmed the company did something. A
    claim the company logged but nobody confirmed does not count, and does not stop the clock.
  </p>
  <p class="mt-2">
    The rules are in
    <code class="text-fg">src/core/math-engine/company-score.ts</code>, and every input is a dated
    public record. Clone the data and recompute it yourself if you disagree.
  </p>
</section>
