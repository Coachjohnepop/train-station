"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import EmailInput, { rememberEmail } from "@/components/EmailInput";
import PasswordInput from "@/components/PasswordInput";
import { offerSavePassword, offerSavePasswordFromForm } from "@/lib/browser-credentials";
import { useFormAutofillSync } from "@/hooks/useFormAutofillSync";
import { getLastEmail } from "@/lib/email-history";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "";
  const prefillEmail = searchParams.get("email") || "";
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useFormAutofillSync(formRef, ["username", "password"], (values) => {
    if (values.username) setEmail(values.username);
    if (values.password) setPassword(values.password);
  });

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
        setError(data.error || "Login failed");
        return;
      }
      rememberEmail(email);
      await offerSavePasswordFromForm(formRef.current);
      await offerSavePassword({ email: email.trim(), password });
      window.location.href = data.redirect || "/member";
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

        <form ref={formRef} onSubmit={handleSubmit} autoComplete="on" className="card space-y-4">
          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>
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
              autoComplete="current-password"
              required
              value={password}
              onChange={setPassword}
              placeholder="Set via forgot password if needed"
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