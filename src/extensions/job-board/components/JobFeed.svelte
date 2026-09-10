<script lang="ts">
  import { scoreJob } from '$core/math-engine';
  import type { JobPost } from '$lib/types';
  import { formatCompensation, relativeTime } from '$lib/utils';
  import TransparencyBadge from './TransparencyBadge.svelte';

  let { jobs = [] }: { jobs: JobPost[] } = $props();

  // Disclosed postings rank above undisclosed ones — that is the whole product.
  const ranked = $derived(
    jobs
      .map((job) => ({ job, ghost: scoreJob(job, [], jobs) }))
      .sort((a, b) => b.ghost.confidence - a.ghost.confidence || a.ghost.score - b.ghost.score)
  );
</script>

<ul class="feed">
  {#each ranked as { job, ghost } (job.id)}
    <li>
      <div class="head">
        <h3>{job.title}</h3>
        <TransparencyBadge score={ghost} />
      </div>
      <p class="meta tabular">
        {formatCompensation(job.compensation)} · {job.location.type}
        {#if job.location.region}({job.location.region}){/if}
        · posted {relativeTime(job.postedAt)}
      </p>
    </li>
  {/each}
</ul>

<style>
  .feed { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.75rem; }
  li { border: 1px solid var(--border); border-radius: 8px; padding: 1rem; }
  .head { display: flex; justify-content: space-between; align-items: start; gap: 1rem; }
  h3 { margin: 0; font-size: 1rem; }
  .meta { margin: 0.35rem 0 0; color: var(--fg-muted); font-size: 0.875rem; }
</style>
