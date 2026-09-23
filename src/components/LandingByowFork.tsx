"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import HowItWorksScreen from "@/components/HowItWorksScreen";
import { markLandingConverted, trackLandingCustom } from "@/lib/landing-return-visit";
import {
  setBackgroundMusicOverlay,
  startThemeSongFromOnboardingPlay,
} from "@/lib/background-music-control";
import { unlockLandingMix } from "@/lib/landing-mix-audio";
import {
  defaultHowItWorks,
  howItWorksStepById,
  normalizeHowItWorks,
  type HowItWorksStepId,
} from "@/lib/how-it-works";
import { startHowItWorksVoice, stopHowItWorksVoice } from "@/lib/play-how-it-works-voice";

type Path = "today" | "own" | "jeremy" | null;

type OwnMove = { id: string; name: string; sets: string; reps: string };

function blankMove(): OwnMove {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: "", sets: "3", reps: "10" };
}

function movesToNotes(moves: OwnMove[]): string {
  const lines: string[] = [];
  for (const move of moves) {
    const name = move.name.trim();
    if (!name) continue;
    const sets = Math.min(20, Math.max(1, Number.parseInt(move.sets, 10) || 1));
    const reps = move.reps.trim() || "10";
    lines.push(name);
    lines.push(/^\d+$/.test(reps) ? `${sets}x${reps}` : Array.from({ length: sets }, () => reps).join(","));
  }
  return lines.join("\n");
}

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
  const [moves, setMoves] = useState<OwnMove[]>(() => [blankMove(), blankMove()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [previewBeat, setPreviewBeat] = useState(0);
  const [previewArmed, setPreviewArmed] = useState(false);
  const [howItWorks, setHowItWorks] = useState(defaultHowItWorks);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setPath(null);
      setError("");
      setPreviewBeat(0);
      setPreviewArmed(false);
      return;
    }
    setPath(initialPath);
    setError("");
    setPreviewBeat(0);
    setPreviewArmed(false);
  }, [open, initialPath]);

  useEffect(() => {
    if (!open || initialPath !== "jeremy") return;
    void fetch("/api/landing-media", { cache: "force-cache" })
      .then((res) => res.json())
      .then((body: { howItWorks?: unknown }) => {
        if (body.howItWorks) setHowItWorks(normalizeHowItWorks(body.howItWorks));
      })
      .catch(() => undefined);
  }, [open, initialPath]);

  useEffect(() => {
    if (!open) stopHowItWorksVoice();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (path === "jeremy" && previewArmed) return;
    setBackgroundMusicOverlay(true);
    return () => setBackgroundMusicOverlay(false);
  }, [open, path, previewArmed]);

  if (!open || !mounted) return null;

  const showingJeremyPreview = path === "jeremy" && previewBeat < PROGRAM_PREVIEW.length;
  const previewStep = PROGRAM_PREVIEW[previewBeat] ?? "workout";
  const lastPreview = previewBeat >= PROGRAM_PREVIEW.length - 1;

  async function start() {
    setBusy(true);
    setError("");
    const notes = path === "own" ? movesToNotes(moves) : "";
    if (path === "own" && !notes.trim()) {
      setError("Add an exercise name.");
      setBusy(false);
      return;
    }
    try {
      const res = await fetch("/api/byow/guest-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: path === "own" ? username : undefined,
          path,
          rawText: path === "own" ? notes : undefined,
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
              {previewStep === "workout" ? "Today on Your Board" : "Adult is the home base"}
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
                motion={previewArmed ? "animate" : "still"}
                playKey={`program-${previewBeat}-${previewArmed ? "go" : "wait"}`}
                voiceUrl={howItWorksStepById(howItWorks, previewStep).voice.audioUrl}
                voiceStartSec={howItWorksStepById(howItWorks, previewStep).voice.startSec}
                voiceEndSec={howItWorksStepById(howItWorks, previewStep).voice.endSec}
              />
              <button
                type="button"
                data-analytics-action={previewArmed ? "b-program-next" : "b-program-play"}
                className="inline-flex h-14 w-full items-center justify-center rounded-full bg-[#7c3aed] text-[17px] font-extrabold text-white"
                onClick={() => {
                  if (!previewArmed) {
                    unlockLandingMix();
                    startThemeSongFromOnboardingPlay();
                    startHowItWorksVoice(howItWorksStepById(howItWorks, previewStep));
                    setPreviewArmed(true);
                    return;
                  }
                  if (lastPreview) {
                    stopHowItWorksVoice();
                    void start();
                    return;
                  }
                  const nextBeat = previewBeat + 1;
                  setPreviewBeat(nextBeat);
                  const nextStep = PROGRAM_PREVIEW[nextBeat];
                  if (nextStep) startHowItWorksVoice(howItWorksStepById(howItWorks, nextStep));
                }}
                disabled={busy}
              >
                {busy ? "Opening…" : !previewArmed ? "How It Works" : lastPreview ? "Let’s begin" : "Next"}
              </button>
              {error ? <p className="text-center text-sm text-red-300">{error}</p> : null}
            </div>
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
              Track Your Current Workout
            </h2>
            <p className="text-[15px] leading-relaxed text-white/80 sm:text-base">
              Upload what you already do, or learn The Train Station Way.
            </p>
            <button
              type="button"
              data-analytics-action="b-fork-own"
              className="inline-flex h-14 w-full items-center justify-center rounded-full bg-[#7c3aed] text-[17px] font-extrabold text-white"
              onClick={() => {
                setPath("own");
                trackLandingCustom("b-fork-own");
              }}
            >
              Upload Your Own Workout
            </button>
            <button
              type="button"
              data-analytics-action="b-learn-station"
              className="inline-flex h-12 w-full items-center justify-center rounded-full border border-white/25 text-[15px] font-bold text-white/90"
              onClick={() => {
                trackLandingCustom("b-learn-station");
                onLearn?.();
              }}
            >
              Learn the Train Station Way
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
            <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
              {moves.map((move, index) => {
                const setCount = Math.min(20, Math.max(1, Number.parseInt(move.sets, 10) || 1));
                return (
                  <div key={move.id} className="rounded-xl border border-white/15 bg-black/25 p-3">
                    <input
                      value={move.name}
                      onChange={(e) =>
                        setMoves((rows) =>
                          rows.map((row) => (row.id === move.id ? { ...row, name: e.target.value } : row)),
                        )
                      }
                      placeholder={index === 0 ? "Air Squats" : "Exercise"}
                      aria-label={`Exercise ${index + 1}`}
                      className="h-10 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white placeholder:text-white/35"
                    />
                    <div className="member-exercise-spec mt-2 text-sm">
                      <div className="member-exercise-spec__scheme">
                        <div className="member-exercise-spec__row">
                          <span className="member-exercise-spec__label">Prescription</span>
                          <span className="member-exercise-spec__value font-medium">
                            {setCount} × {move.reps.trim() || "10"}
                          </span>
                        </div>
                      </div>
                      <div className="member-exercise-spec__sets">
                        <div className="member-set-row">
                          {Array.from({ length: setCount }, (_, setIndex) => (
                            <span
                              key={setIndex}
                              className="member-set-btn text-xs py-0.5"
                              aria-hidden
                            >
                              <span className="member-set-btn__num text-sm">{setIndex + 1}</span>
                              <span className="member-set-btn__label">Set</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-white/55">
                        Sets
                        <input
                          inputMode="numeric"
                          value={move.sets}
                          onChange={(e) =>
                            setMoves((rows) =>
                              rows.map((row) => (row.id === move.id ? { ...row, sets: e.target.value } : row)),
                            )
                          }
                          className="mt-1 h-9 w-16 rounded-lg border border-white/15 bg-white/10 px-2 text-sm font-semibold normal-case tracking-normal text-white"
                        />
                      </label>
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-white/55">
                        Reps
                        <input
                          value={move.reps}
                          onChange={(e) =>
                            setMoves((rows) =>
                              rows.map((row) => (row.id === move.id ? { ...row, reps: e.target.value } : row)),
                            )
                          }
                          className="mt-1 h-9 w-20 rounded-lg border border-white/15 bg-white/10 px-2 text-sm font-semibold normal-case tracking-normal text-white"
                        />
                      </label>
                      {moves.length > 1 ? (
                        <button
                          type="button"
                          className="ml-auto self-end text-xs font-semibold text-white/50"
                          onClick={() => setMoves((rows) => rows.filter((row) => row.id !== move.id))}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              className="text-sm font-semibold text-white/80"
              onClick={() => setMoves((rows) => [...rows, blankMove()])}
            >
              Add exercise
            </button>
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
