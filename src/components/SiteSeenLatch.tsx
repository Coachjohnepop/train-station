"use client";

import { useEffect } from "react";
import { armSiteSeenOnLeave, setSiteSeenCookie } from "@/lib/site-visit";

/** Marks this browser as having visited once they leave, or immediately if already established. */
export default function SiteSeenLatch({ established = false }: { established?: boolean }) {
  useEffect(() => {
    if (established) {
      setSiteSeenCookie();
      return;
    }
    return armSiteSeenOnLeave();
  }, [established]);
  return null;
}
