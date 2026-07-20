"use client";

/**
 * Polls unread message count and:
 * 1) Sets the home-screen PWA badge (iOS 16.4+ / Android installed)
 * 2) Plays a short alert when the count increases (while app is open)
 * 3) Registers the service worker once for installability
 */

import { useEffect, useRef } from "react";
import { clearHomeScreenBadge, setHomeScreenBadge } from "@/lib/app-badge";
import { playMessageAlert } from "@/lib/play-message-alert";

type Props = {
  role: "coach" | "member";
  /** Poll interval ms */
  intervalMs?: number;
};

export default function UnreadAppBadge({ role, intervalMs = 15_000 }: Props) {
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

    async function registerSw() {
      if (!("serviceWorker" in navigator)) return;
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch {
        /* ignore */
      }
    }

    async function loadUnread() {
      try {
        const res = await fetch(`/api/chat/unread?role=${role}`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { unread?: number };
        const count = Math.max(0, Math.floor(Number(data.unread) || 0));

        await setHomeScreenBadge(count);

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

    void registerSw();
    void loadUnread();
    const id = window.setInterval(() => void loadUnread(), intervalMs);

    function onRefresh() {
      void loadUnread();
    }
    window.addEventListener("chat-unread-refresh", onRefresh);
    window.addEventListener("coach-chat-posted", onRefresh);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
      window.removeEventListener("chat-unread-refresh", onRefresh);
      window.removeEventListener("coach-chat-posted", onRefresh);
    };
  }, [role, intervalMs]);

  // Clear badge when leaving the app tab entirely is handled by OS; when count hits 0 we clear.
  useEffect(() => {
    return () => {
      // Don't clear on unmount — next open should still show unread until read.
    };
  }, []);

  return null;
}

/** Call when coach/member opens Messages so badge can refresh immediately after mark-read. */
export function refreshAppBadgeFromEvent(): void {
  window.dispatchEvent(new CustomEvent("chat-unread-refresh"));
}

export { clearHomeScreenBadge, setHomeScreenBadge };
