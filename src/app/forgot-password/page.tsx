"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import EmailInput, { rememberEmail } from "@/components/EmailInput";
import { getLastEmail } from "@/lib/email-history";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [emailed, setEmailed] = useState<boolean | null>(null);

  useEffect(() => {
    const localLast = getLastEmail();
    if (localLast) setEmail(localLast);

    fetch("/api/auth/remembered-email", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { email?: string | null } | null) => {
        if (data?.email) {
          setEmail(data.email);
          rememberEmail(data.email);
        }
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    setEmailed(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong — try again.");
        return;
      }
      rememberEmail(email);
      setEmailed(Boolean(data.emailed));
      setMessage(
        data.message ||
          "If that email is on file, we sent a link to reset your password. Check your inbox (and spam).",
      );
    } catch {
      setError("Something went wrong — try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell-bg flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold tracking-tight text-[var(--accent)]">The Train Station</p>
          <h1 className="mt-4 text-2xl font-bold">Forgot password</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Enter your email and we&apos;ll send a link to set a new password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}
          {message && (
            <div
              className={`space-y-2 rounded-lg border px-3 py-2 text-sm ${
                emailed
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-100"
              }`}
            >
              <p>{message}</p>
              {emailed && email.toLowerCase().includes("@yahoo.") && (
                <p className="text-xs opacity-90">
                  Yahoo often filters new senders — check Spam, Bulk, or the Archive folder too.
                </p>
              )}
              {!emailed && message.includes("couldn't send") && (
                <p className="text-xs opacity-90">
                  Our email provider may need a moment — wait a minute and try again, or sign in with your
                  password if you remember it.
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs text-[var(--muted)] mb-1">Email</label>
            <EmailInput
              required
              value={email}
              onChange={setEmail}
              placeholder="you@thetrainstation.co"
              prefillFromHistory
            />
          </div>

          <button type="submit" disabled={loading || Boolean(message)} className="btn-primary w-full">
            {loading ? "Sending…" : message ? "Email sent" : "Send reset link"}
          </button>
        </form>

        <div className="mt-6 flex flex-col items-center gap-3 text-sm">
          <Link href="/login" className="text-accent hover:underline">
            Back to sign in
          </Link>
          <Link href="/" className="text-[var(--muted)] hover:text-accent transition">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}