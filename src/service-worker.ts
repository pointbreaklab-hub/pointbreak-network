/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

/**
 * Offline shell caching.
 *
 * Network data is Git-backed JSON cached separately in IndexedDB, where it can
 * be invalidated by ETag. This worker only handles the UI shell.
 */

const CACHE = `pointbreak-shell-${version}`;
const PRECACHE = [...build, ...files];

const worker = self as unknown as ServiceWorkerGlobalScope;

worker.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);

      // Added one at a time rather than with addAll(), which is atomic: a
      // single unreachable URL there discards the entire precache and the
      // worker never activates, silently disabling offline support.
      const results = await Promise.allSettled(PRECACHE.map((asset) => cache.add(asset)));
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0) {
        console.warn(`[sw] ${failed}/${PRECACHE.length} shell assets failed to precache`);
      }

      await worker.skipWaiting();
    })()
  );
});

worker.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await worker.clients.claim();
    })()
  );
});

worker.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // Hashed build output is content-addressed, so a cache hit can never be
  // stale. The filename changes when the content does.
  if (url.pathname.startsWith('/_app/immutable/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Everything else, HTML shells included, is network-first. Serving a cached
  // shell after a deploy hands the user markup that references asset hashes the
  // new build already deleted, a blank page until they clear site data.
  event.respondWith(networkFirst(request));
});

async function cacheFirst(request: Request): Promise<Response> {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
  return response;
}

async function networkFirst(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
  }
}
