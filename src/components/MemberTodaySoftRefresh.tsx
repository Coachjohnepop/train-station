"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
  const wheelSettle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef<"idle" | "pull" | "armed" | "refresh">("idle");
  const [pull, setPull] = useState(0);
  const [phase, setPhase] = useState<"idle" | "pull" | "armed" | "refresh">("idle");

  const setPhaseBoth = useCallback((next: typeof phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const runRefresh = useCallback(async () => {
    setPhaseBoth("refresh");
    setPull(ARM_PX);
    try {
      const q = new URLSearchParams({ userId, date: viewDate });
      await fetch(`/api/today?${q.toString()}`, { cache: "no-store" });
      router.refresh();
      await new Promise((r) => setTimeout(r, 450));
    } catch {
      /* still snap back */
    } finally {
      setPhaseBoth("idle");
      setPull(0);
      pullRef.current = 0;
      pulling.current = false;
    }
  }, [router, setPhaseBoth, userId, viewDate]);

  useEffect(() => {
    function applyPull(dist: number) {
      pulling.current = dist > 0;
      pullRef.current = dist;
      setPull(dist);
      setPhaseBoth(dist >= ARM_PX ? "armed" : dist > 0 ? "pull" : "idle");
    }

    function finishPull() {
      const dist = pullRef.current;
      start.current = null;
      pulling.current = false;
      if (phaseRef.current === "refresh") {
        pullRef.current = 0;
        return;
      }
      if (dist >= ARM_PX) {
        void runRefresh();
        return;
      }
      pullRef.current = 0;
      setPull(0);
      setPhaseBoth("idle");
    }

    function onDown(e: PointerEvent) {
      if (phaseRef.current === "refresh") return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      start.current = { x: e.clientX, y: e.clientY, atTop: scrollTop() <= 8 };
      pulling.current = false;
    }

    function onMove(e: PointerEvent) {
      const origin = start.current;
      if (!origin || phaseRef.current === "refresh") return;
      const dy = e.clientY - origin.y;
      const dx = e.clientX - origin.x;
      if (!origin.atTop || dy < 12 || Math.abs(dx) > dy) {
        if (!pulling.current) return;
        applyPull(0);
        pulling.current = false;
        return;
      }
      const dist = Math.min(MAX_PX, dy * RESIST);
      applyPull(dist);
      if (e.cancelable) e.preventDefault();
    }

    function onWheel(e: WheelEvent) {
      if (phaseRef.current === "refresh") return;
      const atTop = scrollTop() <= 8;
      const pullingDown = e.deltaY < 0;
      if (!atTop && !pulling.current) return;
      if (!pullingDown && !pulling.current) return;
      if (!atTop && pullingDown) return;

      const next = pullingDown
        ? Math.min(MAX_PX, pullRef.current + -e.deltaY * 0.45)
        : Math.max(0, pullRef.current - e.deltaY * 0.45);
      if (next > 0 && e.cancelable) e.preventDefault();
      applyPull(next);

      if (wheelSettle.current) clearTimeout(wheelSettle.current);
      wheelSettle.current = setTimeout(() => {
        wheelSettle.current = null;
        finishPull();
      }, 140);
    }

    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", finishPull);
    window.addEventListener("pointercancel", finishPull);
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finishPull);
      window.removeEventListener("pointercancel", finishPull);
      window.removeEventListener("wheel", onWheel);
      if (wheelSettle.current) clearTimeout(wheelSettle.current);
    };
  }, [runRefresh, setPhaseBoth]);

  const label =
    phase === "refresh"
      ? "Updating…"
      : phase === "armed"
        ? "Release to update"
        : "Pull to update";

  return (
    <div data-soft-refresh="" className="space-y-4">
      <div
        className="flex items-center justify-center overflow-hidden text-[11px] font-semibold tracking-wide text-[var(--ramp-gold-light)]"
        style={{
          height: pull,
          opacity: pull > 8 ? 1 : 0,
          transition:
            phase === "refresh" || phase === "idle" ? "height 160ms ease, opacity 160ms ease" : undefined,
        }}
        aria-live="polite"
      >
        <span className={phase === "refresh" ? "animate-pulse" : undefined}>{label}</span>
      </div>
      {children}
    </div>
  );
}
