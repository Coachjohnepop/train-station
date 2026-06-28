"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import EmailInput, { rememberEmail } from "@/components/EmailInput";
import PasswordInput from "@/components/PasswordInput";
import { offerSavePassword, offerSavePasswordFromForm } from "@/lib/browser-credentials";
import { useFormAutofillSync } from "@/hooks/useFormAutofillSync";
import { getLastEmail } from "@/lib/email-history";
import QuickAuthLogin from "@/components/QuickAuthLogin";
import { ensureDeviceId } from "@/lib/quick-auth-client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "";
  const prefillEmail = searchParams.get("email") || "";
  const passwordUpdated = searchParams.get("passwordUpdated") === "1";
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [quickAuthAvailable, setQuickAuthAvailable] = useState(false);
  const [quickAuthResolved, setQuickAuthResolved] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!passwordUpdated) return;
    setPassword("");
    setError(null);
    setShowPasswordForm(false);
  }, [passwordUpdated]);

  useFormAutofillSync(formRef, ["username", "password"], (values) => {
    if (values.username) setEmail(values.username);
    if (values.password) setPassword(values.password);
  });

  useEffect(() => {
    void ensureDeviceId();
  }, []);

  useEffect(() => {
    setQuickAuthResolved(false);
    setQuickAuthAvailable(false);
  }, [email]);

  useEffect(() => {
    if (prefillEmail) return;
    let cancelled = false;
    const localLast = getLastEmail();
    if (localLast) setEmail(localLast);

    fetch("/api/auth/remembered-email", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { email?: string | null } | null) => {
        if (cancelled || !data?.email) return;
        setEmail(data.email!);
        rememberEmail(data.email!);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [prefillEmail]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, redirect }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "not_invited" && data.signupUrl) {
          router.push(data.signupUrl);
          return;
        }
        const baseError = data.error || "Login failed";
        setError(
          passwordUpdated && data.code === "invalid_credentials"
            ? `${baseError} — if you just reset your password, type it manually; your browser may still be filling the old one.`
            : baseError,
        );
        if (data.code === "no_password") setShowPasswordForm(true);
        return;
      }
      rememberEmail(email);
      await offerSavePasswordFromForm(formRef.current);
      await offerSavePassword({ email: email.trim(), password });

      const destination = data.redirect || "/member";
      try {
        const deviceId = await ensureDeviceId();
        const statusRes = await fetch("/api/auth/quick-auth/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ email: email.trim().toLowerCase(), deviceId }),
        });
        const status = (await statusRes.json().catch(() => ({}))) as { enabled?: boolean };
        if (!status.enabled) {
          window.location.href = `/setup-quick-auth?redirect=${encodeURIComponent(destination)}`;
          return;
        }
      } catch {
        /* fall through to destination */
      }
      window.location.href = destination;
    } catch {
      setError("Login failed — try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell-bg flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold tracking-tight text-[var(--accent)]">The Train Station</p>
          <h1 className="mt-4 text-2xl font-bold">Sign in</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Members and coaches — your messages, workouts, and schedule stay tied to your account.
          </p>
        </div>

        {passwordUpdated && (
          <p className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
            Password reset complete — sign in with your new password. Quick sign-in (PIN / Face ID)
            still works if you already set it up on this device. Your browser or keychain may ask to
            update the saved login.
          </p>
        )}

        {!showPasswordForm && email.trim() && (
          <>
            <QuickAuthLogin
              email={email}
              redirect={redirect}
              onUsePassword={() => setShowPasswordForm(true)}
              onAvailabilityChange={setQuickAuthAvailable}
              onStatusResolved={(enabled) => {
                setQuickAuthResolved(true);
                setQuickAuthAvailable(enabled);
              }}
            />
            {quickAuthResolved && quickAuthAvailable && (
              <p className="mt-3 text-center text-[10px] text-[var(--muted)]">
                PIN or Face ID not working?{" "}
                <button
                  type="button"
                  className="text-accent hover:underline"
                  onClick={() => setShowPasswordForm(true)}
                >
                  Sign in with password
                </button>
              </p>
            )}
          </>
        )}

        {!showPasswordForm && email.trim() && !quickAuthResolved && (
          <p className="card text-center text-sm text-[var(--muted)]">Checking quick sign-in…</p>
        )}

        {quickAuthResolved && !quickAuthAvailable && email.trim() && !showPasswordForm && (
          <p className="mb-3 text-center text-xs text-[var(--muted)]">
            No PIN on this device for {email.trim().toLowerCase()} yet — sign in with password once,
            then set up quick sign-in from your dashboard.
          </p>
        )}

        {showPasswordForm && quickAuthAvailable && (
          <button
            type="button"
            className="mb-3 w-full text-center text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
            onClick={() => setShowPasswordForm(false)}
          >
            Back to quick sign-in
          </button>
        )}

        {(showPasswordForm || (quickAuthResolved && !quickAuthAvailable) || !email.trim()) && (
        <form ref={formRef} onSubmit={handleSubmit} autoComplete="on" className="card space-y-4">
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200 space-y-2">
              <p>{error}</p>
              {error.includes("Forgot password") && (
                <p>
                  <Link href="/forgot-password" className="text-accent hover:underline">
                    Reset your password →
                  </Link>
                </p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="login-username" className="block text-xs text-[var(--muted)] mb-1">
              Email
            </label>
            <EmailInput
              id="login-username"
              name="username"
              autoComplete="username"
              required
              value={email}
              onChange={setEmail}
              placeholder="you@thetrainstation.co"
              prefillFromHistory={false}
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-xs text-[var(--muted)] mb-1">
              Password
            </label>
            <PasswordInput
              id="login-password"
              name="password"
              purpose={passwordUpdated ? "new" : "current"}
              required
              value={password}
              onChange={setPassword}
              placeholder={passwordUpdated ? "Type your new password" : "Set via forgot password if needed"}
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <p className="text-center text-xs">
            <Link href="/forgot-password" className="text-accent hover:underline">
              Forgot password?
            </Link>
          </p>

          <p className="text-center text-xs text-[var(--muted)]">
            New here?{" "}
            <Link href="/signup" className="text-accent hover:underline">
              Join the waitlist
            </Link>
          </p>
        </form>
        )}

        <p className="mt-6 text-center text-[10px] text-[var(--muted)]">
          First time or forgot your password?{" "}
          <Link href="/forgot-password" className="text-accent hover:underline">
            Reset it here
          </Link>{" "}
          — we&apos;ll email you a link.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="app-shell-bg min-h-screen flex items-center justify-center text-sm text-[var(--muted)]">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}