<script lang="ts">
  import { componentFor } from '$core/registry';
  import type { LoadedExtension } from '$lib/types';
  import { getContext } from 'svelte';

  // The page is a host; the extension registered for this path supplies the UI.
  const extensions = getContext<LoadedExtension[]>('extensions');
  const loader = componentFor(extensions, '/app/messages');
</script>

<svelte:head><title>Inbox · PointBreak</title></svelte:head>

{#if loader}
  {#await loader() then module}
    {@const Component = (module as { default: any }).default}
    <Component />
  {/await}
{:else}
  <p class="disabled">
    This extension is disabled. Enable it with <code>npm run net -- enable &lt;id&gt;</code>.
  </p>
{/if}

<style>
  .disabled { color: var(--fg-muted); }
</style>
