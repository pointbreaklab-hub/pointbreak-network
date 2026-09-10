<script lang="ts">
  import { GHOST_WEIGHTS } from '$core/math-engine';
</script>

<svelte:head>
  <title>PointBreak — a job network that publishes its math</title>
  <meta
    name="description"
    content="A serverless, Git-backed job network. Ghost job scores, transparency receipts, and an algorithm you can read."
  />
</svelte:head>

<section class="hero">
  <h1>Math over emotion.</h1>
  <p>
    Every job posting here carries a number you can check, computed in your browser from data
    published in a public Git repository. No server holds it. No ranking you can't read.
  </p>
  <p class="cta">
    <a href="/app/jobs">Browse jobs</a>
    <a href="/post-job" class="secondary">Post a job</a>
  </p>
</section>

<section class="weights">
  <h2>The Ghost Score, in full</h2>
  <p>This is the entire algorithm. There is no second one.</p>
  <ul>
    {#each Object.entries(GHOST_WEIGHTS) as [name, weight] (name)}
      <li><code>{name}</code><span class="tabular">{weight.toFixed(2)}</span></li>
    {/each}
  </ul>
  <p class="fine">
    Source: <code>src/core/math-engine/ghost-job.ts</code>. A company that discloses nothing gets
    low confidence, not a good score.
  </p>
</section>

<style>
  .hero { padding-block: 3rem 2rem; max-width: 42rem; }
  h1 { font-size: clamp(2rem, 6vw, 3rem); letter-spacing: -0.03em; margin: 0 0 1rem; }
  .cta { display: flex; gap: 0.75rem; margin-top: 1.5rem; }
  .cta a {
    padding: 0.6rem 1.1rem; border-radius: 8px; text-decoration: none;
    background: var(--accent); color: var(--bg); font-weight: 500;
  }
  .cta .secondary { background: none; border: 1px solid var(--border); color: var(--fg); }
  .weights { border-top: 1px solid var(--border); padding-top: 2rem; max-width: 42rem; }
  h2 { font-size: 1.1rem; }
  ul { list-style: none; padding: 0; display: grid; gap: 0.35rem; max-width: 24rem; }
  li { display: flex; justify-content: space-between; border-bottom: 1px solid var(--border); padding: 0.4rem 0; }
  .fine { color: var(--fg-muted); font-size: 0.85rem; }
</style>
