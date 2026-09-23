self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// A basic fetch handler is required by Chromium to trigger the beforeinstallprompt event.
// Since this app relies heavily on live WebSockets and doesn't explicitly need offline support,
// we just pass the requests through to the network.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
