"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import HowItWorksScreen from "@/components/HowItWorksScreen";
import { markLandingConverted, trackLandingCustom } from "@/lib/landing-return-visit";
import type { HowItWorksStepId } from "@/lib/how-it-works";

type Path = "today" | "own" | "jeremy" | null;

const PROGRAM_PREVIEW: HowItWorksStepId[] = ["workout", "program"];

export default function LandingByowFork({
  open,
  initialPath = null,
  onLearn,
  onClose,
}: {
  open: boolean;
  initialPath?: Path;
  onLearn?: () => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [path, setPath] = useState<Path>(null);
  const [username, setUsername] = useState("");
  const [rawText, setRawText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [previewBeat, setPreviewBeat] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setPath(null);
      setError("");
      setPreviewBeat(0);
      return;
    }
    setPath(initialPath);
    setError("");
    setPreviewBeat(0);
  }, [open, initialPath]);

  if (!open || !mounted) return null;

  const showingJeremyPreview = path === "jeremy" && previewBeat < PROGRAM_PREVIEW.length;
  const showingJeremyName = path === "jeremy" && previewBeat >= PROGRAM_PREVIEW.length;
  const previewStep = PROGRAM_PREVIEW[previewBeat] ?? "workout";

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

  if (path === "jeremy") {
    return createPortal(
      <div
        className="landing-see-inside force-dark fixed inset-0 z-[100] flex flex-col bg-[#07040f]"
        data-force-dark
        role="dialog"
        aria-modal="true"
        aria-labelledby="byow-fork-title"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 px-3 pb-1 pt-[max(0.4rem,env(safe-area-inset-top))] sm:px-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--accent-fg)]">
              See the program
            </p>
            <h2 id="byow-fork-title" className="text-base font-semibold text-white sm:text-lg">
              {showingJeremyName
                ? "Like what you see?"
                : previewStep === "workout"
                  ? "Today on Jeremy’s board"
                  : "Adult is the home base"}
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
        <div className="relative flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
          {showingJeremyPreview ? (
            <div className="flex w-full max-w-lg flex-1 flex-col justify-center gap-4 py-3">
              <HowItWorksScreen
                stepId={previewStep}
                motion="animate"
                playKey={`program-${previewBeat}`}
              />
              <button
                type="button"
                data-analytics-action="b-program-next"
                className="inline-flex h-14 w-full items-center justify-center rounded-full bg-[#7c3aed] text-[17px] font-extrabold text-white"
                onClick={() => setPreviewBeat((n) => n + 1)}
              >
                Next
              </button>
            </div>
          ) : null}
          {showingJeremyName ? (
            <form
              className="mx-auto mt-6 w-full max-w-md space-y-3 rounded-[1.75rem] border border-white/15 bg-[#12081c]/92 p-5 sm:p-6"
              onSubmit={(e) => {
                e.preventDefault();
                void start();
              }}
            >
              <h2 className="text-xl font-semibold text-white sm:text-2xl">Like what you see?</h2>
              <p className="text-[15px] leading-relaxed text-white/80">
                Create a username and let’s begin.
              </p>
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
                No email yet. 7 days on the console.
              </p>
              {error ? <p className="text-center text-sm text-red-300">{error}</p> : null}
              <button
                type="submit"
                disabled={busy}
                data-analytics-action="b-jeremy-go"
                className="inline-flex h-14 w-full items-center justify-center rounded-full bg-[#7c3aed] text-[17px] font-extrabold text-white disabled:opacity-60"
              >
                {busy ? "Opening…" : "Let’s begin"}
              </button>
              <button
                type="button"
                className="w-full text-center text-xs text-white/50 underline"
                onClick={() => setPreviewBeat(PROGRAM_PREVIEW.length - 1)}
              >
                Back
              </button>
            </form>
          ) : null}
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      className="force-dark fixed inset-0 z-[100] flex items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
      data-force-dark
      role="dialog"
      aria-modal="true"
      aria-labelledby="byow-fork-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        aria-label="Close and see the page"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-[1.75rem] border border-white/15 bg-[#12081c]/92 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-md sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--accent-fg)]">
            The Train Station
          </p>
          <button
            type="button"
            className="min-h-10 shrink-0 rounded-full border border-white/20 bg-white/5 px-3 text-sm font-semibold text-white/90"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {!path || path === "today" ? (
          <div className="space-y-4">
            <h2 id="byow-fork-title" className="text-[1.65rem] font-semibold leading-tight tracking-tight text-white sm:text-3xl">
              I workout today
            </h2>
            <p className="text-[15px] leading-relaxed text-white/80 sm:text-base">
              Learn how The Train Station works, or upload the session you already have.
            </p>
            <button
              type="button"
              data-analytics-action="b-learn-station"
              className="inline-flex h-14 w-full items-center justify-center rounded-full bg-[#7c3aed] text-[17px] font-extrabold text-white"
              onClick={() => {
                trackLandingCustom("b-learn-station");
                onLearn?.();
              }}
            >
              Learn About The Train Station
            </button>
            <button
              type="button"
              data-analytics-action="b-fork-own"
              className="inline-flex h-12 w-full items-center justify-center rounded-full border border-white/25 text-[15px] font-bold text-white/90"
              onClick={() => {
                setPath("own");
                trackLandingCustom("b-fork-own");
              }}
            >
              Upload Your Own Workout
            </button>
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void start();
            }}
          >
            <h2 id="byow-fork-title" className="text-xl font-semibold text-white sm:text-2xl">
              Upload today’s workout
            </h2>
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
            <textarea
              required
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={"Today’s workout — one move per line, sets/reps under it.\n\nAir Squats\n3x10\nRomanian Dead Lift\n3x8"}
              className="min-h-40 w-full rounded-2xl border border-white/20 bg-white/10 p-3 text-sm text-white placeholder:text-white/35"
            />
            {error ? <p className="text-center text-sm text-red-300">{error}</p> : null}
            <button
              type="submit"
              disabled={busy}
              data-analytics-action="b-ingest"
              className="inline-flex h-14 w-full items-center justify-center rounded-full bg-[#7c3aed] text-[17px] font-extrabold text-white disabled:opacity-60"
            >
              {busy ? "Opening…" : "Upload"}
            </button>
            <button
              type="button"
              className="w-full text-center text-xs text-white/50 underline"
              onClick={() => setPath("today")}
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
