<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { session, TokenError, verifyToken } from '$core/auth';

  let token = $state('');
  let error = $state<string | null>(null);
  let busy = $state(false);

  async function signIn(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    error = null;

    try {
      const identity = await verifyToken(token);
      session.signIn({ token: token.trim(), github_login: identity.github_login });
      token = '';
      await goto(`${base}/app/feed`);
    } catch (e) {
      error = e instanceof TokenError ? e.message : 'Sign-in failed.';
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>Sign in · PointBreak</title></svelte:head>

<h1 class="text-xl font-medium">Sign in with a GitHub token</h1>

<p class="mt-2 max-w-2xl text-muted">
  No password, no OAuth app, no server. You create a token, you scope it, you revoke it. It is
  stored in this browser and sent only to api.github.com.
</p>

<form onsubmit={signIn} class="mt-6 grid max-w-xl gap-3">
  <label class="grid gap-1 text-sm text-muted">
    Personal access token
    <input
      type="password"
      bind:value={token}
      autocomplete="off"
      spellcheck="false"
      placeholder="github_pat_..."
      required
      class="rounded-md border border-edge bg-elevated px-2.5 py-1.5 font-mono text-sm text-fg"
    />
  </label>

  <button
    type="submit"
    disabled={busy}
    class="justify-self-start rounded-lg bg-accent px-5 py-2 font-medium text-bg disabled:opacity-40"
  >
    {busy ? 'Checking...' : 'Sign in'}
  </button>
</form>

{#if error}
  <p class="mt-3 max-w-xl rounded-md border border-danger p-3 text-sm text-danger">{error}</p>
{/if}

<section class="mt-8 max-w-2xl border-t border-edge pt-6">
  <h2 class="text-base font-medium">Creating one</h2>
  <ol class="mt-2 grid gap-2 text-sm text-muted">
    <li>
      1. Open
      <a
        href="https://github.com/settings/personal-access-tokens/new"
        target="_blank"
        rel="noreferrer noopener"
        class="text-accent">Settings, Developer settings, Fine-grained tokens</a
      >.
    </li>
    <li>2. Repository access: <strong class="text-fg">Public repositories (read-only)</strong>.</li>
    <li>
      3. Account permissions: <strong class="text-fg">Profile, read-only</strong>. That is enough to
      read your commit counts and merged pull requests.
    </li>
    <li>4. Set an expiry. Ninety days is sensible. Paste it above.</li>
  </ol>

  <p class="mt-4 text-sm text-muted">
    Nothing here needs write access. If you later turn on publishing to the shared ledger, that goes
    through a separate service and still never asks for a write token.
  </p>
</section>

<section class="mt-6 max-w-2xl rounded-md border border-edge p-4 text-sm text-muted">
  <h2 class="font-medium text-fg">Why not the usual GitHub button</h2>
  <p class="mt-1">
    OAuth Device Flow was the plan, and it cannot work here. GitHub's
    <code>github.com/login/*</code> endpoints send no
    <code>Access-Control-Allow-Origin</code> header, so a browser blocks the call before it is sent.
    Completing that flow needs a server to relay two requests, and this app is meant to run without
    one. A token you create yourself skips the problem entirely.
  </p>
</section>
