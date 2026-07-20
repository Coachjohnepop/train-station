/**
 * Client helpers: enable Web Push for home-screen badge + phone alerts.
 */

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    return reg;
  } catch {
    return null;
  }
}

export async function getPushPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Ask permission, subscribe, and POST to our API.
 * Must be called from a user gesture on iOS.
 */
export async function enablePushAlerts(): Promise<{ ok: boolean; error?: string }> {
  if (!isPushSupported()) {
    return { ok: false, error: "This browser does not support push alerts." };
  }

  try {
    const keyRes = await fetch("/api/push/vapid-public-key", { cache: "no-store" });
    if (!keyRes.ok) {
      return { ok: false, error: "Push is not configured on the server yet." };
    }
    const { publicKey } = (await keyRes.json()) as { publicKey?: string };
    if (!publicKey) return { ok: false, error: "Missing VAPID public key." };

    const reg = await ensureServiceWorker();
    if (!reg) return { ok: false, error: "Could not register service worker." };

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return {
        ok: false,
        error:
          permission === "denied"
            ? "Notifications blocked — enable them in system Settings for Train Station."
            : "Permission not granted.",
      };
    }

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }

    const json = sub.toJSON();
    const endpoint = json.endpoint;
    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;
    if (!endpoint || !p256dh || !auth) {
      return { ok: false, error: "Invalid push subscription from browser." };
    }

    const save = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint, keys: { p256dh, auth } }),
    });
    if (!save.ok) {
      const data = await save.json().catch(() => ({}));
      return { ok: false, error: (data as { error?: string }).error || "Could not save subscription." };
    }

    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Enable failed" };
  }
}

export async function disablePushAlerts(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      }).catch(() => null);
      await sub.unsubscribe().catch(() => null);
    }
  } catch {
    /* ignore */
  }
}

/** Ask SW to set badge (helps some engines when page setAppBadge is flaky). */
export async function setBadgeViaServiceWorker(count: number): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({ type: "SET_BADGE", count });
  } catch {
    /* ignore */
  }
}
