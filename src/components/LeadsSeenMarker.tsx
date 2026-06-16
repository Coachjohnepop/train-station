"use client";

import { useEffect } from "react";
import { LEADS_SEEN_KEY } from "@/components/LeadsNavBadge";

/**
 * Marks leads as "seen" when the coach opens the Leads page: stamps now into
 * localStorage and pings the nav badge to recompute (clearing it).
 */
export default function LeadsSeenMarker() {
  useEffect(() => {
    try {
      localStorage.setItem(LEADS_SEEN_KEY, new Date().toISOString());
      window.dispatchEvent(new Event("leads-badge-refresh"));
    } catch {
      /* ignore */
    }
  }, []);
  return null;
}
