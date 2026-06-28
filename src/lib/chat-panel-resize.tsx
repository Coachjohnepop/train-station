"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useStoredPanelSize(
  storageKey: string,
  defaultSize: number,
  min: number,
  max: number,
) {
  const [size, setSize] = useState(defaultSize);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const n = Number.parseFloat(raw);
      if (Number.isFinite(n)) setSize(Math.min(max, Math.max(min, n)));
    } catch {
      /* ignore private browsing */
    }
  }, [storageKey, min, max]);

  const setStoredSize = useCallback(
    (next: number | ((prev: number) => number)) => {
      setSize((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        const clamped = Math.min(max, Math.max(min, resolved));
        try {
          localStorage.setItem(storageKey, String(Math.round(clamped)));
        } catch {
          /* ignore */
        }
        return clamped;
      });
    },
    [storageKey, min, max],
  );

  return { size, setSize: setStoredSize };
}

/** True at lg breakpoint (1024px+) — resize handles only apply on desktop web. */
export function useDesktopChatLayout() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isDesktop;
}

type ChatResizeDividerProps = {
  direction: "column" | "row";
  onDelta: (delta: number) => void;
  className?: string;
  label?: string;
};

export function ChatResizeDivider({
  direction,
  onDelta,
  className = "",
  label = "Resize panel",
}: ChatResizeDividerProps) {
  const dragging = useRef(false);
  const lastPos = useRef(0);

  function endDrag() {
    dragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    dragging.current = true;
    lastPos.current = direction === "column" ? e.clientX : e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.style.cursor = direction === "column" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    const pos = direction === "column" ? e.clientX : e.clientY;
    const delta = pos - lastPos.current;
    if (delta !== 0) {
      lastPos.current = pos;
      onDelta(delta);
    }
  }

  return (
    <div
      role="separator"
      aria-orientation={direction === "column" ? "vertical" : "horizontal"}
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={`chat-resize-divider chat-resize-divider--${direction} ${className}`.trim()}
    />
  );
}