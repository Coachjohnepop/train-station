"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Coach finger on the next open set so members log it — rest timer only starts on checkoff.
 */
export default function SetLogFingerHint({ hidden }: { hidden?: boolean }) {
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null);

  const place = useCallback(() => {
    if (hidden) {
      setAnchor(null);
      return;
    }
    const root = document.getElementById("member-workout-console");
    const target =
      (root?.querySelector('[data-set-log-next="1"]') as HTMLElement | null) ||
      (root?.querySelector('[data-set-log-btn]:not([aria-pressed="true"])') as HTMLElement | null);
    if (!target) {
      setAnchor(null);
      return;
    }
    const r = target.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) {
      setAnchor(null);
      return;
    }
    setAnchor({ left: r.left + r.width / 2, top: r.top });
  }, [hidden]);

  useEffect(() => {
    place();
    const root = document.getElementById("member-workout-console");
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    const mo =
      root && typeof MutationObserver !== "undefined"
        ? new MutationObserver(() => place())
        : null;
    if (root && mo) {
      mo.observe(root, {
        attributes: true,
        subtree: true,
        attributeFilter: ["aria-pressed", "data-set-log-next"],
      });
    }
    const ro =
      root && typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => place()) : null;
    if (root && ro) ro.observe(root);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      mo?.disconnect();
      ro?.disconnect();
    };
  }, [place]);

  if (hidden || !anchor) return null;

  return (
    <div
      className="pointer-events-none fixed z-[60] flex -translate-x-1/2 -translate-y-full flex-col items-center"
      style={{ left: anchor.left, top: anchor.top - 4 }}
      role="note"
      aria-label="Log this set so the rest timer starts"
    >
      <div className="mb-0.5 rounded-full bg-[#7c3aed] px-2 py-0.5 text-center shadow-lg shadow-[#7c3aed]/35 ring-1 ring-white/20">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-white">
          Log this set
        </p>
        <p className="text-[9px] font-semibold leading-tight text-white/90">
          Rest timer starts · stay on task
        </p>
      </div>
      <span className="set-log-finger text-[2.6rem] leading-none drop-shadow-[0_8px_16px_rgba(0,0,0,0.45)]" aria-hidden>
        {"\u{1F447}\u{1F3FD}"}
      </span>
    </div>
  );
}
