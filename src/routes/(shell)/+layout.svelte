<script lang="ts">
  import Shell from '$core/layout/Shell.svelte';
  import type { LoadedExtension } from '$lib/types';
  import { getContext, type Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();

  const extensions = getContext<LoadedExtension[]>('extensions');
</script>

<!--
  The app nav lives here rather than in the root layout, so pages outside this
  group can opt out of it. A public portfolio is the case that matters: a shared
  link should show the portfolio, not a navigation bar full of routes the
  visitor cannot open.
-->
<Shell {extensions}>
  {@render children()}
</Shell>
