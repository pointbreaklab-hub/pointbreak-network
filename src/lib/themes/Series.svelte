<script lang="ts">
  import { formatSpan, totalMonths, type Company, type Portfolio } from '$lib/portfolio';
  import EvidenceTag from './EvidenceTag.svelte';

  let { portfolio }: { portfolio: Portfolio } = $props();

  // A company is a series, each role a season, each highlight an episode. The
  // metaphor is the point: a promotion reads as a renewal rather than a line
  // item, which is how progression actually feels.
  const years = $derived(Math.round((totalMonths(portfolio) / 12) * 10) / 10);

  let openRole = $state<string | null>(null);

  function seasons(company: Company) {
    // Oldest first, so season 1 is where they started.
    return [...company.roles].sort((a, b) => a.started.localeCompare(b.started));
  }
</script>

<div class="bg-[#0b0b0f] text-neutral-100">
  <header class="px-6 pt-10 pb-8 sm:px-10">
    <p class="text-xs font-semibold tracking-[0.25em] text-neutral-500 uppercase">Ship log</p>
    <h1 class="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
      {portfolio.display_name ?? portfolio.github_login}
    </h1>
    {#if portfolio.headline}
      <p class="mt-2 max-w-2xl text-lg text-neutral-400">{portfolio.headline}</p>
    {/if}
    <p class="tabular mt-3 text-sm text-neutral-500">
      {portfolio.companies.length} series · {years} years · {portfolio.skills.length} skills
    </p>
    {#if portfolio.summary}
      <p class="mt-4 max-w-2xl text-sm leading-relaxed text-neutral-400">{portfolio.summary}</p>
    {/if}
  </header>

  {#each portfolio.companies as company (company.id)}
    <section class="px-6 pb-10 sm:px-10">
      <div class="flex items-baseline gap-3">
        <h2 class="text-xl font-semibold">{company.name}</h2>
        <EvidenceTag evidence={company.evidence} />
      </div>
      <p class="text-xs text-neutral-500">
        {seasons(company).length}
        {seasons(company).length === 1 ? 'season' : 'seasons'}
      </p>

      <!-- Horizontal, like a shelf. Scrolls inside itself so the page never does. -->
      <div class="mt-3 flex gap-3 overflow-x-auto pb-2">
        {#each seasons(company) as role, index (role.id)}
          <button
            type="button"
            onclick={() => (openRole = openRole === role.id ? null : role.id)}
            class="w-64 shrink-0 rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-left transition hover:border-neutral-600 motion-reduce:transition-none"
            class:!border-neutral-500={openRole === role.id}
          >
            <p class="text-[0.65rem] font-semibold tracking-widest text-neutral-500 uppercase">
              Season {index + 1}
            </p>
            <p class="mt-1 font-medium">{role.title}</p>
            <p class="tabular mt-0.5 text-xs text-neutral-500">
              {formatSpan(role.started, role.ended)}
            </p>
            <p class="mt-2 text-xs text-neutral-500">
              {role.highlights.length}
              {role.highlights.length === 1 ? 'episode' : 'episodes'}
            </p>
            <div class="mt-2"><EvidenceTag evidence={role.evidence} subtle /></div>
          </button>
        {/each}
      </div>

      {#each seasons(company) as role, index (role.id)}
        {#if openRole === role.id}
          <div class="mt-2 rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
            <p class="text-xs tracking-widest text-neutral-500 uppercase">
              Season {index + 1} · {role.title}
            </p>
            {#if role.highlights.length}
              <ol class="mt-3 grid gap-2">
                {#each role.highlights as highlight, episode (episode)}
                  <li class="flex gap-3 text-sm">
                    <span class="tabular w-8 shrink-0 text-neutral-600">
                      E{String(episode + 1).padStart(2, '0')}
                    </span>
                    <span class="text-neutral-300">{highlight}</span>
                  </li>
                {/each}
              </ol>
            {:else}
              <p class="mt-2 text-sm text-neutral-500">No episodes listed for this season.</p>
            {/if}
          </div>
        {/if}
      {/each}
    </section>
  {/each}

  {#if portfolio.education.length || portfolio.projects.length}
    <section class="border-t border-neutral-900 px-6 py-8 sm:px-10">
      {#if portfolio.projects.length}
        <h2 class="text-xs font-semibold tracking-widest text-neutral-500 uppercase">Specials</h2>
        <div class="mt-3 flex gap-3 overflow-x-auto pb-2">
          {#each portfolio.projects as project (project.id)}
            <div class="w-56 shrink-0 rounded-lg border border-neutral-800 bg-neutral-900 p-3">
              <p class="font-medium">{project.name}</p>
              {#if project.summary}
                <p class="mt-1 text-xs text-neutral-500">{project.summary}</p>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      {#if portfolio.education.length}
        <h2 class="mt-6 text-xs font-semibold tracking-widest text-neutral-500 uppercase">
          Origin story
        </h2>
        {#each portfolio.education as item (item.id)}
          <p class="mt-2 text-sm">
            <span class="font-medium">{item.institution}</span>
            <span class="tabular text-neutral-500"> {formatSpan(item.started, item.ended)}</span>
            <EvidenceTag evidence={item.evidence} subtle />
          </p>
        {/each}
      {/if}
    </section>
  {/if}
</div>
