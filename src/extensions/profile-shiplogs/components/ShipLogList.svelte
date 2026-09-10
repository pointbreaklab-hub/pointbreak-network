<script lang="ts">
  import type { ShipLog } from '$lib/types';
  import { relativeTime } from '$lib/utils';

  let { logs = [] }: { logs: ShipLog[] } = $props();
</script>

{#if logs.length === 0}
  <p class="empty">No ship logs yet. A log is one thing you shipped, with a link that proves it.</p>
{:else}
  <ul class="logs">
    {#each logs as log (log.id)}
      <li>
        <h3>{log.title}</h3>
        <p class="meta">{relativeTime(log.shippedAt)} · {log.skills.join(', ')}</p>
        <ul class="evidence">
          {#each log.evidence as e (e.url)}
            <li><a href={e.url} rel="noreferrer noopener" target="_blank">{e.type}</a></li>
          {/each}
        </ul>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .logs { list-style: none; padding: 0; display: grid; gap: 1rem; }
  .logs > li { border: 1px solid var(--border); border-radius: 8px; padding: 1rem; }
  h3 { margin: 0 0 0.25rem; font-size: 1rem; }
  .meta { margin: 0; color: var(--fg-muted); font-size: 0.875rem; }
  .evidence { display: flex; gap: 0.75rem; list-style: none; padding: 0; margin: 0.5rem 0 0; }
  .empty { color: var(--fg-muted); }
</style>
