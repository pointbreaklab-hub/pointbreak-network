<script lang="ts">
  import type { ShipLog } from '$lib/types';
  import { relativeTime } from '$lib/utils';

  let { logs = [] }: { logs: ShipLog[] } = $props();

  // Merged PRs in reverse chronological order — a timeline of shipped work,
  // not a list of responsibilities.
  const timeline = $derived(
    [...logs].sort((a, b) => Date.parse(b.merged_at) - Date.parse(a.merged_at))
  );
</script>

{#if timeline.length === 0}
  <p class="text-muted">
    No ship logs yet. Sign in and we'll read your merged pull requests from GitHub.
  </p>
{:else}
  <ol class="grid gap-0">
    {#each timeline as log (log.repo + log.pr)}
      <li class="border-l border-edge py-3 pl-4">
        <p class="text-sm">
          <span class="text-muted">{log.repo}</span>
          <a
            href={log.url ?? `https://github.com/${log.repo}/pull/${log.pr}`}
            target="_blank"
            rel="noreferrer noopener"
            class="text-accent">#{log.pr}</a
          >
          {#if log.title}<span> — {log.title}</span>{/if}
        </p>
        <p class="text-xs text-muted">merged {relativeTime(log.merged_at)}</p>
      </li>
    {/each}
  </ol>
{/if}
