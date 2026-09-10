<script lang="ts">
  import type { MessageRequest } from '$lib/types';
  import { relativeTime } from '$lib/utils';

  let { request }: { request: MessageRequest } = $props();

  // Bodies arrive as ciphertext. Nothing renders until it is decrypted locally.
  // TODO: wire up local decryption once key exchange lands.
  let plaintext = $state<string | null>(null);
</script>

<article class="mb-2 rounded-lg border border-edge px-4 py-3">
  <header class="flex justify-between gap-4">
    <strong class="text-sm">{request.from}</strong>
    <span class="text-xs text-muted">{relativeTime(request.sent_at)}</span>
  </header>
  <p class="mt-1 text-sm" class:italic={plaintext === null} class:text-muted={plaintext === null}>
    {plaintext ?? 'Encrypted. Accept to decrypt.'}
  </p>
</article>
