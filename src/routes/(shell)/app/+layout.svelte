<script lang="ts">
  /**
   * Which parts of the app need an account.
   *
   * Not most of them. Reading postings and tracking your own applications
   * require no identity at all: the ledger is public, and tracking is local
   * first by design. Demanding a GitHub account and a personal access token
   * before someone can record the job that ghosted them is the single largest
   * reason this collects nothing, because nobody has either one ready at the
   * moment they want to report, and most never will.
   *
   * So the gate now guards only what genuinely acts as you: publishing under
   * your name, reading your private GitHub contributions, posting a job.
   * Verification is the upgrade, not the entry fee.
   *
   * The list names what is open, so a route added later is closed until
   * somebody decides otherwise. That is the right way round for a mistake.
   */
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { session } from '$core/auth/session.svelte';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();

  const OPEN_TO_EVERYONE = ['/app/login', '/app/tracker', '/app/jobs'];

  const isOpen = $derived(
    OPEN_TO_EVERYONE.some((path) => $page.url.pathname === `${base}${path}`)
  );

  $effect(() => {
    if (!session.isAuthenticated && !isOpen) {
      goto(`${base}/app/login`, { replaceState: true });
    }
  });
</script>

{@render children()}
