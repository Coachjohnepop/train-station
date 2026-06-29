"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const PREFER_DASHBOARD_KEY = "ts-admin-prefer-dashboard";
const MOBILE_MAX = 1023;

/** On phone, land coaches on Queue when members need action (unless they chose Dashboard). */
export default function AdminMobileQueueRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia(`(max-width: ${MOBILE_MAX}px)`).matches) return;
    if (sessionStorage.getItem(PREFER_DASHBOARD_KEY) === "1") return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/admin/queue/count", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled && typeof data.count === "number" && data.count > 0) {
          router.replace("/admin/queue");
        }
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}