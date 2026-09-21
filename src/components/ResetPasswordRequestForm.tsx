"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import EmailInput, { rememberEmail } from "@/components/EmailInput";
import { getLastEmail } from "@/lib/email-history";

export default function ResetPasswordRequestForm({
  initialEmail = "",
}: {
  initialEmail?: string;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [emailed, setEmailed] = useState<boolean | null>(null);

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
      return;
    }
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
  }, [initialEmail]);

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
          "If that email is on file, we sent a link to set a new password. Check your inbox (and spam).",
      );
    } catch {
      setError("Something went wrong — try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}
      {message && (
        <div
          className={`space-y-2 rounded-lg border px-3 py-2 text-sm ${
            emailed
              ? "border-emerald-500/30 bg-emerald-500/10 text-[var(--success)]"
              : message.includes("couldn't send")
                ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
                : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--foreground)]"
          }`}
        >
          <p>{message}</p>
          {emailed && (
            <p className="text-xs text-[var(--muted)]">
              New senders often land in spam the first time — check junk and mark &ldquo;Not
              spam&rdquo; so Train Station mail reaches your inbox.
            </p>
          )}
          {!emailed && message.includes("couldn't send") && (
            <p className="text-xs text-[var(--muted)]">
              Our email provider may need a moment — wait a minute and try again.
            </p>
          )}
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">Email</label>
        <EmailInput
          required
          value={email}
          onChange={setEmail}
          placeholder="you@thetrainstation.co"
          prefillFromHistory={!initialEmail}
        />
      </div>

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Sending…" : emailed ? "Send again" : message ? "Try again" : "Email me a reset link"}
      </button>

      <p className="text-center text-xs text-[var(--muted)]">
        Remembered it?{" "}
        <Link href="/login" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
