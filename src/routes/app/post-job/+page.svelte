<script lang="ts">
  import { findReposts } from '$core/math-engine';
  import type { Job, RepostMatch, Salary } from '$lib/types';
  import { formatSalary, isExactSalary, MAX_SALARY_SPREAD } from '$lib/utils';

  // TODO: load this company's past postings from the data repo.
  let pastJobs = $state<Job[]>([]);

  let title = $state('');
  let stack = $state('');
  let description = $state('');
  let salary = $state<Salary>({ min: 0, max: 0, currency: 'EUR', period: 'year' });

  const salaryOk = $derived(isExactSalary(salary));

  // Runs on every keystroke, client-side. A company sees the repost warning
  // before it pays, not after the charge has gone through.
  const reposts = $derived<RepostMatch[]>(
    description.length > 200 ? findReposts(description, pastJobs) : []
  );

  const canSubmit = $derived(title.trim() !== '' && salaryOk && description.length > 200);

  const field = 'rounded-md border border-edge bg-elevated px-2.5 py-1.5 text-fg';

  // TODO: create the Stripe Checkout session via the Worker, then on the signed
  // receipt commit job.json + receipt.json to the data repo.
  function submit(event: SubmitEvent) {
    event.preventDefault();
  }
</script>

<svelte:head><title>Post a job · PointBreak</title></svelte:head>

<h1 class="text-xl font-medium">Post a job</h1>
<p class="mt-2 max-w-2xl text-muted">
  One flat fee, the same for everyone. An exact salary is required, and your action metrics —
  applications, interviews, rejections — are published with the posting. Those numbers are what your
  Ghost Score is computed from.
</p>

<form onsubmit={submit} class="mt-6 grid max-w-2xl gap-4">
  <label class="grid gap-1 text-sm text-muted">
    Title
    <input class={field} bind:value={title} required />
  </label>

  <label class="grid gap-1 text-sm text-muted">
    Tech stack <span class="text-xs">comma separated</span>
    <input class={field} bind:value={stack} placeholder="go, postgres, kubernetes" />
  </label>

  <fieldset class="grid gap-1">
    <legend class="text-sm text-muted">Salary — exact, not a range you'd negotiate down from</legend>
    <div class="grid grid-cols-[1fr_1fr_7rem_7rem] gap-2">
      <input class={field} type="number" bind:value={salary.min} placeholder="min" required />
      <input class={field} type="number" bind:value={salary.max} placeholder="max" required />
      <select class={field} bind:value={salary.currency}>
        <option>EUR</option><option>USD</option><option>GBP</option><option>INR</option>
      </select>
      <select class={field} bind:value={salary.period}>
        <option value="year">/year</option>
        <option value="month">/month</option>
        <option value="day">/day</option>
        <option value="hour">/hour</option>
      </select>
    </div>

    {#if salary.min > 0 && !salaryOk}
      <p class="text-sm text-danger">
        That band is wider than {MAX_SALARY_SPREAD * 100}% of its midpoint. Bands this wide are a
        negotiating position, not information — narrow it or post the exact figure.
      </p>
    {:else if salaryOk}
      <p class="tabular text-sm text-ok">{formatSalary(salary)}</p>
    {/if}
  </fieldset>

  <label class="grid gap-1 text-sm text-muted">
    Description
    <textarea class="{field} min-h-48" bind:value={description} required></textarea>
  </label>

  {#if reposts.length}
    <div class="rounded-md border border-warn p-3">
      <h2 class="text-sm font-medium text-warn">This looks like a repost</h2>
      <p class="mt-1 text-sm">
        Reposting the same description more than twice adds 30 points to your Ghost Score.
      </p>
      <ul class="mt-2 grid gap-1 text-sm">
        {#each reposts as match (match.job_id)}
          <li class="flex justify-between gap-4">
            <span class="text-muted">{match.title}</span>
            <span class="tabular">{(match.similarity * 100).toFixed(0)}% match</span>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  <button
    type="submit"
    disabled={!canSubmit}
    class="justify-self-start rounded-lg bg-accent px-5 py-2.5 font-medium text-bg disabled:opacity-40"
  >
    Continue to payment
  </button>
</form>
