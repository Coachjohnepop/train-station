"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MemberScoreCelebrateDetail } from "@/lib/member-score-celebrate";
import { buzzScoreCelebrate, confettiOriginFromElement, runConfetti } from "@/lib/workout-confetti";

/** Grow phase: header-sized → near full-width 3D gold +points */
const GROW_MS = 1500;
/** Confetti streams from the gold number */
const BURST_MS = 2600;
const FLY_MS = 850;
const FADE_MS = 2000;

type Phase = "idle" | "grow" | "burst" | "fly" | "fade" | "done";

function normalizeCelebrateDetail(
  raw: MemberScoreCelebrateDetail | undefined,
): MemberScoreCelebrateDetail | null {
  if (!raw || typeof raw.totalPoints !== "number") return null;
  const pointsEarned = typeof raw.pointsEarned === "number" ? raw.pointsEarned : 0;
  if (pointsEarned <= 0 && raw.celebration !== "workout-complete") return null;
  return {
    pointsEarned,
    totalPoints: raw.totalPoints,
    label:
      raw.label ||
      (raw.celebration === "workout-complete" ? "Workout complete!" : "Points earned"),
    celebration: raw.celebration,
  };
}

export default function IntakeBookingCelebrate() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [detail, setDetail] = useState<MemberScoreCelebrateDetail | null>(null);
  const [flyStyle, setFlyStyle] = useState<React.CSSProperties>({});
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flyRef = useRef<HTMLDivElement>(null);
  const pointsRef = useRef<HTMLParagraphElement>(null);
  const stopFxRef = useRef<(() => void) | null>(null);
  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];
  }, []);

  const cleanup = useCallback(() => {
    clearTimers();
    stopFxRef.current?.();
    stopFxRef.current = null;
    setPhase("done");
    window.setTimeout(() => {
      setPhase("idle");
      setDetail(null);
      setFlyStyle({});
    }, 50);
  }, [clearTimers]);

  const startFly = useCallback(
    (payload: MemberScoreCelebrateDetail) => {
      const target = document.getElementById("member-nav-scores");
      const flyEl = flyRef.current;
      if (!target || !flyEl) {
        window.dispatchEvent(
          new CustomEvent("member-score-updated", {
            detail: { totalPoints: payload.totalPoints },
          }),
        );
        cleanup();
        return;
      }

      const from = flyEl.getBoundingClientRect();
      const to = target.getBoundingClientRect();
      const dx = to.left + to.width / 2 - (from.left + from.width / 2);
      const dy = to.top + to.height / 2 - (from.top + from.height / 2);
      const atScores = `translate(${dx}px, ${dy}px) scale(0.22)`;

      setFlyStyle({
        transform: "translate(0, 0) scale(1)",
        opacity: 1,
        transition: "none",
      });

      requestAnimationFrame(() => {
        setPhase("fly");
        setFlyStyle({
          transform: atScores,
          opacity: 0.9,
          transition: `transform ${FLY_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${FLY_MS}ms ease`,
        });
      });

      timersRef.current.push(
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("member-score-updated", {
              detail: { totalPoints: payload.totalPoints },
            }),
          );
          setPhase("fade");
          setFlyStyle({
            transform: atScores,
            opacity: 0,
            transition: `opacity ${FADE_MS}ms ease`,
          });
        }, FLY_MS),
      );

      timersRef.current.push(
        window.setTimeout(() => {
          cleanup();
        }, FLY_MS + FADE_MS),
      );
    },
    [cleanup],
  );

  const launchFxFromPoints = useCallback((_workoutComplete: boolean) => {
    const canvas = canvasRef.current;
    const originEl = pointsRef.current || flyRef.current;
    if (!canvas || !originEl) return;

    stopFxRef.current?.();
    const origin = confettiOriginFromElement(originEl);
    // Confetti streams out of the gold +points number (same canvas as overlay)
    stopFxRef.current = runConfetti(canvas, BURST_MS, origin);
  }, []);

  const runCelebrate = useCallback(
    (payload: MemberScoreCelebrateDetail) => {
      const normalized = normalizeCelebrateDetail(payload);
      if (!normalized) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        window.dispatchEvent(
          new CustomEvent("member-score-updated", {
            detail: { totalPoints: normalized.totalPoints },
          }),
        );
        return;
      }

      clearTimers();
      stopFxRef.current?.();
      setDetail(normalized);
      setPhase("grow");
      setFlyStyle({});
      buzzScoreCelebrate(
        normalized.celebration === "workout-complete" ? "workout-complete" : "standard",
      );

      // Confetti from the number once it has laid out and started growing
      timersRef.current.push(
        window.setTimeout(() => {
          setPhase("burst");
          requestAnimationFrame(() => {
            requestAnimationFrame(() => launchFxFromPoints(normalized.celebration === "workout-complete"));
          });
        }, 280),
      );

      // After grow + burst, fly the (now smaller) chip to Scores
      const delayBeforeFly = GROW_MS + Math.min(BURST_MS, 900);
      timersRef.current.push(
        window.setTimeout(() => startFly(normalized), delayBeforeFly),
      );
    },
    [clearTimers, launchFxFromPoints, startFly],
  );

  useEffect(() => {
    function onCelebrate(e: Event) {
      const custom = e as CustomEvent<MemberScoreCelebrateDetail>;
      runCelebrate(custom.detail);
    }

    window.addEventListener("member-score-celebrate", onCelebrate);
    window.addEventListener("intake-booking-celebrate", onCelebrate);
    return () => {
      window.removeEventListener("member-score-celebrate", onCelebrate);
      window.removeEventListener("intake-booking-celebrate", onCelebrate);
      clearTimers();
      stopFxRef.current?.();
    };
  }, [runCelebrate, clearTimers]);

  if (phase === "idle" || !detail) return null;

  const earned = detail.pointsEarned;
  const headline = detail.label || "Points earned";
  const isWorkoutComplete = detail.celebration === "workout-complete";
  const growing = phase === "grow" || phase === "burst";

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[200]"
      aria-live="polite"
      aria-label={earned > 0 ? `You earned ${earned} points` : "Workout complete"}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {(phase === "grow" ||
        phase === "burst" ||
        phase === "fly" ||
        phase === "fade") && (
        <div className="absolute inset-0 flex items-center justify-center px-3">
          <div
            ref={flyRef}
            className="intake-celebrate-points max-w-[100vw] text-center"
            style={phase === "fly" || phase === "fade" ? flyStyle : undefined}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--ramp-gold-light)] sm:text-xs">
              {headline}
            </p>
            {earned > 0 ? (
              <>
                <p
                  ref={pointsRef}
                  className={`score-points-3d mt-1 tabular-nums ${
                    growing ? "score-points-grow" : "score-points-settled"
                  }`}
                >
                  +{earned}
                </p>
                <p className="mt-1 text-sm font-semibold text-white/90 sm:text-base">
                  points
                </p>
              </>
            ) : isWorkoutComplete ? (
              <p className="mt-2 text-lg font-semibold text-white/90">
                All exercises done
              </p>
            ) : null}
            {isWorkoutComplete && earned > 0 ? (
              <p className="mt-2 text-xs font-medium text-white/75 sm:text-sm">
                Total: {detail.totalPoints} pts
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
