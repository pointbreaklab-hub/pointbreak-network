<script lang="ts">
  import { componentFor } from '$core/registry';
  import type { LoadedExtension } from '$lib/types';
  import { getContext } from 'svelte';

  let { path }: { path: string } = $props();

  const extensions = getContext<LoadedExtension[]>('extensions');

  // Derived, not captured: otherwise a changing path keeps the first route's
  // component forever.
  const loader = $derived(componentFor(extensions, path));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let Component = $state<any>(null);
  let loadError = $state<unknown>(null);

  /**
   * The module is resolved here rather than in an `{#await}` block on purpose.
   *
   * Rendering the component inside `{#await ... then}` puts its render inside a
   * promise microtask, and svelte:boundary only catches errors in the
   * synchronous render tree. A component that throws there escapes as an
   * uncaught rejection and blanks the page, which is exactly the failure the
   * boundary is supposed to prevent. Resolving first means `<Component />`
   * renders synchronously inside the boundary, where it can be caught.
   */
  $effect(() => {
    const current = loader;
    if (!current) return;

    let cancelled = false;
    Component = null;
    loadError = null;

    current()
      .then((module) => {
        if (!cancelled) Component = (module as { default: unknown }).default;
      })
      .catch((error) => {
        if (!cancelled) loadError = error;
      });

    return () => {
      cancelled = true;
    };
  });

  function message(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
</script>

{#snippet failure(error: unknown, what: string)}
  <div class="rounded-md border border-danger p-4">
    <h2 class="text-sm font-medium text-danger">This extension failed to {what}</h2>
    <p class="mt-1 text-sm text-muted">
      The rest of the app is unaffected. Disable it with
      <code class="text-fg">npm run net -- disable &lt;id&gt;</code> if it stays broken.
    </p>
    <p class="mt-2 font-mono text-xs text-muted">{message(error)}</p>
  </div>
{/snippet}

{#if !loader}
  <p class="text-sm text-muted">
    This extension is disabled. Enable it with <code>npm run net -- enable &lt;id&gt;</code>.
  </p>
{:else if loadError}
  {@render failure(loadError, 'load')}
{:else if Component}
  <!--
    A route host cannot pass props, so an extension expecting them throws on
    render. Without this boundary that took the whole page down with it, which
    is how /app/company shipped as a blank page reachable from the nav.
  -->
  <svelte:boundary>
    {@const Rendered = Component}
    <Rendered />

    {#snippet failed(error: unknown)}
      {@render failure(error, 'render')}
    {/snippet}
  </svelte:boundary>
{:else}
  <p class="text-muted">Loading...</p>
{/if}
