"use client";

import { useCallback, useEffect, useId, useState } from "react";
import PlayableVideoFrame from "@/components/PlayableVideoFrame";
import { useUploadedContentVolumeDb } from "@/hooks/useUploadedContentVolumeDb";

/** localStorage — first visit to Gear auto-opens Jeremy’s intro once. */
export const EQUIPMENT_INTRO_SEEN_KEY = "ts-equipment-intro-seen";

type Props = {
  /** When null, component renders nothing (intro not configured). */
  videoUrl: string | null;
  /** Force open (e.g. “Watch again” on the Gear page). */
  forceOpen?: boolean;
  onForceOpenHandled?: () => void;
};

export default function EquipmentIntroModal({
  videoUrl,
  forceOpen = false,
  onForceOpenHandled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const titleId = useId();
  const url = videoUrl?.trim() || "";
  const volumeDb = useUploadedContentVolumeDb();

  const markSeen = useCallback(() => {
    try {
      localStorage.setItem(EQUIPMENT_INTRO_SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const close = useCallback(() => {
    markSeen();
    setOpen(false);
    onForceOpenHandled?.();
  }, [markSeen, onForceOpenHandled]);

  // First visit: open once when coach has assigned a video.
  useEffect(() => {
    if (!url) {
      setReady(true);
      return;
    }
    try {
      const seen = localStorage.getItem(EQUIPMENT_INTRO_SEEN_KEY) === "1";
      if (!seen) setOpen(true);
    } catch {
      setOpen(true);
    }
    setReady(true);
  }, [url]);

  // Explicit “Watch again”.
  useEffect(() => {
    if (forceOpen && url) {
      setOpen(true);
    }
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

  if (!url || !ready) return null;
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#7c3aed]/40 bg-[var(--surface)] shadow-2xl">
        <div className="border-b border-[var(--border)] px-4 py-3 sm:px-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a78bfa]">
            From Coach Jeremy
          </p>
          <h2 id={titleId} className="mt-1 text-lg font-semibold text-[var(--text)]">
            Welcome to Gear
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            What this tab is for — and how to think about building a smart home gym before you buy.
          </p>
        </div>

        <div className="aspect-video w-full bg-black">
          <PlayableVideoFrame
            className="h-full w-full"
            videoUrl={url}
            title="Gear intro — home gym buying guide"
            autoplay
            kickPlayback={open}
            duckBackgroundMusic={open}
            volumeDb={volumeDb}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
          <p className="text-[11px] text-[var(--muted)]">
            You can re-watch anytime from this page.
          </p>
          <button type="button" className="btn-primary px-5 py-2 text-sm font-semibold" onClick={close}>
            Got it — show Gear
          </button>
        </div>
      </div>
    </div>
  );
}

/** Small “Watch coach intro” control for the Gear header. */
export function EquipmentIntroWatchAgainButton({
  hasVideo,
  onClick,
}: {
  hasVideo: boolean;
  onClick: () => void;
}) {
  if (!hasVideo) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs font-semibold text-accent hover:underline"
    >
      ▶ Watch coach intro again
    </button>
  );
}
