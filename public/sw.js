/* Train Station PWA service worker
 * - Installability
 * - Web Push → notification + home-screen badge
 * - Network-first (no offline cache; keeps coach/member data fresh)
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});

/** Home-screen badge from SW (works when app is backgrounded after a push). */
async function setBadge(count) {
  try {
    if (typeof self.registration.setAppBadge === "function") {
      if (count > 0) {
        await self.registration.setAppBadge(Math.min(Number(count) || 1, 99));
      } else if (typeof self.registration.clearAppBadge === "function") {
        await self.registration.clearAppBadge();
      }
    }
  } catch {
    /* unsupported */
  }
}

self.addEventListener("push", (event) => {
  let data = {
    title: "Train Station",
    body: "New message",
    url: "/",
    unread: 1,
    tag: "train-station-chat",
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch {
    try {
      const text = event.data?.text();
      if (text) data.body = text;
    } catch {
      /* ignore */
    }
  }

  const unread = Math.max(1, Math.floor(Number(data.unread) || 1));

  event.waitUntil(
    (async () => {
      await setBadge(unread);
      await self.registration.showNotification(data.title || "Train Station", {
        body: data.body || "New message",
        icon: "/images/logo-icon.png",
        badge: "/images/logo-icon.png",
        tag: data.tag || "train-station-chat",
        renotify: true,
        data: { url: data.url || "/" },
        // iOS uses system sound; vibrate helps Android
        vibrate: [120, 60, 120],
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of all) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client && url) {
            try {
              await client.navigate(url);
            } catch {
              /* navigate may fail on older engines */
            }
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(url);
      }
    })(),
  );
});

/** Page can ask SW to set badge (e.g. after poll while still open). */
self.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg.type === "SET_BADGE") {
    event.waitUntil(setBadge(msg.count || 0));
  }
  if (msg.type === "CLEAR_BADGE") {
    event.waitUntil(setBadge(0));
  }
});
