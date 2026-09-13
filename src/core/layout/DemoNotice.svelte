<script lang="ts">
  import type { NetworkSource } from '$core/network';

  let { source, demo }: { source: NetworkSource; demo: boolean } = $props();
</script>

{#if demo}
  <!--
    Shown only when the ledger read succeeded and returned nothing. Inventing
    postings into the public data repo would mislead anyone who cloned it, so
    they live in the client and are labelled instead.
  -->
  <p class="mb-5 rounded-md border border-warn p-3 text-sm">
    <strong class="text-warn">Demonstration data.</strong>
    <span class="text-muted">
      The ledger is empty, so these are example postings held in the app and never published.
      Anything you log is real and yours.
    </span>
  </p>
{:else if source === 'cache'}
  <p class="mb-5 rounded-md border border-edge p-3 text-sm text-muted">
    Offline. Showing the last copy this browser read.
  </p>
{:else if source === 'walk'}
  <p class="mb-5 rounded-md border border-edge p-3 text-sm text-muted">
    The network index is unavailable, so this was read file by file. Slower, same data.
  </p>
{/if}
