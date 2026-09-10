<script lang="ts">
  import type { GhostScore } from '$lib/types';

  let { score }: { score: GhostScore } = $props();

  // Show the company exactly which signal is hurting them, and by how much.
  const worst = $derived([...score.signals].sort((a, b) => b.weight * b.value - a.weight * a.value)[0]);
  const visible = $derived(score.score >= 0.4 || score.confidence < 0.4);
</script>

{#if visible}
  <aside>
    <strong>This posting is trending toward a ghost score.</strong>
    {#if score.confidence < 0.4}
      <p>Your funnel is mostly undisclosed, so candidates see “Undisclosed” rather than a rating.</p>
    {:else if worst}
      <p>
        Largest contributor: <code>{worst.name}</code>
        (<span class="tabular">{(worst.weight * worst.value).toFixed(2)}</span> of
        <span class="tabular">{score.score.toFixed(2)}</span>).
      </p>
    {/if}
  </aside>
{/if}

<style>
  aside {
    border: 1px solid var(--warn); border-radius: 8px;
    padding: 0.85rem 1rem; color: var(--warn); margin-bottom: 1rem;
  }
  p { margin: 0.35rem 0 0; color: var(--fg); }
  code { font-size: 0.85em; }
</style>
