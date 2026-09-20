"use client";

import { useEffect, useState } from "react";
import {
  GUEST_SAVE_AFTER_STEPS,
  GUEST_STEP_EVENT,
} from "@/lib/byow-username";

const SKIP_KEY = "ts-guest-username-skip";

export default function SaveGuestUsernamePrompt() {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SKIP_KEY) === "1") return;
    let steps = Number(sessionStorage.getItem("ts-guest-steps") || "0") || 0;
    if (steps >= GUEST_SAVE_AFTER_STEPS) {
      setOpen(true);
      return;
    }
    const onStep = () => {
      if (sessionStorage.getItem(SKIP_KEY) === "1") return;
      steps += 1;
      sessionStorage.setItem("ts-guest-steps", String(steps));
      if (steps >= GUEST_SAVE_AFTER_STEPS) setOpen(true);
    };
    window.addEventListener(GUEST_STEP_EVENT, onStep);
    return () => window.removeEventListener(GUEST_STEP_EVENT, onStep);
  }, []);

  if (!open) return null;

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
      setOpen(false);
    } catch {
      setError("Could not save — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label="Not now"
        onClick={() => {
          sessionStorage.setItem(SKIP_KEY, "1");
          setOpen(false);
        }}
      />
      <div
        className="relative z-10 w-full max-w-md rounded-[1.75rem] border border-white/15 bg-[#12081c] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] sm:p-6"
        role="dialog"
        aria-labelledby="save-guest-title"
      >
        <h2 id="save-guest-title" className="text-xl font-semibold text-white sm:text-2xl">
          Want to save your work?
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-white/80">Pick a username</p>
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
          <button
            type="button"
            className="w-full text-center text-xs text-white/50 underline"
            onClick={() => {
              sessionStorage.setItem(SKIP_KEY, "1");
              setOpen(false);
            }}
          >
            Not now
          </button>
        </form>
      </div>
    </div>
  );
}
