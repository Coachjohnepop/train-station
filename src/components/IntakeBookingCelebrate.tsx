"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GAMIFICATION_POINTS } from "@/lib/gamification-types";

export type IntakeCelebrateDetail = {
  pointsEarned?: number;
  totalPoints: number;
};

type Phase = "idle" | "burst" | "fly" | "fade" | "done";

const FLY_MS = 850;
const FADE_MS = 2000;

function runConfetti(canvas: HTMLCanvasElement, durationMs = 2200) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.scale(dpr, dpr);

  const colors = ["#d4af37", "#fde68a", "#f0c75e", "#7c3aed", "#c4b5fd", "#4ade9a", "#f472b6"];
  const particles = Array.from({ length: 140 }, () => ({
    x: window.innerWidth / 2 + (Math.random() - 0.5) * 80,
    y: window.innerHeight / 2 + (Math.random() - 0.5) * 40,
    vx: (Math.random() - 0.5) * 14,
    vy: Math.random() * -12 - 4,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    size: Math.random() * 7 + 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    shape: Math.random() > 0.5 ? "rect" : "circle",
  }));

  const start = performance.now();
  let raf = 0;

  function frame(now: number) {
    if (!ctx) return;
    const elapsed = now - start;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.22;
      p.rot += p.vr;
      const alpha = Math.max(0, 1 - elapsed / durationMs);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.shape === "rect") {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.globalAlpha = 1;
    if (elapsed < durationMs) {
      raf = requestAnimationFrame(frame);
    }
  }

  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}

export default function IntakeBookingCelebrate() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [detail, setDetail] = useState<IntakeCelebrateDetail | null>(null);
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

  const startFly = useCallback((payload: IntakeCelebrateDetail) => {
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

  useEffect(() => {
    function onCelebrate(e: Event) {
      const custom = e as CustomEvent<IntakeCelebrateDetail>;
      const payload = custom.detail;
      if (!payload) return;

      setDetail({
        pointsEarned: payload.pointsEarned ?? GAMIFICATION_POINTS.intake_scheduled,
        totalPoints: payload.totalPoints,
      });
      setPhase("burst");
      setFlyStyle({});

      if (canvasRef.current) {
        stopConfettiRef.current?.();
        stopConfettiRef.current = runConfetti(canvasRef.current);
      }

      window.setTimeout(() => startFly(payload), 1600);
    }

    window.addEventListener("intake-booking-celebrate", onCelebrate);
    return () => {
      window.removeEventListener("intake-booking-celebrate", onCelebrate);
      stopConfettiRef.current?.();
    };
  }, [startFly]);

  if (phase === "idle" || !detail) return null;

  const earned = detail.pointsEarned ?? GAMIFICATION_POINTS.intake_scheduled;

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
              Intro booked
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