"use client";

import { useEffect, useState } from "react";
import { GUEST_SAVE_AFTER_DAYS, guestUseDayCount } from "@/lib/byow-username";

const SKIP_KEY = "ts-guest-username-skip";

export default function SaveGuestUsernamePrompt() {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [emphasis, setEmphasis] = useState(false);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const days = guestUseDayCount();
    setEmphasis(days >= GUEST_SAVE_AFTER_DAYS);
    setSkipped(sessionStorage.getItem(SKIP_KEY) === "1");
  }, []);

  async function save() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/byow/claim-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not save.");
        return;
      }
      sessionStorage.setItem(SKIP_KEY, "1");
      setSkipped(true);
      setOpen(false);
      setUsername("");
    } catch {
      setError("Could not save — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (skipped && !open) return null;

  return (
    <div className="space-y-2">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`inline-flex min-h-11 w-full items-center justify-center rounded-full px-6 text-sm font-extrabold sm:w-auto ${
            emphasis
              ? "bg-[#7c3aed] text-white"
              : "border border-white/20 bg-white/5 text-white"
          }`}
        >
          Want to save your work?
        </button>
      ) : (
        <form
          className="rounded-2xl border border-white/15 bg-[#12081c] p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <p className="text-sm font-semibold text-white">Want to save your work?</p>
          <p className="mt-1 text-xs text-white/70">Pick a username</p>
          <input
            required
            autoComplete="username"
            name="username"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-3 h-12 w-full rounded-full border border-white/20 bg-white/10 px-4 text-sm text-white placeholder:text-white/40"
          />
          {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-full bg-[#7c3aed] text-[15px] font-extrabold text-white disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            className="mt-2 w-full text-center text-xs text-white/50 underline"
            onClick={() => setOpen(false)}
          >
            Not now
          </button>
        </form>
      )}
    </div>
  );
}
