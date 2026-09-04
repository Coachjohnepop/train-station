/**
 * Client helpers: enable Web Push for home-screen badge + phone alerts.
 * iOS only delivers when installed to Home Screen + permission from that app.
 */

/** Bump when public/sw.js changes so clients re-register. */
export const SW_SCRIPT = "/sw.js?v=4";

/** Permanent: user completed Enable alerts — never show the banner again. */
export const PUSH_ALERTS_ENABLED_KEY = "ts-push-alerts-enabled";

export function isPushAlertsPermanentlyEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PUSH_ALERTS_ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markPushAlertsPermanentlyEnabled(): void {
  try {
    window.localStorage.setItem(PUSH_ALERTS_ENABLED_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearPushAlertsPermanentlyEnabled(): void {
  try {
    window.localStorage.removeItem(PUSH_ALERTS_ENABLED_KEY);
  } catch {
    /* ignore */
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Phone alerts are for real phones (home-screen PWA / mobile Safari), not desktop
 * browser chrome. Matches PwaInstallHint (~900px) + touch-primary devices.
 */
export function isMobilePushSurface(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia("(max-width: 899px)").matches) return true;
    // iPad landscape can be wide but still a tablet
    if (window.matchMedia("(hover: none) and (pointer: coarse)").matches) return true;
  } catch {
    /* ignore */
  }
  return false;
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
    const reg = await navigator.serviceWorker.register(SW_SCRIPT, {
      scope: "/",
      updateViaCache: "none",
    });
    // Force check for newer SW (critical after deploys)
    try {
      await reg.update();
    } catch {
      /* ignore */
    }
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
 * Ask permission, (re)subscribe, and POST to our API.
 * Must be called from a user gesture on iOS.
 * @param forceResubscribe drop existing endpoint and create a fresh one
 */
export async function enablePushAlerts(opts?: {
  forceResubscribe?: boolean;
}): Promise<{ ok: boolean; error?: string; standalone?: boolean }> {
  if (!isPushSupported()) {
    return { ok: false, error: "This browser does not support push alerts." };
  }

  const standalone = isStandalonePwa();
  // iOS will accept subscribe in Safari sometimes, but closed-app delivery needs Home Screen.
  if (!standalone) {
    return {
      ok: false,
      standalone: false,
      error:
        "Open the Home Screen app (not Safari). iPhone: Share → Add to Home Screen, then open that icon and try again.",
    };
  }

  try {
    const keyRes = await fetch("/api/push/vapid-public-key", { cache: "no-store" });
    if (!keyRes.ok) {
      return { ok: false, error: "Push is not configured on the server yet.", standalone };
    }
    const { publicKey } = (await keyRes.json()) as { publicKey?: string };
    if (!publicKey) return { ok: false, error: "Missing VAPID public key.", standalone };

    const reg = await ensureServiceWorker();
    if (!reg) return { ok: false, error: "Could not register service worker.", standalone };

    // Wait briefly for active worker (iOS can be slow after update)
    if (!reg.active) {
      await new Promise((r) => setTimeout(r, 400));
    }

    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") {
      return {
        ok: false,
        standalone,
        error:
          permission === "denied"
            ? "Notifications blocked — Settings → Notifications → Train Station → Allow."
            : "Permission not granted.",
      };
    }

    let sub = await reg.pushManager.getSubscription();
    if (sub && opts?.forceResubscribe) {
      try {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
      } catch {
        /* ignore */
      }
      await sub.unsubscribe().catch(() => null);
      sub = null;
    }

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
      return { ok: false, error: "Invalid push subscription from browser.", standalone };
    }

    const save = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint,
        keys: { p256dh, auth },
        standalone: true,
      }),
    });
    if (!save.ok) {
      const data = await save.json().catch(() => ({}));
      return {
        ok: false,
        standalone,
        error: (data as { error?: string }).error || "Could not save subscription.",
      };
    }

    return { ok: true, standalone: true };
  } catch (e: unknown) {
    return {
      ok: false,
      standalone,
      error: e instanceof Error ? e.message : "Enable failed",
    };
  }
}

/** Ask server to push a test notification to this user’s devices. */
export async function sendTestPushAlert(): Promise<{ ok: boolean; error?: string; sent?: number }> {
  try {
    const res = await fetch("/api/push/test", { method: "POST", cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      sent?: number;
    };
    if (!res.ok) return { ok: false, error: data.error || "Test failed" };
    return { ok: true, sent: data.sent ?? 0 };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Test failed" };
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

export async function setBadgeViaServiceWorker(count: number): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({ type: "SET_BADGE", count });
  } catch {
    /* ignore */
  }
}
