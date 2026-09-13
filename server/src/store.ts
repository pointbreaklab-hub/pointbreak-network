/**
 * Durable key-value store, file backed.
 *
 * This replaces Cloudflare KV. It holds a few thousand short opaque strings at
 * most, so a database would be ceremony: every value is an HMAC key, a spent
 * nonce, or a small counter, and the whole thing fits in memory comfortably.
 *
 * No native modules and no external service, so `node server/src/node.ts` on
 * any machine is a complete deployment.
 *
 * Durability is an atomic rename: write a temp file, fsync, rename over the
 * real one. A crash mid-write leaves the previous file intact rather than a
 * truncated one.
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

interface Entry {
  value: string;
  /** Epoch millis, or undefined for no expiry. */
  expires?: number;
}

export interface Store {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { ttlSeconds?: number }): Promise<void>;
  close(): Promise<void>;
}

export class FileStore implements Store {
  private entries = new Map<string, Entry>();
  private dirty = false;
  private flushing: Promise<void> | null = null;
  private timer: NodeJS.Timeout | null = null;

  private constructor(private readonly path: string) {}

  static async open(path: string): Promise<FileStore> {
    const store = new FileStore(path);
    await mkdir(dirname(path), { recursive: true });

    try {
      const raw = await readFile(path, 'utf8');
      for (const [key, entry] of Object.entries(JSON.parse(raw) as Record<string, Entry>)) {
        store.entries.set(key, entry);
      }
    } catch (e) {
      // A missing file is an empty store. Anything else is corruption, and
      // starting empty would silently reset every sybil guard.
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }

    store.sweep();
    return store;
  }

  async get(key: string): Promise<string | null> {
    const entry = this.entries.get(key);
    if (!entry) return null;

    if (entry.expires !== undefined && entry.expires < Date.now()) {
      this.entries.delete(key);
      this.schedule();
      return null;
    }

    return entry.value;
  }

  async put(key: string, value: string, opts: { ttlSeconds?: number } = {}): Promise<void> {
    this.entries.set(key, {
      value,
      expires: opts.ttlSeconds ? Date.now() + opts.ttlSeconds * 1000 : undefined
    });

    // Guards must survive a crash, so this write is awaited rather than
    // batched. Handing out a token whose guard was never persisted would let
    // the same account claim the same posting twice.
    this.schedule();
    await this.flush();
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.expires !== undefined && entry.expires < now) this.entries.delete(key);
    }
  }

  private schedule(): void {
    this.dirty = true;
    if (this.timer) return;
    this.timer = setTimeout(() => void this.flush(), 1000);
    this.timer.unref?.();
  }

  private async flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    if (!this.dirty) return;

    this.flushing = (async () => {
      this.dirty = false;
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }

      this.sweep();
      const snapshot = JSON.stringify(Object.fromEntries(this.entries));
      const temp = `${this.path}.${process.pid}.tmp`;

      await writeFile(temp, snapshot, 'utf8');
      await rename(temp, this.path);
    })();

    try {
      await this.flushing;
    } finally {
      this.flushing = null;
    }
  }

  async close(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.dirty = true;
    await this.flush();
  }
}

/** For tests and dry runs. Nothing survives a restart. */
export class MemoryStore implements Store {
  private entries = new Map<string, Entry>();

  async get(key: string): Promise<string | null> {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expires !== undefined && entry.expires < Date.now()) {
      this.entries.delete(key);
      return null;
    }
    return entry.value;
  }

  async put(key: string, value: string, opts: { ttlSeconds?: number } = {}): Promise<void> {
    this.entries.set(key, {
      value,
      expires: opts.ttlSeconds ? Date.now() + opts.ttlSeconds * 1000 : undefined
    });
  }

  async close(): Promise<void> {}
}
