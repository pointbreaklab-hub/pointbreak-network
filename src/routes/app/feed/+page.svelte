<script lang="ts">
  import { session } from '$core/auth/session.svelte';
</script>

<svelte:head><title>Feed · PointBreak</title></svelte:head>

<h1>Signed in as {session.current?.github_login}</h1>
<p class="lede">
  The feed aggregates new postings, funnel updates from companies you applied to, and silence
  crossing the ghost threshold.
</p>
<!-- TODO: assemble from db cache + github-api reads -->

<style>
  h1 { font-size: 1.3rem; }
  .lede { color: var(--fg-muted); max-width: 38rem; }
</style>
