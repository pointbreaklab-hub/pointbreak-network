<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { session } from '$core/auth/session.svelte';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();

  $effect(() => {
    if (!session.isAuthenticated && $page.url.pathname !== `${base}/app/login`) {
      goto(`${base}/app/login`, { replaceState: true });
    }
  });
</script>

{@render children()}
