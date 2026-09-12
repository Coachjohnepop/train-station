"use client";

import { useRef, useState } from "react";

export default function LandingAbClip({
  src,
  poster,
  title,
  analyticsAction,
}: {
  src: string;
  poster?: string | null;
  title: string;
  analyticsAction: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  async function play() {
    const el = ref.current;
    if (!el) return;
    try {
      el.muted = false;
      await el.play();
      setPlaying(true);
    } catch {
      try {
        el.muted = true;
        await el.play();
        setPlaying(true);
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-black ring-1 ring-white/20">
      <video
        ref={ref}
        className="aspect-video w-full object-cover"
        src={src}
        poster={poster || undefined}
        playsInline
        preload="metadata"
        controls={playing}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        aria-label={title}
      />
      {playing ? null : (
        <button
          type="button"
          data-analytics-action={analyticsAction}
          onClick={() => void play()}
          className="absolute inset-0 flex flex-col items-center justify-center bg-black/35 px-4 text-center"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#7c3aed] text-2xl text-white shadow-lg shadow-[#7c3aed]/40">
            ▶
          </span>
          <span className="mt-3 text-sm font-bold text-white">{title}</span>
        </button>
      )}
    </div>
  );
}
