/*
  Temporary cleanup worker for stale registrations.
  If a browser still has /notification-worker.js registered from older code,
  this script unregisters itself so future requests stop.
*/

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    self.registration.unregister().then(() => self.clients.matchAll({ type: "window" })),
  );
});
