<script lang="ts">
  import { goto } from '$app/navigation';
  import { pollForToken, requestDeviceCode, session, type DeviceCode } from '$core/auth';
  import { ghFetch } from '$core/github-api';

  let device = $state<DeviceCode | null>(null);
  let error = $state<string | null>(null);
  let busy = $state(false);

  async function start() {
    busy = true;
    error = null;
    try {
      device = await requestDeviceCode();
      const token = await pollForToken(device);
      session.signIn({ token, login: '' });
      const user = await ghFetch<{ login: string }>('/user');
      session.signIn({ token, login: user.login });
      await goto('/app/feed');
    } catch (e) {
      error = e instanceof Error ? e.message : 'sign-in failed';
    } finally {
      busy = false;
    }
  }
</script>

<h1>Sign in with GitHub</h1>
<p class="lede">
  No password, no redirect, no server. You authorize a device code on github.com and the token stays
  in your browser.
</p>

{#if device}
  <div class="code">
    <p>Enter this code at <a href={device.verification_uri} target="_blank" rel="noreferrer noopener">{device.verification_uri}</a></p>
    <strong class="tabular">{device.user_code}</strong>
    <p class="fine">Waiting for authorization…</p>
  </div>
{:else}
  <button type="button" onclick={start} disabled={busy}>
    {busy ? 'Starting…' : 'Get a device code'}
  </button>
{/if}

{#if error}<p class="error">{error}</p>{/if}

<style>
  h1 { font-size: 1.4rem; }
  .lede { color: var(--fg-muted); max-width: 34rem; }
  .code { border: 1px solid var(--border); border-radius: 8px; padding: 1.25rem; max-width: 28rem; }
  .code strong { font-size: 2rem; letter-spacing: 0.15em; display: block; margin: 0.5rem 0; }
  .fine { color: var(--fg-muted); font-size: 0.85rem; margin: 0; }
  button {
    background: var(--accent); color: var(--bg); border: none; border-radius: 8px;
    padding: 0.6rem 1.1rem; font: inherit; font-weight: 500; cursor: pointer;
  }
  .error { color: var(--danger); }
</style>
