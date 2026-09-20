"use client";

import { useState } from "react";
import { isGuestStubEmail } from "@/lib/byow-username";

export default function GuestSignUpButton({
  email,
  className = "",
}: {
  email?: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!isGuestStubEmail(email)) return null;

  async function save() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/byow/claim-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not save email.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Could not save email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        className={[
          "inline-flex min-h-11 items-center justify-center rounded-md px-2 py-1 text-xs font-semibold",
          "text-emerald-200 transition hover:bg-emerald-500/20 hover:text-emerald-50",
          className,
        ].join(" ")}
        onClick={() => setOpen((v) => !v)}
      >
        Sign Up
      </button>
      {open ? (
        <form
          className="absolute right-0 z-[80] mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-white/15 bg-[#12081c] p-3 shadow-xl"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <p className="text-xs font-semibold text-white">Get started with your email</p>
          <p className="mt-0.5 text-[11px] text-white/60">Username can wait.</p>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@email.com"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="mt-2 h-10 w-full rounded-full border border-white/20 bg-white/10 px-3 text-sm text-white"
          />
          {error ? <p className="mt-1 text-xs text-red-300">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-full bg-[#7c3aed] text-sm font-extrabold text-white disabled:opacity-60"
          >
            {busy ? "Saving…" : "Continue"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
