"use client";

import { Suspense, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PasswordInput from "@/components/PasswordInput";
import { offerSavePassword, offerSavePasswordFromForm } from "@/lib/browser-credentials";
import { useFormAutofillSync } from "@/hooks/useFormAutofillSync";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const formRef = useRef<HTMLFormElement>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useFormAutofillSync(formRef, ["password", "password-confirm"], (values) => {
    if (values.password) setPassword(values.password);
    if (values["password-confirm"]) setConfirmPassword(values["password-confirm"]);
  });

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
      const savedEmail = typeof data.email === "string" ? data.email : "";
      await offerSavePasswordFromForm(formRef.current);
      if (savedEmail) {
        await offerSavePassword({ email: savedEmail, password });
      }
      setDone(true);
      window.setTimeout(() => {
        window.location.href = data.redirectTo || "/login";
      }, 1200);
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
    <form ref={formRef} onSubmit={handleSubmit} autoComplete="on" className="card space-y-4">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200 space-y-2">
          <p>{error}</p>
          {error.includes("invalid or has expired") && (
            <p>
              <Link href="/forgot-password" className="text-accent hover:underline">
                Request a fresh reset link
              </Link>
            </p>
          )}
        </div>
      )}

      <div>
        <label htmlFor="reset-password" className="block text-xs text-[var(--muted)] mb-1">
          New password
        </label>
        <PasswordInput
          id="reset-password"
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          placeholder="At least 8 characters"
          minLength={8}
          required
        />
      </div>

      <div>
        <label htmlFor="reset-password-confirm" className="block text-xs text-[var(--muted)] mb-1">
          Confirm password
        </label>
        <PasswordInput
          id="reset-password-confirm"
          name="password-confirm"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="Repeat password"
          minLength={8}
          required
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