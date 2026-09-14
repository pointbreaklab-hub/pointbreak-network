<script lang="ts">
  import '$core/layout/app.css';
  import { loadEnabledExtensions } from '$core/registry';
  import { setContext } from 'svelte';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();

  // Auto-discovered at build time; route pages read this back out of context.
  const extensions = loadEnabledExtensions();
  setContext('extensions', extensions);
</script>

{@render children()}
