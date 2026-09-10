<script lang="ts">
  let {
    stack = $bindable<string[]>([]),
    minSalary = $bindable(0),
    hideGhosts = $bindable(true)
  } = $props();

  const field = 'rounded-md border border-edge bg-elevated px-2 py-1.5 text-fg';
</script>

<form class="mb-5 flex flex-wrap items-end gap-4" onsubmit={(e) => e.preventDefault()}>
  <label class="grid gap-1 text-sm text-muted">
    Tech stack
    <input
      class={field}
      placeholder="typescript, rust"
      value={stack.join(', ')}
      oninput={(e) =>
        (stack = e.currentTarget.value
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean))}
    />
  </label>

  <label class="grid gap-1 text-sm text-muted">
    Min. salary
    <input class={field} type="number" min="0" step="5000" bind:value={minSalary} />
  </label>

  <label class="flex items-center gap-2 text-sm text-muted">
    <input type="checkbox" bind:checked={hideGhosts} />
    Hide 🔴 ghost jobs
  </label>
</form>
