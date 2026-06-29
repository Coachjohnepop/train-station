"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const PREFER_DASHBOARD_KEY = "ts-admin-prefer-dashboard";

/** Phone coaches skip the desktop dashboard — land on Queue. */
export default function AdminMobileQueueRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 1279px)").matches) return;
    if (sessionStorage.getItem(PREFER_DASHBOARD_KEY) === "1") return;

    router.replace("/admin/queue");
  }, [router]);

  return null;
}