"use client";

import { useState } from "react";
import Link from "next/link";

export default function PublicMeasurementsPage() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/measurements/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          phone: phone.trim() || undefined,
          name: name.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.exists && data.redirectTo) {
        window.location.href = data.redirectTo;
        return;
      }
      if (!res.ok) {
        setError(data.error || "Could not start.");
        return;
      }
      window.location.href = data.redirectTo || "/member/measurements/enter";
    } catch {
      setError("Could not start — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center gap-5 px-4 py-10">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Free</p>
        <h1 className="mt-1 text-2xl font-semibold">Body measurements</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Track weight and tape for free. Email required so we can send your sheet and later
          invites. Phone is optional.
        </p>
      </div>
      <form onSubmit={(e) => void start(e)} className="space-y-3">
        <input
          className="h-12 w-full rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm"
          placeholder="Name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="email"
          required
          autoComplete="email"
          className="h-12 w-full rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="tel"
          autoComplete="tel"
          className="h-12 w-full rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm"
          placeholder="Phone (optional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[#7c3aed] text-sm font-extrabold text-white disabled:opacity-60"
        >
          {busy ? "Opening…" : "Open my sheet"}
        </button>
      </form>
      <p className="text-center text-xs text-[var(--muted)]">
        Already a member?{" "}
        <Link href="/login?redirect=/member/measurements/enter" className="text-accent underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
