"use client";

import { useEffect } from "react";

/**
 * iOS Safari / standalone PWA treat a downward flick at scroll-top as
 * pull-to-refresh and reload the page — that wipes in-progress set checkoffs.
 */
export default function DisablePullToRefresh() {
  useEffect(() => {
    let startY = 0;

    function onTouchStart(e: TouchEvent) {
      startY = e.touches[0]?.clientY ?? 0;
    }

    function onTouchMove(e: TouchEvent) {
      if (!e.cancelable) return;
      const y = e.touches[0]?.clientY ?? 0;
      const el = document.scrollingElement;
      const atTop = (el?.scrollTop ?? window.scrollY) <= 0;
      if (atTop && y > startY) e.preventDefault();
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  return null;
}
