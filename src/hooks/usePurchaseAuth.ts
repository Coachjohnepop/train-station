"use client";

import { useEffect, useState } from "react";
import type { UserRole } from "@/lib/auth-session";
import type { PurchaseAuth } from "@/lib/member-purchase-path";

type PurchaseAuthState = PurchaseAuth & { ready: boolean };

export function usePurchaseAuth(initial?: PurchaseAuth): PurchaseAuthState {
  const [auth, setAuth] = useState<PurchaseAuthState>(() =>
    initial?.signedIn
      ? {
          signedIn: true,
          role: initial.role,
          email: initial.email,
          name: initial.name,
          ready: true,
        }
      : { signedIn: false, ready: !initial },
  );

  useEffect(() => {
    if (initial?.signedIn) return;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/session");
        if (!res.ok) {
          if (!cancelled) setAuth({ signedIn: false, ready: true });
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (data.signedIn && data.user?.role) {
          setAuth({
            signedIn: true,
            role: data.user.role as UserRole,
            email: typeof data.user.email === "string" ? data.user.email : undefined,
            name: typeof data.user.name === "string" ? data.user.name : undefined,
            ready: true,
          });
        } else {
          setAuth({ signedIn: false, ready: true });
        }
      } catch {
        if (!cancelled) setAuth({ signedIn: false, ready: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initial?.signedIn]);

  return auth;
}