<script lang="ts">
  import { MIN_CREDIBLE_WEIGHT } from '$core/math-engine';
  import { vouch } from '$core/ledger';
  import type { WeightedAttestation } from '$lib/types';
  import { relativeTime } from '$lib/utils';

  let {
    vouches = [],
    subject
  }: { vouches: WeightedAttestation[]; subject?: string } = $props();

  let target = $state('');
  let skill = $state('');
  let note = $state('');
  let busy = $state(false);
  let result = $state<{ ok: boolean; message: string } | null>(null);

  const counted = $derived(vouches.filter((v) => v.credibility.weight >= MIN_CREDIBLE_WEIGHT));
  const ignored = $derived(vouches.filter((v) => v.credibility.weight < MIN_CREDIBLE_WEIGHT));

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    result = null;
    try {
      await vouch(target.trim(), skill.trim(), note.trim() || undefined);
      result = { ok: true, message: `Vouched for ${target.trim()} on ${skill.trim()}.` };
      target = '';
      skill = '';
      note = '';
    } catch (e) {
      result = { ok: false, message: e instanceof Error ? e.message : 'Could not record that.' };
    } finally {
      busy = false;
    }
  }

  const field = 'rounded-md border border-edge bg-elevated px-2.5 py-1.5 text-fg';
</script>

<section class="mb-8">
  <h2 class="mb-1 text-base font-medium">Peer attestations</h2>
  <p class="mb-3 max-w-2xl text-sm text-muted">
    A vouch carries no weight of its own. It inherits the voucher's, computed only from what GitHub
    attests about them, so a ring of new accounts vouching for each other multiplies zero.
  </p>

  {#if counted.length === 0 && ignored.length === 0}
    <p class="mb-4 rounded-md border border-edge p-3 text-sm text-muted">
      Nobody has vouched for {subject ?? 'you'} yet. This is the path that works when your work is
      not public: a colleague who reviewed it says so under their own name.
    </p>
  {:else}
    <ul class="mb-4 grid gap-2">
      {#each counted as { attestation, credibility } (attestation.id)}
        <li class="rounded-lg border border-edge p-3">
          <div class="flex items-baseline justify-between gap-3">
            <p class="text-sm">
              <strong>{attestation.skill}</strong>
              <span class="text-muted">vouched by</span>
              <a
                href="https://github.com/{attestation.attested_by}"
                target="_blank"
                rel="noreferrer noopener"
                class="text-accent">{attestation.attested_by}</a
              >
            </p>
            <span
              class="tabular shrink-0 text-xs text-muted"
              title="public commits {credibility.basis.public_commits}, merged PRs {credibility.basis.merged_prs}, private contributions {credibility.basis.private_contributions}"
            >
              weight {credibility.weight.toFixed(2)}
            </span>
          </div>
          {#if attestation.note}
            <p class="mt-1 text-sm text-muted">{attestation.note}</p>
          {/if}
          <p class="mt-1 text-xs text-muted">{relativeTime(attestation.at)}</p>
        </li>
      {/each}
    </ul>

    {#if ignored.length}
      <p class="mb-4 text-xs text-muted">
        <span class="tabular">{ignored.length}</span>
        vouch{ignored.length === 1 ? '' : 'es'} ignored: the accounts behind them have no record to
        lend. They are kept in the ledger and shown as zero rather than deleted.
      </p>
    {/if}
  {/if}

  <form onsubmit={submit} class="flex flex-wrap items-end gap-3 border-t border-edge pt-4">
    <label class="grid gap-1 text-sm text-muted">
      Vouch for
      <input class={field} bind:value={target} placeholder="github-login" required />
    </label>
    <label class="grid gap-1 text-sm text-muted">
      Skill
      <input class={field} bind:value={skill} placeholder="Kotlin" required />
    </label>
    <label class="grid grow gap-1 text-sm text-muted">
      What you saw
      <input class={field} bind:value={note} placeholder="Reviewed most of their settlement engine rewrite" />
    </label>
    <button
      type="submit"
      disabled={busy}
      class="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-bg disabled:opacity-40"
    >
      {busy ? 'Recording...' : 'Vouch'}
    </button>
  </form>

  {#if result}
    <p class="mt-2 text-sm" class:text-ok={result.ok} class:text-danger={!result.ok}>
      {result.message}
    </p>
  {/if}

  <p class="mt-2 text-xs text-muted">
    Vouches are public and signed with your GitHub identity. You cannot vouch for yourself, and one
    vouch per person per skill.
  </p>
</section>
