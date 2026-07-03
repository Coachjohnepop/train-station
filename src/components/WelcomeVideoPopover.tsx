"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import YoutubeAutoplayFrame from "@/components/YoutubeAutoplayFrame";

export default function WelcomeVideoPopover({
  children,
  className = "",
  welcomeVideoUrl = null,
}: {
  children: React.ReactNode;
  className?: string;
  welcomeVideoUrl?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const titleId = useId();
  useEffect(() => {
    setIsTouch(window.matchMedia("(hover: none)").matches);
  }, []);

  const show = useCallback(() => setOpen(true), []);
  const hide = useCallback(() => setOpen(false), []);

  const videoBody = welcomeVideoUrl?.trim() ? (
    <div className="aspect-video overflow-hidden rounded-xl bg-black">
      <YoutubeAutoplayFrame
        className="h-full w-full"
        videoUrl={welcomeVideoUrl}
        title="Welcome video"
        autoplay
        kickPlayback={open}
      />
    </div>
  ) : (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center text-xs text-white/70">
      <p>Welcome video not set yet.</p>
      <p className="mt-2">
        Coach: add your YouTube link in{" "}
        <Link href="/admin/landing" className="text-[#c4b5fd] underline">
          Admin → Landing videos
        </Link>
        .
      </p>
    </div>
  );

  return (
    <>
      <span
        className={`relative inline-block ${className}`}
        onMouseEnter={() => !isTouch && show()}
        onMouseLeave={() => !isTouch && hide()}
      >
        <button
          type="button"
          className="inline-flex h-14 items-center justify-center rounded-full bg-[#7c3aed] px-10 text-sm font-bold text-white shadow-lg shadow-[#7c3aed]/30 transition-all hover:bg-[#6d2dd6] hover:scale-[1.05] active:scale-[0.98]"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          {children}
        </button>

        {open && !isTouch && (
          <div
            role="dialog"
            aria-labelledby={titleId}
            className="absolute left-1/2 top-full z-50 mt-3 w-[min(92vw,320px)] -translate-x-1/2 rounded-2xl border border-white/20 bg-black/95 p-3 shadow-2xl backdrop-blur-md"
          >
            <p id={titleId} className="mb-2 text-center text-xs font-semibold tracking-wide text-white/90">
              Welcome to The Train Station
            </p>
            {videoBody}
            <p className="mt-2 text-center text-[10px] text-white/50">Hover away to close · tap Enter on mobile</p>
          </div>
        )}
      </span>

      {open && isTouch && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={hide}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0a0612] p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <p id={titleId} className="text-sm font-semibold text-white">
                Welcome — quick intro
              </p>
              <button
                type="button"
                onClick={hide}
                className="rounded-full px-2 py-1 text-xs text-white/60 hover:text-white"
              >
                Close
              </button>
            </div>
            {videoBody}
          </div>
        </div>
      )}
    </>
  );
}