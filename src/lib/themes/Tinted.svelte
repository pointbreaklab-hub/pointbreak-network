<script lang="ts">
  import { formatSpan, type Portfolio } from '$lib/portfolio';
  import { accentPalette } from '$lib/contrast';
  import EvidenceTag from './EvidenceTag.svelte';

  let { portfolio }: { portfolio: Portfolio } = $props();

  const palette = $derived(accentPalette(portfolio.theme.accent ?? '#0d7fbc'));
  const accent = $derived(palette?.accent ?? '#0d7fbc');
  const readable = $derived(palette?.readable ?? '#0d7fbc');
</script>

<article
  class="mx-auto max-w-3xl bg-white px-8 py-10 text-[#111]"
  style:--accent={accent}
  style:--readable={readable}
>
  <header class="border-b-4 pb-5" style:border-color="var(--accent)">
    <h1 class="text-3xl font-semibold tracking-tight" style:color="var(--readable)">
      {portfolio.display_name ?? portfolio.github_login}
    </h1>
    {#if portfolio.headline}
      <p class="mt-1 text-lg text-neutral-600">{portfolio.headline}</p>
    {/if}
    {#if portfolio.summary}
      <p class="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-700">{portfolio.summary}</p>
    {/if}
  </header>

  {#each portfolio.companies as company (company.id)}
    <section class="mt-6">
      <div class="flex items-baseline justify-between gap-3">
        <h2 class="text-base font-semibold" style:color="var(--readable)">{company.name}</h2>
        <EvidenceTag evidence={company.evidence} />
      </div>

      {#each company.roles as role (role.id)}
        <div class="mt-3 border-l-4 pl-4" style:border-color="var(--accent)">
          <div class="flex items-baseline justify-between gap-3">
            <p class="font-medium">{role.title}</p>
            <p class="tabular shrink-0 text-xs text-neutral-500">
              {formatSpan(role.started, role.ended)}
            </p>
          </div>
          {#if role.highlights.length}
            <ul class="mt-1 list-disc pl-4 text-sm text-neutral-700">
              {#each role.highlights as highlight, i (i)}<li>{highlight}</li>{/each}
            </ul>
          {/if}
          <div class="mt-1"><EvidenceTag evidence={role.evidence} /></div>
        </div>
      {/each}
    </section>
  {/each}

  {#if portfolio.education.length}
    <section class="mt-7">
      <h2 class="text-xs font-semibold tracking-widest uppercase" style:color="var(--readable)">
        Education
      </h2>
      {#each portfolio.education as item (item.id)}
        <p class="mt-2 flex items-baseline justify-between gap-3 text-sm">
          <span class="font-medium">{item.institution}</span>
          <span class="tabular shrink-0 text-xs text-neutral-500">
            {formatSpan(item.started, item.ended)}
          </span>
        </p>
      {/each}
    </section>
  {/if}

  {#if portfolio.skills.length}
    <section class="mt-7">
      <h2 class="text-xs font-semibold tracking-widest uppercase" style:color="var(--readable)">
        Skills
      </h2>
      <ul class="mt-2 flex flex-wrap gap-1.5">
        {#each portfolio.skills as skill (skill)}
          <li
            class="rounded px-2 py-0.5 text-xs text-white"
            style:background-color="var(--readable)"
          >
            {skill}
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</article>
