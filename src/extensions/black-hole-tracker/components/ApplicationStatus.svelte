<script lang="ts">
  import { BLACK_HOLE_AFTER_DAYS, detectAll } from '$core/math-engine';
  import type { Application, LedgerEvent } from '$lib/types';
  import { relativeTime } from '$lib/utils';

  let {
    applications = [],
    allApplications = applications,
    titles = {},
    onattest
  }: {
    applications: Application[];
    allApplications?: Application[];
    titles?: Record<string, string>;
    onattest?: (claim: LedgerEvent, verdict: 'confirmed' | 'disputed') => void;
  } = $props();

  const rows = $derived(detectAll(applications, allApplications));
  const byJob = $derived(new Map(applications.map((a) => [a.job_id, a])));

  const LABELS: Record<string, string> = {
    submitted: 'Submitted',
    viewed: 'Viewed',
    interviewing: 'Interviewing',
    rejected: 'Rejected',
    offer: 'Offer',
    withdrawn: 'Withdrawn',
    black_hole: 'Black Hole'
  };

  const CLAIM_LABELS: Record<string, string> = {
    resume_viewed: 'viewed your application',
    rejection_sent: 'sent you a rejection',
    interview_scheduled: 'scheduled an interview'
  };

  const th = 'border-b border-edge px-3 py-2 text-left font-medium';
  const td = 'border-b border-edge px-3 py-2 align-top';
</script>

<table class="w-full border-collapse text-sm">
  <thead>
    <tr class="text-muted">
      <th class={th}>Job</th>
      <th class={th}>Applied</th>
      <th class={th}>State</th>
      <th class={th}>Silence</th>
      <th class={th}>Squad</th>
    </tr>
  </thead>
  <tbody>
    {#each rows as row (row.application_ref)}
      {@const app = byJob.get(row.job_id)}
      <tr class:text-danger={row.is_black_hole}>
        <td class={td}>
          {titles[row.job_id] ?? row.job_id}

          {#if app?.pending_claims.length}
            <!-- A company claim earns nothing until the person it names says
                 it happened. This is where that judgement is made. -->
            <div class="mt-2 grid gap-2">
              {#each app.pending_claims as claim (claim.id)}
                <div class="rounded-md border border-warn p-2 text-xs text-fg">
                  <p>
                    This company says it
                    <strong>{CLAIM_LABELS[claim.action] ?? claim.action}</strong>
                    {relativeTime(claim.at)}. Did that happen?
                  </p>
                  <div class="mt-1.5 flex gap-2">
                    <button
                      type="button"
                      class="rounded border border-ok px-2 py-0.5 text-ok"
                      onclick={() => onattest?.(claim, 'confirmed')}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      class="rounded border border-danger px-2 py-0.5 text-danger"
                      onclick={() => onattest?.(claim, 'disputed')}
                    >
                      No, never happened
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </td>
        <td class={td}>{relativeTime(app?.submitted_at ?? new Date())}</td>
        <td class={td}>{LABELS[row.state]}</td>
        <td class="tabular {td}">
          {row.days_silent}d
          {#if row.is_black_hole}
            <span class="text-xs opacity-70">(over {BLACK_HOLE_AFTER_DAYS})</span>
          {/if}
        </td>
        <td class="tabular {td}">
          <!-- You are not the only one being ignored. -->
          {row.squad_size && row.squad_size > 1 ? `${row.squad_size} stuck here` : '-'}
        </td>
      </tr>
    {:else}
      <tr><td colspan="5" class="px-3 py-4 text-muted">Nothing tracked yet.</td></tr>
    {/each}
  </tbody>
</table>
