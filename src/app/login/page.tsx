"use client";

import { useState, useEffect, useRef, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import EmailInput, { rememberEmail } from "@/components/EmailInput";
import PasswordInput from "@/components/PasswordInput";
import { offerSavePassword, offerSavePasswordFromForm } from "@/lib/browser-credentials";
import { useFormAutofillSync } from "@/hooks/useFormAutofillSync";
import { clearRememberedEmail, getLastEmail } from "@/lib/email-history";
import OAuthButtons from "@/components/OAuthButtons";
import QuickAuthLogin from "@/components/QuickAuthLogin";
import {
  clearQuickAuthMeta,
  ensureDeviceId,
  hasSkippedQuickAuthSetup,
  quickAuthMetaForEmail,
} from "@/lib/quick-auth-client";

function isCompleteEmail(value: string): boolean {
  const trimmed = value.trim();
  const at = trimmed.indexOf("@");
  return at > 0 && at < trimmed.length - 1 && trimmed.includes(".");
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "";
  const prefillEmail = searchParams.get("email") || "";
  const switchAccount = searchParams.get("switch") === "1";
  const passwordUpdated = searchParams.get("passwordUpdated") === "1";
  const oauthError = searchParams.get("oauthError");
  const coachLogin = redirect.startsWith("/admin");

  const [email, setEmail] = useState(() => {
    if (switchAccount) return "";
    return prefillEmail;
  });
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(passwordUpdated);
  const [quickAuthAvailable, setQuickAuthAvailable] = useState(false);
  const [quickAuthResolved, setQuickAuthResolved] = useState(false);
  const emailTouchedRef = useRef(switchAccount || Boolean(prefillEmail));
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!passwordUpdated) return;
    setPassword("");
    setError(null);
    setShowPasswordForm(true);
  }, [passwordUpdated]);

  useFormAutofillSync(formRef, ["password"], (values) => {
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
    if (!isCompleteEmail(email) || passwordUpdated) return;
    if (quickAuthMetaForEmail(email)) {
      setShowPasswordForm(false);
    }
  }, [email, passwordUpdated]);

  useEffect(() => {
    if (prefillEmail || switchAccount || emailTouchedRef.current) return;
    let cancelled = false;
    const localLast = getLastEmail();
    if (localLast) setEmail(localLast);

    fetch("/api/auth/remembered-email", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { email?: string | null } | null) => {
        if (cancelled || emailTouchedRef.current || !data?.email) return;
        setEmail(data.email!);
        rememberEmail(data.email!);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [prefillEmail, switchAccount]);

  const switchToDifferentAccount = useCallback(() => {
    emailTouchedRef.current = true;
    setEmail("");
    setPassword("");
    setError(null);
    setShowPasswordForm(true);
    setQuickAuthResolved(false);
    setQuickAuthAvailable(false);
    clearQuickAuthMeta();
    clearRememberedEmail();
    void fetch("/api/auth/remembered-email", { method: "DELETE" });
  }, []);

  function handleEmailChange(next: string) {
    emailTouchedRef.current = true;
    setEmail(next);
    setError(null);
    if (isCompleteEmail(next)) {
      setShowPasswordForm(false);
      return;
    }
  }

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

      const destination = data.redirect || "/member/today";
      const skipQuickAuthSetup =
        destination.includes("/member/onboard") || destination.includes("/member/checkout");
      if (!skipQuickAuthSetup) {
        try {
          const deviceId = await ensureDeviceId();
          const statusRes = await fetch("/api/auth/quick-auth/status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ email: email.trim().toLowerCase(), deviceId }),
          });
          const status = (await statusRes.json().catch(() => ({}))) as { enabled?: boolean };
          if (!status.enabled && !hasSkippedQuickAuthSetup()) {
            window.location.href = `/setup-quick-auth?redirect=${encodeURIComponent(destination)}`;
            return;
          }
        } catch {
          /* fall through to destination */
        }
      }
      window.location.href = destination;
    } catch {
      setError("Login failed — try again");
    } finally {
      setLoading(false);
    }
  }

  const showQuickAuth = !showPasswordForm && isCompleteEmail(email);
  const showPassword =
    showPasswordForm ||
    (quickAuthResolved && !quickAuthAvailable && isCompleteEmail(email));

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

        {switchAccount && (
          <p className="mb-4 rounded-lg border border-[#7c3aed]/30 bg-[#7c3aed]/10 px-3 py-2 text-sm text-[#c4b5fd]">
            Signed out — enter the email for the account you want, or pick one from your history.
          </p>
        )}

        {passwordUpdated && (
          <p className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
            Password reset complete — sign in with your new password. Quick sign-in (PIN / Face ID)
            still works if you already set it up on this device.
          </p>
        )}

        {oauthError && (
          <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {oauthError === "missing_email"
              ? "Social sign-in did not share an email — try another provider or use email and password."
              : oauthError === "invalid_state"
                ? "Sign-in timed out — please try again."
                : "Social sign-in failed — try again or use email and password."}
          </p>
        )}

        {!coachLogin && (
          <>
            <OAuthButtons mode="login" redirect={redirect} className="mb-4" />
            <p className="mb-4 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              or sign in with email
            </p>
          </>
        )}

        <div className="card mb-4 space-y-3">
          <div>
            <label htmlFor="login-username" className="mb-1 block text-xs text-[var(--muted)]">
              Email
            </label>
            <EmailInput
              id="login-username"
              name="username"
              autoComplete="username"
              required
              value={email}
              onChange={handleEmailChange}
              placeholder="you@thetrainstation.co"
              prefillFromHistory={!prefillEmail}
            />
          </div>
          {email.trim() && (
            <button
              type="button"
              className="text-xs text-accent hover:underline"
              onClick={switchToDifferentAccount}
            >
              Use a different account
            </button>
          )}
        </div>

        {showQuickAuth && (
          <>
            <QuickAuthLogin
              email={email}
              redirect={redirect}
              onUsePassword={() => setShowPasswordForm(true)}
              onSwitchAccount={switchToDifferentAccount}
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

        {showQuickAuth && !quickAuthResolved && (
          <p className="card text-center text-sm text-[var(--muted)]">Checking quick sign-in…</p>
        )}

        {quickAuthResolved && !quickAuthAvailable && isCompleteEmail(email) && !showPasswordForm && (
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
            Back to PIN / Face ID
          </button>
        )}

        {showPassword && (
          <form ref={formRef} onSubmit={handleSubmit} autoComplete="on" className="card space-y-4">
            {error && (
              <div className="space-y-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
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
              <label htmlFor="login-password" className="mb-1 block text-xs text-[var(--muted)]">
                Password
              </label>
              <PasswordInput
                id="login-password"
                name="password"
                purpose={passwordUpdated ? "new" : "current"}
                required
                value={password}
                onChange={setPassword}
                placeholder={passwordUpdated ? "Type your new password" : "Your password"}
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

        {!isCompleteEmail(email) && !email.trim() && (
          <p className="mt-4 text-center text-xs text-[var(--muted)]">
            Enter your email to continue — PIN, Face ID, or password.
          </p>
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
    <Suspense
      fallback={
        <div className="app-shell-bg flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}