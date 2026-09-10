<script lang="ts">
  import type { Skill, SkillEvidence } from '$lib/types';
  import { evidenceWeight } from '../data';

  let { skills = [] }: { skills: Skill[] } = $props();

  const ranked = $derived([...skills].sort((a, b) => evidenceWeight(b) - evidenceWeight(a)));
  const peak = $derived(Math.max(1, ...ranked.map(evidenceWeight)));

  const KIND: Record<SkillEvidence['kind'], { label: string; tone: string }> = {
    peer_attestation: { label: 'vouched', tone: 'text-ok' },
    merged_prs: { label: 'merged PRs', tone: 'text-accent' },
    external_artifact: { label: 'published', tone: 'text-accent' },
    public_commits: { label: 'public commits', tone: 'text-muted' },
    private_contributions: { label: 'private work', tone: 'text-muted' }
  };
</script>

<ul class="grid gap-2">
  {#each ranked as skill (skill.skill)}
    <li class="grid grid-cols-[9rem_1fr] items-start gap-3">
      <span class="text-sm">{skill.skill}</span>
      <div>
        <span class="block h-1.5 rounded-full bg-elevated">
          <span
            class="block h-full rounded-full bg-accent"
            style:width="{(evidenceWeight(skill) / peak) * 100}%"
          ></span>
        </span>
        <!-- Which evidence backs the claim, not just how much of it. -->
        <span class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
          {#each skill.evidence as item (item.kind)}
            <span class={KIND[item.kind].tone}>
              {#if item.count}<span class="tabular">{item.count}</span>{/if}
              {KIND[item.kind].label}
              {#if item.attested_by}by {item.attested_by}{/if}
            </span>
          {/each}
        </span>
      </div>
    </li>
  {:else}
    <li class="text-sm text-muted">
      No skill evidence yet. Public commits and merged pull requests are read
      automatically; private work and peer vouches are added by you.
    </li>
  {/each}
</ul>
