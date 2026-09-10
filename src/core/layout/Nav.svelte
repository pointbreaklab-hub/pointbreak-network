<script lang="ts">
  import { page } from '$app/stores';
  import { session } from '$core/auth/session';
  import { theme } from './theme';
  import type { NavItem } from '$core/registry';

  let { items = [] }: { items: NavItem[] } = $props();
</script>

<nav class="flex items-center gap-6 border-b border-edge px-5 py-3">
  <a href="/" class="font-semibold tracking-tight">pointbreak</a>

  <ul class="flex gap-4">
    {#each items as item (item.path)}
      <li>
        <a
          href={item.path}
          class="text-muted hover:text-fg aria-[current=page]:text-fg"
          aria-current={$page.url.pathname === item.path ? 'page' : undefined}
        >
          {item.nav?.label}
        </a>
      </li>
    {/each}
  </ul>

  <div class="ml-auto flex items-center gap-3">
    <button
      type="button"
      onclick={() => theme.toggle()}
      aria-label="Toggle theme"
      class="rounded-md border border-edge px-2.5 py-1 text-muted hover:text-fg"
    >
      {theme.current === 'dark' ? '☾' : '☀'}
    </button>

    {#if session.current}
      <button
        type="button"
        onclick={() => session.signOut()}
        class="rounded-md border border-edge px-2.5 py-1 text-muted hover:text-fg"
      >
        {session.current.github_login}
      </button>
    {:else}
      <a href="/app/login" class="text-muted hover:text-fg">Sign in</a>
    {/if}
  </div>
</nav>
