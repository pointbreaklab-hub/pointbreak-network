<script lang="ts">
  import { BAND_LABELS } from '$core/math-engine';
  import type { GhostScore } from '$lib/types';

  let { score, showValue = false }: { score: GhostScore; showValue?: boolean } = $props();

  const band = $derived(BAND_LABELS[score.band]);
  const tone = $derived(
    { active: 'text-ok', evergreen: 'text-warn', ghost: 'text-danger' }[score.band]
  );
</script>

<span
  class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-current px-2 py-0.5 text-xs whitespace-nowrap {tone}"
  title={score.breakdown
    .filter((r) => r.applied)
    .map((r) => `${r.points > 0 ? '+' : ''}${r.points} ${r.label}`)
    .join('\n') || 'No rules applied'}
>
  <span aria-hidden="true">{band.emoji}</span>
  {band.label}
  {#if showValue}<span class="tabular opacity-70">{score.score}</span>{/if}
</span>
