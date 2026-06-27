"use client";

import { useEffect, useRef, useState } from "react";
import {
  buildCalendlyEmbedUrl,
  isCalendlyScheduledMessage,
  loadCalendlyWidgetScript,
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
  const containerRef = useRef<HTMLDivElement>(null);
  const onScheduledRef = useRef(onScheduled);
  const onCloseRef = useRef(onClose);
  const [mounting, setMounting] = useState(false);
  const [mountError, setMountError] = useState<string | null>(null);

  useEffect(() => {
    onScheduledRef.current = onScheduled;
    onCloseRef.current = onClose;
  }, [onScheduled, onClose]);

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
    if (!open || !calendlyUrl) return;

    let destroyed = false;
    setMounting(true);
    setMountError(null);

    if (containerRef.current) {
      containerRef.current.innerHTML = "";
    }

    (async () => {
      try {
        await loadCalendlyWidgetScript();
        if (destroyed || !containerRef.current || !window.Calendly) return;

        const embedUrl = buildCalendlyEmbedUrl(calendlyUrl);
        const prefillData =
          prefill?.email || prefill?.name
            ? { email: prefill.email, name: prefill.name }
            : undefined;

        window.Calendly.initInlineWidget({
          url: embedUrl,
          parentElement: containerRef.current,
          prefill: prefillData,
        });
      } catch (e: unknown) {
        if (!destroyed) {
          setMountError(e instanceof Error ? e.message : "Could not load scheduling.");
        }
      } finally {
        if (!destroyed) setMounting(false);
      }
    })();

    return () => {
      destroyed = true;
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [open, calendlyUrl, prefill?.email, prefill?.name]);

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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/70 p-2 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="calendly-modal-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(88vh,720px)] w-full max-w-[min(100%,28rem)] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl sm:max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-3 py-2.5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Scheduling</p>
            <h2 id="calendly-modal-title" className="text-sm font-semibold">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-sm text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-white"
            aria-label="Close scheduling"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-3">
          {mounting && (
            <p className="py-8 text-center text-xs text-[var(--muted)]">Loading calendar…</p>
          )}
          {mountError && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              {mountError}
            </p>
          )}
          <div ref={containerRef} className="min-h-[420px] sm:min-h-[520px]" />
        </div>
      </div>
    </div>
  );
}