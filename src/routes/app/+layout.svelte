<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { session } from '$core/auth/session.svelte';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();

  $effect(() => {
    if (!session.isAuthenticated && $page.url.pathname !== '/app/login') {
      goto('/app/login', { replaceState: true });
    }
  });
</script>

{@render children()}
