<script lang="ts">
  import { BLACK_HOLE_AFTER_DAYS, detectAll } from '$core/math-engine';
  import type { Application } from '$lib/types';
  import { relativeTime } from '$lib/utils';

  let {
    applications = [],
    allApplications = applications
  }: { applications: Application[]; allApplications?: Application[] } = $props();

  const rows = $derived(detectAll(applications, allApplications));

  const byJob = $derived(new Map(applications.map((a) => [a.job_id, a])));

  const LABELS: Record<string, string> = {
    submitted: 'Submitted',
    viewed: 'Viewed',
    interviewing: 'Interviewing',
    rejected: 'Rejected',
    black_hole: 'Black hole'
  };
</script>

<p class="mb-4 text-sm text-muted">
  An application goes dark after {BLACK_HOLE_AFTER_DAYS} days of company silence. Silence is
  recorded, not forgiven.
</p>

<table class="w-full border-collapse text-sm">
  <thead>
    <tr class="text-muted">
      <th class="border-b border-edge px-3 py-2 text-left font-medium">Job</th>
      <th class="border-b border-edge px-3 py-2 text-left font-medium">Applied</th>
      <th class="border-b border-edge px-3 py-2 text-left font-medium">State</th>
      <th class="border-b border-edge px-3 py-2 text-left font-medium">Silence</th>
      <th class="border-b border-edge px-3 py-2 text-left font-medium">Squad</th>
    </tr>
  </thead>
  <tbody>
    {#each rows as row (row.job_id)}
      <tr class:text-danger={row.is_black_hole}>
        <td class="border-b border-edge px-3 py-2">{row.job_id}</td>
        <td class="border-b border-edge px-3 py-2">
          {relativeTime(byJob.get(row.job_id)?.submitted_at ?? new Date())}
        </td>
        <td class="border-b border-edge px-3 py-2">{LABELS[row.state]}</td>
        <td class="tabular border-b border-edge px-3 py-2">{row.days_silent}d</td>
        <td class="tabular border-b border-edge px-3 py-2">
          <!-- You are not the only one being ignored. -->
          {row.squad_size ? `${row.squad_size} stuck here` : '-'}
        </td>
      </tr>
    {:else}
      <tr><td colspan="5" class="px-3 py-4 text-muted">No applications tracked yet.</td></tr>
    {/each}
  </tbody>
</table>
