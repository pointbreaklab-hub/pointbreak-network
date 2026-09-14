<script lang="ts">
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { session } from '$core/auth/session.svelte';
  import { loadPortfolio } from '$extensions/portfolio/data';
  import type { Portfolio } from '$lib/portfolio';
  import { loadPublishedPortfolio, type PublishedState } from '$lib/published';
  import Plain from '$lib/themes/Plain.svelte';
  import Series from '$lib/themes/Series.svelte';
  import Tinted from '$lib/themes/Tinted.svelte';

  const login = $derived($page.params.login ?? '');

  let published = $state<PublishedState | null>(null);
  /** Shown when you are looking at your own unpublished portfolio. */
  let ownDraft = $state<Portfolio | null>(null);

  const isMe = $derived(
    session.current?.github_login?.toLowerCase() === login.toLowerCase()
  );

  $effect(() => {
    const who = login;
    if (!who) return;

    published = null;
    ownDraft = null;

    loadPublishedPortfolio(who).then(async (result) => {
      published = result;

      // Your own draft is worth showing to you, clearly marked, so the page is
      // useful before you publish and you can see what a visitor would get.
      if (result.status === 'not_published' && isMe) {
        ownDraft = await loadPortfolio(who);
      }
    });
  });

  const portfolio = $derived(
    published?.status === 'published' ? published.portfolio : ownDraft
  );
</script>

<svelte:head>
  <title>{portfolio?.display_name ?? login} · PointBreak</title>
  {#if portfolio?.headline}
    <meta name="description" content={portfolio.headline} />
  {/if}
  <!--
    SSR is off, so this is set after hydration. Crawlers that run JavaScript
    will see it and those that do not will not. Prerendering public portfolios
    would fix it and needs a build per profile, which is PRD 9.4.
  -->
  {#if published?.status === 'not_published'}
    <meta name="robots" content="noindex" />
  {/if}
</svelte:head>

<div class="min-h-screen bg-bg">
  <header class="flex items-center justify-between gap-4 border-b border-edge px-5 py-3">
    <a href="{base}/" class="font-semibold tracking-tight">pointbreak</a>
    <p class="text-xs text-muted">
      {#if published?.status === 'published'}
        A portfolio published by
        <a
          href="https://github.com/{login}"
          target="_blank"
          rel="noreferrer noopener"
          class="text-accent">{login}</a
        >
      {:else}
        Portfolio
      {/if}
    </p>
  </header>

  <main class="mx-auto w-full max-w-5xl px-5 py-8">
    {#if published === null}
      <p class="text-muted">Loading...</p>
    {:else if published.status === 'error'}
      <p class="rounded-md border border-danger p-3 text-sm text-danger">{published.message}</p>
    {:else if portfolio}
      {#if ownDraft}
        <p class="mb-5 rounded-md border border-warn p-3 text-sm">
          <strong class="text-warn">Only you can see this.</strong>
          <span class="text-muted">
            This is your draft, read from this browser. Nobody visiting this link sees anything
            until you publish it from
            <a href="{base}/app/portfolio" class="text-accent">your portfolio page</a>.
          </span>
        </p>
      {/if}

      <div class="overflow-hidden rounded-lg border border-edge">
        {#if portfolio.theme.id === 'series'}
          <Series {portfolio} />
        {:else if portfolio.theme.id === 'tinted'}
          <Tinted {portfolio} />
        {:else}
          <Plain {portfolio} />
        {/if}
      </div>

      {#if published.status === 'published' && published.published_at}
        <p class="tabular mt-4 text-center text-xs text-muted">
          Published {new Date(published.published_at).toLocaleDateString()} ·
          <a
            href="https://github.com/{import.meta.env.PUBLIC_DATA_REPO ??
              'pointbreaklab-hub/pointbreak-data'}/blob/main/users/{login.toLowerCase()}/portfolio.json"
            target="_blank"
            rel="noreferrer noopener"
            class="underline">read the source record</a
          >
        </p>
      {/if}
    {:else}
      <div class="mx-auto max-w-lg py-16 text-center">
        <h1 class="text-lg font-medium">Nothing published here</h1>
        <p class="mt-2 text-sm text-muted">
          <span class="font-mono">{login}</span> has not published a portfolio, or has set it to
          private.
        </p>
        {#if isMe}
          <a
            href="{base}/app/portfolio"
            class="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg"
          >
            Build yours
          </a>
        {/if}
      </div>
    {/if}
  </main>
</div>
