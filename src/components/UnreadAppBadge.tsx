"use client";

/**
 * Polls unread message count and:
 * 1) Sets the home-screen PWA badge (iOS 16.4+ / Android installed)
 * 2) Plays a short alert when the count increases (while app is open)
 * 3) Registers the service worker once for installability
 *
 * Note: badge/sound while the app is *closed* requires Web Push
 * (see PushAlertEnable + /public/sw.js).
 */

import { useEffect, useRef } from "react";
import { clearHomeScreenBadge, setHomeScreenBadge } from "@/lib/app-badge";
import { playMessageAlert } from "@/lib/play-message-alert";
import { ensureServiceWorker, setBadgeViaServiceWorker } from "@/lib/push-client";
// ensureServiceWorker pulls latest /sw.js?v=… so push handler is present when app is closed

type Props = {
  role: "coach" | "member";
  /** Poll interval ms when app is visible */
  intervalMs?: number;
};

export default function UnreadAppBadge({ role, intervalMs = 12_000 }: Props) {
  const lastCountRef = useRef<number | null>(null);
  const armedRef = useRef(false);

  useEffect(() => {
    // Arm sound after first user gesture (browser autoplay rules)
    const arm = () => {
      armedRef.current = true;
    };
    window.addEventListener("pointerdown", arm, { once: true, passive: true });
    window.addEventListener("keydown", arm, { once: true });

    let cancelled = false;
    let id: number | null = null;

    async function loadUnread() {
      try {
        const res = await fetch(`/api/chat/unread?role=${role}`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { unread?: number };
        const count = Math.max(0, Math.floor(Number(data.unread) || 0));

        await setHomeScreenBadge(count);
        void setBadgeViaServiceWorker(count);

        const prev = lastCountRef.current;
        lastCountRef.current = count;

        // First poll only seeds the baseline — no whistle on page load.
        if (prev != null && count > prev && armedRef.current) {
          void playMessageAlert();
        }
      } catch {
        /* offline / signed out */
      }
    }

    function schedule() {
      if (id != null) window.clearInterval(id);
      // Faster poll when visible; slower when hidden (phones throttle anyway)
      const ms =
        typeof document !== "undefined" && document.visibilityState === "hidden"
          ? Math.max(intervalMs, 45_000)
          : intervalMs;
      id = window.setInterval(() => void loadUnread(), ms);
    }

    void ensureServiceWorker();
    void loadUnread();
    schedule();

    function onRefresh() {
      void loadUnread();
    }
    function onVisibility() {
      if (document.visibilityState === "visible") {
        void loadUnread();
      }
      schedule();
    }
    function onFocus() {
      void loadUnread();
    }

    window.addEventListener("chat-unread-refresh", onRefresh);
    window.addEventListener("coach-chat-posted", onRefresh);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      if (id != null) window.clearInterval(id);
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
      window.removeEventListener("chat-unread-refresh", onRefresh);
      window.removeEventListener("coach-chat-posted", onRefresh);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [role, intervalMs]);

  return null;
}

/** Call when coach/member opens Messages so badge can refresh immediately after mark-read. */
export function refreshAppBadgeFromEvent(): void {
  window.dispatchEvent(new CustomEvent("chat-unread-refresh"));
}

export { clearHomeScreenBadge, setHomeScreenBadge };
