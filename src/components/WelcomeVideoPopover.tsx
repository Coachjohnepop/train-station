"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import PlayableVideoFrame from "@/components/PlayableVideoFrame";
import { useUploadedContentVolumeDb } from "@/hooks/useUploadedContentVolumeDb";

const DEFAULT_TRIGGER =
  "inline-flex h-14 items-center justify-center rounded-full bg-[#7c3aed] px-10 text-sm font-bold text-white shadow-lg shadow-[#7c3aed]/30 transition-all hover:bg-[#6d2dd6] hover:scale-[1.05] active:scale-[0.98]";

/**
 * “Watch intro” — always opens a large, near-fullscreen player (desktop + mobile).
 * No tiny hover card; click/tap only.
 */
export default function WelcomeVideoPopover({
  children,
  className = "",
  buttonClassName,
  welcomeVideoUrl = null,
}: {
  children: React.ReactNode;
  className?: string;
  /** Styles the trigger button (defaults to large purple pill). */
  buttonClassName?: string;
  welcomeVideoUrl?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const volumeDb = useUploadedContentVolumeDb();

  useEffect(() => {
    setMounted(true);
  }, []);

  const show = useCallback(() => setOpen(true), []);
  const hide = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, hide]);

  const videoBody = welcomeVideoUrl?.trim() ? (
    <div className="aspect-video w-full overflow-hidden rounded-xl bg-black sm:rounded-2xl">
      <PlayableVideoFrame
        className="h-full w-full"
        videoUrl={welcomeVideoUrl}
        title="Welcome video"
        autoplay
        kickPlayback={open}
        duckBackgroundMusic={open}
        volumeDb={volumeDb}
      />
    </div>
  ) : (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/70">
      <p>Welcome video not set yet.</p>
      <p className="mt-2 text-xs">
        Coach: upload your intro under{" "}
        <Link href="/admin/videos" className="text-[#c4b5fd] underline">
          Admin → Videos
        </Link>
        .
      </p>
    </div>
  );

  const modal =
    open && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/88 p-3 backdrop-blur-md sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={hide}
          >
            <div
              className="flex w-full max-w-[min(96vw,56rem)] flex-col rounded-2xl border border-white/15 bg-[#0a0612] p-3 shadow-2xl sm:p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-2 flex items-center justify-between gap-3 sm:mb-3">
                <p id={titleId} className="text-sm font-semibold text-white sm:text-base">
                  Welcome — a word from Coach Jeremy
                </p>
                <button
                  type="button"
                  onClick={hide}
                  className="shrink-0 rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white"
                >
                  Close
                </button>
              </div>
              {videoBody}
              <p className="mt-2 text-center text-[11px] text-white/45 sm:mt-3">
                Esc or tap outside to close
              </p>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <span className={`relative inline-block ${className}`}>
        <button
          type="button"
          className={buttonClassName || DEFAULT_TRIGGER}
          onClick={show}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          {children}
        </button>
      </span>
      {modal}
    </>
  );
}
