<script lang="ts">
  import { formatSpan, type Portfolio } from '$lib/portfolio';
  import EvidenceTag from './EvidenceTag.svelte';

  let { portfolio }: { portfolio: Portfolio } = $props();
</script>

<!-- Deliberately printable: a resume still gets printed. -->
<article class="mx-auto max-w-3xl bg-white px-8 py-10 text-[#111] print:px-0">
  <header class="border-b border-neutral-300 pb-5">
    <h1 class="text-3xl font-semibold tracking-tight">
      {portfolio.display_name ?? portfolio.github_login}
    </h1>
    {#if portfolio.headline}
      <p class="mt-1 text-lg text-neutral-600">{portfolio.headline}</p>
    {/if}
    {#if portfolio.summary}
      <p class="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-700">{portfolio.summary}</p>
    {/if}
  </header>

  {#if portfolio.companies.length}
    <section class="mt-7">
      <h2 class="text-xs font-semibold tracking-widest text-neutral-500 uppercase">Experience</h2>
      {#each portfolio.companies as company (company.id)}
        <div class="mt-5">
          <div class="flex items-baseline justify-between gap-3">
            <h3 class="text-base font-semibold">{company.name}</h3>
            <EvidenceTag evidence={company.evidence} />
          </div>

          {#each company.roles as role (role.id)}
            <div class="mt-2.5 pl-4 border-l-2 border-neutral-200">
              <div class="flex items-baseline justify-between gap-3">
                <p class="font-medium">{role.title}</p>
                <p class="shrink-0 text-xs text-neutral-500">{formatSpan(role.started, role.ended)}</p>
              </div>
              {#if role.highlights.length}
                <ul class="mt-1 list-disc pl-4 text-sm text-neutral-700 marker:text-neutral-400">
                  {#each role.highlights as highlight, i (i)}<li>{highlight}</li>{/each}
                </ul>
              {/if}
              <div class="mt-1"><EvidenceTag evidence={role.evidence} /></div>
            </div>
          {/each}
        </div>
      {/each}
    </section>
  {/if}

  {#if portfolio.education.length}
    <section class="mt-7">
      <h2 class="text-xs font-semibold tracking-widest text-neutral-500 uppercase">Education</h2>
      {#each portfolio.education as item (item.id)}
        <div class="mt-2.5 flex items-baseline justify-between gap-3">
          <p>
            <span class="font-medium">{item.institution}</span>
            {#if item.qualification}<span class="text-neutral-600">, {item.qualification}</span>{/if}
          </p>
          <p class="shrink-0 text-xs text-neutral-500">{formatSpan(item.started, item.ended)}</p>
        </div>
        <div class="mt-0.5"><EvidenceTag evidence={item.evidence} /></div>
      {/each}
    </section>
  {/if}

  {#if portfolio.projects.length}
    <section class="mt-7">
      <h2 class="text-xs font-semibold tracking-widest text-neutral-500 uppercase">Projects</h2>
      {#each portfolio.projects as project (project.id)}
        <div class="mt-2.5">
          <p class="font-medium">
            {#if project.url}
              <a href={project.url} target="_blank" rel="noreferrer noopener" class="underline"
                >{project.name}</a
              >
            {:else}{project.name}{/if}
          </p>
          {#if project.summary}<p class="text-sm text-neutral-700">{project.summary}</p>{/if}
        </div>
      {/each}
    </section>
  {/if}

  {#if portfolio.skills.length}
    <section class="mt-7">
      <h2 class="text-xs font-semibold tracking-widest text-neutral-500 uppercase">Skills</h2>
      <p class="mt-2 text-sm text-neutral-700">{portfolio.skills.join(' · ')}</p>
    </section>
  {/if}
</article>
