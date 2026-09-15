"use client";

import { useCallback, useRef, useState, type ReactNode, type TouchEvent } from "react";
import { useRouter } from "next/navigation";

const ARM_PX = 56;
const MAX_PX = 88;
const RESIST = 0.42;

function scrollTop() {
  return document.scrollingElement?.scrollTop ?? window.scrollY;
}

export default function MemberTodaySoftRefresh({
  userId,
  viewDate,
  children,
}: {
  userId: string;
  viewDate: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const start = useRef<{ x: number; y: number; atTop: boolean } | null>(null);
  const pulling = useRef(false);
  const pullRef = useRef(0);
  const [pull, setPull] = useState(0);
  const [phase, setPhase] = useState<"idle" | "pull" | "armed" | "refresh">("idle");

  const runRefresh = useCallback(async () => {
    setPhase("refresh");
    setPull(ARM_PX);
    try {
      const q = new URLSearchParams({ userId, date: viewDate });
      await fetch(`/api/today?${q.toString()}`, { cache: "no-store" });
      router.refresh();
      await new Promise((r) => setTimeout(r, 450));
    } catch {
      /* still snap back */
    } finally {
      setPhase("idle");
      setPull(0);
    }
  }, [router, userId, viewDate]);

  const onTouchStart = useCallback((e: TouchEvent) => {
    if (phase === "refresh") return;
    const t = e.changedTouches[0] || e.touches[0];
    if (!t) return;
    start.current = { x: t.clientX, y: t.clientY, atTop: scrollTop() <= 2 };
    pulling.current = false;
  }, [phase]);

  const onTouchMove = useCallback((e: TouchEvent) => {
    const origin = start.current;
    if (!origin || phase === "refresh") return;
    const t = e.touches[0];
    if (!t) return;
    const dy = t.clientY - origin.y;
    const dx = t.clientX - origin.x;
    if (!origin.atTop || dy < 10 || Math.abs(dx) > dy) {
      if (!pulling.current) return;
      setPull(0);
      setPhase("idle");
      pulling.current = false;
      return;
    }
    pulling.current = true;
    const dist = Math.min(MAX_PX, dy * RESIST);
    pullRef.current = dist;
    setPull(dist);
    setPhase(dist >= ARM_PX ? "armed" : "pull");
  }, [phase]);

  const onTouchEnd = useCallback(() => {
    const wasPulling = pulling.current;
    const dist = pullRef.current;
    start.current = null;
    pulling.current = false;
    pullRef.current = 0;
    if (!wasPulling || phase === "refresh") return;
    if (dist >= ARM_PX) {
      void runRefresh();
      return;
    }
    setPhase("idle");
    setPull(0);
  }, [phase, runRefresh]);

  const label =
    phase === "refresh"
      ? "Updating…"
      : phase === "armed"
        ? "Release to update"
        : "Pull to update";

  return (
    <div
      data-soft-refresh=""
      className="space-y-4"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div
        className="flex items-center justify-center overflow-hidden text-[11px] font-semibold tracking-wide text-[var(--ramp-gold-light)]"
        style={{
          height: pull,
          opacity: pull > 8 ? 1 : 0,
          transition: phase === "refresh" || phase === "idle" ? "height 160ms ease, opacity 160ms ease" : undefined,
        }}
        aria-live="polite"
      >
        <span className={phase === "refresh" ? "animate-pulse" : undefined}>{label}</span>
      </div>
      {children}
    </div>
  );
}
