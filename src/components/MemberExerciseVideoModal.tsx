"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { isYoutubeUrl, youtubeEmbedUrl } from "@/lib/youtube";

type Props = {
  exerciseName: string;
  videoUrl: string;
  onClose: () => void;
};

export default function MemberExerciseVideoModal({
  exerciseName,
  videoUrl,
  onClose,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const embedSrc = isYoutubeUrl(videoUrl) ? youtubeEmbedUrl(videoUrl) : null;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [mounted, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="member-video-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="member-video-modal-title"
    >
      <button
        type="button"
        className="member-video-modal__backdrop"
        aria-label="Close video"
        onClick={onClose}
      />
      <div className="member-video-modal__panel">
        <div className="member-video-modal__header">
          <h2 id="member-video-modal-title" className="text-base font-semibold">
            {exerciseName} — demo
          </h2>
          <button
            type="button"
            className="member-video-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {embedSrc ? (
          <div className="member-video-modal__player">
            <iframe
              title={`${exerciseName} demo video`}
              src={embedSrc}
              width="100%"
              height="100%"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        ) : (
          <div className="space-y-3 px-4 py-6 text-center">
            <p className="text-sm text-[var(--muted)]">
              This demo cannot play inside the workout view.
            </p>
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-block text-sm"
            >
              Open video
            </a>
          </div>
        )}

        <p className="member-video-modal__hint text-xs text-[var(--muted)]">
          Stays on your workout — close when you&apos;re ready to train.
        </p>
      </div>
    </div>,
    document.body,
  );
}