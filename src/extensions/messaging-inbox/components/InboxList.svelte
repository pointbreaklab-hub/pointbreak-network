<script lang="ts">
  import type { MessageRequest } from '$lib/types';
  import MessageRequestCard from './MessageRequest.svelte';

  let { requests = [] }: { requests: MessageRequest[] } = $props();

  const pending = $derived(requests.filter((r) => r.accepted === undefined));
  const accepted = $derived(requests.filter((r) => r.accepted === true));
</script>

<section>
  <h2>Requests <span class="count tabular">{pending.length}</span></h2>
  {#each pending as request (request.threadId)}
    <MessageRequestCard {request} />
  {:else}
    <p class="empty">No pending requests.</p>
  {/each}
</section>

<section>
  <h2>Accepted</h2>
  {#each accepted as request (request.threadId)}
    <MessageRequestCard {request} />
  {:else}
    <p class="empty">Nothing here yet.</p>
  {/each}
</section>

<style>
  section { margin-bottom: 2rem; }
  h2 { font-size: 1rem; display: flex; gap: 0.5rem; align-items: center; }
  .count { color: var(--fg-muted); font-weight: 400; }
  .empty { color: var(--fg-muted); font-size: 0.9rem; }
</style>
