<script lang="ts">
  import type { VerifiedSkill } from '$lib/types';

  let { skills = [] }: { skills: VerifiedSkill[] } = $props();

  // Ranked by commits, never by self-assessment. The bar is relative to the
  // user's own top skill — this is a shape, not a cross-user comparison.
  const ranked = $derived([...skills].sort((a, b) => b.commits - a.commits));
  const peak = $derived(Math.max(1, ...ranked.map((s) => s.commits)));
</script>

<ul class="grid gap-1.5">
  {#each ranked as skill (skill.skill)}
    <li class="grid grid-cols-[9rem_1fr_4rem] items-center gap-3">
      <span class="text-sm">{skill.skill}</span>
      <span class="h-1.5 rounded-full bg-elevated">
        <span
          class="block h-full rounded-full bg-accent"
          style:width="{(skill.commits / peak) * 100}%"
        ></span>
      </span>
      <span class="tabular text-right text-sm text-muted">{skill.commits}</span>
    </li>
  {:else}
    <li class="text-muted">No verified skills yet.</li>
  {/each}
</ul>
