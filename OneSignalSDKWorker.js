importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

// Activate new SW version immediately — don't wait for all tabs to close
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(clients.claim()));

// Always fetch navigation requests (app open / location.reload) from network,
// bypassing the browser cache so PWA users always get the latest index.html.
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .catch(() => fetch(event.request))
    );
  }
});
