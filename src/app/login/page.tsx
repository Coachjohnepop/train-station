"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "";
  const prefillEmail = searchParams.get("email") || "";
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Remember the email across visits (never the password). A ?email= URL param
  // wins over the cached value.
  useEffect(() => {
    if (prefillEmail) return;
    try {
      const saved = localStorage.getItem("ts-login-email");
      if (saved) setEmail(saved);
    } catch {
      /* ignore */
    }
  }, [prefillEmail]);

  useEffect(() => {
    try {
      localStorage.setItem("ts-login-email", email);
    } catch {
      /* ignore */
    }
  }, [email]);

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
        const hint =
          email.trim().toLowerCase().includes("johnsteph") || email.trim().toLowerCase().includes("lemonvoice")
            ? " For John & Steph, use john@lemonvoice.com and leave the password blank."
            : "";
        setError((data.error || "Login failed") + hint);
        return;
      }
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

        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>
          )}

          <div>
            <label className="block text-xs text-[var(--muted)] mb-1">Email</label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@thetrainstation.co"
            />
          </div>

          <div>
            <label className="block text-xs text-[var(--muted)] mb-1">Password (optional for now)</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="Leave blank"
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
          For now, just enter your email and leave password blank. We&apos;ll add real passwords later.
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