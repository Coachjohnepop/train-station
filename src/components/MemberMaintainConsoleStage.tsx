"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";

type Props = {
  /** Clear maintain and return to plain Today. */
  exitHref: string;
  workoutName: string;
  children: ReactNode;
};

/**
 * Maintain-only stage: fullscreen control + auto-enter on first engage.
 * Exit → normal Today (no maintain query).
 * Immersive uses a fixed shell (state-preserving — no portal remount).
 * Fullscreen API hides browser chrome when the platform allows (Chrome Android);
 * iOS Safari mainly gets the app-level immersive shell.
 */
export default function MemberMaintainConsoleStage({
  exitHref,
  workoutName,
  children,
}: Props) {
  const [immersive, setImmersive] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  /** After Shrink/Exit fullscreen once, don't auto re-enter this page load. */
  const suppressAutoFsRef = useRef(false);

  const tryBrowserFullscreen = useCallback(async (el: HTMLElement | null) => {
    if (!el) return;
    const anyEl = el as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
      requestFullscreen?: () => Promise<void>;
    };
    try {
      if (typeof anyEl.requestFullscreen === "function") {
        await anyEl.requestFullscreen();
      } else if (typeof anyEl.webkitRequestFullscreen === "function") {
        await anyEl.webkitRequestFullscreen();
      }
    } catch {
      /* policy / iOS */
    }
  }, []);

  const exitBrowserFullscreen = useCallback(() => {
    const doc = document as Document & {
      webkitExitFullscreen?: () => Promise<void> | void;
      exitFullscreen?: () => Promise<void>;
    };
    try {
      if (document.fullscreenElement && typeof doc.exitFullscreen === "function") {
        void doc.exitFullscreen();
      } else if (typeof doc.webkitExitFullscreen === "function") {
        void doc.webkitExitFullscreen();
      }
    } catch {
      /* ignore */
    }
  }, []);

  const enterImmersive = useCallback(() => {
    setImmersive(true);
    requestAnimationFrame(() => {
      void tryBrowserFullscreen(stageRef.current);
    });
  }, [tryBrowserFullscreen]);

  const shrinkImmersive = useCallback(() => {
    suppressAutoFsRef.current = true;
    setImmersive(false);
    exitBrowserFullscreen();
  }, [exitBrowserFullscreen]);

  useEffect(() => {
    if (!immersive) {
      document.body.classList.remove("maintain-immersive-open");
      return;
    }
    document.body.classList.add("maintain-immersive-open");
    // Nudge mobile browsers to collapse URL chrome when possible.
    try {
      window.scrollTo(0, 1);
    } catch {
      /* ignore */
    }
    return () => {
      document.body.classList.remove("maintain-immersive-open");
      exitBrowserFullscreen();
    };
  }, [immersive, exitBrowserFullscreen]);

  useEffect(() => {
    const onEngage = () => {
      if (suppressAutoFsRef.current) return;
      enterImmersive();
    };
    window.addEventListener("maintain-workout-engage", onEngage);
    return () => window.removeEventListener("maintain-workout-engage", onEngage);
  }, [enterImmersive]);

  return (
    <div
      ref={stageRef}
      className={
        immersive
          ? "maintain-immersive-root fixed inset-0 z-[200] flex flex-col bg-[var(--bg)] text-[var(--text)]"
          : "min-w-0 space-y-3"
      }
      style={
        immersive
          ? {
              paddingTop: "env(safe-area-inset-top)",
              paddingBottom: "env(safe-area-inset-bottom)",
            }
          : undefined
      }
    >
      {immersive ? (
        <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_94%,transparent)] px-3 py-2.5 backdrop-blur-md">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
              Quick maintain
            </p>
            <p className="truncate text-sm font-semibold">{workoutName}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={shrinkImmersive}
              className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--muted)]"
              title="Leave full screen, keep this workout open"
            >
              Shrink
            </button>
            <Link
              href={exitHref}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-[var(--bg)]"
              onClick={() => exitBrowserFullscreen()}
            >
              Exit
            </Link>
          </div>
        </header>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={enterImmersive}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--muted)] transition hover:border-accent/50 hover:text-accent"
            title="Full screen"
            aria-label="Enter full screen"
          >
            <FullscreenIcon />
            Full screen
          </button>
          <Link
            href={exitHref}
            className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--muted)] transition hover:border-accent/40 hover:text-accent"
          >
            Exit → Today
          </Link>
        </div>
      )}

      <div className={immersive ? "min-h-0 flex-1 overflow-y-auto overscroll-contain" : undefined}>
        {children}
      </div>
    </div>
  );
}

function FullscreenIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Fire once per page load from the workout console when the member starts working. */
export function notifyMaintainWorkoutEngage() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("maintain-workout-engage"));
}
