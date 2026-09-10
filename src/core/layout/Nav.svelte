<script lang="ts">
  import { page } from '$app/stores';
  import { session } from '$core/auth/session';
  import { theme } from './theme';
  import type { NavItem } from '$core/registry';

  let { items = [] }: { items: NavItem[] } = $props();
</script>

<nav class="nav">
  <a class="brand" href="/">pointbreak</a>

  <ul>
    {#each items as item (item.path)}
      <li>
        <a href={item.path} aria-current={$page.url.pathname === item.path ? 'page' : undefined}>
          {item.nav?.label}
        </a>
      </li>
    {/each}
  </ul>

  <div class="actions">
    <button type="button" onclick={() => theme.toggle()} aria-label="Toggle theme">
      {theme.current === 'dark' ? '☾' : '☀'}
    </button>
    {#if session.current}
      <button type="button" onclick={() => session.signOut()}>{session.current.login}</button>
    {:else}
      <a href="/app/login">Sign in</a>
    {/if}
  </div>
</nav>

<style>
  .nav {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid var(--border);
  }
  .brand {
    font-weight: 600;
    letter-spacing: -0.02em;
  }
  ul {
    display: flex;
    gap: 1rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .actions {
    margin-left: auto;
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }
  a {
    color: var(--fg-muted);
    text-decoration: none;
  }
  a[aria-current='page'] {
    color: var(--fg);
  }
  button {
    background: none;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.25rem 0.6rem;
    color: var(--fg-muted);
    cursor: pointer;
    font: inherit;
  }
</style>
