"use client";

import { useCallback, useEffect, useId, useState } from "react";
import PlayableVideoFrame from "@/components/PlayableVideoFrame";
import { useUploadedContentVolumeDb } from "@/hooks/useUploadedContentVolumeDb";

/**
 * Full-screen how-to — only when the member asks (Watch again / Expand).
 * No auto-open, no autoplay (tap play in the player).
 */
export const MEASUREMENTS_INTRO_SEEN_KEY = "ts-measurements-intro-seen";

type Props = {
  videoUrl: string | null;
  forceOpen?: boolean;
  onForceOpenHandled?: () => void;
};

export default function MeasurementsIntroModal({
  videoUrl,
  forceOpen = false,
  onForceOpenHandled,
}: Props) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const url = videoUrl?.trim() || "";
  const volumeDb = useUploadedContentVolumeDb();

  const close = useCallback(() => {
    try {
      localStorage.setItem(MEASUREMENTS_INTRO_SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
    onForceOpenHandled?.();
  }, [onForceOpenHandled]);

  // Open only on explicit "Watch again" / Expand — never auto-popup on page load
  useEffect(() => {
    if (forceOpen && url) setOpen(true);
  }, [forceOpen, url]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  if (!url || !open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-3 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={close}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-[var(--text)]">
              How to take your measurements
            </h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Tap play when you&apos;re ready — then log your check-in below.
            </p>
          </div>
          <button type="button" className="btn-ghost text-xs" onClick={close}>
            Close
          </button>
        </div>
        <div className="bg-black">
          <PlayableVideoFrame
            className="aspect-video w-full"
            videoUrl={url}
            title="How to take measurements"
            volumeDb={volumeDb}
            autoplay={false}
            duckBackgroundMusic
          />
        </div>
        <div className="flex justify-end gap-2 px-4 py-3">
          <button type="button" className="btn-primary px-4 py-2 text-sm font-semibold" onClick={close}>
            Got it — log measurements
          </button>
        </div>
      </div>
    </div>
  );
}

export function MeasurementsIntroWatchAgainButton({
  hasVideo,
  onClick,
}: {
  hasVideo: boolean;
  onClick: () => void;
}) {
  if (!hasVideo) return null;
  return (
    <button type="button" className="btn-ghost text-xs font-semibold" onClick={onClick}>
      Watch how-to video
    </button>
  );
}
