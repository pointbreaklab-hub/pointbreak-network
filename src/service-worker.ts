/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

// Offline caching for the UI shell only. Network data is Git-backed JSON and is
// cached separately in IndexedDB, where it can be invalidated by ETag.
const CACHE = `pointbreak-shell-${version}`;
const SHELL = [...build, ...files];

const worker = self as unknown as ServiceWorkerGlobalScope;

worker.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  worker.skipWaiting();
});

worker.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => worker.clients.claim())
  );
});

worker.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;

  // Cache-first for the immutable build output; never for API responses.
  event.respondWith(
    caches.match(request).then((cached) => cached ?? fetch(request))
  );
});
