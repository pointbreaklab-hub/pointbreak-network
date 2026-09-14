<script lang="ts">
  import { newId, type Portfolio } from '$lib/portfolio';

  let {
    portfolio = $bindable(),
    onchange
  }: { portfolio: Portfolio; onchange: () => void } = $props();

  // The parser is a head start and gets things wrong, so correcting it has to
  // be quick rather than a form-filling exercise.
  const field = 'w-full rounded-md border border-edge bg-elevated px-2 py-1 text-sm text-fg';

  function addCompany() {
    portfolio.companies = [
      ...portfolio.companies,
      { id: newId('co'), name: 'New company', roles: [], evidence: [{ kind: 'claimed' }] }
    ];
    onchange();
  }

  function addRole(companyId: string) {
    const company = portfolio.companies.find((c) => c.id === companyId);
    if (!company) return;

    company.roles = [
      ...company.roles,
      {
        id: newId('role'),
        title: 'New role',
        started: '',
        highlights: [],
        skills: [],
        evidence: [{ kind: 'claimed' }]
      }
    ];
    onchange();
  }

  function removeCompany(id: string) {
    portfolio.companies = portfolio.companies.filter((c) => c.id !== id);
    onchange();
  }

  function removeRole(companyId: string, roleId: string) {
    const company = portfolio.companies.find((c) => c.id === companyId);
    if (!company) return;
    company.roles = company.roles.filter((r) => r.id !== roleId);
    onchange();
  }
</script>

<div class="grid max-w-3xl gap-5">
  <section class="rounded-lg border border-edge p-4">
    <h2 class="mb-3 text-sm font-medium text-muted">About</h2>
    <div class="grid gap-2">
      <label class="grid gap-1 text-xs text-muted">
        Name
        <input class={field} bind:value={portfolio.display_name} oninput={onchange} />
      </label>
      <label class="grid gap-1 text-xs text-muted">
        Headline
        <input
          class={field}
          bind:value={portfolio.headline}
          oninput={onchange}
          placeholder="Backend engineer, payments"
        />
      </label>
      <label class="grid gap-1 text-xs text-muted">
        Summary
        <textarea class="{field} min-h-20" bind:value={portfolio.summary} oninput={onchange}
        ></textarea>
      </label>
      <label class="grid gap-1 text-xs text-muted">
        Skills, comma separated
        <input
          class={field}
          value={portfolio.skills.join(', ')}
          oninput={(e) => {
            portfolio.skills = e.currentTarget.value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
            onchange();
          }}
        />
      </label>
    </div>
  </section>

  <section class="rounded-lg border border-edge p-4">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-sm font-medium text-muted">Experience</h2>
      <button type="button" onclick={addCompany} class="text-xs text-accent">Add company</button>
    </div>

    {#each portfolio.companies as company (company.id)}
      <div class="mb-4 rounded-md border border-edge p-3">
        <div class="flex gap-2">
          <input class={field} bind:value={company.name} oninput={onchange} />
          <button
            type="button"
            onclick={() => removeCompany(company.id)}
            class="shrink-0 text-xs text-muted hover:text-danger">Remove</button
          >
        </div>

        {#each company.roles as role (role.id)}
          <div class="mt-3 border-l-2 border-edge pl-3">
            <div class="flex gap-2">
              <input class={field} bind:value={role.title} oninput={onchange} />
              <button
                type="button"
                onclick={() => removeRole(company.id, role.id)}
                class="shrink-0 text-xs text-muted hover:text-danger">Remove</button
              >
            </div>
            <div class="mt-1 flex gap-2">
              <!-- Month precision: CVs rarely state a day and guessing one invents detail. -->
              <input
                class={field}
                type="month"
                bind:value={role.started}
                oninput={onchange}
                title="Started"
              />
              <input
                class={field}
                type="month"
                value={role.ended ?? ''}
                oninput={(e) => {
                  role.ended = e.currentTarget.value || undefined;
                  onchange();
                }}
                title="Ended, leave empty if current"
              />
            </div>
            <textarea
              class="{field} mt-1 min-h-16"
              value={role.highlights.join('\n')}
              oninput={(e) => {
                role.highlights = e.currentTarget.value.split('\n').filter((l) => l.trim());
                onchange();
              }}
              placeholder="One achievement per line"
            ></textarea>
          </div>
        {/each}

        <button
          type="button"
          onclick={() => addRole(company.id)}
          class="mt-2 text-xs text-accent"
        >
          Add role
        </button>
        <p class="mt-1 text-xs text-muted">
          A promotion is a second role here. The Series theme renders it as a new season.
        </p>
      </div>
    {:else}
      <p class="text-sm text-muted">Nothing yet.</p>
    {/each}
  </section>

  <section class="rounded-lg border border-edge p-4">
    <h2 class="mb-3 text-sm font-medium text-muted">Education</h2>
    {#each portfolio.education as item (item.id)}
      <div class="mb-2 flex gap-2">
        <input class={field} bind:value={item.institution} oninput={onchange} />
        <input
          class="{field} max-w-40"
          bind:value={item.qualification}
          oninput={onchange}
          placeholder="Qualification"
        />
      </div>
    {:else}
      <p class="text-sm text-muted">Nothing yet.</p>
    {/each}
  </section>
</div>
