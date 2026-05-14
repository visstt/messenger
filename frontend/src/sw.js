import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(
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
    })
  );
});
