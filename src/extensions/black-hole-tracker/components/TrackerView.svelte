<script lang="ts">
  import { session } from '$core/auth/session.svelte';
  import { db } from '$core/db';
  import { BLACK_HOLE_AFTER_DAYS, detectAll, projectAll } from '$core/math-engine';
  import {
    appendEvent,
    exportLocalData,
    PUBLISHING_ENABLED,
    type AppendInput
  } from '$core/ledger';
  import { companyIdFromUrl, mintApplicationRef, normalizeJobUrl } from '$lib/identity';
  import type { LedgerEvent } from '$lib/types';
  import DemoNotice from '$core/layout/DemoNotice.svelte';
  import type { NetworkSource } from '$core/network';
  import { loadTracker } from '../data';
  import ApplicationStatus from './ApplicationStatus.svelte';

  let events = $state<LedgerEvent[]>([]);
  let myRefs = $state<string[]>([]);
  let titles = $state<Record<string, string>>({});
  let source = $state<NetworkSource>('index');
  let demo = $state(false);
  let error = $state<string | null>(null);
  let loading = $state(true);

  let url = $state('');
  let title = $state('');
  let formError = $state<string | null>(null);
  let writeError = $state<string | null>(null);

  $effect(() => {
    const login = session.current?.github_login;
    if (!login) return;

    loadTracker(login)
      .then((data) => {
        events = data.events;
        myRefs = data.myRefs;
        titles = data.titles;
        source = data.source;
        demo = data.demo;
      })
      .catch((e: unknown) => (error = e instanceof Error ? e.message : 'Could not read the ledger.'))
      .finally(() => (loading = false));
  });

  const all = $derived(projectAll(events));
  const mine = $derived(all.filter((a) => myRefs.includes(a.application_ref)));
  const dark = $derived(detectAll(mine, all).filter((r) => r.is_black_hole).length);

  /**
   * The local write is the commit, so nothing is rolled back. A failed publish
   * downgrades to a warning rather than discarding what you recorded.
   */
  async function append(input: AppendInput) {
    writeError = null;
    try {
      const result = await appendEvent(input);
      events = [...events, result.event];
      if (result.warning) writeError = result.warning;
    } catch (e) {
      writeError = e instanceof Error ? e.message : 'Could not record that.';
    }
  }

  function download() {
    void exportLocalData().then((json) => {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `pointbreak-tracker-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  function attest(claim: LedgerEvent, verdict: 'confirmed' | 'disputed') {
    void append({
      job_id: claim.job_id,
      application_ref: claim.application_ref,
      action: verdict === 'confirmed' ? 'claim_confirmed' : 'claim_disputed',
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

    // Kept locally so the ref survives a reload. The public ledger never
    // carries the link between this ref and the signed-in account.
    void db.myApplications.put({
      application_ref: ref,
      job_id: jobId,
      job_title: title.trim() || `${company} posting`,
      company_id: company,
      source_url: normalized,
      created_at: new Date().toISOString()
    });

    void append({ job_id: jobId, application_ref: ref, action: 'application_submitted' });

    url = '';
    title = '';
  }

  const field = 'rounded-md border border-edge bg-elevated px-2.5 py-1.5 text-fg';
</script>

<div class="mb-5 flex items-start justify-between gap-4">
  <div class="max-w-3xl">
    <h1 class="text-lg font-medium">Black Hole Tracker</h1>
    <p class="mt-1 text-sm text-muted">
      Log anything you applied to, wherever you found it. Rows are projected from an append-only
      ledger, and a company action only counts once you confirm it happened, so silence cannot be
      papered over by a recruiter marking work as done.
    </p>
  </div>
  <button
    type="button"
    onclick={download}
    class="shrink-0 rounded-md border border-edge px-3 py-1.5 text-sm text-muted hover:text-fg"
  >
    Export
  </button>
</div>

<DemoNotice {source} {demo} />

{#if !PUBLISHING_ENABLED}
  <p class="mb-5 rounded-md border border-edge p-3 text-sm text-muted">
    <strong class="text-fg">Stored on this device only.</strong>
    Nothing you log here is published, so squad counts and company scores come from the
    demonstration data below rather than from other real people. Export keeps a copy, because
    clearing site data would otherwise lose it.
  </p>
{/if}

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

{#if writeError}
  <p class="mb-4 rounded-md border border-danger p-3 text-sm text-danger">{writeError}</p>
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
