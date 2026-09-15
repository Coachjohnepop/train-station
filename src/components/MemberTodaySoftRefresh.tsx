"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

const ARM_PX = 56;
const MAX_PX = 88;
const RESIST = 0.42;

function scrollTop() {
  return document.scrollingElement?.scrollTop ?? window.scrollY;
}

function isInteractive(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(target.closest("a, button, input, textarea, select, [role='button']"))
  );
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
    }
  }, [router, setPhaseBoth, userId, viewDate]);

  useEffect(() => {
    function onDown(e: PointerEvent) {
      if (phaseRef.current === "refresh") return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (isInteractive(e.target)) return;
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
        pulling.current = false;
        pullRef.current = 0;
        setPull(0);
        setPhaseBoth("idle");
        return;
      }
      pulling.current = true;
      const dist = Math.min(MAX_PX, dy * RESIST);
      pullRef.current = dist;
      setPull(dist);
      setPhaseBoth(dist >= ARM_PX ? "armed" : "pull");
      if (e.cancelable) e.preventDefault();
    }

    function onUp() {
      const wasPulling = pulling.current;
      const dist = pullRef.current;
      start.current = null;
      pulling.current = false;
      if (!wasPulling || phaseRef.current === "refresh") {
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

    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
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
