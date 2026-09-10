<script lang="ts">
  import type { Application } from '$lib/types';
  import { daysBetween, relativeTime } from '$lib/utils';

  let { applications = [] }: { applications: Application[] } = $props();

  const GHOST_AFTER_DAYS = 21;

  function silentDays(app: Application): number {
    const last = app.lastCompanyContactAt ?? app.submittedAt;
    return Math.round(daysBetween(last));
  }

  const rows = $derived(
    applications
      .map((app) => ({ app, silent: silentDays(app), ghosted: silentDays(app) > GHOST_AFTER_DAYS }))
      .sort((a, b) => b.silent - a.silent)
  );
</script>

<table>
  <thead>
    <tr><th>Job</th><th>Applied</th><th>Stage</th><th>Silence</th></tr>
  </thead>
  <tbody>
    {#each rows as { app, silent, ghosted } (app.jobId + app.login)}
      <tr class:ghosted>
        <td>{app.jobId}</td>
        <td>{relativeTime(app.submittedAt)}</td>
        <td>{app.history.at(-1)?.stage ?? 'submitted'}</td>
        <td class="tabular">{silent}d{ghosted ? ' — ghosted' : ''}</td>
      </tr>
    {/each}
  </tbody>
</table>

<style>
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border); }
  th { color: var(--fg-muted); font-weight: 500; }
  .ghosted td:last-child { color: var(--danger); }
</style>
