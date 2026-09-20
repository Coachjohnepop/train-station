"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { markLandingConverted, trackLandingCustom } from "@/lib/landing-return-visit";

type Path = "own" | "jeremy" | null;

export default function LandingByowFork({
  open,
  initialPath = null,
  onClose,
}: {
  open: boolean;
  initialPath?: Path;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [path, setPath] = useState<Path>(null);
  const [username, setUsername] = useState("");
  const [rawText, setRawText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setPath(null);
      setError("");
      return;
    }
    setPath(initialPath);
    setError("");
  }, [open, initialPath]);

  if (!open || !mounted) return null;

  async function start() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/byow/guest-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          path,
          rawText: path === "own" ? rawText : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not start.");
        return;
      }
      markLandingConverted();
      trackLandingCustom(path === "own" ? "b-byow-ingest" : "b-jeremy-today");
      window.location.href = data.redirectTo || "/member/today";
    } catch {
      setError("Could not start — try again.");
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div
      className="landing-app-walk force-dark fixed inset-0 z-[100] flex flex-col bg-[#07040f]"
      data-force-dark
      role="dialog"
      aria-modal="true"
      aria-labelledby="byow-fork-title"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 pb-1 pt-[max(0.4rem,env(safe-area-inset-top))] sm:px-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--accent-fg)]">
            Get started
          </p>
          <h2 id="byow-fork-title" className="text-base font-semibold text-white sm:text-lg">
            {!path
              ? "Do you already have a workout?"
              : path === "own"
                ? "Your workout · our console"
                : "Jeremy’s board"}
          </h2>
        </div>
        <button
          type="button"
          className="min-h-11 rounded-full border border-white/20 bg-white/5 px-3 text-sm font-semibold text-white/90"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {!path ? (
          <>
            <p className="text-center text-sm text-white/70">
              Same Today, sets, and rest either way. You pick the content.
            </p>
            <button
              type="button"
              data-analytics-action="b-fork-own"
              className="inline-flex h-14 items-center justify-center rounded-full bg-[#7c3aed] text-[17px] font-extrabold text-white"
              onClick={() => {
                setPath("own");
                trackLandingCustom("b-fork-own");
              }}
            >
              Yes — I’ll paste mine
            </button>
            <button
              type="button"
              data-analytics-action="b-fork-jeremy"
              className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 text-[15px] font-bold text-white/90"
              onClick={() => {
                setPath("jeremy");
                trackLandingCustom("b-fork-jeremy");
              }}
            >
              No — use Jeremy’s Today
            </button>
          </>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void start();
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
            <p className="text-center text-[11px] text-white/50">
              No email yet. 7 days on the console. We’ll ask for email later for a weekly recap.
            </p>
            {path === "own" ? (
              <textarea
                required
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={"Today’s workout — one move per line, sets/reps under it.\n\nAir Squats\n3x10\nRomanian Dead Lift\n3x8"}
                className="min-h-40 w-full rounded-2xl border border-white/20 bg-white/10 p-3 text-sm text-white placeholder:text-white/35"
              />
            ) : (
              <p className="text-center text-sm text-white/70">
                We’ll put you on Jeremy’s Adult board — same checkoffs and rest timer.
              </p>
            )}
            {error ? <p className="text-center text-sm text-red-300">{error}</p> : null}
            <button
              type="submit"
              disabled={busy}
              data-analytics-action={path === "own" ? "b-ingest" : "b-jeremy-go"}
              className="inline-flex h-14 w-full items-center justify-center rounded-full bg-[#7c3aed] text-[17px] font-extrabold text-white disabled:opacity-60"
            >
              {busy ? "Opening…" : path === "own" ? "Ingest" : "Open Today"}
            </button>
            <button
              type="button"
              className="w-full text-center text-xs text-white/50 underline"
              onClick={() => setPath(null)}
            >
              Back
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
