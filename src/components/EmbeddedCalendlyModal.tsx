"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  buildCalendlyEmbedUrl,
  isCalendlyScheduledMessage,
  type CalendlyPrefill,
} from "@/lib/calendly-embed";

type Props = {
  open: boolean;
  calendlyUrl: string;
  prefill?: CalendlyPrefill;
  title?: string;
  onClose: () => void;
  onScheduled: () => void;
};

export default function EmbeddedCalendlyModal({
  open,
  calendlyUrl,
  prefill,
  title = "Book your session",
  onClose,
  onScheduled,
}: Props) {
  const onScheduledRef = useRef(onScheduled);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onScheduledRef.current = onScheduled;
    onCloseRef.current = onClose;
  }, [onScheduled, onClose]);

  const iframeSrc = useMemo(() => {
    if (!open || !calendlyUrl) return null;
    return buildCalendlyEmbedUrl(calendlyUrl, { prefill });
  }, [open, calendlyUrl, prefill?.email, prefill?.name]);

  useEffect(() => {
    if (!open) return;

    function handleMessage(event: MessageEvent) {
      if (!event.origin.endsWith("calendly.com")) return;
      if (!isCalendlyScheduledMessage(event.data)) return;
      onScheduledRef.current();
      onCloseRef.current();
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!open || !iframeSrc) return null;

  return (
    <div
      className="calendly-modal-overlay fixed inset-0 z-[110] flex items-stretch justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="calendly-modal-title"
      onClick={onClose}
    >
      <div
        className="calendly-modal-panel flex h-[100dvh] w-full max-w-none flex-col overflow-hidden bg-white shadow-2xl sm:h-[min(92vh,820px)] sm:max-w-[440px] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="calendly-modal-header flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--ramp-gold-light)]">
              Your next step
            </p>
            <h2 id="calendly-modal-title" className="text-base font-semibold text-[var(--text)]">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2.5 py-1 text-lg leading-none text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-white"
            aria-label="Close scheduling"
          >
            ✕
          </button>
        </div>

        <div className="calendly-modal-frame min-h-0 flex-1 bg-white">
          <iframe
            key={iframeSrc}
            src={iframeSrc}
            title={title}
            className="calendly-modal-iframe h-full w-full border-0"
            allow="fullscreen"
          />
        </div>
      </div>
    </div>
  );
}