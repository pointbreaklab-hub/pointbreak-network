<script lang="ts">
  import { BLACK_HOLE_AFTER_DAYS, HIGH_VOLUME_APPLICATIONS, STALE_AFTER_DAYS } from '$core/math-engine';

  const features = [
    {
      emoji: '🔴',
      title: 'Ghost Job Algorithm',
      body: `Every posting carries a 0–100 score computed in your browser from the company's own action metrics. Open past ${STALE_AFTER_DAYS} days with nobody interviewed? ${HIGH_VOLUME_APPLICATIONS}+ applicants and zero interviews? The number moves, and everyone sees it.`
    },
    {
      emoji: '🕳️',
      title: 'Black Hole Tracker',
      body: `After ${BLACK_HOLE_AFTER_DAYS} days of silence an application stops being "pending" and becomes a recorded fact about the company. You also see how many other people are stuck on the same posting.`
    },
    {
      emoji: '📦',
      title: 'Git-backed Ship Logs',
      body: 'Your profile is merged pull requests and commit counts, read from GitHub. Skills are verified by volume of work shipped, not by endorsements from people who never saw your code.'
    }
  ];
</script>

<svelte:head>
  <title>PointBreak — The Open-Source Professional Network</title>
  <meta
    name="description"
    content="Math over emotion. Ghost job scores, black hole tracking, and Git-backed proof of work. No premium tiers, no pay-to-message."
  />
</svelte:head>

<section class="max-w-2xl py-12">
  <h1 class="text-4xl font-semibold tracking-tight sm:text-5xl">
    The Open-Source Professional Network.
    <span class="block text-muted">Math over Emotion.</span>
  </h1>

  <p class="mt-5 text-lg text-muted">
    We don't do emotions. We do math. Candidates prove skills with Git commits. Companies prove
    hiring intent with action metrics. Both numbers are public, and both are computed in your
    browser from data anyone can clone.
  </p>

  <div class="mt-7 flex flex-wrap gap-3">
    <a
      href="/app/feed"
      class="rounded-lg bg-accent px-5 py-2.5 font-medium text-bg hover:opacity-90"
    >
      Launch App
    </a>
    <a
      href="/app/post-job"
      class="rounded-lg border border-edge px-5 py-2.5 font-medium hover:bg-elevated"
    >
      Post a job
    </a>
  </div>

  <p class="mt-4 text-sm text-muted">
    No premium tiers. No pay-to-message. No VIP treatment.
  </p>
</section>

<section class="grid gap-6 border-t border-edge py-10 sm:grid-cols-3">
  {#each features as feature (feature.title)}
    <article>
      <p class="text-2xl" aria-hidden="true">{feature.emoji}</p>
      <h2 class="mt-2 text-base font-medium">{feature.title}</h2>
      <p class="mt-1 text-sm text-muted">{feature.body}</p>
    </article>
  {/each}
</section>

<section class="max-w-2xl border-t border-edge py-10">
  <h2 class="text-base font-medium">There is no server</h2>
  <p class="mt-2 text-sm text-muted">
    The client is a static bundle. Every profile, job, and event is JSON in a public Git repository.
    Scoring runs in your browser against source you can read in this repo. If this project is
    abandoned or turns hostile, forking the entire network is <code class="text-fg">git clone</code>.
  </p>
</section>
