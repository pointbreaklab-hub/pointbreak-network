<script lang="ts">
  import { BAND_LABELS, MIN_SAMPLE_FOR_SILENCE } from '$core/math-engine';
  import type { GhostScore } from '$lib/types';

  let { score, showValue = false }: { score: GhostScore; showValue?: boolean } = $props();

  const band = $derived(BAND_LABELS[score.band]);
  const tone = $derived(
    { active: 'text-ok', evergreen: 'text-warn', ghost: 'text-danger' }[score.band]
  );

  // Say so when the score rests on very little. Externally sourced jobs are
  // only visible through the candidates who logged them here.
  const thin = $derived(score.sample < MIN_SAMPLE_FOR_SILENCE);
</script>

<span class="shrink-0 text-right">
  <span
    class="inline-flex items-center gap-1.5 rounded-full border border-current px-2 py-0.5 text-xs whitespace-nowrap {tone}"
    title={score.breakdown
      .filter((r) => r.applied)
      .map((r) => `${r.points > 0 ? '+' : ''}${r.points}  ${r.label}`)
      .join('\n') || 'No rules applied'}
  >
    <span aria-hidden="true">{band.emoji}</span>
    {band.label}
    {#if showValue}<span class="tabular opacity-70">{score.score}</span>{/if}
  </span>

  {#if showValue}
    <span class="tabular mt-0.5 block text-xs text-muted">
      {#if thin}from {score.sample} reports{:else}{score.sample} reports{/if}
    </span>
  {/if}
</span>
