"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("This reset link is missing or invalid. Request a new one.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Reset failed — try again or request a new link.");
        return;
      }
      setDone(true);
      setTimeout(() => router.push(data.redirectTo || "/login"), 1500);
    } catch {
      setError("Reset failed — try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="card space-y-4 text-sm text-[var(--muted)]">
        <p>This reset link is invalid. Request a new one from the forgot password page.</p>
        <Link href="/forgot-password" className="text-accent hover:underline">
          Request reset link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="card text-sm text-emerald-100">
        Password updated. Redirecting you to sign in…
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <div>
        <label className="block text-xs text-[var(--muted)] mb-1">New password</label>
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
          placeholder="At least 8 characters"
        />
      </div>

      <div>
        <label className="block text-xs text-[var(--muted)] mb-1">Confirm password</label>
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="input"
          placeholder="Repeat password"
        />
      </div>

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="app-shell-bg flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold tracking-tight text-[var(--accent)]">The Train Station</p>
          <h1 className="mt-4 text-2xl font-bold">Set a new password</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Choose a password you&apos;ll use to sign in from now on.
          </p>
        </div>

        <Suspense
          fallback={
            <div className="card text-sm text-[var(--muted)]">Loading…</div>
          }
        >
          <ResetPasswordForm />
        </Suspense>

        <div className="mt-6 text-center text-sm">
          <Link href="/login" className="text-accent hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}