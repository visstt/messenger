import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(
    Promise.all([
      clearBadge(),
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
        const url = new URL(targetUrl, self.location.origin);
        const sameOriginClient = clients.find((client) => {
          try {
            return new URL(client.url).origin === url.origin;
          } catch {
            return false;
          }
        });

        if (sameOriginClient) {
          return sameOriginClient.focus();
        }
        return self.clients.openWindow(url.href);
      }),
    ])
  );
});

self.addEventListener("message", (event) => {
  if (!event.data || event.data.type !== "badge:update") return;
  const count = Number(event.data.count || 0);
  event.waitUntil(count > 0 ? setBadge(count) : clearBadge());
});

async function setBadge(count) {
  try {
    if ("setAppBadge" in self.registration) {
      await self.registration.setAppBadge(Math.min(99, Math.max(0, count)));
    }
  } catch {
    // Ignore unsupported runtime errors.
  }
}

async function clearBadge() {
  try {
    if ("clearAppBadge" in self.registration) {
      await self.registration.clearAppBadge();
    }
  } catch {
    // Ignore unsupported runtime errors.
  }
}
