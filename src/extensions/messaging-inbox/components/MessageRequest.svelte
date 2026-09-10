<script lang="ts">
  import type { MessageRequest } from '$lib/types';
  import { relativeTime } from '$lib/utils';

  let { request }: { request: MessageRequest } = $props();

  // Bodies arrive as ciphertext; nothing is rendered until decrypted locally.
  // TODO: wire up local decryption once key exchange lands.
  let plaintext = $state<string | null>(null);
</script>

<article>
  <header>
    <strong>{request.from}</strong>
    <span class="meta">{relativeTime(request.sentAt)}</span>
  </header>
  <p class:locked={plaintext === null}>{plaintext ?? 'Encrypted — accept to decrypt.'}</p>
</article>

<style>
  article { border: 1px solid var(--border); border-radius: 8px; padding: 0.85rem 1rem; margin-bottom: 0.6rem; }
  header { display: flex; justify-content: space-between; gap: 1rem; }
  .meta { color: var(--fg-muted); font-size: 0.8rem; }
  p { margin: 0.4rem 0 0; }
  .locked { color: var(--fg-muted); font-style: italic; }
</style>
