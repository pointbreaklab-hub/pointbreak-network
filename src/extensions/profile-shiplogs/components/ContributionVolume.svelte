<script lang="ts">
  import type { ContributionVolume } from '$lib/types';

  let { volume }: { volume?: ContributionVolume } = $props();

  const share = $derived(volume && volume.total > 0 ? volume.restricted / volume.total : 0);
</script>

{#if volume && volume.total > 0}
  <section class="rounded-lg border border-edge p-4">
    <h2 class="text-sm font-medium text-muted">Contribution volume, last year</h2>

    <p class="tabular mt-1 text-3xl font-semibold">{volume.total.toLocaleString()}</p>

    <div class="mt-3 flex h-2 overflow-hidden rounded-full bg-elevated">
      <span class="bg-accent" style:width="{(1 - share) * 100}%"></span>
      <span class="bg-ok" style:width="{share * 100}%"></span>
    </div>

    <p class="mt-2 text-xs text-muted">
      <span class="tabular text-ok">{volume.restricted.toLocaleString()}</span>
      of these are in private repositories. GitHub confirms the count without naming the
      repositories, so work behind a corporate firewall still counts here.
    </p>
  </section>
{:else}
  <section class="rounded-lg border border-edge p-4">
    <h2 class="text-sm font-medium text-muted">Contribution volume</h2>
    <p class="mt-2 text-sm text-muted">
      Not shared. If most of your work is in private repositories, turn on
      <em>Include private contributions on my profile</em> in your GitHub settings and refresh.
      Only the total is read, never repository names.
    </p>
  </section>
{/if}
