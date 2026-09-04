/* Train Station PWA service worker v4
 * - Installability (fetch handler must exist)
 * - Web Push → notification + home-screen badge
 * - Do NOT hijack document / Next.js RSC loads — that whitescreens the
 *   installed desktop app on relaunch (redirects + App Router flights).
 */
const SW_VERSION = "ts-sw-v4";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve(SW_VERSION));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.mode === "navigate") return;
  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_next/")) return;
  if (url.searchParams.has("_rsc")) return;
  if (req.headers.get("RSC") === "1") return;
  if (req.headers.get("Next-Router-Prefetch")) return;
  event.respondWith(
    fetch(req).catch(
      () => new Response("", { status: 504, statusText: "offline" }),
    ),
  );
});

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
    /* badge optional */
  }
}

self.addEventListener("push", (event) => {
  let data = {
    title: "Train Station",
    body: "New message",
    url: "/member/chat",
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
      const text = event.data && event.data.text && event.data.text();
      if (text) data.body = text;
    } catch {
      /* ignore */
    }
  }

  const unread = Math.max(1, Math.floor(Number(data.unread) || 1));

  // iOS: showNotification is required for the push to surface when the app is closed.
  // Do notification first; badge second so a badge failure never drops the alert.
  event.waitUntil(
    (async () => {
      try {
        await self.registration.showNotification(data.title || "Train Station", {
          body: data.body || "New message",
          icon: "/images/logo-icon.png",
          badge: "/images/logo-icon.png",
          tag: data.tag || "train-station-chat",
          renotify: true,
          requireInteraction: false,
          data: { url: data.url || "/member/chat" },
        });
      } catch (err) {
        // Last-resort empty notification so iOS still delivers something
        try {
          await self.registration.showNotification("Train Station", {
            body: "New message",
            tag: "train-station-chat-fallback",
          });
        } catch {
          /* ignore */
        }
      }
      await setBadge(unread);
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/member/chat";
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
              /* older engines */
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

self.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg.type === "SET_BADGE") {
    event.waitUntil(setBadge(msg.count || 0));
  }
  if (msg.type === "CLEAR_BADGE") {
    event.waitUntil(setBadge(0));
  }
  if (msg.type === "PING") {
    event.ports && event.ports[0] && event.ports[0].postMessage({ ok: true, version: SW_VERSION });
  }
});
