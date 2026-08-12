"use client";

import { useEffect } from "react";
import { MEMBERS_SEEN_KEY } from "@/components/MembersNavBadge";

/** Clear purple new-signup badge when coach opens Members. */
export default function MembersSeenMarker() {
  useEffect(() => {
    try {
      localStorage.setItem(MEMBERS_SEEN_KEY, new Date().toISOString());
      window.dispatchEvent(new Event("members-badge-refresh"));
    } catch {
      /* ignore */
    }
  }, []);
  return null;
}
