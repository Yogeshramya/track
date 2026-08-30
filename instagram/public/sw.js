// Background Service Worker for LocShare / Instagram Tracker
// Handles background sync & keepalive with strict 3-minute cutoff on tab close

const THREE_MINUTES = 3 * 60 * 1000;
let backgroundTimer = null;
let backgroundStartTime = null;

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  if (type === 'TAB_CLOSED_OR_HIDDEN') {
    backgroundStartTime = Date.now();
    // Schedule shutdown after 3 minutes
    if (backgroundTimer) clearTimeout(backgroundTimer);
    backgroundTimer = setTimeout(() => {
      // 3 minutes elapsed: stop all background tracking
      backgroundStartTime = null;
    }, THREE_MINUTES);
  } else if (type === 'TAB_REOPENED') {
    if (backgroundTimer) clearTimeout(backgroundTimer);
    backgroundStartTime = null;
  }
});
