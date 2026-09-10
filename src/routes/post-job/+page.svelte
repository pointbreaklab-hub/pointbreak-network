<script lang="ts">
  import type { Compensation } from '$lib/types';

  let title = $state('');
  let comp = $state<Compensation>({ min: 0, max: 0, currency: 'EUR', period: 'year' });

  // Posting is paid, and the payment buys the obligation to publish funnel
  // numbers. The Worker signs a receipt and commits it to the data repo.
  // TODO: create the Stripe Checkout session, then redirect.
  function submit(event: SubmitEvent) {
    event.preventDefault();
  }
</script>

<svelte:head><title>Post a job · PointBreak</title></svelte:head>

<h1>Post a job</h1>
<p class="lede">
  A compensation range is required, and you agree to publish your funnel numbers. That disclosure is
  what the fee buys — it is what makes your posting rank.
</p>

<form onsubmit={submit}>
  <label>Title <input bind:value={title} required /></label>
  <div class="range">
    <label>Min <input type="number" bind:value={comp.min} required /></label>
    <label>Max <input type="number" bind:value={comp.max} required /></label>
    <label>
      Currency
      <select bind:value={comp.currency}>
        <option>EUR</option><option>USD</option><option>GBP</option><option>INR</option>
      </select>
    </label>
  </div>
  <button type="submit">Continue to payment</button>
</form>

<style>
  h1 { font-size: 1.4rem; }
  .lede { color: var(--fg-muted); max-width: 36rem; }
  form { display: grid; gap: 1rem; max-width: 34rem; margin-top: 1.5rem; }
  label { display: grid; gap: 0.25rem; font-size: 0.875rem; color: var(--fg-muted); }
  .range { display: grid; grid-template-columns: 1fr 1fr 8rem; gap: 0.75rem; }
  input, select {
    background: var(--bg-elevated); color: var(--fg);
    border: 1px solid var(--border); border-radius: 6px; padding: 0.4rem 0.55rem; font: inherit;
  }
  button {
    background: var(--accent); color: var(--bg); border: none; border-radius: 8px;
    padding: 0.6rem 1.1rem; font: inherit; font-weight: 500; cursor: pointer; justify-self: start;
  }
</style>
