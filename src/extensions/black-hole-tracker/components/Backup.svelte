<script lang="ts">
  /**
   * Backup and restore of local tracker data.
   *
   * Local mode keeps everything in one browser, so clearing site data destroys
   * a job search history that exists nowhere else. That makes a backup
   * necessary, and makes it dangerous: the file is the private map from
   * pseudonymous refs to the jobs behind them. It is written encrypted, and the
   * passphrase is asked for here rather than assumed, because nothing else in
   * the system can recover it.
   */
  import { exportLocalData, importLocalData } from '$core/ledger';
  import { MIN_PASSPHRASE_LENGTH } from '$lib/backup';
  import { ledgerDate } from '$lib/utils';

  let { onimported }: { onimported?: () => void } = $props();

  let panel = $state<'none' | 'export' | 'import'>('none');
  let passphrase = $state('');
  let repeated = $state('');
  let chosen = $state<File | null>(null);
  let busy = $state(false);
  let error = $state<string | null>(null);
  let notice = $state<string | null>(null);

  function show(which: 'export' | 'import') {
    panel = panel === which ? 'none' : which;
    passphrase = '';
    repeated = '';
    chosen = null;
    error = null;
    notice = null;
  }

  async function save() {
    error = null;
    notice = null;

    if (passphrase !== repeated) {
      error = 'The two passphrases do not match.';
      return;
    }

    busy = true;
    try {
      const encrypted = await exportLocalData(passphrase);
      const url = URL.createObjectURL(new Blob([encrypted], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `pointbreak-backup-${ledgerDate()}.json`;
      link.click();
      URL.revokeObjectURL(url);

      passphrase = '';
      repeated = '';
      notice = 'Saved, encrypted. Keep the passphrase somewhere safe: nobody can recover it for you, and without it the file is unreadable.';
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not write the backup.';
    } finally {
      busy = false;
    }
  }

  async function restore() {
    error = null;
    notice = null;
    if (!chosen) return;

    busy = true;
    try {
      const counts = await importLocalData(await chosen.text(), passphrase);
      passphrase = '';
      chosen = null;
      notice = `Restored ${counts.events} event${counts.events === 1 ? '' : 's'} and ${counts.applications} application${counts.applications === 1 ? '' : 's'}. Anything already here was kept.`;
      onimported?.();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not read that backup.';
    } finally {
      busy = false;
    }
  }

  const field = 'rounded-md border border-edge bg-elevated px-2.5 py-1.5 text-fg';
  const button = 'rounded-md border border-edge px-3 py-1.5 text-sm text-muted hover:text-fg';
</script>

<div class="flex shrink-0 gap-2">
  <button type="button" onclick={() => show('export')} class={button}>Back up</button>
  <button type="button" onclick={() => show('import')} class={button}>Restore</button>
</div>

{#if panel !== 'none'}
  <section class="mt-3 w-full rounded-lg border border-edge p-4">
    {#if panel === 'export'}
      <h2 class="text-sm font-medium">Back up this device</h2>
      <p class="mt-1 max-w-2xl text-sm text-muted">
        The backup holds the link between your applications and you, which the public ledger
        deliberately does not. So it is encrypted with a passphrase before it is written, in this
        browser, and the passphrase is never sent anywhere. There is no reset: lose it and the file
        is unreadable by anyone, including us.
      </p>

      <div class="mt-3 flex flex-wrap items-end gap-3">
        <label class="grid gap-1 text-sm text-muted">
          Passphrase
          <input
            type="password"
            bind:value={passphrase}
            autocomplete="new-password"
            class="{field} w-64"
            placeholder="{MIN_PASSPHRASE_LENGTH} characters or more"
          />
        </label>
        <label class="grid gap-1 text-sm text-muted">
          Again
          <input type="password" bind:value={repeated} autocomplete="new-password" class="{field} w-64" />
        </label>
        <button
          type="button"
          onclick={save}
          disabled={busy || passphrase.length < MIN_PASSPHRASE_LENGTH || !repeated}
          class="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-bg disabled:opacity-40"
        >
          {busy ? 'Encrypting...' : 'Download'}
        </button>
      </div>
    {:else}
      <h2 class="text-sm font-medium">Restore a backup</h2>
      <p class="mt-1 max-w-2xl text-sm text-muted">
        Adds the contents of a backup to this browser. Nothing already here is removed, and
        restoring the same file twice changes nothing.
      </p>

      <div class="mt-3 flex flex-wrap items-end gap-3">
        <label class="grid gap-1 text-sm text-muted">
          Backup file
          <input
            type="file"
            accept=".json,application/json"
            onchange={(e) => (chosen = e.currentTarget.files?.[0] ?? null)}
            class="{field} w-72 text-sm"
          />
        </label>
        <label class="grid gap-1 text-sm text-muted">
          Passphrase
          <input type="password" bind:value={passphrase} autocomplete="off" class="{field} w-64" />
        </label>
        <button
          type="button"
          onclick={restore}
          disabled={busy || !chosen}
          class="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-bg disabled:opacity-40"
        >
          {busy ? 'Opening...' : 'Restore'}
        </button>
      </div>
    {/if}

    {#if error}
      <p class="mt-3 max-w-2xl rounded-md border border-danger p-3 text-sm text-danger">{error}</p>
    {/if}
    {#if notice}
      <p class="mt-3 max-w-2xl rounded-md border border-ok p-3 text-sm text-muted">{notice}</p>
    {/if}
  </section>
{/if}
