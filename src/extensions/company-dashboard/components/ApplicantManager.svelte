<script lang="ts">
  import { scoreJob } from '$core/math-engine';
  import type { Application, JobPost } from '$lib/types';
  import { relativeTime } from '$lib/utils';
  import GhostScoreWarning from './GhostScoreWarning.svelte';

  let { job, applications = [] }: { job: JobPost; applications: Application[] } = $props();

  const ghost = $derived(scoreJob(job, applications));
</script>

<GhostScoreWarning score={ghost} />

<h2>{job.title}</h2>
<p class="meta tabular">{applications.length} applicants · posted {relativeTime(job.postedAt)}</p>

<ul>
  {#each applications as app (app.login)}
    <li>
      <span>{app.login}</span>
      <span class="stage">{app.history.at(-1)?.stage ?? 'submitted'}</span>
      <!-- TODO: stage transitions write back to the data repo as commits -->
    </li>
  {/each}
</ul>

<style>
  h2 { font-size: 1.05rem; margin: 0; }
  .meta { color: var(--fg-muted); font-size: 0.875rem; margin: 0.25rem 0 1rem; }
  ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.4rem; }
  li { display: flex; justify-content: space-between; border-bottom: 1px solid var(--border); padding: 0.5rem 0; }
  .stage { color: var(--fg-muted); font-size: 0.875rem; }
</style>
