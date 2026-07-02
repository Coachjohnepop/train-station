"use client";

import { useState } from "react";
import type { CoachDayTimelineItem } from "@/lib/coach-day";

export default function CoachLiveZoomStrip({ items }: { items: CoachDayTimelineItem[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [zoomById, setZoomById] = useState<Record<string, { joinUrl: string; hostUrl: string }>>(
    () => {
      const initial: Record<string, { joinUrl: string; hostUrl: string }> = {};
      for (const item of items) {
        if (item.zoomUrl && item.zoomHostUrl) {
          initial[item.id] = { joinUrl: item.zoomUrl, hostUrl: item.zoomHostUrl };
        }
      }
      return initial;
    },
  );

  async function createZoom(id: string) {
    setBusyId(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/bookings/${id}/zoom`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Could not create Zoom link.");
        return;
      }
      setZoomById((prev) => ({
        ...prev,
        [id]: { joinUrl: data.zoom.joinUrl, hostUrl: data.zoom.hostUrl },
      }));
      setMessage(data.demo ? "Demo Zoom link created (add Zoom API keys for real meetings)." : "Zoom link ready.");
      setTimeout(() => setMessage(null), 4000);
    } catch {
      setMessage("Could not create Zoom link.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-sky-500/35 bg-sky-500/8 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-sky-200">Live Zoom sessions today</p>
          <p className="text-xs text-[var(--muted)]">Start the room for members — they join from Live on their phone.</p>
        </div>
        {message ? <p className="text-xs text-[var(--success)]">{message}</p> : null}
      </div>
      <div className="mt-3 space-y-2">
        {items.map((item) => {
          const zoom = zoomById[item.id];
          return (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {item.timeLabel} · {item.memberNames.join(", ")}
                </p>
                <p className="text-xs text-[var(--muted)]">{item.title}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {zoom?.hostUrl ? (
                  <a
                    href={zoom.hostUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary px-3 py-1 text-xs"
                  >
                    Start Zoom
                  </a>
                ) : (
                  <button
                    type="button"
                    className="btn-primary px-3 py-1 text-xs"
                    disabled={busyId === item.id}
                    onClick={() => void createZoom(item.id)}
                  >
                    {busyId === item.id ? "Creating…" : "Create Zoom link"}
                  </button>
                )}
                {zoom?.joinUrl ? (
                  <button
                    type="button"
                    className="btn-ghost px-3 py-1 text-xs"
                    onClick={() => void navigator.clipboard.writeText(zoom.joinUrl)}
                  >
                    Copy member link
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}