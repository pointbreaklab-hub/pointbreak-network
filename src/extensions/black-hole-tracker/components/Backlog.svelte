<script lang="ts">
  /**
   * The bridge between tracking privately and contributing to the network.
   *
   * Everything here works with no account, which means the ordinary state is a
   * pile of real reports on one device that the network cannot see. This panel
   * is the only thing that converts them, so it has to be honest about what is
   * held, plain about what signing in buys, and never scolding about not having
   * done it. The reports are useful to their owner either way.
   */
  import { base } from '$app/paths';
  import { session } from '$core/auth/session.svelte';
  import { backlogSize, publishBacklog, PUBLISHING_ENABLED } from '$core/ledger';

  let { changed = 0, onpublished }: { changed?: number; onpublished?: () => void } = $props();

  let queued = $state(0);
  let busy = $state(false);
  let error = $state<string | null>(null);
  let notice = $state<string | null>(null);

  $effect(() => {
    changed;
    void backlogSize().then((n) => (queued = n));
  });

  async function publish() {
    error = null;
    notice = null;
    busy = true;

    try {
      const result = await publishBacklog();
      queued = result.remaining;

      if (result.published > 0) {
        notice = `Published ${result.published} report${result.published === 1 ? '' : 's'}.`;
      }
      if (result.remaining > 0) {
        error = `${result.remaining} could not be published and are still here. ${result.error ?? ''}`.trim();
      }
      if (result.published === 0 && result.remaining === 0) {
        notice = 'Nothing waiting.';
      }

      onpublished?.();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not publish.';
    } finally {
      busy = false;
    }
  }

  const reports = $derived(`${queued} report${queued === 1 ? '' : 's'}`);
</script>

{#if !PUBLISHING_ENABLED}
  <p class="mb-5 rounded-md border border-edge p-3 text-sm text-muted">
    <strong class="text-fg">Stored on this device only.</strong>
    This build does not publish, so squad counts and company scores come from the demonstration data
    below rather than from other real people. Everything you log is kept and queued. Back it up:
    clearing site data would otherwise lose it, and the backup is encrypted because that copy is the
    one thing linking these applications back to you.
  </p>
{:else if !session.current}
  <p class="mb-5 rounded-md border border-edge p-3 text-sm text-muted">
    <strong class="text-fg">Tracking privately.</strong>
    No account needed, and nothing here has left this device.
    {#if queued > 0}
      {reports} are waiting. Signing in publishes them under a random reference, so they start
      counting towards the company's score without carrying your name.
      <a href="{base}/app/login" class="text-accent underline">Sign in</a>
      when you want that. Your reports are yours either way.
    {:else}
      Sign in later if you want your reports to count towards a company's public score.
    {/if}
  </p>
{:else if queued > 0}
  <div class="mb-5 flex flex-wrap items-center gap-3 rounded-md border border-edge p-3 text-sm">
    <span class="text-muted">
      <strong class="text-fg">{reports} not published.</strong>
      Recorded before you signed in, or while the service was unreachable.
    </span>
    <button
      type="button"
      onclick={publish}
      disabled={busy}
      class="ml-auto rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-bg disabled:opacity-40"
    >
      {busy ? 'Publishing...' : `Publish ${reports}`}
    </button>
  </div>
{/if}

{#if notice}
  <p class="mb-5 rounded-md border border-ok p-3 text-sm text-muted">{notice}</p>
{/if}
{#if error}
  <p class="mb-5 rounded-md border border-danger p-3 text-sm text-danger">{error}</p>
{/if}
