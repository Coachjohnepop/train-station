"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import QuickAuthSetupPrompt from "@/components/QuickAuthSetupPrompt";
import {
  hasSkippedQuickAuthSetup,
  markQuickAuthSetupSkipped,
  useQuickAuthDeviceId,
} from "@/lib/quick-auth-client";

export default function SetupQuickAuthClient({
  email,
  redirectTo,
}: {
  email: string;
  redirectTo: string;
}) {
  const router = useRouter();
  const { deviceId, ready } = useQuickAuthDeviceId();
  const [checking, setChecking] = useState(true);

  function skipSetup() {
    markQuickAuthSetupSkipped();
    router.push(redirectTo);
    router.refresh();
  }

  useEffect(() => {
    if (!ready) return;
    if (hasSkippedQuickAuthSetup()) {
      router.replace(redirectTo);
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
        if (cancelled) return;
        const enabled = Boolean(data?.enabled || data?.pin || data?.webauthn);
        if (enabled) {
          router.replace(redirectTo);
          return;
        }
        setChecking(false);
      })
      .catch(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, email, deviceId, redirectTo, router]);

  if (checking) {
    return <p className="text-center text-sm text-[var(--muted)]">Checking quick sign-in…</p>;
  }

  return (
    <>
      <QuickAuthSetupPrompt
        email={email}
        onContinue={() => {
          router.push(redirectTo);
          router.refresh();
        }}
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