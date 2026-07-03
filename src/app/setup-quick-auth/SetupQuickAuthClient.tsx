"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import QuickAuthSetupPrompt from "@/components/QuickAuthSetupPrompt";
import {
  hasSkippedQuickAuthSetup,
  markQuickAuthSetupSkipped,
  useQuickAuthDeviceId,
} from "@/lib/quick-auth-client";

function goToDestination(path: string) {
  window.location.replace(path);
}

export default function SetupQuickAuthClient({
  email,
  redirectTo,
}: {
  email: string;
  redirectTo: string;
}) {
  const { deviceId, ready } = useQuickAuthDeviceId();
  const [checking, setChecking] = useState(true);
  const leavingRef = useRef(false);

  function leaveSetup() {
    if (leavingRef.current) return;
    leavingRef.current = true;
    goToDestination(redirectTo);
  }

  function skipSetup() {
    markQuickAuthSetupSkipped();
    leaveSetup();
  }

  useEffect(() => {
    if (!ready) return;
    if (hasSkippedQuickAuthSetup()) {
      leaveSetup();
      return;
    }

    let cancelled = false;
    void fetch("/api/auth/quick-auth/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ email: email.trim().toLowerCase(), deviceId }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { enabled?: boolean; pin?: boolean; webauthn?: boolean } | null) => {
        if (cancelled || leavingRef.current) return;
        const enabled = Boolean(data?.enabled || data?.pin || data?.webauthn);
        if (enabled) {
          leaveSetup();
          return;
        }
        setChecking(false);
      })
      .catch(() => {
        if (!cancelled && !leavingRef.current) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ready, email, deviceId, redirectTo]);

  if (checking) {
    return <p className="text-center text-sm text-[var(--muted)]">Checking quick sign-in…</p>;
  }

  return (
    <>
      <QuickAuthSetupPrompt
        email={email}
        onContinue={leaveSetup}
        onReady={leaveSetup}
      />
      <p className="mt-6 text-center text-sm">
        <button type="button" onClick={skipSetup} className="text-accent hover:underline">
          Skip for now →
        </button>
        {" · "}
        <Link href={redirectTo} className="text-[var(--muted)] hover:underline">
          Go without saving
        </Link>
      </p>
    </>
  );
}