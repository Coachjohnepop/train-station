"use client";

import { useEffect, useRef } from "react";

/**
 * Once per mount: pull gate cookies into line with the DB profile.
 * Stops paid members from living behind a stale `ts_needs_payment` cookie.
 * If setup is still incomplete, send them to onboard (or checkout) instead of Today.
 */
export default function MemberGateCookieSync() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void (async () => {
      try {
        const res = await fetch("/api/member/sync-gates", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          needsOnboard?: boolean;
          needsPayment?: boolean;
          needsFreePm?: boolean;
          redirectTo?: string;
        };
        const here = window.location.pathname;
        const dest = data.redirectTo || "";
        if (!dest || dest === here || here.startsWith(dest.split("?")[0] || dest)) return;
        const allowedWhileGated =
          here.startsWith("/member/onboard") ||
          here.startsWith("/member/checkout") ||
          here.startsWith("/member/payment-setup") ||
          here.startsWith("/member/account") ||
          here.startsWith("/member/book") ||
          here.startsWith("/member/chat") ||
          here.startsWith("/member/speaking") ||
          here.startsWith("/member/quote-received");
        const mustMove = Boolean(data.needsOnboard || data.needsPayment || data.needsFreePm);
        if (mustMove && !allowedWhileGated) {
          window.location.replace(dest);
        }
      } catch {
        /* non-blocking */
      }
    })();
  }, []);

  return null;
}
