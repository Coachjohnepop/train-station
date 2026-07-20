/* Train Station — minimal service worker for PWA install + future push.
   Network-first: no offline cache yet (keeps coach/member data fresh). */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Pass-through — required for installability on Chromium; no offline shell yet.
  event.respondWith(fetch(event.request));
});
