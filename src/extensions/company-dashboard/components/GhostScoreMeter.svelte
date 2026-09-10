<script lang="ts">
  import { actionNudges, BAND_LABELS, BANDS } from '$core/math-engine';
  import type { GhostScore, Job, JobMetrics } from '$lib/types';

  let { job, metrics, score }: { job: Job; metrics: JobMetrics; score: GhostScore } = $props();

  const band = $derived(BAND_LABELS[score.band]);
  const tone = $derived({ active: 'text-ok', evergreen: 'text-warn', ghost: 'text-danger' }[score.band]);
  const fill = $derived({ active: 'bg-ok', evergreen: 'bg-warn', ghost: 'bg-danger' }[score.band]);
  const nudges = $derived(actionNudges(job, metrics));
</script>

<section class="rounded-lg border border-edge p-4">
  <div class="flex items-baseline justify-between gap-4">
    <h2 class="text-sm font-medium text-muted">Ghost Score</h2>
    <span class="text-sm {tone}">{band.emoji} {band.label}</span>
  </div>

  <p class="tabular mt-1 text-4xl font-semibold {tone}">
    {score.score}<span class="text-lg text-muted">/100</span>
  </p>
  <p class="tabular text-xs text-muted">from {score.sample} candidate reports</p>

  <div class="relative mt-3 h-2 rounded-full bg-elevated">
    <div class="h-full rounded-full {fill}" style:width="{score.score}%"></div>
    <span class="absolute top-0 h-full w-px bg-bg/60" style:left="{BANDS.evergreen}%"></span>
    <span class="absolute top-0 h-full w-px bg-bg/60" style:left="{BANDS.ghost}%"></span>
  </div>

  <ul class="mt-4 grid gap-1 text-sm">
    {#each score.breakdown.filter((r) => r.applied) as rule (rule.id)}
      <li class="flex justify-between gap-4 border-b border-edge py-1">
        <span class="text-muted">{rule.label}</span>
        <span class="tabular {rule.points > 0 ? 'text-danger' : 'text-ok'}">
          {rule.points > 0 ? '+' : ''}{rule.points}
        </span>
      </li>
    {/each}
  </ul>

  {#if nudges.length}
    <div class="mt-4 rounded-md border border-warn p-3">
      <h3 class="text-sm font-medium text-warn">Lower your score</h3>
      <ul class="mt-1 grid gap-1 text-sm">
        {#each nudges as nudge (nudge)}<li>{nudge}</li>{/each}
      </ul>
    </div>
  {/if}
</section>
