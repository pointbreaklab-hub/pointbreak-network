<script lang="ts">
  import type { LocationType } from '$lib/types';

  let {
    locationType = $bindable<LocationType | 'any'>('any'),
    minComp = $bindable(0),
    disclosedOnly = $bindable(false)
  } = $props();
</script>

<form class="filters" onsubmit={(e) => e.preventDefault()}>
  <label>
    Location
    <select bind:value={locationType}>
      <option value="any">Any</option>
      <option value="remote">Remote</option>
      <option value="hybrid">Hybrid</option>
      <option value="onsite">On-site</option>
    </select>
  </label>

  <label>
    Min. compensation
    <input type="number" min="0" step="5000" bind:value={minComp} />
  </label>

  <label class="check">
    <input type="checkbox" bind:checked={disclosedOnly} />
    Only postings that disclose their funnel
  </label>
</form>

<style>
  .filters { display: flex; flex-wrap: wrap; gap: 1rem; align-items: end; margin-bottom: 1.25rem; }
  label { display: grid; gap: 0.25rem; font-size: 0.875rem; color: var(--fg-muted); }
  .check { display: flex; align-items: center; gap: 0.5rem; }
  select, input[type='number'] {
    background: var(--bg-elevated); color: var(--fg);
    border: 1px solid var(--border); border-radius: 6px; padding: 0.35rem 0.5rem; font: inherit;
  }
</style>
