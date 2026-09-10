<script lang="ts">
  import Nav from './Nav.svelte';
  import { navItems } from '$core/registry';
  import type { LoadedExtension } from '$lib/types';
  import type { Snippet } from 'svelte';

  let {
    extensions = [],
    children
  }: { extensions: LoadedExtension[]; children: Snippet } = $props();

  const items = $derived(navItems(extensions));
</script>

<div class="shell">
  <Nav {items} />
  <main>
    {@render children()}
  </main>
</div>

<style>
  .shell {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg);
    color: var(--fg);
  }
  main {
    flex: 1;
    width: min(72rem, 100% - 2.5rem);
    margin-inline: auto;
    padding-block: 2rem;
  }
</style>
