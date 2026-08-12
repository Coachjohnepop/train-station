"use client";

import { useEffect, useRef } from "react";

/**
 * Once per mount: pull gate cookies into line with the DB profile.
 * Stops paid members from living behind a stale `ts_needs_payment` cookie.
 */
export default function MemberGateCookieSync() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void fetch("/api/member/sync-gates", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
    }).catch(() => {
      /* non-blocking */
    });
  }, []);

  return null;
}
