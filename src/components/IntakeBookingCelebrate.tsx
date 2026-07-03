"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MemberScoreCelebrateDetail } from "@/lib/member-score-celebrate";
import { runConfetti } from "@/lib/workout-confetti";

type Phase = "idle" | "burst" | "fly" | "fade" | "done";

const FLY_MS = 850;
const FADE_MS = 2000;

function normalizeCelebrateDetail(raw: MemberScoreCelebrateDetail | undefined): MemberScoreCelebrateDetail | null {
  if (!raw || typeof raw.totalPoints !== "number") return null;
  const pointsEarned = typeof raw.pointsEarned === "number" ? raw.pointsEarned : 0;
  if (pointsEarned <= 0) return null;
  return {
    pointsEarned,
    totalPoints: raw.totalPoints,
    label: raw.label || "Points earned",
  };
}

export default function IntakeBookingCelebrate() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [detail, setDetail] = useState<MemberScoreCelebrateDetail | null>(null);
  const [flyStyle, setFlyStyle] = useState<React.CSSProperties>({});
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flyRef = useRef<HTMLDivElement>(null);
  const stopConfettiRef = useRef<(() => void) | null>(null);

  const cleanup = useCallback(() => {
    setPhase("done");
    window.setTimeout(() => {
      setPhase("idle");
      setDetail(null);
      setFlyStyle({});
    }, 50);
  }, []);

  const startFly = useCallback((payload: MemberScoreCelebrateDetail) => {
    const target = document.getElementById("member-nav-scores");
    const flyEl = flyRef.current;
    if (!target || !flyEl) {
      window.dispatchEvent(
        new CustomEvent("member-score-updated", { detail: { totalPoints: payload.totalPoints } }),
      );
      cleanup();
      return;
    }

    const from = flyEl.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const atScores = `translate(${dx}px, ${dy}px) scale(0.35)`;

    setFlyStyle({
      transform: "translate(0, 0) scale(1)",
      opacity: 1,
      transition: "none",
    });

    requestAnimationFrame(() => {
      setPhase("fly");
      setFlyStyle({
        transform: atScores,
        opacity: 0.85,
        transition: `transform ${FLY_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${FLY_MS}ms ease`,
      });
    });

    window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("member-score-updated", { detail: { totalPoints: payload.totalPoints } }),
      );
      setPhase("fade");
      setFlyStyle({
        transform: atScores,
        opacity: 0,
        transition: `opacity ${FADE_MS}ms ease`,
      });
    }, FLY_MS);

    window.setTimeout(() => {
      cleanup();
    }, FLY_MS + FADE_MS);
  }, [cleanup]);

  const runCelebrate = useCallback(
    (payload: MemberScoreCelebrateDetail) => {
      const normalized = normalizeCelebrateDetail(payload);
      if (!normalized) return;

      setDetail(normalized);
      setPhase("burst");
      setFlyStyle({});

      if (canvasRef.current) {
        stopConfettiRef.current?.();
        stopConfettiRef.current = runConfetti(canvasRef.current);
      }

      window.setTimeout(() => startFly(normalized), 1600);
    },
    [startFly],
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
      stopConfettiRef.current?.();
    };
  }, [runCelebrate]);

  if (phase === "idle" || !detail) return null;

  const earned = detail.pointsEarned;
  const headline = detail.label || "Points earned";

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[200]"
      aria-live="polite"
      aria-label={`You earned ${earned} points`}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {(phase === "burst" || phase === "fly" || phase === "fade") && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            ref={flyRef}
            className="intake-celebrate-points text-center"
            style={phase === "fly" || phase === "fade" ? flyStyle : undefined}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--ramp-gold-light)]">
              {headline}
            </p>
            <p className="mt-1 text-5xl font-black tabular-nums text-[var(--ramp-gold-light)] sm:text-6xl">
              +{earned}
            </p>
            <p className="mt-1 text-sm font-semibold text-white/90">points</p>
          </div>
        </div>
      )}
    </div>
  );
}