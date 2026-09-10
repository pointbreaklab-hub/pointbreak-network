<script lang="ts">
  import { scoreJob } from '$core/math-engine';
  import type { Application, CloseReason, Job } from '$lib/types';
  import { relativeTime } from '$lib/utils';
  import GhostScoreMeter from './GhostScoreMeter.svelte';

  let { job, applications = [] }: { job: Job; applications: Application[] } = $props();

  const ghost = $derived(scoreJob(job));

  const CLOSE_REASONS: Array<{ value: CloseReason; label: string }> = [
    { value: 'external_hire', label: 'Hired externally' },
    { value: 'internal_hire', label: 'Hired internally' },
    { value: 'cancelled', label: 'Cancelled, no hire' }
  ];

  let closeReason = $state<CloseReason | ''>('');

  // TODO: writes a status transition to the data repo as a commit.
  function closeJob() {}
</script>

<div class="grid gap-6 md:grid-cols-[2fr_1fr]">
  <div>
    <h1 class="text-lg font-medium">{job.title}</h1>
    <p class="tabular mt-1 mb-4 text-sm text-muted">
      {applications.length} applicants · posted {relativeTime(job.posted_at)}
    </p>

    <ul class="grid gap-1">
      {#each applications as app (app.github_login)}
        <li class="flex justify-between border-b border-edge py-2">
          <span>{app.github_login}</span>
          <span class="text-sm text-muted">
            {app.status} · {relativeTime(app.last_action_at)}
          </span>
        </li>
      {:else}
        <li class="py-2 text-muted">No applicants yet.</li>
      {/each}
    </ul>

    <div class="mt-6 flex items-end gap-3">
      <label class="grid gap-1 text-sm text-muted">
        Close this posting
        <select bind:value={closeReason} class="rounded-md border border-edge bg-elevated px-2 py-1.5 text-fg">
          <option value="">Select a reason…</option>
          {#each CLOSE_REASONS as reason (reason.value)}
            <option value={reason.value}>{reason.label}</option>
          {/each}
        </select>
      </label>
      <button
        type="button"
        onclick={closeJob}
        disabled={!closeReason}
        class="rounded-md border border-edge px-3 py-1.5 text-sm disabled:opacity-40"
      >
        Close
      </button>
    </div>
  </div>

  <GhostScoreMeter {job} score={ghost} />
</div>
