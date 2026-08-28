/**
 * sw.js — service worker: syarat teknis biar PWA ini "installable" beneran
 * (ada tombol Install di browser) + cache app shell buat dibuka offline +
 * terima notifikasi push (Firebase Cloud Messaging) walau app-nya ketutup.
 * Request ke backend (Apps Script) sengaja TIDAK di-cache — selalu network,
 * konsisten dengan pola offline-first di index.html (localStorage yang jadi
 * primary store, bukan cache HTTP).
 */
const CACHE_NAME = 'mutabaah-keluarga-v2';
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

/* ================= FIREBASE CLOUD MESSAGING (background) ================= */
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCkAs9UxrTkYiPQpG5--Rr1xDAd6bFN22Y",
  authDomain: "mutabaah-keluarga.firebaseapp.com",
  projectId: "mutabaah-keluarga",
  storageBucket: "mutabaah-keluarga.firebasestorage.app",
  messagingSenderId: "204512737720",
  appId: "1:204512737720:web:f2eb0076acaad001f5f74d"
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || 'Mutabaah Keluarga';
  const body = (payload.notification && payload.notification.body) || '';
  self.registration.showNotification(title, { body, icon: 'icons/icon-192.png' });
});
