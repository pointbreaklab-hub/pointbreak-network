<script lang="ts">
  import type { MessageRequest } from '$lib/types';
  import MessageRequestCard from './MessageRequest.svelte';

  let { requests = [] }: { requests: MessageRequest[] } = $props();

  const pending = $derived(requests.filter((r) => r.accepted === undefined));
  const accepted = $derived(requests.filter((r) => r.accepted === true));
</script>

<p class="mb-6 text-sm text-muted">
  Anyone can send a request; nobody can pay to skip the queue. Messages are polled, not pushed.
</p>

<section class="mb-8">
  <h2 class="mb-2 flex items-center gap-2 text-base font-medium">
    Requests <span class="tabular font-normal text-muted">{pending.length}</span>
  </h2>
  {#each pending as request (request.thread_id)}
    <MessageRequestCard {request} />
  {:else}
    <p class="text-sm text-muted">No pending requests.</p>
  {/each}
</section>

<section>
  <h2 class="mb-2 text-base font-medium">Accepted</h2>
  {#each accepted as request (request.thread_id)}
    <MessageRequestCard {request} />
  {:else}
    <p class="text-sm text-muted">Nothing here yet.</p>
  {/each}
</section>
