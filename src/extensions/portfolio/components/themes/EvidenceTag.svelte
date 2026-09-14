<script lang="ts">
  import { describeEvidence, isCorroborated, type Corroboration } from '$lib/portfolio';

  let { evidence, subtle = false }: { evidence: Corroboration[]; subtle?: boolean } = $props();

  // Claimed is the default state and not a criticism, so it is shown quietly
  // rather than as a warning. Corroborated is what earns emphasis.
  const backed = $derived(isCorroborated(evidence));
  const shown = $derived(evidence.filter((e) => e.kind !== 'claimed'));
</script>

{#if backed}
  <span class="inline-flex flex-wrap gap-1 align-middle">
    {#each shown as item (item.kind + JSON.stringify(item))}
      <span
        class="rounded-full border border-current px-1.5 py-0.5 text-[0.65rem] leading-none {subtle
          ? 'opacity-80'
          : ''}"
      >
        {describeEvidence(item)}
      </span>
    {/each}
  </span>
{:else}
  <span class="text-[0.65rem] opacity-50" title="Stated on the CV, nothing corroborates it yet">
    claimed
  </span>
{/if}
