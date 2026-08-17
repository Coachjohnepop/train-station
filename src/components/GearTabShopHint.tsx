"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Onboarding home-equipment step: arrow pointing up at the Gear nav tab
 * so members see they can shop gear on-site too.
 */
export default function GearTabShopHint() {
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null);

  const place = useCallback(() => {
    const el = document.getElementById("member-nav-gear");
    if (!el) {
      setAnchor(null);
      return;
    }
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) {
      setAnchor(null);
      return;
    }
    setAnchor({
      left: r.left + r.width / 2,
      top: r.bottom + 4,
    });
    el.classList.add("member-nav-gear--hint");
  }, []);

  useEffect(() => {
    place();
    const gear = document.getElementById("member-nav-gear");
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    const ro =
      typeof ResizeObserver !== "undefined" && gear
        ? new ResizeObserver(() => place())
        : null;
    if (gear && ro) ro.observe(gear);

    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      ro?.disconnect();
      document.getElementById("member-nav-gear")?.classList.remove("member-nav-gear--hint");
    };
  }, [place]);

  if (!anchor) return null;

  return (
    <div
      className="pointer-events-none fixed z-[60] flex max-w-[min(16rem,calc(100vw-1.5rem))] -translate-x-1/2 flex-col items-center"
      style={{ left: anchor.left, top: anchor.top }}
      role="note"
    >
      {/* Arrow tip points up at Gear tab */}
      <div
        className="gear-tab-shop-hint__arrow h-0 w-0 border-x-[7px] border-b-[9px] border-x-transparent border-b-[#7c3aed]"
        aria-hidden
      />
      <div className="gear-tab-shop-hint__bubble rounded-lg bg-[#7c3aed] px-2.5 py-1.5 text-center shadow-lg shadow-[#7c3aed]/40 ring-1 ring-white/15">
        <p className="text-sm font-semibold leading-snug text-white">
          Shop gear here too
        </p>
        <p className="mt-0.5 text-xs leading-snug text-white/85">
          Tap <span className="font-bold">Gear</span> anytime to browse &amp; buy on this site
        </p>
      </div>
    </div>
  );
}
