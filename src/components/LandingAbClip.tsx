"use client";

import { useEffect, useRef, useState } from "react";
import { warmUrl } from "@/lib/warm-media";

type Phase = "idle" | "intro" | "ready" | "part2";

export default function LandingAbClip({
  src,
  readySrc,
  poster,
  title,
  analyticsAction,
}: {
  src: string;
  /** If set, first clip stops and a READY button plays this second clip. */
  readySrc?: string | null;
  poster?: string | null;
  title: string;
  analyticsAction: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [clip, setClip] = useState(src);

  useEffect(() => {
    warmUrl(src, "video");
    if (readySrc) warmUrl(readySrc, "video");
  }, [src, readySrc]);

  async function playFrom(url: string, next: Phase) {
    const el = ref.current;
    if (!el) return;
    if (el.getAttribute("src") !== url) {
      el.src = url;
      el.load();
    }
    setClip(url);
    setPhase(next);
    try {
      el.muted = false;
      await el.play();
    } catch {
      try {
        el.muted = true;
        await el.play();
      } catch {
        /* ignore */
      }
    }
  }

  const showPoster = phase === "idle";
  const showReady = phase === "ready";
  const showControls = phase === "intro" || phase === "part2";

  return (
    <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-black ring-1 ring-white/20">
      <video
        ref={ref}
        className="aspect-video w-full object-cover"
        src={clip}
        poster={poster || undefined}
        playsInline
        preload="auto"
        controls={showControls}
        onPlay={() => {
          setPhase((p) => (p === "idle" ? "intro" : p));
        }}
        onEnded={() => {
          const current = ref.current?.currentSrc || ref.current?.getAttribute("src") || "";
          if (readySrc && !current.includes("jeremy-welcome-ready")) setPhase("ready");
          else setPhase("idle");
        }}
        aria-label={title}
      />
      {showPoster ? (
        <button
          type="button"
          data-analytics-action={analyticsAction}
          onClick={() => void playFrom(src, "intro")}
          className="absolute inset-0 flex flex-col items-center justify-center bg-black/35 px-4 text-center"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#7c3aed] text-2xl text-white shadow-lg shadow-[#7c3aed]/40">
            ▶
          </span>
          <span className="mt-3 text-sm font-bold text-white">{title}</span>
        </button>
      ) : null}
      {showReady && readySrc ? (
        <button
          type="button"
          data-analytics-action="hero-meet-jeremy-ready"
          onClick={() => void playFrom(readySrc, "part2")}
          className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 px-4 text-center"
        >
          <span className="inline-flex min-h-14 min-w-[10rem] items-center justify-center rounded-full bg-[#7c3aed] px-10 text-xl font-extrabold tracking-wide text-white shadow-lg shadow-[#7c3aed]/40">
            READY
          </span>
        </button>
      ) : null}
    </div>
  );
}
