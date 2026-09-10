<script lang="ts">
  import { BLACK_HOLE_AFTER_DAYS, detectAll } from '$core/math-engine';
  import type { Application } from '$lib/types';
  import { relativeTime } from '$lib/utils';

  let {
    applications = [],
    allApplications = applications,
    titles = {}
  }: {
    applications: Application[];
    allApplications?: Application[];
    titles?: Record<string, string>;
  } = $props();

  const rows = $derived(detectAll(applications, allApplications));
  const byJob = $derived(new Map(applications.map((a) => [a.job_id, a])));

  const LABELS: Record<string, string> = {
    submitted: 'Submitted',
    viewed: 'Viewed',
    interviewing: 'Interviewing',
    rejected: 'Rejected',
    black_hole: 'Black Hole'
  };

  const th = 'border-b border-edge px-3 py-2 text-left font-medium';
  const td = 'border-b border-edge px-3 py-2';
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
    {#each rows as row (row.job_id)}
      <tr class:text-danger={row.is_black_hole}>
        <td class={td}>{titles[row.job_id] ?? row.job_id}</td>
        <td class={td}>{relativeTime(byJob.get(row.job_id)?.submitted_at ?? new Date())}</td>
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
      <tr><td colspan="5" class="px-3 py-4 text-muted">No applications tracked yet.</td></tr>
    {/each}
  </tbody>
</table>
