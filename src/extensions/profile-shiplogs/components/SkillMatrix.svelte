<script lang="ts">
  let { skills = {} }: { skills: Record<string, number> } = $props();

  // Sorted by demonstrated depth, not self-rating.
  const ranked = $derived(Object.entries(skills).sort(([, a], [, b]) => b - a));
</script>

<ul class="matrix">
  {#each ranked as [name, level] (name)}
    <li>
      <span>{name}</span>
      <span class="bar" style:--level={level}></span>
      <span class="tabular">{level.toFixed(1)}</span>
    </li>
  {/each}
</ul>

<style>
  .matrix { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.4rem; }
  li { display: grid; grid-template-columns: 10rem 1fr 3rem; gap: 0.75rem; align-items: center; }
  .bar { height: 6px; border-radius: 3px; background: var(--border); position: relative; }
  .bar::after {
    content: ''; position: absolute; inset: 0 auto 0 0;
    width: calc(var(--level) * 10%); border-radius: 3px; background: var(--accent);
  }
</style>
