<script lang="ts">
  import { session } from '$core/auth/session.svelte';
  import { BLACK_HOLE_AFTER_DAYS, detectAll, projectAll } from '$core/math-engine';
  import { companyIdFromUrl, mintApplicationRef, normalizeJobUrl } from '$lib/identity';
  import type { LedgerEvent } from '$lib/types';
  import { loadTracker } from '../data';
  import ApplicationStatus from './ApplicationStatus.svelte';

  let events = $state<LedgerEvent[]>([]);
  let myRefs = $state<string[]>([]);
  let titles = $state<Record<string, string>>({});
  let error = $state<string | null>(null);
  let loading = $state(true);

  let url = $state('');
  let title = $state('');
  let formError = $state<string | null>(null);

  $effect(() => {
    const login = session.current?.github_login;
    if (!login) return;

    loadTracker(login)
      .then((data) => {
        events = data.events;
        myRefs = data.myRefs;
        titles = data.titles;
      })
      .catch((e: unknown) => (error = e instanceof Error ? e.message : 'Could not read the ledger.'))
      .finally(() => (loading = false));
  });

  const all = $derived(projectAll(events));
  const mine = $derived(all.filter((a) => myRefs.includes(a.application_ref)));
  const dark = $derived(detectAll(mine, all).filter((r) => r.is_black_hole).length);

  function append(event: Omit<LedgerEvent, 'id'>) {
    // TODO: commit to events/<job_id>.jsonl. Appending locally first keeps the
    // UI responsive and matches how the committed write will behave.
    events = [...events, { ...event, id: `ev_local_${crypto.randomUUID().slice(0, 8)}` }];
  }

  function attest(claim: LedgerEvent, verdict: 'confirmed' | 'disputed') {
    append({
      job_id: claim.job_id,
      application_ref: claim.application_ref,
      action: verdict === 'confirmed' ? 'claim_confirmed' : 'claim_disputed',
      at: new Date().toISOString(),
      actor: 'candidate',
      ref_event: claim.id
    });
  }

  /**
   * Log a job posted anywhere. This is what makes the network work without the
   * company participating: a posting on LinkedIn or a careers page becomes
   * measurable the moment one candidate records applying to it.
   */
  function logApplication(submit: SubmitEvent) {
    submit.preventDefault();
    formError = null;

    let normalized: string;
    let company: string;
    try {
      normalized = normalizeJobUrl(url);
      company = companyIdFromUrl(normalized);
    } catch {
      formError = 'That does not look like a URL. Paste the link to the posting.';
      return;
    }

    // Same posting logged by several people collapses onto one id, which is
    // what lets silence aggregate across candidates.
    const jobId = `ext_${company}_${normalized.split('/').pop() ?? 'job'}`;
    const ref = mintApplicationRef();

    titles = { ...titles, [jobId]: title.trim() || `${company} posting` };
    myRefs = [...myRefs, ref];
    append({
      job_id: jobId,
      application_ref: ref,
      action: 'application_submitted',
      at: new Date().toISOString(),
      actor: 'candidate'
    });

    url = '';
    title = '';
  }

  const field = 'rounded-md border border-edge bg-elevated px-2.5 py-1.5 text-fg';
</script>

<h1 class="text-lg font-medium">Black Hole Tracker</h1>
<p class="mt-1 mb-5 max-w-3xl text-sm text-muted">
  Log anything you applied to, wherever you found it. Rows are projected from an append-only
  ledger, and a company action only counts once you confirm it happened, so silence cannot be
  papered over by a recruiter marking work as done.
</p>

<form onsubmit={logApplication} class="mb-6 flex flex-wrap items-end gap-3">
  <label class="grid gap-1 text-sm text-muted">
    Job URL
    <input class="{field} w-96" bind:value={url} placeholder="https://linkedin.com/jobs/view/..." required />
  </label>
  <label class="grid gap-1 text-sm text-muted">
    Title <span class="text-xs">optional</span>
    <input class={field} bind:value={title} placeholder="Senior Backend Engineer" />
  </label>
  <button type="submit" class="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-bg">
    Log application
  </button>
</form>

{#if formError}
  <p class="mb-4 text-sm text-danger">{formError}</p>
{/if}

{#if loading}
  <p class="text-muted">Reading the ledger...</p>
{:else if error}
  <p class="rounded-md border border-danger p-3 text-sm text-danger">{error}</p>
{:else}
  {#if dark > 0}
    <p class="mb-4 rounded-md border border-danger p-3 text-sm">
      <span class="tabular text-danger">{dark}</span>
      of your
      <span class="tabular">{mine.length}</span>
      applications have had no confirmed company action for over {BLACK_HOLE_AFTER_DAYS} days.
    </p>
  {/if}

  <ApplicationStatus applications={mine} allApplications={all} {titles} onattest={attest} />
{/if}
