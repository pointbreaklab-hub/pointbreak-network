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

<div class="flex min-h-screen flex-col bg-bg text-fg">
  <Nav {items} />
  <main class="mx-auto w-full max-w-5xl flex-1 px-5 py-8">
    {@render children()}
  </main>
</div>
