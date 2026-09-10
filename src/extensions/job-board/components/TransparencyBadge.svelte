<script lang="ts">
  import type { GhostScore } from '$lib/types';

  let { score }: { score: GhostScore } = $props();

  // Low confidence is reported as "undisclosed", never as a good score.
  const label = $derived(
    score.confidence < 0.3
      ? 'Undisclosed'
      : score.score < 0.33
        ? 'Healthy'
        : score.score < 0.66
          ? 'Watch'
          : 'Likely ghost'
  );

  const tone = $derived(
    score.confidence < 0.3 ? 'muted' : score.score < 0.33 ? 'ok' : score.score < 0.66 ? 'warn' : 'danger'
  );
</script>

<span class="badge {tone}" title={`ghost ${score.score} · confidence ${score.confidence}`}>
  {label}
</span>

<style>
  .badge {
    font-size: 0.75rem; padding: 0.15rem 0.5rem; border-radius: 999px;
    border: 1px solid currentColor; white-space: nowrap;
  }
  .ok { color: var(--ok); }
  .warn { color: var(--warn); }
  .danger { color: var(--danger); }
  .muted { color: var(--fg-muted); }
</style>
