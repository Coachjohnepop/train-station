"use client";

import { useEffect, useState } from "react";
import { GUEST_SAVE_AFTER_DAYS, guestUseDayCount } from "@/lib/byow-username";

const SKIP_KEY = "ts-guest-username-skip";

export default function SaveGuestUsernamePrompt() {
  const [mode, setMode] = useState<"hidden" | "banner" | "modal" | "form">("hidden");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const days = guestUseDayCount();
    const skipped = sessionStorage.getItem(SKIP_KEY) === "1";
    if (days >= GUEST_SAVE_AFTER_DAYS && !skipped) setMode("modal");
    else setMode("banner");
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
      setMode("hidden");
    } catch {
      setError("Could not save — try again.");
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    sessionStorage.setItem(SKIP_KEY, "1");
    setMode("banner");
  }

  if (mode === "hidden") return null;

  const form = (
    <form
      className="mt-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <input
        required
        autoComplete="username"
        name="username"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="h-12 w-full rounded-full border border-white/20 bg-white/10 px-4 text-sm text-white placeholder:text-white/40"
      />
      {error ? <p className="text-center text-sm text-red-300">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-14 w-full items-center justify-center rounded-full bg-[#7c3aed] text-[17px] font-extrabold text-white disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save"}
      </button>
    </form>
  );

  if (mode === "banner") {
    return (
      <div className="rounded-2xl border border-white/15 bg-[#12081c] px-4 py-3">
        {username || error ? (
          <>
            <p className="text-sm font-semibold text-white">Want to save your work?</p>
            <p className="text-xs text-white/70">Pick a username — whenever you’re ready.</p>
            {form}
          </>
        ) : (
          <button
            type="button"
            className="w-full text-left"
            onClick={() => setMode("form")}
          >
            <p className="text-sm font-semibold text-white">Want to save your work?</p>
            <p className="text-xs text-white/70">Pick a username anytime — no rush.</p>
          </button>
        )}
      </div>
    );
  }

  if (mode === "form") {
    return (
      <div className="rounded-2xl border border-white/15 bg-[#12081c] px-4 py-3">
        <p className="text-sm font-semibold text-white">Want to save your work?</p>
        <p className="text-xs text-white/70">Pick a username</p>
        {form}
        <button
          type="button"
          className="mt-2 w-full text-center text-xs text-white/50 underline"
          onClick={() => setMode("banner")}
        >
          Not now
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55" />
      <div
        className="relative z-10 w-full max-w-md rounded-[1.75rem] border border-white/15 bg-[#12081c] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] sm:p-6"
        role="dialog"
        aria-labelledby="save-guest-title"
      >
        <h2 id="save-guest-title" className="text-xl font-semibold text-white sm:text-2xl">
          Want to save your work?
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-white/80">Pick a username</p>
        {form}
        <button
          type="button"
          className="mt-3 w-full text-center text-xs text-white/50 underline"
          onClick={dismiss}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
