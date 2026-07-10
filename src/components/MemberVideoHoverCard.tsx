"use client";

import { useCallback, useEffect, useId, useState } from "react";
import YoutubeAutoplayFrame from "@/components/YoutubeAutoplayFrame";

export default function MemberVideoHoverCard({
  title,
  subtitle,
  videoUrl,
  className = "",
}: {
  title: string;
  subtitle?: string;
  videoUrl: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const titleId = useId();

  useEffect(() => {
    setIsTouch(window.matchMedia("(hover: none)").matches);
  }, []);

  const show = useCallback(() => setOpen(true), []);
  const hide = useCallback(() => setOpen(false), []);

  const videoBody = (
    <div className="aspect-video overflow-hidden rounded-xl bg-black">
      <YoutubeAutoplayFrame
        className="h-full w-full"
        videoUrl={videoUrl}
        title={title}
        autoplay
        kickPlayback={open}
        duckBackgroundMusic={open}
      />
    </div>
  );

  return (
    <>
      <div
        className={`relative ${className}`}
        onMouseEnter={() => !isTouch && show()}
        onMouseLeave={() => !isTouch && hide()}
      >
        <button
          type="button"
          className="card flex w-full items-center justify-between gap-3 p-4 text-left transition hover:border-[var(--accent)]/50"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
              Coach video
            </p>
            <p className="mt-1 text-sm font-semibold">{title}</p>
            {subtitle ? <p className="mt-1 text-xs text-[var(--muted)]">{subtitle}</p> : null}
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs text-accent hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              YouTube link →
            </a>
          </div>
          <span className="shrink-0 text-xs font-semibold text-[var(--accent)]">
            {isTouch ? (open ? "Close" : "Play") : "Hover to play"}
          </span>
        </button>

        {open && !isTouch && (
          <div
            role="dialog"
            aria-labelledby={titleId}
            className="absolute left-0 right-0 top-full z-50 mt-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-2xl"
          >
            <p id={titleId} className="mb-2 text-xs font-semibold text-[var(--text)]">
              {title}
            </p>
            {videoBody}
          </div>
        )}
      </div>

      {open && isTouch && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={hide}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <p id={titleId} className="text-sm font-semibold">
                {title}
              </p>
              <button type="button" onClick={hide} className="text-xs text-[var(--muted)]">
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