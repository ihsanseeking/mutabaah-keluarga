/**
 * sw.js — service worker: syarat teknis biar PWA ini "installable" beneran
 * (ada tombol Install di browser) + cache app shell buat dibuka offline.
 * Request ke backend (Apps Script) sengaja TIDAK di-cache — selalu network,
 * konsisten dengan pola offline-first di index.html (localStorage yang jadi
 * primary store, bukan cache HTTP).
 */
const CACHE_NAME = 'mutabaah-keluarga-v1';
const APP_SHELL = ['./', './index.html', './manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.url.includes('script.google.com')) return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
