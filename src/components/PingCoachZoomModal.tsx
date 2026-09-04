"use client";

import { useEffect, useId, useRef, useState } from "react";

export const ZOOM_READY_PING_MESSAGE = "Coach, Members are ready";

export default function PingCoachZoomModal({
  open,
  sessionDate,
  onClose,
}: {
  open: boolean;
  sessionDate?: string;
  onClose: () => void;
}) {
  const titleId = useId();
  const sendRef = useRef<HTMLButtonElement>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSending(false);
      setError(null);
      return;
    }
    const t = window.setTimeout(() => sendRef.current?.focus(), 30);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !sending) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, sending, onClose]);

  if (!open) return null;

  async function send() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/member/live-zoom/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionDate: sessionDate || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not ping coach.");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not ping coach.");
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/65"
        aria-label="Cancel ping"
        disabled={sending}
        onClick={() => {
          if (!sending) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-[81] w-full max-w-sm rounded-2xl border border-sky-500/40 bg-[var(--surface)] p-5 shadow-2xl"
      >
        <p id={titleId} className="text-base font-semibold text-sky-100">
          Ping coach to start Zoom
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          This stays on Today. Send the note below — then you&apos;re back on your workout.
        </p>
        <p className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3 text-sm font-medium text-[var(--text)]">
          {ZOOM_READY_PING_MESSAGE}
        </p>
        {error ? (
          <p className="mt-2 text-xs text-[var(--danger)]" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="btn-ghost flex-1 py-2.5 text-sm"
            disabled={sending}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            ref={sendRef}
            type="button"
            className="btn-primary flex-1 py-2.5 text-sm font-bold"
            disabled={sending}
            onClick={() => void send()}
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
