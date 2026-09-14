<script lang="ts">
  import { session } from '$core/auth/session.svelte';
  import {
    ENFORCEABLE_VISIBILITY,
    type Portfolio,
    type ThemeId,
    type Visibility
  } from '$lib/portfolio';
  import { accentPalette, MIN_TEXT_CONTRAST } from '../contrast';
  import {
    createPortfolio,
    deletePortfolio,
    loadPortfolio,
    publishPortfolio,
    savePortfolio,
    visibilityHelp
  } from '../data';
  import { extractText, parseCv } from '../parse';
  import Editor from './Editor.svelte';
  import Plain from './themes/Plain.svelte';
  import Series from './themes/Series.svelte';
  import Tinted from './themes/Tinted.svelte';

  let portfolio = $state<Portfolio | null>(null);
  let loading = $state(true);
  let importing = $state(false);
  let notice = $state<string | null>(null);
  let error = $state<string | null>(null);
  let pasted = $state('');
  let editing = $state(false);
  let redacted = $state<{ emails: number; phones: number } | null>(null);

  const THEMES: Array<{ id: ThemeId; label: string; note: string }> = [
    { id: 'series', label: 'Series', note: 'Companies as series, roles as seasons' },
    { id: 'plain', label: 'Plain', note: 'White, typographic, prints well' },
    { id: 'tinted', label: 'Tinted', note: 'Plain with a colour you choose' }
  ];

  const VISIBILITIES: Array<{ id: Visibility; label: string }> = [
    { id: 'public', label: 'Anyone' },
    { id: 'specific_people', label: 'Specific people' },
    { id: 'hiring_managers', label: 'Hiring managers' },
    { id: 'hidden', label: 'Nobody' }
  ];

  $effect(() => {
    const login = session.current?.github_login;
    if (!login) return;

    loadPortfolio(login)
      .then((found) => (portfolio = found))
      .finally(() => (loading = false));
  });

  const palette = $derived(
    portfolio?.theme.id === 'tinted' ? accentPalette(portfolio.theme.accent ?? '#0d7fbc') : null
  );

  async function persist() {
    if (portfolio) await savePortfolio(portfolio);
  }

  async function importText(text: string) {
    const login = session.current?.github_login;
    if (!login || !text.trim()) return;

    error = null;
    importing = true;

    try {
      const result = parseCv(text, login);
      portfolio = result.portfolio;
      redacted = result.redacted;
      await persist();
      editing = true;
      notice =
        'Parsed. Check every line before publishing: CV layouts vary, so this gets things wrong.';
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not read that.';
    } finally {
      importing = false;
    }
  }

  async function onFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    error = null;
    importing = true;
    try {
      await importText(await extractText(file));
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not read that file.';
      importing = false;
    }
  }

  async function startBlank() {
    const login = session.current?.github_login;
    if (!login) return;
    portfolio = await createPortfolio(login);
    editing = true;
  }

  async function discard() {
    const login = session.current?.github_login;
    if (!login) return;
    await deletePortfolio(login);
    portfolio = null;
    redacted = null;
    notice = null;
    editing = false;
  }

  async function publish() {
    if (!portfolio) return;
    const result = await publishPortfolio(portfolio);
    notice = result.message;
  }

  const field = 'rounded-md border border-edge bg-elevated px-2.5 py-1.5 text-fg';
</script>

<h1 class="text-lg font-medium">Portfolio</h1>
<p class="mt-1 mb-5 max-w-3xl text-sm text-muted">
  Your CV as a web page. It is parsed in this browser and the file is never uploaded anywhere.
  Contact details are stripped before anything is stored, and nothing is shared until you publish.
</p>

{#if loading}
  <p class="text-muted">Loading...</p>
{:else if !portfolio}
  <section class="max-w-2xl">
    <div class="rounded-lg border border-edge p-5">
      <h2 class="text-base font-medium">Import a CV</h2>
      <p class="mt-1 text-sm text-muted">
        PDF, plain text or markdown. Parsing a CV is unreliable because layouts vary, so whatever
        comes out goes straight into an editor for you to correct.
      </p>

      <label class="mt-4 inline-block">
        <span
          class="cursor-pointer rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg hover:opacity-90"
        >
          Choose a file
        </span>
        <input type="file" accept=".pdf,.txt,.md,text/plain" class="hidden" onchange={onFile} />
      </label>

      <p class="mt-5 text-sm text-muted">Or paste the text:</p>
      <textarea
        bind:value={pasted}
        class="{field} mt-1 min-h-40 w-full font-mono text-xs"
        placeholder="Paste your CV here. Plain text works best."
      ></textarea>
      <button
        type="button"
        onclick={() => importText(pasted)}
        disabled={importing || !pasted.trim()}
        class="mt-2 rounded-md border border-edge px-3 py-1.5 text-sm disabled:opacity-40"
      >
        {importing ? 'Parsing...' : 'Parse pasted text'}
      </button>

      <p class="mt-5 border-t border-edge pt-4 text-sm text-muted">
        Rather start from nothing?
        <button type="button" onclick={startBlank} class="text-accent underline">
          Build it by hand
        </button>
      </p>
    </div>
  </section>

  {#if error}
    <p class="mt-4 max-w-2xl rounded-md border border-danger p-3 text-sm text-danger">{error}</p>
  {/if}
{:else}
  {#if error}
    <p class="mb-4 max-w-3xl rounded-md border border-danger p-3 text-sm text-danger">{error}</p>
  {/if}

  {#if notice}
    <p class="mb-4 max-w-3xl rounded-md border border-edge p-3 text-sm text-muted">{notice}</p>
  {/if}

  {#if redacted && (redacted.emails > 0 || redacted.phones > 0)}
    <p class="mb-4 max-w-3xl rounded-md border border-ok p-3 text-sm">
      <strong class="text-ok">Contact details removed.</strong>
      <span class="text-muted">
        {redacted.emails} email{redacted.emails === 1 ? '' : 's'} and {redacted.phones} phone
        number{redacted.phones === 1 ? '' : 's'} were found in the file and were not stored. A public
        repository is the last place they belong.
      </span>
    </p>
  {/if}

  <div class="mb-5 flex flex-wrap items-end gap-4">
    <div>
      <p class="mb-1 text-sm text-muted">Theme</p>
      <div class="flex gap-2">
        {#each THEMES as theme (theme.id)}
          <button
            type="button"
            title={theme.note}
            onclick={async () => {
              portfolio!.theme = { ...portfolio!.theme, id: theme.id };
              await persist();
            }}
            class="rounded-md border px-3 py-1.5 text-sm"
            class:border-accent={portfolio.theme.id === theme.id}
            class:text-accent={portfolio.theme.id === theme.id}
            class:border-edge={portfolio.theme.id !== theme.id}
            class:text-muted={portfolio.theme.id !== theme.id}
          >
            {theme.label}
          </button>
        {/each}
      </div>
    </div>

    {#if portfolio.theme.id === 'tinted'}
      <div>
        <p class="mb-1 text-sm text-muted">Colour</p>
        <input
          type="color"
          value={portfolio.theme.accent ?? '#0d7fbc'}
          oninput={async (e) => {
            portfolio!.theme = { ...portfolio!.theme, accent: e.currentTarget.value };
            await persist();
          }}
          class="h-9 w-16 cursor-pointer rounded-md border border-edge bg-elevated"
        />
      </div>
    {/if}

    <div class="ml-auto flex gap-2">
      <button
        type="button"
        onclick={() => (editing = !editing)}
        class="rounded-md border border-edge px-3 py-1.5 text-sm text-muted hover:text-fg"
      >
        {editing ? 'Preview' : 'Edit'}
      </button>
      <button
        type="button"
        onclick={discard}
        class="rounded-md border border-edge px-3 py-1.5 text-sm text-muted hover:text-danger"
      >
        Discard
      </button>
    </div>
  </div>

  {#if palette?.adjusted}
    <p class="mb-4 max-w-3xl rounded-md border border-warn p-3 text-sm text-muted">
      <strong class="text-warn">Colour darkened for text.</strong>
      Your colour is kept for rules and blocks. Against white it reaches only
      {palette.originalRatio}:1, below the {MIN_TEXT_CONTRAST}:1 needed for body text, so a darker
      variant at {palette.ratio}:1 is used for words.
    </p>
  {/if}

  {#if editing}
    <Editor bind:portfolio onchange={persist} />
  {:else}
    <div class="overflow-hidden rounded-lg border border-edge">
      {#if portfolio.theme.id === 'series'}
        <Series {portfolio} />
      {:else if portfolio.theme.id === 'tinted'}
        <Tinted {portfolio} />
      {:else}
        <Plain {portfolio} />
      {/if}
    </div>
  {/if}

  <section class="mt-6 max-w-3xl border-t border-edge pt-5">
    <h2 class="text-base font-medium">Who can see this</h2>

    <div class="mt-3 flex flex-wrap gap-2">
      {#each VISIBILITIES as option (option.id)}
        {@const enforceable = ENFORCEABLE_VISIBILITY.includes(option.id)}
        <button
          type="button"
          disabled={!enforceable}
          title={enforceable ? visibilityHelp(option.id) : 'Not available yet'}
          onclick={async () => {
            portfolio!.visibility = option.id;
            await persist();
          }}
          class="rounded-md border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
          class:border-accent={portfolio.visibility === option.id}
          class:text-accent={portfolio.visibility === option.id}
          class:border-edge={portfolio.visibility !== option.id}
          class:text-muted={portfolio.visibility !== option.id}
        >
          {option.label}
        </button>
      {/each}
    </div>

    <p class="mt-2 text-sm text-muted">{visibilityHelp(portfolio.visibility)}</p>

    <!--
      Two of the four states cannot be enforced by a static page reading a
      public repository. Offering them anyway would be the worst possible
      outcome, because people would put real information behind a control that
      restricts nothing.
    -->
    <p class="mt-4 rounded-md border border-edge p-3 text-sm text-muted">
      <strong class="text-fg">Why two options are greyed out.</strong>
      Specific people and hiring managers are access control, and this is a static page reading a public
      repository, so it has none to enforce them with. Shipping switches that imply restriction without
      restricting anything would be worse than leaving them off, because you would trust them. They need
      either per-recipient encryption or a server that gates reads, and that decision is still open.
    </p>

    <button
      type="button"
      onclick={publish}
      disabled={portfolio.visibility !== 'public'}
      class="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg disabled:opacity-40"
    >
      Publish
    </button>
  </section>
{/if}
