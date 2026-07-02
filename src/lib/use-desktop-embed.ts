"use client";

import { useEffect, useState } from "react";

export const DESKTOP_EMBED_MQ = "(min-width: 768px)";

export function isDesktopEmbedViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(DESKTOP_EMBED_MQ).matches;
}

/** Desktop-wide enough for inline Zoom embed (matches Tailwind md). */
export function useDesktopEmbed() {
  const [desktop, setDesktop] = useState(isDesktopEmbedViewport);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_EMBED_MQ);
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return desktop;
}