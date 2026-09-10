<script lang="ts">
  import { scoreJob } from '$core/math-engine';
  import type { Application, CloseReason, Job, JobMetrics } from '$lib/types';
  import { relativeTime } from '$lib/utils';
  import GhostScoreMeter from './GhostScoreMeter.svelte';

  let {
    job,
    metrics,
    applications = []
  }: { job: Job; metrics: JobMetrics; applications: Application[] } = $props();

  const ghost = $derived(scoreJob(job, metrics));

  const CLOSE_REASONS: Array<{ value: CloseReason; label: string }> = [
    { value: 'external_hire', label: 'Hired externally' },
    { value: 'internal_hire', label: 'Hired internally' },
    { value: 'cancelled', label: 'Cancelled, no hire' }
  ];

  let closeReason = $state<CloseReason | ''>('');

  // TODO: appends a company claim to the ledger. It earns no credit until the
  // candidate confirms it, which is the entire point of the design.
  function closeJob() {}
</script>

<div class="grid gap-6 md:grid-cols-[2fr_1fr]">
  <div>
    <h1 class="text-lg font-medium">{job.title}</h1>
    <p class="tabular mt-1 mb-4 text-sm text-muted">
      {applications.length} tracked applicants · posted {relativeTime(job.posted_at)}
    </p>

    <p class="mb-4 rounded-md border border-edge p-3 text-xs text-muted">
      Applicants are pseudonymous here. You see that someone applied and what they confirmed, never
      who they are, until they choose to open a thread with you.
    </p>

    <ul class="grid gap-1">
      {#each applications as app (app.application_ref)}
        <li class="flex justify-between border-b border-edge py-2 text-sm">
          <span class="font-mono text-xs text-muted">{app.application_ref.slice(0, 12)}</span>
          <span class="text-muted">
            {app.status} · {relativeTime(app.last_action_at)}
            {#if app.pending_claims.length}
              <span class="text-warn">· {app.pending_claims.length} unconfirmed</span>
            {/if}
          </span>
        </li>
      {:else}
        <li class="py-2 text-muted">No tracked applicants yet.</li>
      {/each}
    </ul>

    <div class="mt-6 flex items-end gap-3">
      <label class="grid gap-1 text-sm text-muted">
        Close this posting
        <select bind:value={closeReason} class="rounded-md border border-edge bg-elevated px-2 py-1.5 text-fg">
          <option value="">Select a reason...</option>
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

  <GhostScoreMeter {job} {metrics} score={ghost} />
</div>
